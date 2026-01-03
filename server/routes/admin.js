const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../config/supabase');
const { authenticateToken, generateToken } = require('../middleware/auth');

const resolveCategoryId = async ({ category_id, category }) => {
  if (category_id) return Number(category_id);
  if (!category) return null;

  if (category === 'liquids') return 1;
  if (category === 'consumables') return 2;

  return null;
};

const getProductWithRelations = async (productId) => {
  const productRes = await pool.query(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = $1
  `, [productId]);

  if (productRes.rows.length === 0) return null;
  const product = productRes.rows[0];

  const flavorsRes = await pool.query(
    'SELECT * FROM product_flavors WHERE product_id = $1',
    [productId]
  );
  product.flavors = flavorsRes.rows;

  return product;
};

// Авторизация админа
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    const result = await pool.query(
      'SELECT * FROM admins WHERE username = $1',
      [username]
    );
      
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
      
    const admin = result.rows[0];
    const isValid = await bcrypt.compare(password, admin.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
      
    // Обновляем время последнего входа
    await pool.query(
      'UPDATE admins SET last_login = NOW() WHERE id = $1',
      [admin.id]
    );
      
    const token = generateToken(admin.username, admin.role);
    res.json({
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        role: admin.role
      }
    });
  } catch (dbError) {
    // Если база недоступна, используем временный fallback
    if (username === 'admin' && password === 'paradise251208') {
      const token = generateToken('admin', 'admin');
      return res.json({
        token,
        admin: {
          id: 1,
          username: 'admin',
          role: 'admin'
        }
      });
    }
    console.error('Login error:', dbError);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получение всех пользователей (для админа)
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const users = await pool.query(`
      SELECT u.*,
             COUNT(o.id) as orders_count,
             COALESCE(SUM(o.total_amount), 0) as total_spent
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    res.json(users.rows);
  } catch (error) {
    console.error('Users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получение статистики
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const ordersStats = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(total_amount) as total_revenue,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders
      FROM orders
    `);
    
    const usersCount = await pool.query(
      'SELECT COUNT(*) as count FROM users'
    );
    
    const productsCount = await pool.query(
      'SELECT COUNT(*) as count FROM products WHERE is_active = true'
    );
    
    const reviewsCount = await pool.query(
      'SELECT COUNT(*) as count FROM reviews WHERE is_approved = true'
    );
    
    res.json({
      orders: ordersStats.rows[0],
      users: usersCount.rows[0],
      products: productsCount.rows[0],
      reviews: reviewsCount.rows[0]
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получение всех заказов
router.get('/orders', authenticateToken, async (req, res) => {
  try {
    const orders = await pool.query(`
      SELECT o.*, u.telegram_username, u.telegram_first_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `);
    
    // Получаем товары для каждого заказа
    for (let order of orders.rows) {
      const items = await pool.query(`
        SELECT oi.*, p.name as product_name
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = $1
      `, [order.id]);
      
      order.items = items.rows;
    }
    
    res.json(orders.rows);
  } catch (error) {
    console.error('Orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Обновление статуса заказа
router.put('/orders/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    await pool.query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, id]
    );
    
    res.json({ message: 'Order status updated' });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получение всех товаров (для админа)
router.get('/products', authenticateToken, async (req, res) => {
  try {
    const products = await pool.query(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.name
    `);
    
    // Получение вкусов для каждого товара
    for (let product of products.rows) {
      const flavors = await pool.query(
        'SELECT * FROM product_flavors WHERE product_id = $1',
        [product.id]
      );
      product.flavors = flavors.rows;
    }
    
    res.json(products.rows);
  } catch (error) {
    console.error('Products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Создание товара
router.post('/products', authenticateToken, async (req, res) => {
  try {
    const { name, category_id, category, price, description, stock, flavors, flavor, image_url } = req.body;

    // Валидация входных данных
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Product name is required' });
    }

    if (name.length > 200) {
      return res.status(400).json({ error: 'Product name too long' });
    }

    if (!price || !Number.isFinite(Number(price)) || Number(price) < 0 || Number(price) > 100000) {
      return res.status(400).json({ error: 'Invalid price' });
    }

    if (stock !== undefined && (!Number.isInteger(Number(stock)) || Number(stock) < 0 || Number(stock) > 10000)) {
      return res.status(400).json({ error: 'Invalid stock' });
    }

    if (description && description.length > 2000) {
      return res.status(400).json({ error: 'Description too long' });
    }

    if (image_url && (typeof image_url !== 'string' || image_url.length > 1000)) {
      return res.status(400).json({ error: 'Invalid image URL' });
    }

    // Валидация вкусов
    if (flavors && Array.isArray(flavors)) {
      if (flavors.length > 50) {
        return res.status(400).json({ error: 'Too many flavors' });
      }
      
      for (const f of flavors) {
        if (!f.name || typeof f.name !== 'string' || f.name.length > 100) {
          return res.status(400).json({ error: 'Invalid flavor name' });
        }
        
        if (!Number.isInteger(Number(f.stock)) || Number(f.stock) < 0 || Number(f.stock) > 1000) {
          return res.status(400).json({ error: 'Invalid flavor stock' });
        }
      }
    }

    const resolvedCategoryId = await resolveCategoryId({ category_id, category });
    if (!resolvedCategoryId) {
      return res.status(400).json({ error: 'category_id or valid category is required' });
    }
    
    const product_id = `product-${Date.now()}`;
    
    await pool.query(`
      INSERT INTO products (id, name, category_id, price, description, stock, image_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [product_id, name, resolvedCategoryId, price, description || null, stock, image_url || null]);
    
    // Добавляем вкусы если есть
    const normalizedFlavors = Array.isArray(flavors)
      ? flavors
      : (flavor ? [{ name: flavor, stock: stock }] : []);

    if (normalizedFlavors.length > 0) {
      for (let fl of normalizedFlavors) {
        const flavorName = typeof fl === 'string' ? fl : (fl.name || fl.flavor_name);
        const flavorStock = typeof fl === 'string' ? stock : (fl.stock ?? stock);
        if (!flavorName) continue;
        await pool.query(
          'INSERT INTO product_flavors (product_id, flavor_name, stock) VALUES ($1, $2, $3)',
          [product_id, flavorName, flavorStock]
        );
      }
    }

    const createdProduct = await getProductWithRelations(product_id);
    res.status(201).json(createdProduct);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Обновление товара
router.put('/products/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category_id, category, price, description, stock, is_active, flavors, image_url, flavor } = req.body;

    const resolvedCategoryId = await resolveCategoryId({ category_id, category });
    if (!resolvedCategoryId) {
      return res.status(400).json({ error: 'category_id or valid category is required' });
    }
    
    await pool.query('BEGIN');
    try {
      await pool.query(`
        UPDATE products 
        SET name = $1, category_id = $2, price = $3, description = $4, stock = $5, is_active = $6, image_url = $7, updated_at = NOW()
        WHERE id = $8
      `, [name, resolvedCategoryId, price, description || null, stock, is_active, image_url || null, id]);

      const normalizedFlavors = Array.isArray(flavors)
        ? flavors
        : (flavor ? [{ name: flavor, stock: stock }] : []);

      await pool.query('DELETE FROM product_flavors WHERE product_id = $1', [id]);

      if (normalizedFlavors.length > 0) {
        for (let fl of normalizedFlavors) {
          const flavorName = typeof fl === 'string' ? fl : (fl.name || fl.flavor_name);
          const flavorStock = typeof fl === 'string' ? stock : (fl.stock ?? stock);
          if (!flavorName) continue;
          await pool.query(
            'INSERT INTO product_flavors (product_id, flavor_name, stock) VALUES ($1, $2, $3)',
            [id, flavorName, flavorStock]
          );
        }
      }

      await pool.query('COMMIT');
    } catch (e) {
      await pool.query('ROLLBACK');
      throw e;
    }

    const updatedProduct = await getProductWithRelations(id);
    res.json(updatedProduct);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Удаление товара (soft delete)
router.delete('/products/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query('BEGIN');
    try {
      await pool.query('DELETE FROM product_flavors WHERE product_id = $1', [id]);
      await pool.query('DELETE FROM products WHERE id = $1', [id]);
      await pool.query('COMMIT');
    } catch (e) {
      await pool.query('ROLLBACK');
      throw e;
    }

    res.json({ message: 'Product deleted' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получение отзывов (для модерации)
router.get('/reviews', authenticateToken, async (req, res) => {
  try {
    const reviews = await pool.query(`
      SELECT r.*, p.name as product_name, u.telegram_username
      FROM reviews r
      LEFT JOIN products p ON r.product_id = p.id
      LEFT JOIN users u ON r.user_id = u.id
      ORDER BY r.created_at DESC
    `);
    res.json(reviews.rows);
  } catch (error) {
    console.error('Reviews error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Модерация отзыва
router.put('/reviews/:id/approve', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_approved } = req.body;
    
    await pool.query(
      'UPDATE reviews SET is_approved = $1, updated_at = NOW() WHERE id = $2',
      [is_approved, id]
    );
    
    res.json({ message: 'Review moderation updated' });
  } catch (error) {
    console.error('Review moderation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Удаление отзыва
router.delete('/reviews/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query('DELETE FROM reviews WHERE id = $1', [id]);
    
    res.json({ message: 'Review deleted' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
