import pool from './config/neon.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const reviewsResult = await pool.query(
        'SELECT * FROM reviews WHERE is_approved = true ORDER BY created_at DESC'
      );
      res.json({ reviews: reviewsResult.rows });
    } else if (req.method === 'POST') {
      const { telegram_username, rating, review_text } = req.body;

      await pool.query(
        'INSERT INTO reviews (telegram_username, rating, review_text) VALUES ($1, $2, $3)',
        [telegram_username, rating, review_text]
      );

      res.json({ ok: true });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Reviews error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
