const pool = require('../config/supabase');

// Middleware для проверки блокировки пользователя по telegram_id
const checkUserBlocked = async (req, res, next) => {
  try {
    // Получаем telegram_id из заголовка или из тела запроса
    const telegramId = req.headers['x-telegram-id'] || req.body.telegram_id;
    
    if (!telegramId) {
      // Если нет telegram_id, пропускаем запрос (для публичных эндпоинтов)
      return next();
    }
    
    // Проверяем, заблокирован ли пользователь
    const result = await pool.query(
      'SELECT is_blocked FROM users WHERE telegram_id = $1',
      [telegramId.toString()]
    );
    
    if (result.rows.length > 0 && result.rows[0].is_blocked) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'User is blocked' 
      });
    }
    
    next();
  } catch (error) {
    console.error('Check block middleware error:', error);
    // При ошибке пропускаем запрос, чтобы не блокировать всех
    next();
  }
};

// Middleware для проверки авторизации (наличия telegram_id)
const requireAuth = async (req, res, next) => {
  try {
    const telegramId = req.headers['x-telegram-id'] || req.body.telegram_id;
    
    if (!telegramId) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Telegram authentication required' 
      });
    }
    
    // Проверяем, существует ли пользователь
    const result = await pool.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [telegramId.toString()]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'User not found' 
      });
    }
    
    const user = result.rows[0];
    
    // Проверяем блокировку
    if (user.is_blocked) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'User is blocked' 
      });
    }
    
    // Добавляем пользователя в запрос
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

module.exports = { checkUserBlocked, requireAuth };
