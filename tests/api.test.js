const request = require('supertest');
const path = require('path');
const fs = require('fs');

// Use a test database
const TEST_DB = path.join(__dirname, '..', 'test-inventory.db');
process.env.DB_PATH = TEST_DB;
process.env.JWT_SECRET = 'test-secret';

// Clean up before tests
if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

const app = require('../server');
const { closeDb } = require('../src/config/database');

let adminToken;
let staffToken;
let categoryId;
let productId;

afterAll(() => {
  closeDb();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

describe('Auth API', () => {
  test('POST /api/auth/login - should login admin with default credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('admin');
    adminToken = res.body.token;
  });

  test('POST /api/auth/login - should reject invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  test('POST /api/auth/login - should require username and password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('Categories API', () => {
  test('POST /api/categories - should create a category', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Beverages', description: 'Drink items' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Beverages');
    categoryId = res.body.id;
  });

  test('GET /api/categories - should list categories', async () => {
    const res = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('PUT /api/categories/:id - should update a category', async () => {
    const res = await request(app)
      .put(`/api/categories/${categoryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Beverages Updated', description: 'Updated desc' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Beverages Updated');
  });

  test('POST /api/categories - should reject duplicate names', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Beverages Updated' });
    expect(res.status).toBe(409);
  });

  test('GET /api/categories - should require auth', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(401);
  });
});

describe('Products API', () => {
  test('POST /api/products - should create a product', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sku: 'TB-001',
        name: 'Tao Bin Coffee Powder',
        category_id: categoryId,
        quantity: 100,
        min_stock: 20,
        unit: 'kg',
        location: 'Rack A1'
      });
    expect(res.status).toBe(201);
    expect(res.body.sku).toBe('TB-001');
    expect(res.body.quantity).toBe(100);
    productId = res.body.id;
  });

  test('GET /api/products - should list products', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('GET /api/products/:id - should get a product', async () => {
    const res = await request(app)
      .get(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Tao Bin Coffee Powder');
  });

  test('PUT /api/products/:id - should update a product', async () => {
    const res = await request(app)
      .put(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sku: 'TB-001', name: 'Tao Bin Premium Coffee', min_stock: 25, unit: 'kg' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Tao Bin Premium Coffee');
  });

  test('POST /api/products - should reject duplicate SKU', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sku: 'TB-001', name: 'Duplicate' });
    expect(res.status).toBe(409);
  });
});

describe('Transactions API', () => {
  test('POST /api/transactions - should create stock IN', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ product_id: productId, type: 'IN', quantity: 50, reference: 'PO-001' });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('IN');
    expect(res.body.quantity).toBe(50);
  });

  test('POST /api/transactions - should update product quantity on stock IN', async () => {
    const res = await request(app)
      .get(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.quantity).toBe(150); // 100 + 50
  });

  test('POST /api/transactions - should create stock OUT', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ product_id: productId, type: 'OUT', quantity: 30, reference: 'SO-001' });
    expect(res.status).toBe(201);
  });

  test('POST /api/transactions - should update product quantity on stock OUT', async () => {
    const res = await request(app)
      .get(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.quantity).toBe(120); // 150 - 30
  });

  test('POST /api/transactions - should reject insufficient stock', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ product_id: productId, type: 'OUT', quantity: 9999 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Insufficient stock');
  });

  test('POST /api/transactions - should validate required fields', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('GET /api/transactions - should list transactions', async () => {
    const res = await request(app)
      .get('/api/transactions')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Dashboard API', () => {
  test('GET /api/dashboard/stats - should return stats', async () => {
    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.totalProducts).toBeGreaterThan(0);
    expect(res.body.totalCategories).toBeGreaterThan(0);
  });

  test('GET /api/dashboard/low-stock - should return low stock products', async () => {
    const res = await request(app)
      .get('/api/dashboard/low-stock')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/dashboard/recent-transactions - should return recent transactions', async () => {
    const res = await request(app)
      .get('/api/dashboard/recent-transactions')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('Users API', () => {
  test('POST /api/users - should create a staff user', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'staff1', password: 'pass123', full_name: 'Staff User' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('staff');
  });

  test('POST /api/auth/login - should login as staff', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'staff1', password: 'pass123' });
    expect(res.status).toBe(200);
    staffToken = res.body.token;
  });

  test('GET /api/users - should deny staff access to user list', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
  });

  test('GET /api/users - admin should list users', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Products cleanup', () => {
  test('DELETE /api/products/:id - should delete a product', async () => {
    const res = await request(app)
      .delete(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  test('DELETE /api/categories/:id - should delete a category', async () => {
    const res = await request(app)
      .delete(`/api/categories/${categoryId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});
