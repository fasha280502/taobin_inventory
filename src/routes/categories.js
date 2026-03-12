const express = require('express');
const { getDb } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const categories = db.prepare(`
      SELECT c.*, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name
    `).all();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name is required' });

    const db = getDb();
    const result = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)').run(name, description || null);
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(category);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Category name already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name is required' });

    const db = getDb();
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Category not found' });

    db.prepare("UPDATE categories SET name = ?, description = ?, updated_at = datetime('now') WHERE id = ?")
      .run(name, description || null, req.params.id);
    const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Category name already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Category not found' });

    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
