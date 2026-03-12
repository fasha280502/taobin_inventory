'use strict';

const express = require('express');
const { getDb } = require('../database/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

function generateSKU(db) {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM products').get().cnt;
  return `TB-${String(count + 1).padStart(5, '0')}`;
}

// GET /api/products
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const { search, category_id, low_stock, active } = req.query;

  let query = `
    SELECT p.*, c.name as category_name, s.name as supplier_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE 1=1
  `;
  const params = [];

  if (active !== 'false') {
    query += ' AND p.is_active = 1';
  }
  if (search) {
    query += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term);
  }
  if (category_id) {
    query += ' AND p.category_id = ?';
    params.push(category_id);
  }
  if (low_stock === 'true') {
    query += ' AND p.current_stock <= p.reorder_point';
  }

  query += ' ORDER BY p.name';
  const products = db.prepare(query).all(...params);
  res.json({ success: true, data: products, total: products.length });
});

// GET /api/products/low-stock
router.get('/low-stock', authenticate, (req, res) => {
  const db = getDb();
  const products = db.prepare(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.is_active = 1 AND p.current_stock <= p.reorder_point
    ORDER BY (p.current_stock - p.reorder_point) ASC
  `).all();
  res.json({ success: true, data: products, total: products.length });
});

// GET /api/products/:id
router.get('/:id', authenticate, (req, res) => {
  const db = getDb();
  const product = db.prepare(`
    SELECT p.*, c.name as category_name, s.name as supplier_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  // Get recent transactions
  const transactions = db.prepare(`
    SELECT t.*, u.full_name as user_name
    FROM transactions t
    JOIN users u ON t.user_id = u.id
    WHERE t.product_id = ?
    ORDER BY t.created_at DESC
    LIMIT 10
  `).all(req.params.id);

  res.json({ success: true, data: { ...product, recent_transactions: transactions } });
});

// POST /api/products
router.post('/', authenticate, requireRole('admin', 'manager'), (req, res) => {
  const {
    sku, name, description, category_id, supplier_id,
    unit, unit_cost, selling_price, current_stock,
    minimum_stock, maximum_stock, reorder_point, location, barcode,
  } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Product name is required' });
  }

  const db = getDb();
  const productSku = sku ? sku.trim() : generateSKU(db);

  const existing = db.prepare('SELECT id FROM products WHERE sku = ?').get(productSku);
  if (existing) {
    return res.status(409).json({ success: false, message: 'SKU already exists' });
  }

  if (barcode) {
    const barcodeExists = db.prepare('SELECT id FROM products WHERE barcode = ?').get(barcode);
    if (barcodeExists) {
      return res.status(409).json({ success: false, message: 'Barcode already exists' });
    }
  }

  const result = db.prepare(`
    INSERT INTO products (
      sku, name, description, category_id, supplier_id,
      unit, unit_cost, selling_price, current_stock,
      minimum_stock, maximum_stock, reorder_point, location, barcode
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    productSku,
    name.trim(),
    description || null,
    category_id || null,
    supplier_id || null,
    unit || 'pcs',
    parseFloat(unit_cost) || 0,
    parseFloat(selling_price) || 0,
    parseInt(current_stock) || 0,
    parseInt(minimum_stock) || 0,
    parseInt(maximum_stock) || 9999,
    parseInt(reorder_point) || 0,
    location || null,
    barcode || null,
  );

  // If initial stock > 0, create a transaction
  if (parseInt(current_stock) > 0) {
    const txNo = `TXN-${Date.now()}`;
    db.prepare(`
      INSERT INTO transactions (transaction_no, type, product_id, quantity, unit_cost, total_cost, notes, user_id)
      VALUES (?, 'IN', ?, ?, ?, ?, ?, ?)
    `).run(
      txNo,
      result.lastInsertRowid,
      parseInt(current_stock),
      parseFloat(unit_cost) || 0,
      (parseFloat(unit_cost) || 0) * parseInt(current_stock),
      'Initial stock entry',
      req.user.id,
    );
  }

  res.status(201).json({
    success: true,
    message: 'Product created successfully',
    data: { id: result.lastInsertRowid, sku: productSku, name: name.trim() },
  });
});

// PUT /api/products/:id
router.put('/:id', authenticate, requireRole('admin', 'manager'), (req, res) => {
  const {
    name, description, category_id, supplier_id,
    unit, unit_cost, selling_price, minimum_stock,
    maximum_stock, reorder_point, location, barcode, is_active,
  } = req.body;

  const db = getDb();
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  if (barcode) {
    const barcodeExists = db.prepare('SELECT id FROM products WHERE barcode = ? AND id != ?').get(barcode, req.params.id);
    if (barcodeExists) {
      return res.status(409).json({ success: false, message: 'Barcode already exists' });
    }
  }

  db.prepare(`
    UPDATE products SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      category_id = COALESCE(?, category_id),
      supplier_id = COALESCE(?, supplier_id),
      unit = COALESCE(?, unit),
      unit_cost = COALESCE(?, unit_cost),
      selling_price = COALESCE(?, selling_price),
      minimum_stock = COALESCE(?, minimum_stock),
      maximum_stock = COALESCE(?, maximum_stock),
      reorder_point = COALESCE(?, reorder_point),
      location = COALESCE(?, location),
      barcode = COALESCE(?, barcode),
      is_active = COALESCE(?, is_active),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name ? name.trim() : null,
    description !== undefined ? description : null,
    category_id !== undefined ? category_id : null,
    supplier_id !== undefined ? supplier_id : null,
    unit || null,
    unit_cost !== undefined ? parseFloat(unit_cost) : null,
    selling_price !== undefined ? parseFloat(selling_price) : null,
    minimum_stock !== undefined ? parseInt(minimum_stock) : null,
    maximum_stock !== undefined ? parseInt(maximum_stock) : null,
    reorder_point !== undefined ? parseInt(reorder_point) : null,
    location !== undefined ? location : null,
    barcode !== undefined ? barcode : null,
    is_active !== undefined ? is_active : null,
    req.params.id,
  );

  res.json({ success: true, message: 'Product updated successfully' });
});

// DELETE /api/products/:id
router.delete('/:id', authenticate, requireRole('admin'), (req, res) => {
  const db = getDb();
  db.prepare('UPDATE products SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Product deactivated successfully' });
});

module.exports = router;
