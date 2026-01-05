const express = require('express');
const cors = require('cors');
 const path = require('path');
 const crypto = require('crypto');
 const fs = require('fs');
 require('dotenv').config();

 // Neon Postgres pool
 const pool = require('./config/neon');

const app = express();

 const projectRoot = path.join(__dirname, '..');

 const renderIndexHtml = (res) => {
  try {
    const assetsDir = path.join(projectRoot, 'assets');
    const files = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : [];

    const pickLatestByMtime = (candidates) => {
      let best = null;
      let bestMtime = -1;
      for (const f of candidates) {
        try {
          const stat = fs.statSync(path.join(assetsDir, f));
          const m = Number(stat.mtimeMs || 0);
          if (m > bestMtime) {
            bestMtime = m;
            best = f;
          }
        } catch {
          // ignore
        }
      }
      return best;
    };

    const jsCandidates = files.filter((f) => /^index-.*\.js$/.test(f));
    const cssCandidates = files.filter((f) => /^index-.*\.css$/.test(f));

    const jsFile = pickLatestByMtime(jsCandidates);
    const cssFile = pickLatestByMtime(cssCandidates);

    if (!jsFile || !cssFile) {
      res.setHeader('Cache-Control', 'no-store');
      return res.sendFile(path.join(projectRoot, 'index.html'));
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(
      `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <title>PARADISE-SHOP</title>
    <script type="module" crossorigin src="/assets/${jsFile}"></script>
    <link rel="stylesheet" crossorigin href="/assets/${cssFile}">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`
    );
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store');
    return res.sendFile(path.join(projectRoot, 'index.html'));
  }
 };

 const requireAdminAuth = (req, res, next) => {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
 };

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
app.use(
  '/assets',
  express.static(path.join(projectRoot, 'assets'), {
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  })
);
app.use(express.static(projectRoot, { index: false }));

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
  return renderIndexHtml(res);
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
    environment: process.env.NODE_ENV,
    vercel: {
      gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA,
      gitCommitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE,
      gitCommitRef: process.env.VERCEL_GIT_COMMIT_REF,
      gitRepoSlug: process.env.VERCEL_GIT_REPO_SLUG,
      gitRepoOwner: process.env.VERCEL_GIT_REPO_OWNER,
      region: process.env.VERCEL_REGION,
      url: process.env.VERCEL_URL,
    },
    runtime: {
      node: process.version,
      pid: process.pid,
      cwd: process.cwd(),
    }
  });
});

// Products
app.get('/api/products', (req, res) => {
  (async () => {
    try {
      const result = await pool.query(`
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        ORDER BY p.name
      `);

      for (const product of result.rows) {
        const flavors = await pool.query(
          'SELECT * FROM product_flavors WHERE product_id = $1 ORDER BY flavor_name',
          [product.id]
        );
        product.flavors = flavors.rows;
      }

      res.json(result.rows);
    } catch (error) {
      console.error('Products error:', error);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  })();
});

// Aliases (some parts of the frontend can call without /api)
app.get('/products', (req, res) => {
  (async () => {
    try {
      const result = await pool.query(`
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        ORDER BY p.name
      `);

      for (const product of result.rows) {
        const flavors = await pool.query(
          'SELECT * FROM product_flavors WHERE product_id = $1 ORDER BY flavor_name',
          [product.id]
        );
        product.flavors = flavors.rows;
      }

      res.json(result.rows);
    } catch (error) {
      console.error('Products error:', error);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  })();
});

// Create order
const createOrder = async (req, res) => {
  try {
    const {
      items,
      telegram_user,
      user_id,
      total_amount,
      delivery_address,
      phone,
      notes,
    } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Missing items' });
    }

    const computedTotalAmount = items.reduce(
      (sum, item) => sum + Number(item?.price || 0) * Number(item?.quantity || item?.qty || 0),
      0
    );
    const totalAmount = Number.isFinite(Number(total_amount))
      ? Number(total_amount)
      : computedTotalAmount;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const resolvedUserId = user_id !== undefined && user_id !== null && String(user_id).trim() !== ''
        ? String(user_id)
        : null;

      const orderResult = await client.query(
        `
        INSERT INTO orders (user_id, total_amount, delivery_address, phone, notes)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
        [
          resolvedUserId,
          totalAmount,
          delivery_address || null,
          phone || null,
          notes || null,
        ]
      );

      const orderId = orderResult.rows?.[0]?.id;
      if (!orderId) {
        throw new Error('Failed to create order id');
      }

      for (const item of items) {
        await client.query(
          `
          INSERT INTO order_items (order_id, product_id, flavor_name, quantity, price)
          VALUES ($1, $2, $3, $4, $5)
        `,
          [
            orderId,
            item.product_id || item.id,
            item.flavor_name || item.flavor || null,
            Number(item.quantity || item.qty || 0),
            Number(item.price || 0),
          ]
        );
      }

      await client.query('COMMIT');

      const order = orderResult.rows[0];
      return res.json({
        id: order.id,
        status: 'created',
        message: 'Order created',
        total_amount: totalAmount,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Order creation error:', error);
    return res.status(500).json({ error: 'Failed to create order', details: error.message });
  }
};

app.post('/api/orders', createOrder);
app.post('/orders', createOrder);

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

// Admin products CRUD (minimal in-memory implementation)
app.get('/admin/products', requireAdminAuth, (req, res) => {
  (async () => {
    try {
      const result = await pool.query(`
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        ORDER BY p.created_at DESC
      `);

      for (const product of result.rows) {
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
  })();
});

app.post('/admin/products', requireAdminAuth, (req, res) => {
  (async () => {
    try {
      const { name, category_id, category, price, description, stock, flavors, image_url } = req.body || {};

      if (!name || price === undefined || price === null) {
        return res.status(400).json({ error: 'Name and price are required' });
      }

      let resolvedCategoryId = category_id;
      if (!resolvedCategoryId && category) {
        if (category === 'liquids') resolvedCategoryId = 1;
        else if (category === 'consumables') resolvedCategoryId = 2;
      }
      resolvedCategoryId = Number(resolvedCategoryId) || 1;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const id = crypto.randomUUID();
        const productResult = await client.query(
          `
          INSERT INTO products (id, name, category_id, price, description, stock, image_url)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `,
          [id, name, resolvedCategoryId, Number(price), description || null, Number(stock || 0), image_url || null]
        );

        const product = productResult.rows[0];

        if (Array.isArray(flavors) && flavors.length > 0) {
          for (const flavor of flavors) {
            const flavorName = flavor?.flavor_name || flavor?.name;
            const flavorStock = Number(flavor?.stock ?? 0);
            if (flavorName) {
              await client.query(
                `
                INSERT INTO product_flavors (product_id, flavor_name, stock)
                VALUES ($1, $2, $3)
              `,
                [product.id, flavorName, flavorStock]
              );
            }
          }
        }

        await client.query('COMMIT');

        const flavorsResult = await pool.query(
          'SELECT * FROM product_flavors WHERE product_id = $1 ORDER BY flavor_name',
          [product.id]
        );
        product.flavors = flavorsResult.rows;

        res.json(product);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Create product error:', error);
      res.status(500).json({ error: 'Failed to create product', details: error.message });
    }
  })();
});

app.put('/admin/products/:id', requireAdminAuth, (req, res) => {
  (async () => {
    try {
      const { id } = req.params;
      const { name, category_id, category, price, description, stock, flavors, image_url } = req.body || {};

      if (!name || price === undefined || price === null) {
        return res.status(400).json({ error: 'Name and price are required' });
      }

      let resolvedCategoryId = category_id;
      if (!resolvedCategoryId && category) {
        if (category === 'liquids') resolvedCategoryId = 1;
        else if (category === 'consumables') resolvedCategoryId = 2;
      }
      resolvedCategoryId = Number(resolvedCategoryId) || 1;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const productResult = await client.query(
          `
          UPDATE products
          SET name = $1, category_id = $2, price = $3, description = $4, stock = $5, image_url = $6, updated_at = NOW()
          WHERE id = $7
          RETURNING *
        `,
          [name, resolvedCategoryId, Number(price), description || null, Number(stock || 0), image_url || null, id]
        );

        if (productResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Product not found' });
        }

        await client.query('DELETE FROM product_flavors WHERE product_id = $1', [id]);

        if (Array.isArray(flavors) && flavors.length > 0) {
          for (const flavor of flavors) {
            const flavorName = flavor?.flavor_name || flavor?.name;
            const flavorStock = Number(flavor?.stock ?? 0);
            if (flavorName) {
              await client.query(
                `
                INSERT INTO product_flavors (product_id, flavor_name, stock)
                VALUES ($1, $2, $3)
              `,
                [id, flavorName, flavorStock]
              );
            }
          }
        }

        await client.query('COMMIT');

        const product = productResult.rows[0];
        const flavorsResult = await pool.query(
          'SELECT * FROM product_flavors WHERE product_id = $1 ORDER BY flavor_name',
          [id]
        );
        product.flavors = flavorsResult.rows;

        res.json(product);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Update product error:', error);
      res.status(500).json({ error: 'Failed to update product', details: error.message });
    }
  })();
});

app.delete('/admin/products/:id', requireAdminAuth, (req, res) => {
  (async () => {
    try {
      const { id } = req.params;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM product_flavors WHERE product_id = $1', [id]);
        const result = await client.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Product not found' });
        }
        await client.query('COMMIT');
        res.json({ success: true });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Delete product error:', error);
      res.status(500).json({ error: 'Failed to delete product', details: error.message });
    }
  })();
});

// Catch-all handler for React Router
app.get(/.*/, (req, res) => {
  // Never serve index.html for missing static assets
  if (req.path.startsWith('/assets/')) {
    return res.status(404).end();
  }

  // Don't intercept API routes
  if (req.path.startsWith('/api') || req.path.startsWith('/admin') || req.path === '/health') {
    return res.status(404).json({ error: 'Route not found' });
  }
  return renderIndexHtml(res);
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
