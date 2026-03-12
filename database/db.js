'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.TEST_DB === 'true'
  ? path.join(__dirname, '..', 'data', 'test_inventory.db')
  : path.join(__dirname, '..', 'data', 'inventory.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initializeDatabase() {
  const database = getDb();

  // Users table
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff' CHECK(role IN ('admin', 'manager', 'staff')),
      email TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Categories table
  database.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Suppliers table
  database.exec(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Products table
  database.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      category_id INTEGER,
      supplier_id INTEGER,
      unit TEXT NOT NULL DEFAULT 'pcs',
      unit_cost REAL NOT NULL DEFAULT 0,
      selling_price REAL NOT NULL DEFAULT 0,
      current_stock INTEGER NOT NULL DEFAULT 0,
      minimum_stock INTEGER NOT NULL DEFAULT 0,
      maximum_stock INTEGER NOT NULL DEFAULT 9999,
      reorder_point INTEGER NOT NULL DEFAULT 0,
      location TEXT,
      barcode TEXT,
      image_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
    )
  `);

  // Transactions table (stock in/out)
  database.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_no TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL CHECK(type IN ('IN', 'OUT', 'ADJUSTMENT', 'TRANSFER', 'RETURN')),
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_cost REAL,
      total_cost REAL,
      reference_no TEXT,
      notes TEXT,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Audit log table
  database.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      table_name TEXT,
      record_id INTEGER,
      old_values TEXT,
      new_values TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Create indexes
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_product ON transactions(product_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
  `);

  // Seed default admin user if not exists
  const adminExists = database.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    database.prepare(`
      INSERT INTO users (username, password, full_name, role, email)
      VALUES (?, ?, ?, ?, ?)
    `).run('admin', hashedPassword, 'System Administrator', 'admin', 'admin@taobin.com');
  }

  // Seed default categories
  const defaultCategories = [
    { name: 'Machine Parts', description: 'Spare parts and components for Tao Bin machines' },
    { name: 'Beverages', description: 'Coffee beans, syrups, and beverage ingredients' },
    { name: 'Consumables', description: 'Cups, straws, and single-use items' },
    { name: 'Cleaning Supplies', description: 'Cleaning agents and maintenance supplies' },
    { name: 'Packaging', description: 'Packaging materials and containers' },
    { name: 'Electronics', description: 'Electronic components and accessories' },
    { name: 'Office Supplies', description: 'General office and administrative supplies' },
  ];

  const insertCategory = database.prepare(`
    INSERT OR IGNORE INTO categories (name, description) VALUES (?, ?)
  `);
  for (const cat of defaultCategories) {
    insertCategory.run(cat.name, cat.description);
  }

  console.log('[Database] Initialized successfully');
  return database;
}

module.exports = { getDb, initializeDatabase };
