const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Получение всех товаров
router.get('/products', async (req, res) => {
  try {
    const [products] = await pool.execute(`
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = true
      ORDER BY p.name
    `);
    
    // Получение вкусов для каждого товара
    for (let product of products) {
      const [flavors] = await pool.execute(
        'SELECT flavor_name, stock FROM product_flavors WHERE product_id = ?',
        [product.id]
      );
      product.flavors = flavors;
    }
    
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получение категорий
router.get('/categories', async (req, res) => {
  try {
    const [categories] = await pool.execute(`
      SELECT * FROM categories 
      ORDER BY name
    `);
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Создание/обновление пользователя Telegram
router.post('/users/telegram', async (req, res) => {
  try {
    const { telegram_id, username, first_name, last_name } = req.body;
    
    // Проверяем, существует ли пользователь
    const [existing] = await pool.execute(
      'SELECT * FROM users WHERE telegram_id = ?',
      [telegram_id]
    );
    
    if (existing.length > 0) {
      // Обновляем существующего пользователя
      await pool.execute(`
        UPDATE users 
        SET telegram_username = ?, telegram_first_name = ?, telegram_last_name = ?
        WHERE telegram_id = ?
      `, [username, first_name, last_name, telegram_id]);
      
      res.json(existing[0]);
    } else {
      // Создаем нового пользователя
      const [result] = await pool.execute(`
        INSERT INTO users (telegram_id, telegram_username, telegram_first_name, telegram_last_name)
        VALUES (?, ?, ?, ?)
      `, [telegram_id, username, first_name, last_name]);
      
      const [newUser] = await pool.execute(
        'SELECT * FROM users WHERE id = ?',
        [result.insertId]
      );
      
      res.json(newUser[0]);
    }
  } catch (error) {
    console.error('Error saving Telegram user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Создание заказа
router.post('/orders', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { user_id, items, delivery_address, phone, notes } = req.body;
    
    // Проверяем наличие достаточного количества товаров
    for (let item of items) {
      if (item.flavor_name) {
        const [flavorStock] = await connection.execute(
          'SELECT stock FROM product_flavors WHERE product_id = ? AND flavor_name = ?',
          [item.product_id, item.flavor_name]
        );
        
        if (flavorStock.length === 0 || flavorStock[0].stock < item.quantity) {
          await connection.rollback();
          return res.status(400).json({ 
            error: 'Insufficient stock',
            product_id: item.product_id,
            flavor_name: item.flavor_name,
            requested: item.quantity,
            available: flavorStock.length > 0 ? flavorStock[0].stock : 0
          });
        }
      } else {
        const [productStock] = await connection.execute(
          'SELECT stock FROM products WHERE id = ?',
          [item.product_id]
        );
        
        if (productStock.length === 0 || productStock[0].stock < item.quantity) {
          await connection.rollback();
          return res.status(400).json({ 
            error: 'Insufficient stock',
            product_id: item.product_id,
            requested: item.quantity,
            available: productStock.length > 0 ? productStock[0].stock : 0
          });
        }
      }
    }
    
    // Рассчитываем общую сумму
    let total_amount = 0;
    for (let item of items) {
      total_amount += item.price * item.quantity;
    }
    
    // Создаем заказ
    const [orderResult] = await connection.execute(`
      INSERT INTO orders (user_id, total_amount, delivery_address, phone, notes)
      VALUES (?, ?, ?, ?, ?)
    `, [user_id, total_amount, delivery_address, phone, notes]);
    
    const order_id = orderResult.insertId;
    
    // Добавляем товары в заказ и уменьшаем остатки
    for (let item of items) {
      await connection.execute(`
        INSERT INTO order_items (order_id, product_id, flavor_name, quantity, price)
        VALUES (?, ?, ?, ?, ?)
      `, [order_id, item.product_id, item.flavor_name, item.quantity, item.price]);
      
      // Уменьшаем остатки с проверкой
      if (item.flavor_name) {
        const [result] = await connection.execute(`
          UPDATE product_flavors 
          SET stock = stock - ? 
          WHERE product_id = ? AND flavor_name = ? AND stock >= ?
        `, [item.quantity, item.product_id, item.flavor_name, item.quantity]);
        
        if (result.affectedRows === 0) {
          await connection.rollback();
          return res.status(400).json({ 
            error: 'Stock update failed - insufficient stock',
            product_id: item.product_id,
            flavor_name: item.flavor_name
          });
        }
      } else {
        const [result] = await connection.execute(`
          UPDATE products 
          SET stock = stock - ? 
          WHERE id = ? AND stock >= ?
        `, [item.quantity, item.product_id, item.quantity]);
        
        if (result.affectedRows === 0) {
          await connection.rollback();
          return res.status(400).json({ 
            error: 'Stock update failed - insufficient stock',
            product_id: item.product_id
          });
        }
      }
    }
    
    await connection.commit();
    
    const [order] = await connection.execute(
      'SELECT * FROM orders WHERE id = ?',
      [order_id]
    );
    
    res.json(order[0]);
  } catch (error) {
    await connection.rollback();
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    connection.release();
  }
});

// Получение отзывов
router.get('/reviews', async (req, res) => {
  try {
    const [reviews] = await pool.execute(`
      SELECT r.*, p.name as product_name, u.telegram_username
      FROM reviews r
      LEFT JOIN products p ON r.product_id = p.id
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.is_approved = true
      ORDER BY r.created_at DESC
      LIMIT 50
    `);
    res.json(reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Создание отзыва
router.post('/reviews', async (req, res) => {
  try {
    const { user_id, product_id, rating, review_text, telegram_username } = req.body;
    
    const [result] = await pool.execute(`
      INSERT INTO reviews (user_id, product_id, rating, review_text, telegram_username)
      VALUES (?, ?, ?, ?, ?)
    `, [user_id, product_id, rating, review_text, telegram_username]);
    
    const [review] = await pool.execute(
      'SELECT * FROM reviews WHERE id = ?',
      [result.insertId]
    );
    
    res.json(review[0]);
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получение заказов пользователя
router.get('/orders/user/:telegram_id', async (req, res) => {
  try {
    const { telegram_id } = req.params;
    
    const [user] = await pool.execute(
      'SELECT id FROM users WHERE telegram_id = ?',
      [telegram_id]
    );
    
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const [orders] = await pool.execute(`
      SELECT o.*, 
             JSON_ARRAYAGG(
               JSON_OBJECT(
                 'product_name', p.name,
                 'flavor_name', oi.flavor_name,
                 'quantity', oi.quantity,
                 'price', oi.price
               )
             ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE o.user_id = ?
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `, [user[0].id]);
    
    res.json(orders);
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получение статистики продаж для админ панели
router.get('/admin/stats', async (req, res) => {
  try {
    // Общая статистика
    const [totalStats] = await pool.execute(`
      SELECT 
        COUNT(DISTINCT o.id) as total_orders,
        COUNT(DISTINCT o.user_id) as total_customers,
        SUM(o.total_amount) as total_revenue,
        AVG(o.total_amount) as avg_order_value
      FROM orders o
      WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);
    
    // Продажи по категориям
    const [categoryStats] = await pool.execute(`
      SELECT 
        c.name as category_name,
        COUNT(DISTINCT o.id) as orders_count,
        SUM(oi.quantity * oi.price) as revenue
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY c.id, c.name
      ORDER BY revenue DESC
    `);
    
    // Топ товары
    const [topProducts] = await pool.execute(`
      SELECT 
        p.name,
        COUNT(oi.id) as times_sold,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.quantity * oi.price) as revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY p.id, p.name
      ORDER BY revenue DESC
      LIMIT 10
    `);
    
    // Низкие остатки
    const [lowStock] = await pool.execute(`
      SELECT 
        p.name,
        p.stock,
        c.name as category_name
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.stock <= 10 AND p.is_active = true
      ORDER BY p.stock ASC
      LIMIT 10
    `);
    
    // Низкие остатки вкусов
    const [lowStockFlavors] = await pool.execute(`
      SELECT 
        p.name as product_name,
        pf.flavor_name,
        pf.stock
      FROM product_flavors pf
      JOIN products p ON pf.product_id = p.id
      WHERE pf.stock <= 5 AND p.is_active = true
      ORDER BY pf.stock ASC
      LIMIT 10
    `);
    
    res.json({
      total: totalStats[0] || {},
      byCategory: categoryStats,
      topProducts,
      lowStock,
      lowStockFlavors
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получение всех отзывов для админ панели
router.get('/admin/reviews', async (req, res) => {
  try {
    const [reviews] = await pool.execute(`
      SELECT r.*, p.name as product_name, u.telegram_username
      FROM reviews r
      LEFT JOIN products p ON r.product_id = p.id
      LEFT JOIN users u ON r.user_id = u.id
      ORDER BY r.created_at DESC
    `);
    res.json(reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Одобрение/отклонение отзыва
router.put('/admin/reviews/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_approved } = req.body;
    
    const [result] = await pool.execute(
      'UPDATE reviews SET is_approved = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [is_approved, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    res.json({ message: 'Review updated successfully' });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
