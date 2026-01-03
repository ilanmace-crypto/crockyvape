const express = require('express');
const cors = require('cors');

// Создаем минимальное приложение для Vercel
const app = express();

// Базовый middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());

// Тестовый эндпоинт
app.get('/api/minimal-test', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Vercel serverless function working',
    timestamp: new Date().toISOString(),
    method: req.method,
    headers: {
      'user-agent': req.headers['user-agent'],
      'host': req.headers['host']
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// Экспорт для Vercel
module.exports = app;
