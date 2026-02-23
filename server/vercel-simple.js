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

 let schemaReadyPromise = null;
 const ensureSchemaReady = () => {
  if (schemaReadyPromise) return schemaReadyPromise;
  schemaReadyPromise = (async () => {
    await pool.query(
      `
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
    );

    await pool.query(
      `
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        category_id INTEGER REFERENCES categories(id),
        price DECIMAL(10,2) NOT NULL,
        description TEXT,
        image_url VARCHAR(500),
        stock INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
    );

    await pool.query(
      `
      CREATE TABLE IF NOT EXISTS product_flavors (
        id SERIAL PRIMARY KEY,
        product_id VARCHAR(50) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        flavor_name VARCHAR(100) NOT NULL,
        stock INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (product_id, flavor_name)
      )
    `
    );

    await pool.query(
      `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id VARCHAR(100) UNIQUE NOT NULL,
        telegram_username VARCHAR(100),
        telegram_first_name VARCHAR(100),
        telegram_last_name VARCHAR(100),
        phone VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
    );

    await pool.query(
      `
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        total_amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        delivery_address TEXT,
        phone VARCHAR(20),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
    );

    await pool.query(
      `
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id VARCHAR(50) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        flavor_name VARCHAR(100),
        quantity INTEGER NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
    );

    await pool.query(
      `
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP NULL
      )
    `
    );

    await pool.query(
      `
      CREATE TABLE IF NOT EXISTS product_images (
        product_id TEXT PRIMARY KEY,
        mime_type TEXT NOT NULL,
        data TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
    );

    await pool.query(
      `
      CREATE TABLE IF NOT EXISTS reviews (
        id BIGSERIAL PRIMARY KEY,
        telegram_username TEXT,
        rating INT NOT NULL DEFAULT 5,
        review_text TEXT,
        is_approved BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
    );
  })();
  return schemaReadyPromise;
 };

 app.get('/api/debug/tables', async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `
    );
    res.json({ ok: true, tables: result.rows.map((r) => r.table_name) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
 });

 const parseDataUrlImage = (value) => {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('data:')) return null;
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mime: match[1], b64: match[2] };
 };

 const sendTelegramMessage = async (text) => {
  // Force redeploy final
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_GROUP_CHAT_ID || process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (!token || !chatId) return;

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch (e) {
    console.error('Telegram notify error:', e);
  }
 };

 const renderIndexHtml = (res) => {
  try {
    const clientIndexPath = path.join(projectRoot, 'client/dist/index.html');
    if (fs.existsSync(clientIndexPath)) {
      res.setHeader('Cache-Control', 'no-store');
      return res.sendFile(clientIndexPath);
    }

    // Always generate HTML with latest assets.
    const distAssetsDir = path.join(projectRoot, 'client/dist/assets');
    if (!fs.existsSync(distAssetsDir)) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(500).send('Client build is missing: client/dist/assets was not found');
    }

    const files = fs.readdirSync(distAssetsDir);

    const pickLatestByMtime = (candidates) => {
      let best = null;
      let bestMtime = -1;
      for (const f of candidates) {
        try {
          const stat = fs.statSync(path.join(distAssetsDir, f));
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

    const jsFile = pickLatestByMtime(jsCandidates) || jsCandidates.sort().slice(-1)[0];
    const cssFile = pickLatestByMtime(cssCandidates) || cssCandidates.sort().slice(-1)[0];

    if (!jsFile || !cssFile) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(500).send('Client build is missing');
    }

    // Use a fixed unique version string to force browser to reload assets after build
    const v = 'v_dark_theme_1771850000';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(
      `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <title>CROCKYVAPE</title>
    <script type="module" crossorigin src="/assets/${jsFile}?v=${v}"></script>
    <link rel="stylesheet" crossorigin href="/assets/${cssFile}?v=${v}">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`
    );
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).send('Client build is missing');
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

app.use(express.json({ limit: '10mb' }));

// Serve static files from root
app.use(express.static(path.join(projectRoot, 'public')));

app.use(
  '/assets',
  express.static(path.join(projectRoot, 'client/dist/assets'), {
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-cache');
    },
  })
);

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

app.get('/api/debug/assets', (req, res) => {
  try {
    const distAssetsDir = path.join(projectRoot, 'client/dist/assets');

    const listDir = (dir) => {
      try {
        if (!fs.existsSync(dir)) return { exists: false, files: [] };
        return { exists: true, files: fs.readdirSync(dir) };
      } catch (e) {
        return { exists: false, files: [], error: e?.message || String(e) };
      }
    };

    return res.json({
      cwd: process.cwd(),
      projectRoot,
      distAssetsDir,
      distAssets: listDir(distAssetsDir),
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

app.get('/api/debug/db', async (req, res) => {
  try {
    const ping = await pool.query('SELECT 1 as ok');
    let reviewsInfo = null;
    try {
      await ensureSchemaReady();
      const count = await pool.query('SELECT COUNT(*)::int as count FROM reviews');
      reviewsInfo = { ok: true, count: count.rows?.[0]?.count ?? null };
    } catch (e) {
      reviewsInfo = { ok: false, error: e?.message || String(e) };
    }
    res.json({ ok: true, ping: ping.rows?.[0] || null, reviews: reviewsInfo });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
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
      await ensureSchemaReady();
      const result = await pool.query(`
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        ORDER BY p.name
      `);

      const ids = result.rows.map((p) => p.id);
      let imageMap = new Map();
      if (ids.length > 0) {
        const imgRes = await pool.query(
          'SELECT product_id FROM product_images WHERE product_id = ANY($1::text[])',
          [ids]
        );
        imageMap = new Map(imgRes.rows.map((r) => [r.product_id, true]));
      }

      for (const product of result.rows) {
        if (imageMap.get(product.id)) {
          const imgRes = await pool.query('SELECT mime_type, data FROM product_images WHERE product_id = $1', [product.id]); if (imgRes.rows.length > 0) { const row = imgRes.rows[0]; product.image_url = `data:${row.mime_type};base64,${row.data}`; };
        }
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
      await ensureSchemaReady();
      const result = await pool.query(`
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        ORDER BY p.name
      `);

      const ids = result.rows.map((p) => p.id);
      let imageMap = new Map();
      if (ids.length > 0) {
        const imgRes = await pool.query(
          'SELECT product_id FROM product_images WHERE product_id = ANY($1::text[])',
          [ids]
        );
        imageMap = new Map(imgRes.rows.map((r) => [r.product_id, true]));
      }

      for (const product of result.rows) {
        if (imageMap.get(product.id)) {
          const imgRes = await pool.query('SELECT mime_type, data FROM product_images WHERE product_id = $1', [product.id]); if (imgRes.rows.length > 0) { const row = imgRes.rows[0]; product.image_url = `data:${row.mime_type};base64,${row.data}`; };
        }
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

      let resolvedUserId = user_id !== undefined && user_id !== null && String(user_id).trim() !== ''
        ? String(user_id)
        : null;

      if (!resolvedUserId) {
        const tgId = telegram_user?.telegram_id ? String(telegram_user.telegram_id) : null;
        if (!tgId) {
          return res.status(400).json({
            error: 'Missing user',
            details: 'user_id or telegram_user.telegram_id is required',
          });
        }

        const existing = await client.query('SELECT id FROM users WHERE telegram_id = $1', [tgId]);
        if (existing.rows.length > 0) {
          resolvedUserId = existing.rows[0].id;
          await client.query(
            'UPDATE users SET telegram_username = $1, telegram_first_name = $2, telegram_last_name = $3, phone = $4, updated_at = NOW() WHERE id = $5',
            [
              telegram_user?.telegram_username || null,
              telegram_user?.telegram_first_name || null,
              telegram_user?.telegram_last_name || null,
              phone || null,
              resolvedUserId,
            ]
          );
        } else {
          const created = await client.query(
            'INSERT INTO users (telegram_id, telegram_username, telegram_first_name, telegram_last_name, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [
              tgId,
              telegram_user?.telegram_username || null,
              telegram_user?.telegram_first_name || null,
              telegram_user?.telegram_last_name || null,
              phone || null,
            ]
          );
          resolvedUserId = created.rows[0].id;
        }
      }

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
        const productId = String(item.product_id || item.id || '').trim();
        const qty = Number(item.quantity || item.qty || 0);
        const price = Number(item.price || 0);
        const flavorNameRaw = item.flavor_name || item.flavor || null;
        const flavorName = flavorNameRaw ? String(flavorNameRaw).trim() : null;

        if (!productId || !Number.isFinite(qty) || qty <= 0) {
          throw new Error('Invalid order item');
        }

        await client.query(
          `
          INSERT INTO order_items (order_id, product_id, flavor_name, quantity, price)
          VALUES ($1, $2, $3, $4, $5)
        `,
          [
            orderId,
            productId,
            flavorName,
            qty,
            price,
          ]
        );

        if (flavorName) {
          const updatedFlavor = await client.query(
            `UPDATE product_flavors
             SET stock = stock - $1
             WHERE product_id = $2 AND flavor_name = $3 AND stock >= $1
             RETURNING stock`,
            [qty, productId, flavorName]
          );

          if (updatedFlavor.rows.length === 0) {
            throw new Error(`Нет остатка по вкусу: ${flavorName}`);
          }

          const sumRes = await client.query(
            'SELECT COALESCE(SUM(stock), 0) AS total FROM product_flavors WHERE product_id = $1',
            [productId]
          );
          const total = Number(sumRes.rows?.[0]?.total || 0);
          await client.query(
            'UPDATE products SET stock = $1, is_active = CASE WHEN $1 <= 0 THEN false ELSE is_active END, updated_at = NOW() WHERE id = $2',
            [total, productId]
          );
        } else {
          const updatedProduct = await client.query(
            `UPDATE products
             SET stock = stock - $1,
                 is_active = CASE WHEN (stock - $1) <= 0 THEN false ELSE is_active END,
                 updated_at = NOW()
             WHERE id = $2 AND stock >= $1
             RETURNING stock`,
            [qty, productId]
          );
          if (updatedProduct.rows.length === 0) {
            throw new Error('Нет остатка по товару');
          }
        }
      }

      await client.query('COMMIT');

      try {
        const itemsWithNames = await Promise.all(
          (items || []).map(async (it) => {
            const productId = String(it.product_id || it.id || '').trim();
            const productResult = await client.query('SELECT name FROM products WHERE id = $1', [productId]);
            return {
              ...it,
              name: productResult.rows[0]?.name || productId,
            };
          })
        );

        const lines = itemsWithNames.map((it) => {
          const name = it.name;
          const fl = it.flavor_name ? ` (${it.flavor_name})` : (it.flavor ? ` (${it.flavor})` : '');
          const qty = Number(it.quantity || it.qty || 0);
          const price = Number(it.price || 0);
          return `- ${name}${fl} x${qty} = ${(price * qty).toFixed(2)} BYN`;
        });

        const tg = telegram_user?.telegram_username
          ? `@${telegram_user.telegram_username}`
          : (telegram_user?.telegram_first_name || '');

        await sendTelegramMessage(
          `🔔 <b>НОВЫЙ ЗАКАЗ</b>\n\n` +
          `👤 <b>Клиент:</b> ${tg || 'Не указано'}\n` +
          `${phone ? `📞 <b>Телефон:</b> ${phone}\n` : ''}` +
          `${delivery_address ? `🏠 <b>Адрес:</b> ${delivery_address}\n` : ''}` +
          `${notes ? `📝 <b>Комментарий:</b> ${notes}\n` : ''}` +
          `\n📦 <b>Состав заказа:</b>\n` +
          `${lines.join('\n')}\n\n` +
          `💳 <b>Итого:</b> ${Number(totalAmount).toFixed(2)} BYN\n` +
          `🆔 <b>Order ID:</b> ${orderId}`
        );
      } catch (e) {
        console.error('Telegram notification build error:', e);
      }

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

app.get('/api/reviews', (req, res) => {
  (async () => {
    try {
      await ensureSchemaReady();
      const result = await pool.query(`
        SELECT
          id,
          COALESCE(telegram_username, '') as telegram_username,
          COALESCE(rating, 5) as rating,
          COALESCE(review_text, '') as review_text,
          COALESCE(is_approved, false) as is_approved,
          created_at
        FROM reviews
        WHERE is_approved = true
        ORDER BY created_at DESC
        LIMIT 50
      `);
      res.json(result.rows);
    } catch (error) {
      console.error('Fetch reviews error:', error);
      res.status(500).json({ error: 'Failed to fetch reviews', details: error?.message || String(error) });
    }
  })();
});

app.post('/api/reviews', (req, res) => {
  (async () => {
    try {
      await ensureSchemaReady();
      const { telegram_username, rating, review_text, product_id } = req.body || {};
      const r = Number(rating || 5);
      const safeRating = Number.isFinite(r) ? Math.max(1, Math.min(5, r)) : 5;

      // Some existing schemas require user_id NOT NULL. We create/reuse a system user.
      const tgId = 'site-review-user';
      let userId;
      try {
        const existing = await pool.query('SELECT id FROM users WHERE telegram_id = $1 LIMIT 1', [tgId]);
        if (existing.rows.length > 0) {
          userId = existing.rows[0].id;
        } else {
          const createdUser = await pool.query(
            `INSERT INTO users (telegram_id, telegram_username)
             VALUES ($1, $2)
             RETURNING id`,
            [tgId, telegram_username || null]
          );
          userId = createdUser.rows[0].id;
        }
      } catch (e) {
        console.error('Failed to ensure system user for reviews:', e);
        return res.status(500).json({
          error: 'Failed to create review',
          details: e?.message || String(e),
        });
      }

      const insert = await pool.query(
        `
        INSERT INTO reviews (user_id, product_id, rating, review_text, telegram_username)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, telegram_username, rating, review_text, is_approved, created_at
      `,
        [userId, product_id || null, safeRating, review_text || null, telegram_username || null]
      );

      res.status(201).json(insert.rows[0]);
    } catch (error) {
      console.error('Create review error:', error);
      res.status(500).json({ error: 'Failed to create review', details: error?.message || String(error) });
    }
  })();
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

      await ensureSchemaReady();

      const parsedImage = parseDataUrlImage(image_url);
      if (parsedImage) {
        const allowed = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
        if (!allowed.has(parsedImage.mime)) {
          return res.status(400).json({ error: 'Unsupported image type' });
        }
        const approxBytes = Math.floor((parsedImage.b64.length * 3) / 4);
        if (approxBytes > 2_000_000) {
          return res.status(400).json({ error: 'Image too large. Max 2MB.' });
        }
      }

      if (!parsedImage && typeof image_url === 'string' && image_url.length > 500) {
        return res.status(400).json({
          error: 'Image URL is too long (max 500 chars). Please use a shorter URL.',
        });
      }

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
          [id, name, resolvedCategoryId, Number(price), description || null, Number(stock || 0), parsedImage ? null : (image_url || null)]
        );

        const product = productResult.rows[0];

        if (parsedImage) {
          await client.query(
            `INSERT INTO product_images (product_id, mime_type, data)
             VALUES ($1, $2, $3)
             ON CONFLICT (product_id) DO UPDATE SET mime_type = EXCLUDED.mime_type, data = EXCLUDED.data, updated_at = NOW()`,
            [product.id, parsedImage.mime, parsedImage.b64]
          );
          const stableUrl = `/api/products/${product.id}/image`;
          await client.query('UPDATE products SET image_url = $1, updated_at = NOW() WHERE id = $2', [stableUrl, product.id]);
          product.image_url = stableUrl;
        }

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

      await ensureSchemaReady();

      const parsedImage = parseDataUrlImage(image_url);
      if (parsedImage) {
        const allowed = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
        if (!allowed.has(parsedImage.mime)) {
          return res.status(400).json({ error: 'Unsupported image type' });
        }
        const approxBytes = Math.floor((parsedImage.b64.length * 3) / 4);
        if (approxBytes > 2_000_000) {
          return res.status(400).json({ error: 'Image too large. Max 2MB.' });
        }
      }

      if (!parsedImage && typeof image_url === 'string' && image_url.length > 500) {
        return res.status(400).json({
          error: 'Image URL is too long (max 500 chars). Please use a shorter URL.',
        });
      }

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
          SET name = $1, category_id = $2, price = $3, description = $4, stock = $5, image_url = COALESCE($6, image_url), updated_at = NOW()
          WHERE id = $7
          RETURNING *
        `,
          [name, resolvedCategoryId, Number(price), description || null, Number(stock || 0), parsedImage ? null : (image_url || null), id]
        );

        if (productResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Product not found' });
        }

        if (parsedImage) {
          await client.query(
            `INSERT INTO product_images (product_id, mime_type, data)
             VALUES ($1, $2, $3)
             ON CONFLICT (product_id) DO UPDATE SET mime_type = EXCLUDED.mime_type, data = EXCLUDED.data, updated_at = NOW()`,
            [id, parsedImage.mime, parsedImage.b64]
          );
          const stableUrl = `/api/products/${id}/image`;
          await client.query('UPDATE products SET image_url = $1, updated_at = NOW() WHERE id = $2', [stableUrl, id]);
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
        // If an image is present in product_images, always expose stable URL
        if (parsedImage) {
          product.image_url = `/api/products/${id}/image`;
        }
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

// Admin stats endpoint
app.get('/api/admin/stats', requireAdminAuth, (req, res) => {
  (async () => {
    try {
      await ensureSchemaReady();
      const totalStats = await pool.query(`
        SELECT 
          COUNT(DISTINCT o.id) as total_orders,
          COUNT(DISTINCT o.user_id) as total_customers,
          COALESCE(SUM(o.total_amount), 0) as total_revenue,
          AVG(o.total_amount) as avg_order_value
        FROM orders o
        WHERE o.created_at >= NOW() - INTERVAL '30 days'
      `);

      const categoryStats = await pool.query(`
        SELECT 
          c.name as category_name,
          COUNT(DISTINCT o.id) as orders_count,
          COALESCE(SUM(oi.quantity * oi.price), 0) as revenue
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        JOIN products p ON oi.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        WHERE o.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY c.id, c.name
        ORDER BY revenue DESC
      `);

      const topProducts = await pool.query(`
        SELECT 
          p.name,
          COUNT(oi.id) as times_sold,
          SUM(oi.quantity) as total_quantity,
          COALESCE(SUM(oi.quantity * oi.price), 0) as revenue
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY p.id, p.name
        ORDER BY revenue DESC
        LIMIT 10
      `);

      const lowStock = await pool.query(`
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

      const lowStockFlavors = await pool.query(`
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
        total: totalStats.rows[0] || {},
        byCategory: categoryStats.rows,
        topProducts: topProducts.rows,
        lowStock: lowStock.rows,
        lowStockFlavors: lowStockFlavors.rows
      });
    } catch (error) {
      console.error('Admin stats error:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  })();
});

// Load reviews for admin
app.get('/api/admin/reviews', requireAdminAuth, (req, res) => {
  (async () => {
    try {
      await ensureSchemaReady();
      const reviews = await pool.query(`
        SELECT r.*, p.name as product_name, u.telegram_username
        FROM reviews r
        LEFT JOIN products p ON r.product_id = p.id
        LEFT JOIN users u ON r.user_id = u.id
        ORDER BY r.created_at DESC
      `);
      res.json(reviews.rows);
    } catch (error) {
      console.error('Load reviews error:', error);
      res.status(500).json({ error: 'Failed to load reviews' });
    }
  })();
});

// Approve/reject review
app.put('/api/admin/reviews/:id', requireAdminAuth, (req, res) => {
  (async () => {
    try {
      await ensureSchemaReady();
      const { id } = req.params;
      const { is_approved } = req.body;
      await pool.query(
        'UPDATE reviews SET is_approved = $1, updated_at = NOW() WHERE id = $2',
        [is_approved, id]
      );
      res.json({ message: 'Review updated' });
    } catch (error) {
      console.error('Update review error:', error);
      res.status(500).json({ error: 'Failed to update review' });
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
