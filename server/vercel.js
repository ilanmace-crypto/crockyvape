const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

// Тестовые эндпоинты
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    message: 'Vercel serverless working!'
  });
});

app.get('/api/debug', (req, res) => {
  res.json({
    message: 'Debug working',
    timestamp: new Date().toISOString()
  });
});

// Простой admin login без базы данных
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === 'admin' && password === 'paradise251208') {
    res.json({
      token: 'mock-token-' + Date.now(),
      admin: {
        id: 1,
        username: 'admin',
        role: 'admin'
      }
    });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Mock products endpoint
app.get('/api/products', (req, res) => {
  res.json([
    {
      id: '1',
      name: 'Test Liquid',
      price: 25,
      stock: 10,
      category: 'liquids',
      image_url: null
    }
  ]);
});

// Mock orders endpoint
app.post('/api/orders', (req, res) => {
  res.json({
    id: 'order-' + Date.now(),
    status: 'created',
    message: 'Order created (mock)'
  });
});

module.exports = app;
