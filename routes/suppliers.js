'use strict';

const express = require('express');
const { getDb } = require('../database/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/suppliers
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const { active } = req.query;
  let query = 'SELECT * FROM suppliers';
  const params = [];
  if (active !== undefined) {
    query += ' WHERE is_active = ?';
    params.push(active === 'true' ? 1 : 0);
  }
  query += ' ORDER BY name';
  const suppliers = db.prepare(query).all(...params);
  res.json({ success: true, data: suppliers });
});

// GET /api/suppliers/:id
router.get('/:id', authenticate, (req, res) => {
  const db = getDb();
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  if (!supplier) {
    return res.status(404).json({ success: false, message: 'Supplier not found' });
  }
  res.json({ success: true, data: supplier });
});

// POST /api/suppliers
router.post('/', authenticate, requireRole('admin', 'manager'), (req, res) => {
  const { name, contact_person, phone, email, address } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Supplier name is required' });
  }

  const db = getDb();
  const result = db.prepare(`
    INSERT INTO suppliers (name, contact_person, phone, email, address)
    VALUES (?, ?, ?, ?, ?)
  `).run(name.trim(), contact_person || null, phone || null, email || null, address || null);

  res.status(201).json({
    success: true,
    message: 'Supplier created successfully',
    data: { id: result.lastInsertRowid, name: name.trim() },
  });
});

// PUT /api/suppliers/:id
router.put('/:id', authenticate, requireRole('admin', 'manager'), (req, res) => {
  const { name, contact_person, phone, email, address, is_active } = req.body;
  const db = getDb();
  const supplier = db.prepare('SELECT id FROM suppliers WHERE id = ?').get(req.params.id);
  if (!supplier) {
    return res.status(404).json({ success: false, message: 'Supplier not found' });
  }

  db.prepare(`
    UPDATE suppliers SET
      name = COALESCE(?, name),
      contact_person = COALESCE(?, contact_person),
      phone = COALESCE(?, phone),
      email = COALESCE(?, email),
      address = COALESCE(?, address),
      is_active = COALESCE(?, is_active),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name ? name.trim() : null,
    contact_person !== undefined ? contact_person : null,
    phone !== undefined ? phone : null,
    email !== undefined ? email : null,
    address !== undefined ? address : null,
    is_active !== undefined ? is_active : null,
    req.params.id
  );

  res.json({ success: true, message: 'Supplier updated successfully' });
});

// DELETE /api/suppliers/:id
router.delete('/:id', authenticate, requireRole('admin'), (req, res) => {
  const db = getDb();
  db.prepare('UPDATE suppliers SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Supplier deactivated successfully' });
});

module.exports = router;
