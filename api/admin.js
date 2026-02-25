import pool from './config/neon.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const { action, password, ...data } = req.body;

      if (action === 'login') {
        // Check password
        const adminResult = await pool.query('SELECT id FROM admins WHERE password_hash = $1', [password]);
        if (adminResult.rows.length > 0) {
          res.json({ ok: true, adminId: adminResult.rows[0].id });
        } else {
          res.status(401).json({ error: 'Invalid password' });
        }
      } else {
        res.status(400).json({ error: 'Invalid action' });
      }
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Admin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
