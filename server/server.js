const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Используем PostgreSQL если DATABASE_URL задан
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
const apiRoutes = process.env.DATABASE_URL ? 
  require('./routes/api_postgresql') : 
  null;
const adminRoutes = process.env.DATABASE_URL ? 
  require('./routes/admin_postgresql') : 
  null;

const initDatabase = process.env.DATABASE_URL ? 
  require('./config/postgresql_init').initPostgresDatabase : 
  null;

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy для Railway и других хостингов
app.set('trust proxy', 1);

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Отключаем CSP для разработки
}));
app.use(cors());
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
console.log('API Routes:', apiRoutes ? 'LOADED' : 'NOT LOADED');
console.log('Admin Routes:', adminRoutes ? 'LOADED' : 'NOT LOADED');
if (apiRoutes) app.use('/api', apiRoutes);
if (adminRoutes) app.use('/admin', adminRoutes);

// Debug route
app.get('/api/debug', (req, res) => {
  res.json({ 
    message: 'Debug route working',
    timestamp: new Date().toISOString(),
    routes: {
      api: apiRoutes ? 'loaded' : 'not loaded',
      admin: adminRoutes ? 'loaded' : 'not loaded'
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

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Trust proxy: ${app.get('trust proxy')}`);
  
  // Initialize database
  try {
    if (initDatabase) {
      await initDatabase();
      console.log('Database initialized successfully!');
    } else {
      console.log('No database configured - running without database');
    }
  } catch (error) {
    console.error('Database initialization failed:', error);
    // Don't exit, let server start anyway
  }
});
