'use strict';

const express = require('express');
const { getDb } = require('../database/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/reports/dashboard
router.get('/dashboard', authenticate, (req, res) => {
  const db = getDb();

  const totalProducts = db.prepare('SELECT COUNT(*) as cnt FROM products WHERE is_active = 1').get().cnt;
  const lowStockItems = db.prepare('SELECT COUNT(*) as cnt FROM products WHERE is_active = 1 AND current_stock <= reorder_point').get().cnt;
  const outOfStockItems = db.prepare('SELECT COUNT(*) as cnt FROM products WHERE is_active = 1 AND current_stock = 0').get().cnt;
  const totalInventoryValue = db.prepare('SELECT COALESCE(SUM(current_stock * unit_cost), 0) as val FROM products WHERE is_active = 1').get().val;

  const todayTxIn = db.prepare(`
    SELECT COALESCE(SUM(quantity), 0) as qty, COALESCE(SUM(total_cost), 0) as value
    FROM transactions WHERE type = 'IN' AND date(created_at) = date('now')
  `).get();
  const todayTxOut = db.prepare(`
    SELECT COALESCE(SUM(quantity), 0) as qty, COALESCE(SUM(total_cost), 0) as value
    FROM transactions WHERE type = 'OUT' AND date(created_at) = date('now')
  `).get();

  const monthlyActivity = db.prepare(`
    SELECT
      strftime('%Y-%m', created_at) as month,
      type,
      COUNT(*) as count,
      COALESCE(SUM(ABS(quantity)), 0) as total_qty,
      COALESCE(SUM(total_cost), 0) as total_value
    FROM transactions
    WHERE created_at >= date('now', '-6 months')
    GROUP BY strftime('%Y-%m', created_at), type
    ORDER BY month ASC
  `).all();

  const lowStockProducts = db.prepare(`
    SELECT p.id, p.sku, p.name, p.current_stock, p.reorder_point, p.minimum_stock, p.unit,
           c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.is_active = 1 AND p.current_stock <= p.reorder_point
    ORDER BY p.current_stock ASC
    LIMIT 10
  `).all();

  const recentTransactions = db.prepare(`
    SELECT t.transaction_no, t.type, t.quantity, t.created_at,
           p.name as product_name, p.sku as product_sku,
           u.full_name as user_name
    FROM transactions t
    JOIN products p ON t.product_id = p.id
    JOIN users u ON t.user_id = u.id
    ORDER BY t.created_at DESC
    LIMIT 10
  `).all();

  const topMovingProducts = db.prepare(`
    SELECT p.id, p.name, p.sku, p.unit,
           COALESCE(SUM(CASE WHEN t.type = 'OUT' THEN t.quantity ELSE 0 END), 0) as total_out,
           COALESCE(SUM(CASE WHEN t.type = 'IN' THEN t.quantity ELSE 0 END), 0) as total_in
    FROM products p
    LEFT JOIN transactions t ON p.id = t.product_id AND t.created_at >= date('now', '-30 days')
    WHERE p.is_active = 1
    GROUP BY p.id
    ORDER BY total_out DESC
    LIMIT 10
  `).all();

  const categoryDistribution = db.prepare(`
    SELECT c.name as category_name, COUNT(p.id) as product_count,
           COALESCE(SUM(p.current_stock * p.unit_cost), 0) as value
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
    GROUP BY c.id
    ORDER BY value DESC
  `).all();

  res.json({
    success: true,
    data: {
      summary: {
        total_products: totalProducts,
        low_stock_items: lowStockItems,
        out_of_stock_items: outOfStockItems,
        total_inventory_value: totalInventoryValue,
      },
      today: {
        stock_in: todayTxIn,
        stock_out: todayTxOut,
      },
      monthly_activity: monthlyActivity,
      low_stock_products: lowStockProducts,
      recent_transactions: recentTransactions,
      top_moving_products: topMovingProducts,
      category_distribution: categoryDistribution,
    },
  });
});

// GET /api/reports/inventory - Full inventory report
router.get('/inventory', authenticate, (req, res) => {
  const db = getDb();
  const { category_id } = req.query;

  let query = `
    SELECT p.*, c.name as category_name, s.name as supplier_name,
           (p.current_stock * p.unit_cost) as stock_value
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE p.is_active = 1
  `;
  const params = [];
  if (category_id) {
    query += ' AND p.category_id = ?';
    params.push(category_id);
  }
  query += ' ORDER BY c.name, p.name';

  const products = db.prepare(query).all(...params);
  const totalValue = products.reduce((sum, p) => sum + (p.stock_value || 0), 0);

  res.json({
    success: true,
    data: {
      products,
      total_products: products.length,
      total_value: totalValue,
      generated_at: new Date().toISOString(),
    },
  });
});

// GET /api/reports/transactions - Transaction report
router.get('/transactions', authenticate, (req, res) => {
  const db = getDb();
  const { type, start_date, end_date, product_id } = req.query;

  let query = `
    SELECT t.*, p.name as product_name, p.sku as product_sku, p.unit as product_unit,
           u.full_name as user_name, c.name as category_name
    FROM transactions t
    JOIN products p ON t.product_id = p.id
    JOIN users u ON t.user_id = u.id
    LEFT JOIN categories c ON p.category_id = c.id
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

  query += ' ORDER BY t.created_at DESC';
  const transactions = db.prepare(query).all(...params);

  const summary = {
    total_in: 0, total_in_value: 0,
    total_out: 0, total_out_value: 0,
    total_adjustments: 0, total_returns: 0,
  };
  for (const tx of transactions) {
    if (tx.type === 'IN') { summary.total_in += tx.quantity; summary.total_in_value += tx.total_cost || 0; }
    if (tx.type === 'OUT') { summary.total_out += tx.quantity; summary.total_out_value += tx.total_cost || 0; }
    if (tx.type === 'ADJUSTMENT') summary.total_adjustments++;
    if (tx.type === 'RETURN') summary.total_returns++;
  }

  res.json({
    success: true,
    data: { transactions, summary, generated_at: new Date().toISOString() },
  });
});

// GET /api/reports/audit-log
router.get('/audit-log', authenticate, (req, res) => {
  const db = getDb();
  const { limit = 100, offset = 0 } = req.query;
  const logs = db.prepare(`
    SELECT a.*, u.username, u.full_name
    FROM audit_log a
    LEFT JOIN users u ON a.user_id = u.id
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `).all(parseInt(limit), parseInt(offset));
  const total = db.prepare('SELECT COUNT(*) as cnt FROM audit_log').get().cnt;
  res.json({ success: true, data: logs, total });
});

module.exports = router;
