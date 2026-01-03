const fs = require('fs');
const path = require('path');

// Создаем директорию для логов если нет
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Функция логирования безопасности
const securityLog = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ip: meta.ip || 'unknown',
    userAgent: meta.userAgent || 'unknown',
    path: meta.path || 'unknown',
    method: meta.method || 'unknown',
    ...meta
  };

  const logFile = path.join(logDir, `security-${new Date().toISOString().split('T')[0]}.log`);
  const logLine = JSON.stringify(logEntry) + '\n';

  fs.appendFileSync(logFile, logLine);

  // Критические события также в консоль
  if (level === 'CRITICAL' || level === 'HIGH') {
    console.warn(`[SECURITY ${level}] ${message}`, logEntry);
  }
};

// Мониторинг подозрительной активности
const detectSuspiciousActivity = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || '';
  const path = req.path;
  const method = req.method;

  // Подозрительные User-Agent
  const suspiciousAgents = [
    /bot/i,
    /crawler/i,
    /scanner/i,
    /sqlmap/i,
    /nikto/i,
    /nmap/i
  ];

  if (suspiciousAgents.some(agent => agent.test(userAgent))) {
    securityLog('HIGH', 'Suspicious user agent detected', {
      ip,
      userAgent,
      path,
      method
    });
  }

  // Подозрительные пути
  const suspiciousPaths = [
    '/admin',
    '/api/admin',
    '/config',
    '/env',
    '/.env',
    '/wp-admin',
    '/phpmyadmin'
  ];

  if (suspiciousPaths.some(suspiciousPath => path.includes(suspiciousPath))) {
    securityLog('MEDIUM', 'Suspicious path access attempt', {
      ip,
      path,
      method,
      userAgent
    });
  }

  // Попытки SQL инъекций в параметрах
  const sqlInjectionPatterns = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
    /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
    /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i
  ];

  const checkSQLInjection = (obj) => {
    if (typeof obj === 'string') {
      return sqlInjectionPatterns.some(pattern => pattern.test(obj));
    }
    if (typeof obj === 'object' && obj !== null) {
      return Object.values(obj).some(checkSQLInjection);
    }
    return false;
  };

  if (checkSQLInjection(req.query) || checkSQLInjection(req.body)) {
    securityLog('CRITICAL', 'SQL injection attempt detected', {
      ip,
      path,
      method,
      userAgent,
      query: req.query,
      body: req.body
    });
    
    // Блокируем IP при попытке SQL инъекции
    return res.status(403).json({ error: 'Access denied' });
  }

  next();
};

module.exports = {
  securityLog,
  detectSuspiciousActivity
};
