const express = require('express');
const router = express.Router();
const pool = require('../config/supabase');

const sendTelegramMessage = async (text) => {
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

// GET /api/orders - получить все заказы
router.get('/', async (req, res) => {
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
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// POST /api/orders - создать новый заказ
router.post('/', async (req, res) => {
  try {
    const { user_id, total_amount, delivery_address, phone, notes, items, telegram_user } = req.body;

    // Валидация входных данных
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Ограничение количества товаров в заказе
    if (items.length > 50) {
      return res.status(400).json({ error: 'Too many items in order' });
    }

    // Валидация каждого товара
    for (const item of items) {
      if (!item.product_id || typeof item.product_id !== 'string') {
        return res.status(400).json({ error: 'Invalid product ID' });
      }
      
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
        return res.status(400).json({ error: 'Invalid quantity' });
      }
      
      const price = Number(item.price);
      if (!Number.isFinite(price) || price < 0 || price > 10000) {
        return res.status(400).json({ error: 'Invalid price' });
      }

      // Валидация имени вкуса
      if (item.flavor_name && (typeof item.flavor_name !== 'string' || item.flavor_name.length > 100)) {
        return res.status(400).json({ error: 'Invalid flavor name' });
      }
    }

    // Валидация полей заказа
    if (total_amount && (!Number.isFinite(Number(total_amount)) || Number(total_amount) < 0 || Number(total_amount) > 100000)) {
      return res.status(400).json({ error: 'Invalid total amount' });
    }

    if (phone && (typeof phone !== 'string' || phone.length > 20)) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }

    if (delivery_address && (typeof delivery_address !== 'string' || delivery_address.length > 500)) {
      return res.status(400).json({ error: 'Invalid delivery address' });
    }

    if (notes && (typeof notes !== 'string' || notes.length > 1000)) {
      return res.status(400).json({ error: 'Invalid notes' });
    }
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Resolve user
      let resolvedUserId = user_id ? Number(user_id) : null;
      if (!resolvedUserId && telegram_user?.telegram_id) {
        const tgId = String(telegram_user.telegram_id);
        const existing = await client.query('SELECT id FROM users WHERE telegram_id = $1', [tgId]);
        if (existing.rows.length > 0) {
          resolvedUserId = existing.rows[0].id;
          await client.query(
            'UPDATE users SET telegram_username = $1, telegram_first_name = $2, telegram_last_name = $3, phone = $4, updated_at = NOW() WHERE id = $5',
            [telegram_user.telegram_username || null, telegram_user.telegram_first_name || null, telegram_user.telegram_last_name || null, phone || null, resolvedUserId]
          );
        } else {
          const created = await client.query(
            'INSERT INTO users (telegram_id, telegram_username, telegram_first_name, telegram_last_name, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [tgId, telegram_user.telegram_username || null, telegram_user.telegram_first_name || null, telegram_user.telegram_last_name || null, phone || null]
          );
          resolvedUserId = created.rows[0].id;
        }
      }

      if (!resolvedUserId) {
        throw new Error('user_id or telegram_user.telegram_id is required');
      }

      const computedTotal = Number.isFinite(Number(total_amount))
        ? Number(total_amount)
        : items.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0), 0);

      // Создаем заказ
      const orderResult = await client.query(`
        INSERT INTO orders (user_id, total_amount, delivery_address, phone, notes)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [resolvedUserId, computedTotal, delivery_address || null, phone || null, notes || null]);
      
      const order = orderResult.rows[0];
      
      // Добавляем товары заказа + списываем остатки
      for (let item of items) {
        const productId = String(item.product_id);
        const qty = Number(item.quantity || 0);
        const price = Number(item.price || 0);
        const flavorName = item.flavor_name ? String(item.flavor_name) : null;

        if (!productId || qty <= 0) {
          throw new Error('Invalid order item');
        }

        await client.query(
          `INSERT INTO order_items (order_id, product_id, flavor_name, quantity, price)
           VALUES ($1, $2, $3, $4, $5)`,
          [order.id, productId, flavorName, qty, price]
        );

        if (flavorName) {
          // decrement flavor stock (prevent negative)
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

          // update total product stock as sum of flavors
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
          // decrement product stock (prevent negative)
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

      // Get product names for Telegram notification
      const itemsWithNames = await Promise.all(
        (items || []).map(async (it) => {
          const productResult = await client.query(
            'SELECT name FROM products WHERE id = $1',
            [it.product_id]
          );
          const productName = productResult.rows[0]?.name || it.product_id;
          return {
            ...it,
            name: productName
          };
        })
      );

      // Telegram notification (best-effort)
      const lines = itemsWithNames.map((it) => {
        const name = it.name;
        const fl = it.flavor_name ? ` (${it.flavor_name})` : '';
        return `- ${name}${fl} x${it.quantity} = ${Number(it.price || 0) * Number(it.quantity || 0)} BYN`;
      });
      const tg = telegram_user?.telegram_username
        ? `@${telegram_user.telegram_username}`
        : (telegram_user?.telegram_first_name || '');

      await sendTelegramMessage(
        `🔔 <b>НОВЫЙ ЗАКАЗ</b>

📅 <b>Дата:</b> ${new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
🛍️ <b>Количество товаров:</b> ${items.length} шт.
💸 <b>Общая сумма:</b> ${order.total_amount.toFixed(2)} BYN
👤 <b>Клиент:</b> ${tg || 'Не указано'}
${phone ? `📞 <b>Телефон:</b> ${phone}` : ''}
${delivery_address ? `🏠 <b>Адрес:</b> ${delivery_address}` : ''}
${notes ? `📝 <b>Комментарий:</b> ${notes}` : ''}

📦 <b>Состав заказа:</b>

${lines.map((line, idx) => {
  const match = line.match(/- (.+?) x(\d+) = ([\d.]+) BYN/);
  if (match) {
    const [, name, qty, total] = match;
    const flavorMatch = name.match(/^(.+?) \((.+?)\)$/);
    if (flavorMatch) {
      const [_, productName, flavor] = flavorMatch;
      return `${idx + 1}. ${productName}
   💰 ${Number(total).toFixed(2)} BYN × ${qty} шт. = ${total} BYN
   🍃 <b>Вкус:</b> ${flavor}`;
    } else {
      return `${idx + 1}. ${name}
   💰 ${Number(total).toFixed(2)} BYN × ${qty} шт. = ${total} BYN`;
    }
  }
  return `${idx + 1}. ${line}`;
}).join('\n\n')}

💳 <b>Итого к оплате:</b> ${order.total_amount.toFixed(2)} BYN

⚡ <b>Срочно обработайте заказ!</b>`
      );

      res.status(201).json(order);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// PUT /api/orders/:id/status - обновить статус заказа
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const result = await pool.query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

module.exports = router;
