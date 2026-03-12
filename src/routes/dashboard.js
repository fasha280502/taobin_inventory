const express = require('express');
const { getDb } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/stats', (req, res) => {
  try {
    const db = getDb();

    const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
    const totalCategories = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
    const lowStockCount = db.prepare('SELECT COUNT(*) as count FROM products WHERE quantity <= min_stock').get().count;
    const totalStockValue = db.prepare('SELECT COALESCE(SUM(quantity), 0) as total FROM products').get().total;

    const todayIn = db.prepare(
      "SELECT COALESCE(SUM(quantity), 0) as total FROM transactions WHERE type = 'IN' AND date(created_at) = date('now')"
    ).get().total;
    const todayOut = db.prepare(
      "SELECT COALESCE(SUM(quantity), 0) as total FROM transactions WHERE type = 'OUT' AND date(created_at) = date('now')"
    ).get().total;

    res.json({
      totalProducts,
      totalCategories,
      lowStockCount,
      totalStockValue,
      todayIn,
      todayOut
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/low-stock', (req, res) => {
  try {
    const db = getDb();
    const products = db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.quantity <= p.min_stock
      ORDER BY (p.quantity * 1.0 / p.min_stock) ASC
    `).all();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/recent-transactions', (req, res) => {
  try {
    const db = getDb();
    const transactions = db.prepare(`
      SELECT t.*, p.name as product_name, p.sku, u.full_name as performed_by_name
      FROM transactions t
      JOIN products p ON p.id = t.product_id
      LEFT JOIN users u ON u.id = t.performed_by
      ORDER BY t.created_at DESC
      LIMIT 20
    `).all();
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
