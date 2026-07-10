const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const pool = require('../config/supabase');

// Проверка данных от Telegram Widget
const verifyTelegramData = (data, botToken) => {
  const { hash, ...authData } = data;
  
  // Создаем строку для проверки
  const dataCheckString = Object.keys(authData)
    .sort()
    .map(key => `${key}=${authData[key]}`)
    .join('\n');
  
  // Создаем секретный ключ из bot token
  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  
  // Создаем HMAC-SHA256
  const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  
  return hmac === hash;
};

// POST /api/auth/telegram - авторизация через Telegram Widget
router.post('/telegram', async (req, res) => {
  try {
    const { id, first_name, last_name, username, auth_date, hash } = req.body;
    const botToken = process.env.TELEGRAM_AUTH_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    
    if (!botToken) {
      return res.status(500).json({ error: 'Telegram auth bot token not configured' });
    }
    
    if (!id || !hash) {
      return res.status(400).json({ error: 'Missing required Telegram data' });
    }
    
    // Проверяем подпись Telegram
    const isValid = verifyTelegramData(req.body, botToken);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid Telegram data' });
    }
    
    // Проверяем, существует ли пользователь
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [id.toString()]
    );
    
    let user;
    
    if (existingUser.rows.length > 0) {
      user = existingUser.rows[0];

      if (user.is_blocked) {
        return res.status(403).json({ error: 'User is blocked' });
      }

      // Обновляем данные пользователя
      const updatedUser = await pool.query(`
        UPDATE users 
        SET telegram_username = $1, 
            telegram_first_name = $2, 
            telegram_last_name = $3, 
            updated_at = NOW()
        WHERE telegram_id = $4
        RETURNING *
      `, [username || null, first_name || null, last_name || null, id.toString()]);
      
      user = updatedUser.rows[0];
    } else {
      // Создаем нового пользователя
      const newUser = await pool.query(`
        INSERT INTO users (telegram_id, telegram_username, telegram_first_name, telegram_last_name)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [id.toString(), username || null, first_name || null, last_name || null]);
      
      user = newUser.rows[0];
    }
    
    // Создаем простой токен сессии (в реальном проекте лучше использовать JWT)
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    // Сохраняем токен в базе данных (можно добавить таблицу sessions)
    // Для простоты пока просто возвращаем user data
    
    res.json({
      success: true,
      user: {
        id: user.id,
        telegram_id: user.telegram_id,
        telegram_username: user.telegram_username,
        telegram_first_name: user.telegram_first_name,
        telegram_last_name: user.telegram_last_name,
        is_blocked: user.is_blocked || false
      },
      token: sessionToken
    });
    
  } catch (error) {
    console.error('Telegram auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// GET /api/auth/me - получить текущего пользователя по токену
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    // В реальном проекте здесь нужно проверить токен в базе данных
    // Для простоты пока возвращаем ошибку
    res.status(401).json({ error: 'Invalid token' });
    
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

module.exports = router;
