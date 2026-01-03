const crypto = require('crypto');

// Генерация CSRF токена
const generateCSRFToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Middleware для проверки CSRF токена
const csrfProtection = (req, res, next) => {
  // Пропускаем GET, HEAD, OPTIONS запросы
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Пропускаем API запросы с Authorization header
  if (req.headers.authorization) {
    return next();
  }

  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionToken = req.session?.csrfToken;

  if (!token || !sessionToken || token !== sessionToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  next();
};

// Middleware для установки CSRF токена
const setCSRFToken = (req, res, next) => {
  if (!req.session) {
    req.session = {};
  }
  req.session.csrfToken = generateCSRFToken();
  res.locals.csrfToken = req.session.csrfToken;
  next();
};

module.exports = {
  generateCSRFToken,
  csrfProtection,
  setCSRFToken
};
