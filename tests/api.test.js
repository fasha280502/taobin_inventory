'use strict';

/**
 * Basic API Tests for Tao Bin Warehouse Inventory System
 * Run with: node tests/api.test.js
 */

const http = require('http');
const path = require('path');

// Start test server on a random port
process.env.PORT = '0'; // will be overridden
const TEST_PORT = 3099;
process.env.PORT = TEST_PORT;
// Use a test database
process.env.TEST_DB = 'true';

// Override db path for testing
const fs = require('fs');
const testDbPath = path.join(__dirname, '..', 'data', 'test_inventory.db');

let passed = 0;
let failed = 0;
let token = null;

// ============================================================
// Test utilities
// ============================================================
function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.log(`  ❌ ${message}`);
    failed++;
  }
}

function request(method, path, body, authToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: TEST_PORT,
      path,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (authToken) options.headers['Authorization'] = `Bearer ${authToken}`;

    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// Tests
// ============================================================
async function runTests() {
  console.log('\n🧪 Tao Bin Inventory System - API Tests\n');
  console.log('─'.repeat(50));

  // ── Health Check ─────────────────────────────────────────
  console.log('\n[1] Health Check');
  const health = await request('GET', '/api/health');
  assert(health.status === 200, 'Health endpoint returns 200');
  assert(health.body.success === true, 'Health response has success:true');
  assert(typeof health.body.version === 'string', 'Health response has version');

  // ── Auth: Login ──────────────────────────────────────────
  console.log('\n[2] Authentication');

  const badLogin = await request('POST', '/api/auth/login', { username: 'admin', password: 'wrongpass' });
  assert(badLogin.status === 401, 'Invalid credentials return 401');

  const goodLogin = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
  assert(goodLogin.status === 200, 'Valid login returns 200');
  assert(goodLogin.body.token, 'Login response contains token');
  assert(goodLogin.body.user.username === 'admin', 'Login response has correct username');
  assert(goodLogin.body.user.role === 'admin', 'Admin user has admin role');
  token = goodLogin.body.token;

  const me = await request('GET', '/api/auth/me', null, token);
  assert(me.status === 200, 'GET /auth/me returns 200');
  assert(me.body.user.username === 'admin', '/auth/me returns correct user');

  const noAuth = await request('GET', '/api/auth/me');
  assert(noAuth.status === 401, 'Missing auth token returns 401');

  // ── Categories ───────────────────────────────────────────
  console.log('\n[3] Categories');

  const cats = await request('GET', '/api/categories', null, token);
  assert(cats.status === 200, 'GET /categories returns 200');
  assert(Array.isArray(cats.body.data), 'Categories data is an array');
  assert(cats.body.data.length >= 7, 'Default categories are seeded');

  const newCat = await request('POST', '/api/categories', { name: 'Test Category X', description: 'Test' }, token);
  assert(newCat.status === 201, 'POST /categories creates category');
  assert(newCat.body.data.id, 'New category has an ID');
  const catId = newCat.body.data.id;

  const dupCat = await request('POST', '/api/categories', { name: 'Test Category X' }, token);
  assert(dupCat.status === 409, 'Duplicate category name returns 409');

  const updCat = await request('PUT', `/api/categories/${catId}`, { name: 'Test Category Updated' }, token);
  assert(updCat.status === 200, 'PUT /categories/:id updates category');

  // ── Products ─────────────────────────────────────────────
  console.log('\n[4] Products');

  const prods = await request('GET', '/api/products', null, token);
  assert(prods.status === 200, 'GET /products returns 200');
  assert(Array.isArray(prods.body.data), 'Products data is an array');

  const newProd = await request('POST', '/api/products', {
    name: 'Test Coffee Beans 1kg',
    category_id: catId,
    unit: 'bag',
    unit_cost: 45.50,
    selling_price: 60.00,
    current_stock: 50,
    minimum_stock: 10,
    reorder_point: 15,
    location: 'A-01',
  }, token);
  assert(newProd.status === 201, 'POST /products creates product');
  assert(newProd.body.data.id, 'New product has an ID');
  const prodId = newProd.body.data.id;
  const prodSku = newProd.body.data.sku;

  const getProd = await request('GET', `/api/products/${prodId}`, null, token);
  assert(getProd.status === 200, 'GET /products/:id returns 200');
  assert(getProd.body.data.name === 'Test Coffee Beans 1kg', 'Product has correct name');
  assert(getProd.body.data.current_stock === 50, 'Product has correct initial stock');

  const searchProd = await request('GET', '/api/products?search=Coffee+Beans', null, token);
  assert(searchProd.status === 200, 'Product search returns 200');
  assert(searchProd.body.data.length >= 1, 'Product search finds results');

  const dupSku = await request('POST', '/api/products', { name: 'Duplicate SKU', sku: prodSku }, token);
  assert(dupSku.status === 409, 'Duplicate SKU returns 409');

  const updProd = await request('PUT', `/api/products/${prodId}`, { selling_price: 65.00 }, token);
  assert(updProd.status === 200, 'PUT /products/:id updates product');

  // ── Transactions ─────────────────────────────────────────
  console.log('\n[5] Transactions');

  // Stock IN
  const txIn = await request('POST', '/api/transactions/in', {
    product_id: prodId,
    quantity: 20,
    unit_cost: 45.00,
    reference_no: 'PO-TEST-001',
    notes: 'Test stock in',
  }, token);
  assert(txIn.status === 201, 'POST /transactions/in creates IN transaction');
  assert(txIn.body.data.transaction_no.startsWith('IN-'), 'IN transaction has correct prefix');
  assert(txIn.body.data.new_stock === 70, 'Stock updated correctly after IN');

  // Stock OUT
  const txOut = await request('POST', '/api/transactions/out', {
    product_id: prodId,
    quantity: 5,
    reference_no: 'WO-TEST-001',
  }, token);
  assert(txOut.status === 201, 'POST /transactions/out creates OUT transaction');
  assert(txOut.body.data.new_stock === 65, 'Stock updated correctly after OUT');

  // Insufficient stock
  const txInsufficientOut = await request('POST', '/api/transactions/out', {
    product_id: prodId,
    quantity: 9999,
  }, token);
  assert(txInsufficientOut.status === 400, 'Insufficient stock returns 400');

  // Stock Adjustment
  const txAdj = await request('POST', '/api/transactions/adjustment', {
    product_id: prodId,
    new_quantity: 60,
    notes: 'Physical count adjustment',
  }, token);
  assert(txAdj.status === 201, 'POST /transactions/adjustment works');
  assert(txAdj.body.data.new_stock === 60, 'Adjustment sets correct stock');
  assert(txAdj.body.data.old_stock === 65, 'Adjustment records old stock');

  // Get transactions
  const txList = await request('GET', `/api/transactions?product_id=${prodId}`, null, token);
  assert(txList.status === 200, 'GET /transactions returns 200');
  assert(txList.body.data.length >= 3, 'Transactions list contains records');

  // ── Low Stock Alert ───────────────────────────────────────
  console.log('\n[6] Low Stock & Reports');

  const lowStock = await request('GET', '/api/products/low-stock', null, token);
  assert(lowStock.status === 200, 'GET /products/low-stock returns 200');

  const dashboard = await request('GET', '/api/reports/dashboard', null, token);
  assert(dashboard.status === 200, 'GET /reports/dashboard returns 200');
  assert(typeof dashboard.body.data.summary.total_products === 'number', 'Dashboard has total_products');
  assert(typeof dashboard.body.data.summary.total_inventory_value === 'number', 'Dashboard has inventory_value');
  assert(Array.isArray(dashboard.body.data.recent_transactions), 'Dashboard has recent_transactions');
  assert(Array.isArray(dashboard.body.data.low_stock_products), 'Dashboard has low_stock_products');

  const invReport = await request('GET', '/api/reports/inventory', null, token);
  assert(invReport.status === 200, 'GET /reports/inventory returns 200');
  assert(Array.isArray(invReport.body.data.products), 'Inventory report has products array');

  const txReport = await request('GET', '/api/reports/transactions', null, token);
  assert(txReport.status === 200, 'GET /reports/transactions returns 200');
  assert(txReport.body.data.summary, 'Transaction report has summary');

  // ── Users ─────────────────────────────────────────────────
  console.log('\n[7] User Management');

  const usersList = await request('GET', '/api/auth/users', null, token);
  assert(usersList.status === 200, 'GET /auth/users returns 200');

  const newUser = await request('POST', '/api/auth/users', {
    username: 'teststaff1',
    password: 'staff123',
    full_name: 'Test Staff Member',
    role: 'staff',
    email: 'staff@taobin.com',
  }, token);
  assert(newUser.status === 201, 'POST /auth/users creates user');

  const dupUser = await request('POST', '/api/auth/users', {
    username: 'teststaff1',
    password: 'staff123',
    full_name: 'Duplicate User',
    role: 'staff',
  }, token);
  assert(dupUser.status === 409, 'Duplicate username returns 409');

  // Login as staff
  const staffLogin = await request('POST', '/api/auth/login', { username: 'teststaff1', password: 'staff123' });
  assert(staffLogin.status === 200, 'Staff can login');
  const staffToken = staffLogin.body.token;

  // Staff cannot create categories (manager+ only)
  const staffCatCreate = await request('POST', '/api/categories', { name: 'Staff Category' }, staffToken);
  assert(staffCatCreate.status === 403, 'Staff cannot create categories (403)');

  // Staff cannot create products
  const staffProdCreate = await request('POST', '/api/products', { name: 'Staff Product' }, staffToken);
  assert(staffProdCreate.status === 403, 'Staff cannot create products (403)');

  // Staff can do stock in/out
  const staffTxIn = await request('POST', '/api/transactions/in', { product_id: prodId, quantity: 5 }, staffToken);
  assert(staffTxIn.status === 201, 'Staff can record stock IN');

  // Cleanup: delete test category (should fail since it has products)
  const delCatWithProds = await request('DELETE', `/api/categories/${catId}`, null, token);
  assert(delCatWithProds.status === 400, 'Cannot delete category with active products');

  // Deactivate test product first
  await request('DELETE', `/api/products/${prodId}`, null, token);
  const delCat = await request('DELETE', `/api/categories/${catId}`, null, token);
  assert(delCat.status === 200, 'Category deleted after products deactivated');

  // ── Summary ───────────────────────────────────────────────
  console.log('\n' + '─'.repeat(50));
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    console.log('⚠️  Some tests failed!\n');
    process.exit(1);
  } else {
    console.log('🎉 All tests passed!\n');
    process.exit(0);
  }
}

// ── Start server for testing ──────────────────────────────
// Clean test database
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

// Patch db path for tests
const dbModule = require('../database/db');
const origGetDb = dbModule.getDb;

const app = require('../server');

// Wait for server to start then run tests
setTimeout(async () => {
  try {
    await runTests();
  } catch (err) {
    console.error('\n❌ Test runner error:', err.message);
    process.exit(1);
  }
}, 1000);
