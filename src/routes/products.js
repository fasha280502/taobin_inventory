const express = require('express');
const { getDb } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { category_id, search, low_stock } = req.query;
    let sql = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
    `;
    const conditions = [];
    const params = [];

    if (category_id) {
      conditions.push('p.category_id = ?');
      params.push(category_id);
    }
    if (search) {
      conditions.push('(p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term);
    }
    if (low_stock === 'true') {
      conditions.push('p.quantity <= p.min_stock');
    }

    if (conditions.length) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY p.name';

    const products = db.prepare(sql).all(...params);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const product = db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = ?
    `).get(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', (req, res) => {
  try {
    const { sku, name, description, category_id, quantity, min_stock, unit, location } = req.body;
    if (!sku || !name) return res.status(400).json({ error: 'SKU and name are required' });

    const db = getDb();
    const result = db.prepare(
      'INSERT INTO products (sku, name, description, category_id, quantity, min_stock, unit, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(sku, name, description || null, category_id || null, quantity || 0, min_stock || 10, unit || 'pcs', location || null);

    const product = db.prepare('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?')
      .get(result.lastInsertRowid);
    res.status(201).json(product);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'SKU already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { sku, name, description, category_id, min_stock, unit, location } = req.body;
    if (!sku || !name) return res.status(400).json({ error: 'SKU and name are required' });

    const db = getDb();
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    db.prepare(
      "UPDATE products SET sku = ?, name = ?, description = ?, category_id = ?, min_stock = ?, unit = ?, location = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(sku, name, description || null, category_id || null, min_stock || 10, unit || 'pcs', location || null, req.params.id);

    const product = db.prepare('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?')
      .get(req.params.id);
    res.json(product);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'SKU already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
