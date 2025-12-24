const express = require('express');
const router = express.Router();
const pool = require('../config/postgresql');
const jwt = require('jsonwebtoken');

// Middleware для проверки админ токена
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Получение всех заказов
router.get('/orders', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.*, u.first_name, u.telegram_id, u.phone
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получение всех пользователей
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM users 
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Создание товара
router.post('/products', authenticateToken, async (req, res) => {
  try {
    const { name, description, price, category_id, image_url, in_stock } = req.body;
    
    const result = await pool.query(`
      INSERT INTO products (name, description, price, category_id, image_url, in_stock)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [name, description, price, category_id, image_url, in_stock || true]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Обновление товара
router.put('/products/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, category_id, image_url, in_stock } = req.body;
    
    const result = await pool.query(`
      UPDATE products 
      SET name = $1, description = $2, price = $3, category_id = $4, 
          image_url = $5, in_stock = $6, updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `, [name, description, price, category_id, image_url, in_stock, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Удаление товара
router.delete('/products/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Создание категории
router.post('/categories', authenticateToken, async (req, res) => {
  try {
    const { name, description, image_url } = req.body;
    
    const result = await pool.query(`
      INSERT INTO categories (name, description, image_url)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [name, description, image_url]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Обновление статуса заказа
router.put('/orders/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const result = await pool.query(`
      UPDATE orders 
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [status, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получение статистики
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const usersCount = await pool.query('SELECT COUNT(*) as count FROM users');
    const ordersCount = await pool.query('SELECT COUNT(*) as count FROM orders');
    const productsCount = await pool.query('SELECT COUNT(*) as count FROM products');
    const revenue = await pool.query('SELECT SUM(total_amount) as total FROM orders WHERE status = "completed"');
    
    res.json({
      users: usersCount.rows[0].count,
      orders: ordersCount.rows[0].count,
      products: productsCount.rows[0].count,
      revenue: revenue.rows[0].total || 0
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
