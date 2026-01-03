const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Подключаем Neon базу данных
const pool = require('./config/neon');

const app = express();

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
app.use(express.static('public'));
app.use(express.static('.'));

// Favicon handler
app.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // Return no content for favicon
});

// Root route handler - serve index.html
app.get('/', (req, res) => {
  res.sendFile('index.html', { root: '.' });
});

// Catch-all handler for React Router
app.get('*', (req, res) => {
  // Don't intercept API routes
  if (req.path.startsWith('/api') || req.path.startsWith('/admin') || req.path === '/health') {
    return res.status(404).json({ error: 'Route not found' });
  }
  res.sendFile('index.html', { root: '.' });
});

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

// GET /api/products-debug - debug products API
app.get('/api/products-debug', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.created_at DESC
    `);
    
    // Получаем вкусы для каждого товара
    for (let product of result.rows) {
      const flavors = await pool.query(
        'SELECT * FROM product_flavors WHERE product_id = $1 ORDER BY flavor_name',
        [product.id]
      );
      product.flavors = flavors.rows;
    }
    
    res.json({
      total_products: result.rows.length,
      products: result.rows,
      frontend_filter: {
        liquids_count: result.rows.filter(p => Number(p.category_id) === 1 && Number(p.stock) > 0).length,
        consumables_count: result.rows.filter(p => Number(p.category_id) === 2 && Number(p.stock) > 0).length,
        with_stock_count: result.rows.filter(p => Number(p.stock) > 0).length
      }
    });
  } catch (error) {
    console.error('Debug products error:', error);
    res.status(500).json({ error: 'Failed to fetch debug products' });
  }
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
    console.log('Order request received:', JSON.stringify(req.body, null, 2));
    
    const { items, telegram_user } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      console.log('Order validation failed: missing items');
      return res.status(400).json({ error: 'Missing items' });
    }

    console.log('Items count:', items.length);
    console.log('Telegram user:', telegram_user);

    // Создаем заказ в Neon
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const totalAmount = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
      console.log('Total amount calculated:', totalAmount);
      
      const orderResult = await client.query(`
        INSERT INTO orders (user_id, total_amount, telegram_id, telegram_username)
        VALUES (NULL, $1, $2, $3)
        RETURNING *
      `, [
        totalAmount,
        telegram_user?.telegram_id || null,
        telegram_user?.telegram_username || null
      ]);
      
      const order = orderResult.rows[0];
      console.log('Order created:', order.id);
      
      // Добавляем товары заказа
      for (const item of items) {
        console.log('Adding order item:', item);
        await client.query(`
          INSERT INTO order_items (order_id, product_id, flavor_name, quantity, price)
          VALUES ($1, $2, $3, $4, $5)
        `, [order.id, item.product_id, item.flavor_name || null, item.quantity, item.price]);
      }
      
      await client.query('COMMIT');
      console.log('Order transaction committed');
      
      res.json({
        id: order.id,
        status: 'created',
        message: 'Order created successfully in Neon',
        total_amount: totalAmount
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Order transaction error:', error);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: 'Failed to create order', details: error.message });
  }
});

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

// GET /admin/products - get all products for admin
app.get('/admin/products', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.created_at DESC
    `);
    
    // Получаем вкусы для каждого товара
    for (let product of result.rows) {
      const flavors = await pool.query(
        'SELECT * FROM product_flavors WHERE product_id = $1 ORDER BY flavor_name',
        [product.id]
      );
      product.flavors = flavors.rows;
    }
    
    res.json(result.rows);
  } catch (error) {
    console.error('Admin products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
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

// GET /api/db-check - check database tables
app.get('/api/db-check', async (req, res) => {
  try {
    const tables = await pool.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    let productsCount = 0;
    let adminsCount = 0;
    
    try {
      const productsResult = await pool.query('SELECT COUNT(*) as count FROM products');
      productsCount = productsResult.rows[0].count;
    } catch (e) {
      console.warn('Products table error:', e.message);
    }
    
    try {
      const adminsResult = await pool.query('SELECT COUNT(*) as count FROM admins');
      adminsCount = adminsResult.rows[0].count;
    } catch (e) {
      console.warn('Admins table error:', e.message);
    }
    
    res.json({
      tables: tables.rows,
      counts: {
        products: productsCount,
        admins: adminsCount
      },
      database_url: process.env.DATABASE_URL ? 'SET' : 'NOT_SET'
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      database_url: process.env.DATABASE_URL ? 'SET' : 'NOT_SET'
    });
  }
});

module.exports = app;

// Start server if not in Vercel environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`API debug: http://localhost:${PORT}/api/debug`);
  });
}
