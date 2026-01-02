const bcrypt = require('bcrypt');
const pool = require('./config/database');

async function setupAdmin() {
  try {
    // Создаем таблицу админов если нет
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP NULL
      )
    `);

    // Создаем админа admin/paradise251208
    const hashedPassword = await bcrypt.hash('paradise251208', 10);
    
    await pool.execute(`
      INSERT IGNORE INTO admins (username, password_hash, role) 
      VALUES (?, ?, 'admin')
    `, ['admin', hashedPassword]);

    console.log('Админ создан: admin/paradise251208');
    process.exit(0);
  } catch (error) {
    console.error('Ошибка:', error);
    process.exit(1);
  }
}

setupAdmin();
