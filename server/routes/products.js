const express = require('express');
const router = express.Router();

// Временное хранилище товаров (позже заменим на PostgreSQL)
let products = [
  {
    id: 1,
    name: 'PARADISE Liquid 30ml',
    price: 25,
    category: 'liquids',
    flavor: 'Mango Ice',
    stock: 50
  },
  {
    id: 2,
    name: 'Salt 20mg 30ml',
    price: 28,
    category: 'liquids',
    flavor: 'Blueberry',
    stock: 30
  },
  {
    id: 3,
    name: 'Картридж (POD) 1.0Ω',
    price: 12,
    category: 'consumables',
    stock: 100
  }
];

let nextId = 4;

// GET /api/products - получить все товары
router.get('/', (req, res) => {
  try {
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// POST /api/products - добавить новый товар
router.post('/', (req, res) => {
  try {
    const { name, price, category, flavor, stock } = req.body;
    
    if (!name || !price || !category || !stock) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const newProduct = {
      id: nextId++,
      name,
      price: Number(price),
      category,
      flavor: flavor || null,
      stock: Number(stock)
    };
    
    products.push(newProduct);
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add product' });
  }
});

// PUT /api/products/:id - обновить товар
router.put('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const productIndex = products.findIndex(p => p.id === id);
    
    if (productIndex === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const { name, price, category, flavor, stock } = req.body;
    
    const updatedProduct = {
      ...products[productIndex],
      name: name || products[productIndex].name,
      price: price ? Number(price) : products[productIndex].price,
      category: category || products[productIndex].category,
      flavor: flavor !== undefined ? flavor : products[productIndex].flavor,
      stock: stock ? Number(stock) : products[productIndex].stock
    };
    
    products[productIndex] = updatedProduct;
    res.json(updatedProduct);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/products/:id - удалить товар
router.delete('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const productIndex = products.findIndex(p => p.id === id);
    
    if (productIndex === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    products.splice(productIndex, 1);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;
