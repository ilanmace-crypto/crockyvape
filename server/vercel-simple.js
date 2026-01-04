const express = require('express');
const cors = require('cors');
 const path = require('path');

const app = express();

 const projectRoot = path.join(__dirname, '..');

// Set CSP headers
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' 'unsafe-inline' 'unsafe-eval'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline' blob:; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https: wss: blob:; worker-src 'self' blob:; media-src 'self' blob:; manifest-src 'self';"
  );
  next();
});

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

// Serve static files from root
app.use(express.static(path.join(projectRoot, 'public')));
app.use(express.static(projectRoot));
app.use('/assets', express.static(path.join(projectRoot, 'assets')));

// Favicon handler
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Vite.svg handler
app.get('/vite.svg', (req, res) => {
  res.sendFile(path.join(projectRoot, 'vite.svg'));
});

// Root route handler - serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(projectRoot, 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    message: 'Server is running'
  });
});

// Debug endpoint
app.get('/api/debug', (req, res) => {
  res.json({
    message: 'Debug working',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
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
      category_name: 'Жидкости',
      flavors: []
    }
  ]);
});

// Mock admin login
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === 'admin' && password === 'paradise251208') {
    const token = 'token-' + Date.now() + '-' + Math.random().toString(36).substring(2);
    return res.json({
      token,
      admin: {
        id: 1,
        username: 'admin',
        role: 'admin'
      }
    });
  }

  res.status(401).json({ error: 'Invalid credentials' });
});

// Catch-all handler for React Router
app.get(/.*/, (req, res) => {
  // Don't intercept API routes
  if (req.path.startsWith('/api') || req.path.startsWith('/admin') || req.path === '/health') {
    return res.status(404).json({ error: 'Route not found' });
  }
  res.sendFile(path.join(projectRoot, 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

module.exports = app;
