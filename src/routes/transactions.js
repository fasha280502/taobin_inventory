const express = require('express');
const { getDb } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { product_id, type, limit } = req.query;
    let sql = `
      SELECT t.*, p.name as product_name, p.sku, u.full_name as performed_by_name
      FROM transactions t
      JOIN products p ON p.id = t.product_id
      LEFT JOIN users u ON u.id = t.performed_by
    `;
    const conditions = [];
    const params = [];

    if (product_id) {
      conditions.push('t.product_id = ?');
      params.push(product_id);
    }
    if (type) {
      conditions.push('t.type = ?');
      params.push(type);
    }
    if (conditions.length) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY t.created_at DESC';
    if (limit) {
      sql += ' LIMIT ?';
      params.push(parseInt(limit, 10));
    }

    const transactions = db.prepare(sql).all(...params);
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', (req, res) => {
  try {
    const { product_id, type, quantity, reference, notes } = req.body;
    if (!product_id || !type || !quantity) {
      return res.status(400).json({ error: 'product_id, type, and quantity are required' });
    }
    if (!['IN', 'OUT'].includes(type)) {
      return res.status(400).json({ error: 'Type must be IN or OUT' });
    }
    if (quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than 0' });
    }

    const db = getDb();
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    if (type === 'OUT' && product.quantity < quantity) {
      return res.status(400).json({ error: `Insufficient stock. Available: ${product.quantity}` });
    }

    const newQty = type === 'IN' ? product.quantity + quantity : product.quantity - quantity;

    const updateAndInsert = db.transaction(() => {
      db.prepare("UPDATE products SET quantity = ?, updated_at = datetime('now') WHERE id = ?")
        .run(newQty, product_id);
      const result = db.prepare(
        'INSERT INTO transactions (product_id, type, quantity, reference, notes, performed_by) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(product_id, type, quantity, reference || null, notes || null, req.user.id);
      return result;
    });

    const result = updateAndInsert();
    const transaction = db.prepare(`
      SELECT t.*, p.name as product_name, p.sku, u.full_name as performed_by_name
      FROM transactions t
      JOIN products p ON p.id = t.product_id
      LEFT JOIN users u ON u.id = t.performed_by
      WHERE t.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(transaction);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
