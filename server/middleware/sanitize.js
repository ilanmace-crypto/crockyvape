// Упрощенный middleware для защиты от XSS (только для критических полей)
const sanitizeInput = (req, res, next) => {
  try {
    const sanitizeString = (str) => {
      if (typeof str !== 'string') return str;
      return str
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    };

    // Очищаем только критические поля в body
    if (req.body) {
      if (req.body.name) req.body.name = sanitizeString(req.body.name);
      if (req.body.description) req.body.description = sanitizeString(req.body.description);
      if (req.body.notes) req.body.notes = sanitizeString(req.body.notes);
      if (req.body.username) req.body.username = sanitizeString(req.body.username);
      if (req.body.telegram_username) req.body.telegram_username = sanitizeString(req.body.telegram_username);
    }

    // Очищаем query параметры
    if (req.query) {
      Object.keys(req.query).forEach(key => {
        if (typeof req.query[key] === 'string') {
          req.query[key] = sanitizeString(req.query[key]);
        }
      });
    }
  } catch (error) {
    console.warn('Sanitize middleware error:', error.message);
  }

  next();
};

module.exports = sanitizeInput;
