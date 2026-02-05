const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const sanitizeInput = require('./middleware/sanitize');
const { detectSuspiciousActivity } = require('./middleware/security');
require('dotenv').config();

// Подключаем роуты
const productsRouter = require('./routes/products');
const ordersRouter = require('./routes/orders');
const usersRouter = require('./routes/users');
const statsRouter = require('./routes/stats');
const adminRouter = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000; // Railway использует порт 3000

// Trust proxy для Railway и других хостингов
app.set('trust proxy', 1);

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin === 'http://localhost:5173' || origin === 'http://localhost:3000' || origin === 'http://localhost:3001') {
      return callback(null, true);
    }
    if (/^https:\/\/.*\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(sanitizeInput); // Защита от XSS
app.use(detectSuspiciousActivity); // Мониторинг безопасности

// Rate limiting с правильной конфигурацией для proxy
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Пропускаем health check и debug роуты
    return req.path === '/health' || req.path === '/api/debug';
  }
});

// Отдельный лимитер для заказов (защита от спама)
const orderLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // максимум 5 заказов за 5 минут
  message: { error: 'Too many orders, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Защита от brute force атак на админку
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // максимум 10 попыток входа за 15 минут
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

// Защита от DDoS на API
const ddosLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // максимум 1000 запросов в минуту
  message: { error: 'Too many requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', ddosLimiter);
app.use('/api/', limiter);

// Временно отключаем middleware для теста
// app.use(sanitizeInput); // Защита от XSS
// app.use(detectSuspiciousActivity); // Мониторинг безопасности

// Routes
app.use('/api/products', productsRouter);
app.use('/api/orders', orderLimiter, ordersRouter);
app.use('/api/users', usersRouter);
app.use('/api/stats', statsRouter);

// UI redirect to React admin (HashRouter)
app.get(['/admin', '/admin/'], (req, res) => {
  res.redirect('/#/admin');
});
app.use('/admin', authLimiter, adminRouter);

// Debug route
app.get('/api/debug', (req, res) => {
  res.json({ 
    message: 'Debug route working',
    timestamp: new Date().toISOString(),
    routes: {
      products: 'loaded',
      orders: 'loaded',
      users: 'loaded',
      stats: 'loaded'
    },
    proxy: {
      trust: app.get('trust proxy'),
      forwarded: req.headers['x-forwarded-for'],
      remote: req.ip
    }
  });
});

// Database connection test
app.get('/api/db-test', async (req, res) => {
  try {
    const pool = require('./config/supabase');
    
    // Test basic connection
    const result = await pool.query('SELECT NOW() as current_time, version() as db_version');
    
    // Test if tables exist
    const tables = await pool.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    // Test if admins table exists and has data
    let adminsInfo = null;
    try {
      const adminsResult = await pool.query('SELECT COUNT(*) as count FROM admins');
      adminsInfo = {
        exists: true,
        count: adminsResult.rows[0].count
      };
    } catch (adminError) {
      adminsInfo = {
        exists: false,
        error: adminError.message
      };
    }
    
    // Test products table
    let productsInfo = null;
    try {
      const productsResult = await pool.query('SELECT COUNT(*) as count FROM products');
      productsInfo = {
        exists: true,
        count: productsResult.rows[0].count
      };
    } catch (productError) {
      productsInfo = {
        exists: false,
        error: productError.message
      };
    }
    
    res.json({
      status: 'connected',
      timestamp: result.rows[0].current_time,
      database: result.rows[0].db_version,
      tables: tables.rows,
      admins: adminsInfo,
      products: productsInfo,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
        DB_HOST: process.env.DB_HOST ? 'SET' : 'NOT_SET',
        DB_NAME: process.env.DB_NAME || 'NOT_SET'
      }
    });
    
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
        DB_HOST: process.env.DB_HOST ? 'SET' : 'NOT_SET',
        DB_NAME: process.env.DB_NAME || 'NOT_SET'
      }
    });
  }
});

// Health check (before rate limiting)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    proxy: {
      trust: app.get('trust proxy'),
      forwarded: req.headers['x-forwarded-for'],
      remote: req.ip
    },
    routes: {
      products: 'loaded'
    }
  });
});

// Minimal test endpoint (no dependencies)
app.get('/api/minimal-test', (req, res) => {
  try {
    res.status(200).json({
      status: 'OK',
      message: 'Minimal test working',
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      headers: {
        'user-agent': req.headers['user-agent'],
        'host': req.headers['host']
      }
    });
  } catch (error) {
    console.error('Minimal test error:', error);
    res.status(500).json({
      status: 'ERROR',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Root route для Railway
app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'PARADISE SHOP API Server',
    status: 'OK',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      products: '/api/products',
      debug: '/api/debug'
    }
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  if (err.code === 'ERR_ERL_UNEXPECTED_X_FORWARDED_FOR') {
    console.warn('Rate limit warning - X-Forwarded-For header detected');
  }
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Products API: http://localhost:${PORT}/api/products`);
    console.log(`Trust proxy: ${app.get('trust proxy')}`);
    console.log('Products API ready!');
    console.log('Server restarted at:', new Date().toISOString());
  });
}

module.exports = app;
