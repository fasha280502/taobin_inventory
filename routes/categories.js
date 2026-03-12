'use strict';

const express = require('express');
const { getDb } = require('../database/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/categories
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const categories = db.prepare(`
    SELECT c.*, COUNT(p.id) as product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
    GROUP BY c.id
    ORDER BY c.name
  `).all();
  res.json({ success: true, data: categories });
});

// GET /api/categories/:id
router.get('/:id', authenticate, (req, res) => {
  const db = getDb();
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!category) {
    return res.status(404).json({ success: false, message: 'Category not found' });
  }
  res.json({ success: true, data: category });
});

// POST /api/categories
router.post('/', authenticate, requireRole('admin', 'manager'), (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Category name is required' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM categories WHERE name = ?').get(name.trim());
  if (existing) {
    return res.status(409).json({ success: false, message: 'Category name already exists' });
  }

  const result = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)').run(name.trim(), description || null);
  res.status(201).json({
    success: true,
    message: 'Category created successfully',
    data: { id: result.lastInsertRowid, name: name.trim(), description },
  });
});

// PUT /api/categories/:id
router.put('/:id', authenticate, requireRole('admin', 'manager'), (req, res) => {
  const { name, description } = req.body;
  const db = getDb();
  const category = db.prepare('SELECT id FROM categories WHERE id = ?').get(req.params.id);
  if (!category) {
    return res.status(404).json({ success: false, message: 'Category not found' });
  }

  if (name) {
    const existing = db.prepare('SELECT id FROM categories WHERE name = ? AND id != ?').get(name.trim(), req.params.id);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Category name already exists' });
    }
  }

  db.prepare(`
    UPDATE categories SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(name ? name.trim() : null, description !== undefined ? description : null, req.params.id);

  res.json({ success: true, message: 'Category updated successfully' });
});

// DELETE /api/categories/:id
router.delete('/:id', authenticate, requireRole('admin'), (req, res) => {
  const db = getDb();
  const category = db.prepare('SELECT id FROM categories WHERE id = ?').get(req.params.id);
  if (!category) {
    return res.status(404).json({ success: false, message: 'Category not found' });
  }

  const productCount = db.prepare('SELECT COUNT(*) as cnt FROM products WHERE category_id = ? AND is_active = 1').get(req.params.id);
  if (productCount.cnt > 0) {
    return res.status(400).json({ success: false, message: 'Cannot delete category with active products' });
  }

  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Category deleted successfully' });
});

module.exports = router;
