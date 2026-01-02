const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
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
  contentSecurityPolicy: false, // Отключаем CSP для разработки
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use('/api/', limiter);

// Routes
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/users', usersRouter);
app.use('/api/stats', statsRouter);

// UI redirect to React admin (HashRouter)
app.get(['/admin', '/admin/'], (req, res) => {
  res.redirect('/#/admin');
});
app.use('/admin', adminRouter);

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
