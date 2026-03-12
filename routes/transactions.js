'use strict';

const express = require('express');
const { getDb } = require('../database/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

function generateTxNo(type) {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return `${type}-${dateStr}-${Date.now().toString().slice(-6)}`;
}

// GET /api/transactions
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const { type, product_id, start_date, end_date, limit = 50, offset = 0 } = req.query;

  let query = `
    SELECT t.*, p.name as product_name, p.sku as product_sku, p.unit as product_unit,
           u.full_name as user_name
    FROM transactions t
    JOIN products p ON t.product_id = p.id
    JOIN users u ON t.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (type) {
    query += ' AND t.type = ?';
    params.push(type.toUpperCase());
  }
  if (product_id) {
    query += ' AND t.product_id = ?';
    params.push(product_id);
  }
  if (start_date) {
    query += ' AND date(t.created_at) >= date(?)';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND date(t.created_at) <= date(?)';
    params.push(end_date);
  }

  const total = db.prepare(query.replace('SELECT t.*, p.name as product_name, p.sku as product_sku, p.unit as product_unit,\n           u.full_name as user_name', 'SELECT COUNT(*) as cnt')).get(...params).cnt;

  query += ` ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));

  const transactions = db.prepare(query).all(...params);
  res.json({ success: true, data: transactions, total, limit: parseInt(limit), offset: parseInt(offset) });
});

// GET /api/transactions/:id
router.get('/:id', authenticate, (req, res) => {
  const db = getDb();
  const tx = db.prepare(`
    SELECT t.*, p.name as product_name, p.sku as product_sku, p.unit as product_unit,
           u.full_name as user_name
    FROM transactions t
    JOIN products p ON t.product_id = p.id
    JOIN users u ON t.user_id = u.id
    WHERE t.id = ?
  `).get(req.params.id);

  if (!tx) {
    return res.status(404).json({ success: false, message: 'Transaction not found' });
  }
  res.json({ success: true, data: tx });
});

// POST /api/transactions - Create stock IN transaction
router.post('/in', authenticate, (req, res) => {
  const { product_id, quantity, unit_cost, reference_no, notes } = req.body;

  if (!product_id || !quantity || quantity <= 0) {
    return res.status(400).json({ success: false, message: 'Product and valid quantity are required' });
  }

  const db = getDb();
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(product_id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const qty = parseInt(quantity);
  const cost = parseFloat(unit_cost) || product.unit_cost;
  const txNo = generateTxNo('IN');

  const insertTx = db.transaction(() => {
    db.prepare(`
      INSERT INTO transactions (transaction_no, type, product_id, quantity, unit_cost, total_cost, reference_no, notes, user_id)
      VALUES (?, 'IN', ?, ?, ?, ?, ?, ?, ?)
    `).run(txNo, product_id, qty, cost, cost * qty, reference_no || null, notes || null, req.user.id);

    db.prepare(`
      UPDATE products SET current_stock = current_stock + ?, updated_at = datetime('now') WHERE id = ?
    `).run(qty, product_id);
  });

  insertTx();

  const updatedProduct = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(product_id);
  res.status(201).json({
    success: true,
    message: 'Stock IN recorded successfully',
    data: { transaction_no: txNo, new_stock: updatedProduct.current_stock },
  });
});

// POST /api/transactions/out - Create stock OUT transaction
router.post('/out', authenticate, (req, res) => {
  const { product_id, quantity, reference_no, notes } = req.body;

  if (!product_id || !quantity || quantity <= 0) {
    return res.status(400).json({ success: false, message: 'Product and valid quantity are required' });
  }

  const db = getDb();
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(product_id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const qty = parseInt(quantity);
  if (product.current_stock < qty) {
    return res.status(400).json({
      success: false,
      message: `Insufficient stock. Available: ${product.current_stock}, Requested: ${qty}`,
    });
  }

  const txNo = generateTxNo('OUT');

  const insertTx = db.transaction(() => {
    db.prepare(`
      INSERT INTO transactions (transaction_no, type, product_id, quantity, unit_cost, total_cost, reference_no, notes, user_id)
      VALUES (?, 'OUT', ?, ?, ?, ?, ?, ?, ?)
    `).run(txNo, product_id, qty, product.unit_cost, product.unit_cost * qty, reference_no || null, notes || null, req.user.id);

    db.prepare(`
      UPDATE products SET current_stock = current_stock - ?, updated_at = datetime('now') WHERE id = ?
    `).run(qty, product_id);
  });

  insertTx();

  const updatedProduct = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(product_id);
  res.status(201).json({
    success: true,
    message: 'Stock OUT recorded successfully',
    data: { transaction_no: txNo, new_stock: updatedProduct.current_stock },
  });
});

// POST /api/transactions/adjustment - Stock adjustment
router.post('/adjustment', authenticate, requireRole('admin', 'manager'), (req, res) => {
  const { product_id, new_quantity, notes } = req.body;

  if (!product_id || new_quantity === undefined || new_quantity < 0) {
    return res.status(400).json({ success: false, message: 'Product and valid new quantity are required' });
  }

  const db = getDb();
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(product_id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const newQty = parseInt(new_quantity);
  const diff = newQty - product.current_stock;
  const txNo = generateTxNo('ADJ');

  const insertTx = db.transaction(() => {
    db.prepare(`
      INSERT INTO transactions (transaction_no, type, product_id, quantity, unit_cost, total_cost, notes, user_id)
      VALUES (?, 'ADJUSTMENT', ?, ?, ?, ?, ?, ?)
    `).run(
      txNo, product_id, diff, product.unit_cost,
      Math.abs(diff) * product.unit_cost,
      notes || `Stock adjusted from ${product.current_stock} to ${newQty}`,
      req.user.id,
    );

    db.prepare('UPDATE products SET current_stock = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newQty, product_id);
  });

  insertTx();

  res.status(201).json({
    success: true,
    message: 'Stock adjustment recorded successfully',
    data: { transaction_no: txNo, old_stock: product.current_stock, new_stock: newQty, difference: diff },
  });
});

// POST /api/transactions/return - Return to supplier
router.post('/return', authenticate, requireRole('admin', 'manager'), (req, res) => {
  const { product_id, quantity, reference_no, notes } = req.body;

  if (!product_id || !quantity || quantity <= 0) {
    return res.status(400).json({ success: false, message: 'Product and valid quantity are required' });
  }

  const db = getDb();
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(product_id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const qty = parseInt(quantity);
  if (product.current_stock < qty) {
    return res.status(400).json({
      success: false,
      message: `Insufficient stock for return. Available: ${product.current_stock}`,
    });
  }

  const txNo = generateTxNo('RET');

  const insertTx = db.transaction(() => {
    db.prepare(`
      INSERT INTO transactions (transaction_no, type, product_id, quantity, unit_cost, total_cost, reference_no, notes, user_id)
      VALUES (?, 'RETURN', ?, ?, ?, ?, ?, ?, ?)
    `).run(txNo, product_id, qty, product.unit_cost, product.unit_cost * qty, reference_no || null, notes || null, req.user.id);

    db.prepare('UPDATE products SET current_stock = current_stock - ?, updated_at = datetime(\'now\') WHERE id = ?').run(qty, product_id);
  });

  insertTx();

  const updatedProduct = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(product_id);
  res.status(201).json({
    success: true,
    message: 'Return recorded successfully',
    data: { transaction_no: txNo, new_stock: updatedProduct.current_stock },
  });
});

module.exports = router;
