import pool from './config/neon.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { category } = req.query;

      let query = `
        SELECT p.*, c.name as category_name,
               array_agg(DISTINCT pf.flavor) as flavors,
               array_agg(DISTINCT pi.url) as images
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN product_flavors pf ON p.id = pf.product_id
        LEFT JOIN product_images pi ON p.id = pi.product_id
        WHERE p.is_active = true
      `;

      const params = [];
      if (category) {
        query += ' AND c.slug = $1';
        params.push(category);
      }

      query += ' GROUP BY p.id, c.name ORDER BY p.created_at DESC';

      const result = await pool.query(query, params);

      // Get categories
      const categoriesResult = await pool.query('SELECT * FROM categories ORDER BY name');
      const categories = categoriesResult.rows;

      res.json({ products: result.rows, categories });
    } else if (req.method === 'POST') {
      // Admin create product
      const { name, description, price, category_id, flavors, images } = req.body;

      const productResult = await pool.query(
        'INSERT INTO products (name, description, price, category_id) VALUES ($1, $2, $3, $4) RETURNING id',
        [name, description, price, category_id]
      );

      const productId = productResult.rows[0].id;

      // Add flavors
      if (flavors && flavors.length > 0) {
        for (const flavor of flavors) {
          await pool.query(
            'INSERT INTO product_flavors (product_id, flavor) VALUES ($1, $2)',
            [productId, flavor]
          );
        }
      }

      // Add images
      if (images && images.length > 0) {
        for (const image of images) {
          await pool.query(
            'INSERT INTO product_images (product_id, url) VALUES ($1, $2)',
            [productId, image]
          );
        }
      }

      res.json({ ok: true, productId });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
