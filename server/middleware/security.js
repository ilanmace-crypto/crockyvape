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

  try {
    fs.appendFileSync(logFile, logLine);
  } catch (logError) {
    console.warn('Failed to write security log:', logError.message);
  }

  // Критические события также в консоль
  if (level === 'CRITICAL' || level === 'HIGH') {
    console.warn(`[SECURITY ${level}] ${message}`, logEntry);
  }
};

// Упрощенный мониторинг подозрительной активности
const detectSuspiciousActivity = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || '';
  const path = req.path;
  const method = req.method;

  // Только критические проверки для Vercel
  try {
    // Попытки SQL инъекций только в параметрах
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

    // Проверяем только query параметры (не body чтобы не сломать JSON)
    if (checkSQLInjection(req.query)) {
      securityLog('CRITICAL', 'SQL injection attempt detected', {
        ip,
        path,
        method,
        userAgent,
        query: req.query
      });
      
      // Не блокируем, а просто логируем для Vercel
      console.warn('SQL injection attempt detected from IP:', ip);
    }
  } catch (error) {
    console.warn('Security middleware error:', error.message);
  }

  next();
};

module.exports = {
  securityLog,
  detectSuspiciousActivity
};
