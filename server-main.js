const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve static files from React app
app.use(express.static(path.join(__dirname, 'build')));

// SQLite database connection
const db = new sqlite3.Database('./paradise-shop.db', (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Connected to SQLite database');
    initDatabase();
  }
});

// Initialize database tables
function initDatabase() {
  // Create categories table
  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT
  )`);

  // Create products table
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    category_id INTEGER,
    stock INTEGER DEFAULT 0,
    flavors TEXT,
    image TEXT,
    in_stock BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories (id)
  )`);

  // Insert default categories
  db.run(`INSERT OR IGNORE INTO categories (name, description) VALUES 
    ('Жидкости', 'Жидкости для вейпинга'),
    ('Картриджи', 'Сменные картриджи'),
    ('Одноразовые', 'Одноразовые вейпы')
  `);

  // Insert sample products if table is empty
  db.get('SELECT COUNT(*) as count FROM products', (err, row) => {
    if (!err && row.count === 0) {
      console.log('Adding sample products...');
      db.run(`INSERT INTO products (name, description, price, category_id, stock, flavors, in_stock) VALUES 
        ('BLOOD - Сочная малина', 'Жидкость HARD с вкусом сочной малины', 15.00, 1, 0, '{"Сочная малина": 15}', 1),
        ('BLOOD - Тропический микс', 'Жидкость HARD с вкусом тропического микса', 15.00, 1, 0, '{"Тропический микс": 17}', 1),
        ('Картридж Vaporesso Xros 0.6 2ml (Corex 2.0)', 'Картридж Vaporesso Xros 0.6 2ml с технологией Corex 2.0', 13.00, 2, 1, null, 1)
      `);
    }
  });

  console.log('Database initialized successfully');
}

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Products CRUD
app.get('/api/products', (req, res) => {
  db.all('SELECT * FROM products ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('Error fetching products:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.json(rows);
  });
});

app.post('/api/products', (req, res) => {
  const { name, description, price, category_id, stock, flavors, image, in_stock } = req.body;
  
  db.run(
    `INSERT INTO products (name, description, price, category_id, stock, flavors, image, in_stock) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, description, price, category_id, stock || 0, JSON.stringify(flavors), image, in_stock !== false],
    function(err) {
      if (err) {
        console.error('Error creating product:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      // Get the created product
      db.get('SELECT * FROM products WHERE id = ?', [this.lastID], (err, row) => {
        if (err) {
          console.error('Error fetching created product:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
        res.status(201).json(row);
      });
    }
  );
});

app.put('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const { name, description, price, category_id, stock, flavors, image, in_stock } = req.body;
  
  db.run(
    `UPDATE products SET name = ?, description = ?, price = ?, category_id = ?, 
     stock = ?, flavors = ?, image = ?, in_stock = ? WHERE id = ?`,
    [name, description, price, category_id, stock || 0, JSON.stringify(flavors), image, in_stock !== false, id],
    function(err) {
      if (err) {
        console.error('Error updating product:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }
      
      // Get the updated product
      db.get('SELECT * FROM products WHERE id = ?', [id], (err, row) => {
        if (err) {
          console.error('Error fetching updated product:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
        res.json(row);
      });
    }
  );
});

app.delete('/api/products/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM products WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Error deleting product:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.status(204).send();
  });
});

// Categories
app.get('/api/categories', (req, res) => {
  db.all('SELECT * FROM categories ORDER BY id', (err, rows) => {
    if (err) {
      console.error('Error fetching categories:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.json(rows);
  });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`StackBlitz deployment ready!`);
});
