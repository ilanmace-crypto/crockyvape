import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const pool = require('../server/config/neon.js').default;

const sendTelegramMessage = async (text) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_GROUP_CHAT_ID || process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) return;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { telegram_username, metro_station, items } = req.body;

    if (!telegram_username || !metro_station || !items || items.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Insert order
    const orderResult = await pool.query(
      'INSERT INTO orders (telegram_username, metro_station, status) VALUES ($1, $2, $3) RETURNING id',
      [telegram_username, metro_station, 'pending']
    );

    const orderId = orderResult.rows[0].id;

    // Insert order items
    for (const item of items) {
      await pool.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
        [orderId, item.id, item.quantity, item.price]
      );
    }

    // Send Telegram notification
    const itemsText = items.map(item => `${item.name} x${item.quantity} - ${item.price * item.quantity}₽`).join('\n');
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const text = `<b>Новый заказ #${orderId}</b>\n\nПользователь: @${telegram_username}\nМетро: ${metro_station}\n\n${itemsText}\n\n<b>Итого: ${total}₽</b>`;
    await sendTelegramMessage(text);

    res.json({ ok: true, orderId });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
