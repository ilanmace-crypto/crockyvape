const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Подключаем Neon базу данных
const pool = require('./config/neon');

const app = express();

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

// Health check с проверкой Neon БД
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time, version() as db_version');
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: 'Neon PostgreSQL connected',
      db_time: result.rows[0].current_time,
      db_version: result.rows[0].db_version
    });
  } catch (error) {
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: 'Neon PostgreSQL disconnected',
      error: error.message
    });
  }
});

// Debug endpoint
app.get('/api/debug', (req, res) => {
  res.json({
    message: 'Debug working with Neon',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    has_db: !!process.env.DATABASE_URL
  });
});

// Admin login с Neon БД
app.post('/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Пробуем Neon базу данных
    try {
      const result = await pool.query(
        'SELECT * FROM admins WHERE username = $1',
        [username]
      );
      
      if (result.rows.length > 0) {
        const admin = result.rows[0];
        if (password === 'paradise251208') {
          const token = 'neon-token-' + Date.now() + '-' + Math.random().toString(36).substring(2);
          return res.json({
            token,
            admin: {
              id: admin.id,
              username: admin.username,
              role: admin.role
            }
          });
        }
      }
    } catch (dbError) {
      console.warn('Neon DB error, using fallback:', dbError.message);
    }

    // Fallback
    if (username === 'admin' && password === 'paradise251208') {
      const token = 'fallback-token-' + Date.now() + '-' + Math.random().toString(36).substring(2);
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
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Products с Neon БД
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.name
    `);
    
    // Получаем вкусы для каждого товара
    for (let product of result.rows) {
      const flavors = await pool.query(
        'SELECT * FROM product_flavors WHERE product_id = $1',
        [product.id]
      );
      product.flavors = flavors.rows;
    }
    
    res.json(result.rows);
  } catch (error) {
    console.error('Products error:', error);
    // Fallback с mock данными
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
  }
});

// Orders с Neon БД
app.post('/api/orders', async (req, res) => {
  try {
    const { items, telegram_user } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Missing items' });
    }

    // Создаем заказ в Neon
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const orderResult = await client.query(`
        INSERT INTO orders (user_id, total_amount, telegram_id, telegram_username)
        VALUES (NULL, $1, $2, $3)
        RETURNING *
      `, [
        items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        telegram_user?.telegram_id || null,
        telegram_user?.telegram_username || null
      ]);
      
      const order = orderResult.rows[0];
      
      // Добавляем товары заказа
      for (const item of items) {
        await client.query(`
          INSERT INTO order_items (order_id, product_id, flavor_name, quantity, price)
          VALUES ($1, $2, $3, $4, $5)
        `, [order.id, item.product_id, item.flavor_name || null, item.quantity, item.price]);
      }
      
      await client.query('COMMIT');
      
      res.json({
        id: order.id,
        status: 'created',
        message: 'Order created successfully in Neon'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

module.exports = app;

// Admin products endpoints
app.post('/admin/products', async (req, res) => {
  try {
    const { name, category_id, category, price, description, stock, flavors, image_url } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    // Определяем category_id
    let resolvedCategoryId = category_id;
    if (!resolvedCategoryId && category) {
      if (category === 'liquids') resolvedCategoryId = 1;
      else if (category === 'consumables') resolvedCategoryId = 2;
    }

    if (!resolvedCategoryId) {
      return res.status(400).json({ error: 'Category is required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const productResult = await client.query(`
        INSERT INTO products (id, name, category_id, price, description, stock, image_url)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [name, resolvedCategoryId, price, description || null, stock || 0, image_url || null]);
      
      const product = productResult.rows[0];
      
      // Добавляем вкусы если есть
      if (flavors && Array.isArray(flavors) && flavors.length > 0) {
        for (const flavor of flavors) {
          if (flavor.name && flavor.stock > 0) {
            await client.query(`
              INSERT INTO product_flavors (product_id, flavor_name, stock)
              VALUES ($1, $2, $3)
            `, [product.id, flavor.name, flavor.stock]);
          }
        }
      }
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        product: {
          ...product,
          flavors: flavors || []
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Admin orders endpoint
app.get('/admin/orders', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.*, u.telegram_username
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Orders error:', error);
    res.json([]);
  }
});

// Admin users endpoint  
app.get('/admin/users', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.*,
             COUNT(o.id) as orders_count,
             COALESCE(SUM(o.total_amount), 0) as total_spent
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Users error:', error);
    res.json([]);
  }
});


// PUT /admin/products/:id - update product
app.put('/admin/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category_id, category, price, description, stock, flavors, image_url } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    // Определяем category_id
    let resolvedCategoryId = category_id;
    if (!resolvedCategoryId && category) {
      if (category === 'liquids') resolvedCategoryId = 1;
      else if (category === 'consumables') resolvedCategoryId = 2;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const productResult = await client.query(`
        UPDATE products 
        SET name = $1, category_id = $2, price = $3, description = $4, stock = $5, image_url = $6, updated_at = NOW()
        WHERE id = $7
        RETURNING *
      `, [name, resolvedCategoryId, price, description || null, stock || 0, image_url || null, id]);
      
      if (productResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Product not found' });
      }
      
      const product = productResult.rows[0];
      
      // Удаляем старые вкусы и добавляем новые
      await client.query('DELETE FROM product_flavors WHERE product_id = $1', [id]);
      
      if (flavors && Array.isArray(flavors) && flavors.length > 0) {
        for (const flavor of flavors) {
          if (flavor.name && flavor.stock > 0) {
            await client.query(`
              INSERT INTO product_flavors (product_id, flavor_name, stock)
              VALUES ($1, $2, $3)
            `, [id, flavor.name, flavor.stock]);
          }
        }
      }
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        product: {
          ...product,
          flavors: flavors || []
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /admin/products/:id - delete product
app.delete('/admin/products/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Удаляем вкусы
      await client.query('DELETE FROM product_flavors WHERE product_id = $1', [id]);
      
      // Удаляем товар
      const result = await client.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
      
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Product not found' });
      }
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: 'Product deleted successfully'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

