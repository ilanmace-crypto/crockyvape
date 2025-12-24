const express = require('express');
const router = express.Router();
const pool = require('../config/postgresql');

// Получение всех товаров
router.get('/products', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.in_stock = true
      ORDER BY p.name
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получение категорий
router.get('/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Создание/обновление пользователя Telegram
router.post('/users/telegram', async (req, res) => {
  try {
    const { telegram_id, username, first_name, last_name } = req.body;
    
    const result = await pool.query(`
      INSERT INTO users (telegram_id, username, first_name, last_name)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (telegram_id) 
      DO UPDATE SET 
        username = $2,
        first_name = $3,
        last_name = $4,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [telegram_id, username, first_name, last_name]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Создание заказа
router.post('/orders', async (req, res) => {
  try {
    const { user_id, items, delivery_address, phone } = req.body;
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Calculate total amount
      let total_amount = 0;
      for (const item of items) {
        const productResult = await client.query(
          'SELECT price FROM products WHERE id = $1',
          [item.product_id]
        );
        total_amount += parseFloat(productResult.rows[0].price) * item.quantity;
      }
      
      // Create order
      const orderResult = await client.query(`
        INSERT INTO orders (user_id, total_amount, delivery_address, phone)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [user_id, total_amount, delivery_address, phone]);
      
      const order = orderResult.rows[0];
      
      // Create order items
      for (const item of items) {
        const productResult = await client.query(
          'SELECT price FROM products WHERE id = $1',
          [item.product_id]
        );
        const price = parseFloat(productResult.rows[0].price);
        
        await client.query(`
          INSERT INTO order_items (order_id, product_id, quantity, price)
          VALUES ($1, $2, $3, $4)
        `, [order.id, item.product_id, item.quantity, price]);
      }
      
      await client.query('COMMIT');
      res.json(order);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получение отзывов
router.get('/reviews', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, p.name as product_name, u.first_name
      FROM reviews r
      LEFT JOIN products p ON r.product_id = p.id
      LEFT JOIN users u ON r.user_id = u.id
      ORDER BY r.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Создание отзыва
router.post('/reviews', async (req, res) => {
  try {
    const { product_id, user_id, rating, comment } = req.body;
    
    const result = await pool.query(`
      INSERT INTO reviews (product_id, user_id, rating, comment)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [product_id, user_id, rating, comment]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получение заказов пользователя
router.get('/orders/user/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    
    const result = await pool.query(`
      SELECT o.*, u.first_name, u.telegram_id
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE u.telegram_id = $1
      ORDER BY o.created_at DESC
    `, [telegramId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
