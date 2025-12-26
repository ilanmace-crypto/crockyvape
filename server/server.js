const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Подключаем роуты
const productsRouter = require('./routes/products');

const app = express();
const PORT = process.env.PORT || 3000; // Railway использует порт 3000

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
app.use('/api/products', productsRouter);

// Debug route
app.get('/api/debug', (req, res) => {
  res.json({ 
    message: 'Debug route working',
    timestamp: new Date().toISOString(),
    routes: {
      products: 'loaded'
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Products API: http://localhost:${PORT}/api/products`);
  console.log(`Trust proxy: ${app.get('trust proxy')}`);
  console.log('Products API ready!');
});
