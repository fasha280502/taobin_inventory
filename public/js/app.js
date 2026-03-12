/* Tao Bin Malaysia - Warehouse Inventory System - Frontend App */
'use strict';

// ============================================================
// STATE & CONFIG
// ============================================================
const API_BASE = '/api';
let currentUser = null;
let token = localStorage.getItem('tb_token') || null;
let currentPage = 'dashboard';
let allProducts = [];
let allCategories = [];
let allSuppliers = [];
let lowStockCount = 0;

// Pagination state per page
const pagination = {
  transactions: { offset: 0, limit: 50, total: 0 },
};

// ============================================================
// API HELPER
// ============================================================
async function api(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  } catch (err) {
    throw err;
  }
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast-item ${type}`;
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
  toast.innerHTML = `<strong>${icon}</strong> ${message}`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)'; toast.style.transition = '0.3s'; setTimeout(() => toast.remove(), 300); }, 3500);
}

// ============================================================
// AUTH
// ============================================================
async function login() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('login-btn');
  const errEl = document.getElementById('login-error');

  if (!username || !password) {
    errEl.textContent = 'Please enter username and password';
    errEl.classList.remove('d-none');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Logging in...';
  errEl.classList.add('d-none');

  try {
    const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('tb_token', token);
    localStorage.setItem('tb_user', JSON.stringify(currentUser));
    initApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('d-none');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>Login';
  }
}

async function logout() {
  try { await api('/auth/logout', { method: 'POST' }); } catch {}
  token = null;
  currentUser = null;
  localStorage.removeItem('tb_token');
  localStorage.removeItem('tb_user');
  document.getElementById('auth-page').style.display = 'flex';
  document.getElementById('main-app').style.display = 'none';
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
}

// ============================================================
// APP INIT
// ============================================================
async function initApp() {
  document.getElementById('auth-page').style.display = 'none';
  document.getElementById('main-app').style.display = 'flex';

  // Set user info in sidebar
  const initials = currentUser.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  document.getElementById('sidebar-user-avatar').textContent = initials;
  document.getElementById('sidebar-user-name').textContent = currentUser.full_name;
  document.getElementById('sidebar-user-role').textContent = currentUser.role;

  // Show/hide admin-only nav items
  if (currentUser.role === 'admin' || currentUser.role === 'manager') {
    document.querySelectorAll('.nav-admin').forEach(el => el.classList.remove('d-none'));
  }

  await loadData();
  navigateTo('dashboard');
}

async function loadData() {
  try {
    const [catData, supData] = await Promise.all([
      api('/categories'),
      api('/suppliers'),
    ]);
    allCategories = catData.data || [];
    allSuppliers = supData.data || [];
  } catch {}
}

// ============================================================
// NAVIGATION
// ============================================================
function navigateTo(page) {
  currentPage = page;

  // Update active nav link
  document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === page);
  });

  // Show/hide page sections
  document.querySelectorAll('.page-section').forEach(sec => {
    sec.classList.toggle('active', sec.id === `page-${page}`);
  });

  // Update top bar title
  const titles = {
    dashboard: 'Dashboard',
    products: 'Products',
    categories: 'Categories',
    suppliers: 'Suppliers',
    'stock-in': 'Stock IN',
    'stock-out': 'Stock OUT',
    transactions: 'Transaction History',
    reports: 'Reports',
    users: 'User Management',
    settings: 'Settings',
  };
  document.getElementById('page-title').textContent = titles[page] || page;
  document.getElementById('page-date').textContent = new Date().toLocaleDateString('en-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Load page data
  switch (page) {
    case 'dashboard': loadDashboard(); break;
    case 'products': loadProducts(); break;
    case 'categories': loadCategories(); break;
    case 'suppliers': loadSuppliers(); break;
    case 'stock-in': loadStockInPage(); break;
    case 'stock-out': loadStockOutPage(); break;
    case 'transactions': loadTransactions(); break;
    case 'reports': loadReports(); break;
    case 'users': loadUsers(); break;
  }
}

// ============================================================
// DASHBOARD
// ============================================================
async function loadDashboard() {
  try {
    const data = await api('/reports/dashboard');
    const d = data.data;

    document.getElementById('stat-total-products').textContent = d.summary.total_products;
    document.getElementById('stat-low-stock').textContent = d.summary.low_stock_items;
    document.getElementById('stat-out-of-stock').textContent = d.summary.out_of_stock_items;
    document.getElementById('stat-inventory-value').textContent = `RM ${formatNumber(d.summary.total_inventory_value)}`;
    document.getElementById('stat-today-in').textContent = d.today.stock_in.qty;
    document.getElementById('stat-today-out').textContent = d.today.stock_out.qty;

    lowStockCount = d.summary.low_stock_items;
    const badge = document.getElementById('low-stock-badge');
    if (lowStockCount > 0) {
      badge.textContent = lowStockCount;
      badge.style.display = 'inline';
    } else {
      badge.style.display = 'none';
    }

    // Low stock alert
    const alertEl = document.getElementById('low-stock-alert');
    if (d.summary.low_stock_items > 0) {
      alertEl.style.display = 'flex';
      alertEl.querySelector('span').textContent = `${d.summary.low_stock_items} item(s) are at or below reorder point. ${d.summary.out_of_stock_items} item(s) are out of stock.`;
    } else {
      alertEl.style.display = 'none';
    }

    // Low stock table
    renderLowStockTable(d.low_stock_products);

    // Recent transactions
    renderRecentTransactions(d.recent_transactions);

    // Category distribution
    renderCategoryChart(d.category_distribution);

    // Monthly chart
    renderMonthlyChart(d.monthly_activity);

  } catch (err) {
    showToast('Failed to load dashboard: ' + err.message, 'error');
  }
}

function renderLowStockTable(products) {
  const tbody = document.getElementById('low-stock-tbody');
  if (!products.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">No low stock items 🎉</td></tr>';
    return;
  }
  tbody.innerHTML = products.map(p => {
    const badge = getStockBadge(p.current_stock, p.reorder_point, p.minimum_stock);
    return `<tr>
      <td><code class="text-muted">${p.sku}</code></td>
      <td>${escHtml(p.name)}</td>
      <td>${escHtml(p.category_name || '-')}</td>
      <td><strong>${p.current_stock}</strong> ${p.unit}</td>
      <td>${p.reorder_point}</td>
      <td>${badge}</td>
    </tr>`;
  }).join('');
}

function renderRecentTransactions(txns) {
  const tbody = document.getElementById('recent-tx-tbody');
  if (!txns.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">No transactions yet</td></tr>';
    return;
  }
  tbody.innerHTML = txns.map(t => `<tr>
    <td><code>${t.transaction_no}</code></td>
    <td>${getTypeBadge(t.type)}</td>
    <td>${escHtml(t.product_name)}</td>
    <td class="${t.type === 'IN' ? 'text-success' : 'text-danger'}">${t.type === 'IN' ? '+' : '-'}${Math.abs(t.quantity)}</td>
    <td class="text-muted">${formatDateTime(t.created_at)}</td>
  </tr>`).join('');
}

function renderCategoryChart(categories) {
  const el = document.getElementById('category-chart');
  if (!categories.length) { el.innerHTML = '<div class="empty-state"><i class="fas fa-chart-pie"></i>No data</div>'; return; }
  const total = categories.reduce((s, c) => s + (c.value || 0), 0);
  const colors = ['#e31e24', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];
  el.innerHTML = categories.slice(0, 7).map((c, i) => {
    const pct = total > 0 ? ((c.value / total) * 100).toFixed(1) : 0;
    return `<div class="d-flex align-items-center gap-2 mb-2">
      <div style="width:12px;height:12px;border-radius:3px;background:${colors[i % colors.length]};flex-shrink:0"></div>
      <div class="flex-grow-1" style="font-size:0.82rem">${escHtml(c.category_name)}</div>
      <div style="font-size:0.78rem;color:#6b7280">${c.product_count} items</div>
      <div style="font-size:0.8rem;font-weight:600;min-width:60px;text-align:right">RM ${formatNumber(c.value)}</div>
    </div>
    <div style="background:#f3f4f6;border-radius:4px;height:6px;margin-bottom:0.5rem">
      <div style="width:${pct}%;background:${colors[i % colors.length]};height:100%;border-radius:4px"></div>
    </div>`;
  }).join('');
}

function renderMonthlyChart(activity) {
  const el = document.getElementById('monthly-chart');
  if (!activity.length) { el.innerHTML = '<div class="empty-state"><i class="fas fa-chart-bar"></i>No data</div>'; return; }

  // Group by month
  const months = {};
  activity.forEach(a => {
    if (!months[a.month]) months[a.month] = { IN: 0, OUT: 0 };
    months[a.month][a.type] = a.total_qty;
  });

  const maxVal = Math.max(...Object.values(months).flatMap(m => [m.IN, m.OUT]), 1);
  el.innerHTML = `<div class="d-flex align-items-end gap-2" style="height:120px;overflow-x:auto;padding:0 0.5rem">
    ${Object.entries(months).map(([month, vals]) => {
      const inH = Math.round((vals.IN / maxVal) * 100);
      const outH = Math.round((vals.OUT / maxVal) * 100);
      return `<div class="text-center flex-fill" style="min-width:60px">
        <div style="font-size:0.65rem;color:#9ca3af;margin-bottom:2px">${vals.IN > 0 ? '+'+vals.IN : ''}</div>
        <div class="d-flex gap-1 align-items-end justify-content-center" style="height:80px">
          <div style="width:14px;background:#10b981;height:${inH}%;border-radius:2px 2px 0 0" title="IN: ${vals.IN}"></div>
          <div style="width:14px;background:#ef4444;height:${outH}%;border-radius:2px 2px 0 0" title="OUT: ${vals.OUT}"></div>
        </div>
        <div style="font-size:0.62rem;color:#9ca3af;margin-top:2px">${month.slice(5)}</div>
      </div>`;
    }).join('')}
  </div>
  <div class="d-flex gap-3 justify-content-center mt-2" style="font-size:0.75rem">
    <span><span style="color:#10b981">■</span> Stock IN</span>
    <span><span style="color:#ef4444">■</span> Stock OUT</span>
  </div>`;
}

// ============================================================
// PRODUCTS
// ============================================================
async function loadProducts() {
  const search = document.getElementById('product-search')?.value || '';
  const category = document.getElementById('product-category-filter')?.value || '';
  const lowStock = document.getElementById('product-low-stock-filter')?.checked || false;

  try {
    let endpoint = '/products?';
    if (search) endpoint += `search=${encodeURIComponent(search)}&`;
    if (category) endpoint += `category_id=${category}&`;
    if (lowStock) endpoint += 'low_stock=true&';

    const data = await api(endpoint);
    allProducts = data.data || [];
    renderProductsTable(allProducts);
    populateCategoryFilter('product-category-filter');
  } catch (err) {
    showToast('Failed to load products: ' + err.message, 'error');
  }
}

function renderProductsTable(products) {
  const tbody = document.getElementById('products-tbody');
  const countEl = document.getElementById('products-count');
  if (countEl) countEl.textContent = `${products.length} item(s)`;

  if (!products.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state"><i class="fas fa-box-open"></i><br>No products found</td></tr>';
    return;
  }

  tbody.innerHTML = products.map(p => {
    const badge = getStockBadge(p.current_stock, p.reorder_point, p.minimum_stock);
    const canEdit = currentUser.role === 'admin' || currentUser.role === 'manager';
    return `<tr>
      <td><code class="text-muted" style="font-size:0.78rem">${escHtml(p.sku)}</code></td>
      <td>
        <div style="font-weight:600;font-size:0.88rem">${escHtml(p.name)}</div>
        ${p.location ? `<div style="font-size:0.75rem;color:#9ca3af"><i class="fas fa-map-marker-alt"></i> ${escHtml(p.location)}</div>` : ''}
      </td>
      <td><span class="badge bg-light text-dark" style="font-size:0.75rem">${escHtml(p.category_name || '-')}</span></td>
      <td class="text-end"><strong>${p.current_stock}</strong> <span class="text-muted">${p.unit}</span></td>
      <td class="text-end text-muted">${p.reorder_point}</td>
      <td>${badge}</td>
      <td class="text-end">RM ${formatNumber(p.unit_cost)}</td>
      <td class="text-end">RM ${formatNumber(p.current_stock * p.unit_cost)}</td>
      <td>
        <div class="d-flex gap-1">
          <button class="btn btn-sm btn-outline-secondary" onclick="viewProduct(${p.id})" title="View"><i class="fas fa-eye"></i></button>
          ${canEdit ? `<button class="btn btn-sm btn-outline-primary" onclick="editProduct(${p.id})" title="Edit"><i class="fas fa-edit"></i></button>` : ''}
          ${canEdit ? `<button class="btn btn-sm btn-outline-success" onclick="quickStockIn(${p.id})" title="Stock IN"><i class="fas fa-plus"></i></button>` : ''}
          ${canEdit ? `<button class="btn btn-sm btn-outline-danger" onclick="quickStockOut(${p.id})" title="Stock OUT"><i class="fas fa-minus"></i></button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');
}

function populateCategoryFilter(selectId) {
  const el = document.getElementById(selectId);
  if (!el) return;
  const current = el.value;
  el.innerHTML = '<option value="">All Categories</option>' +
    allCategories.map(c => `<option value="${c.id}" ${c.id == current ? 'selected' : ''}>${escHtml(c.name)}</option>`).join('');
}

async function viewProduct(id) {
  try {
    const data = await api(`/products/${id}`);
    const p = data.data;
    const modal = document.getElementById('product-view-modal');
    document.getElementById('view-product-title').textContent = p.name;
    document.getElementById('view-product-body').innerHTML = `
      <div class="row g-3">
        <div class="col-6"><label class="form-label text-muted">SKU</label><p><code>${escHtml(p.sku)}</code></p></div>
        <div class="col-6"><label class="form-label text-muted">Category</label><p>${escHtml(p.category_name || '-')}</p></div>
        <div class="col-6"><label class="form-label text-muted">Unit</label><p>${escHtml(p.unit)}</p></div>
        <div class="col-6"><label class="form-label text-muted">Location</label><p>${escHtml(p.location || '-')}</p></div>
        <div class="col-4"><label class="form-label text-muted">Current Stock</label><p class="fs-5 fw-bold">${p.current_stock}</p></div>
        <div class="col-4"><label class="form-label text-muted">Reorder Point</label><p>${p.reorder_point}</p></div>
        <div class="col-4"><label class="form-label text-muted">Min Stock</label><p>${p.minimum_stock}</p></div>
        <div class="col-6"><label class="form-label text-muted">Unit Cost</label><p>RM ${formatNumber(p.unit_cost)}</p></div>
        <div class="col-6"><label class="form-label text-muted">Selling Price</label><p>RM ${formatNumber(p.selling_price)}</p></div>
        <div class="col-12"><label class="form-label text-muted">Total Value</label><p class="text-success fw-bold">RM ${formatNumber(p.current_stock * p.unit_cost)}</p></div>
        ${p.description ? `<div class="col-12"><label class="form-label text-muted">Description</label><p>${escHtml(p.description)}</p></div>` : ''}
      </div>
      <hr>
      <h6>Recent Transactions</h6>
      ${p.recent_transactions.length ? `<div class="table-responsive"><table class="table table-sm">
        <thead><tr><th>No.</th><th>Type</th><th>Qty</th><th>Date</th></tr></thead>
        <tbody>${p.recent_transactions.map(t => `<tr>
          <td><code>${t.transaction_no}</code></td>
          <td>${getTypeBadge(t.type)}</td>
          <td class="${t.type === 'IN' ? 'text-success' : 'text-danger'}">${t.type === 'IN' ? '+' : '-'}${Math.abs(t.quantity)}</td>
          <td>${formatDateTime(t.created_at)}</td>
        </tr>`).join('')}</tbody>
      </table></div>` : '<p class="text-muted">No transactions</p>'}
    `;
    new bootstrap.Modal(modal).show();
  } catch (err) {
    showToast('Failed to load product: ' + err.message, 'error');
  }
}

function openAddProductModal() {
  const modal = document.getElementById('product-modal');
  document.getElementById('product-modal-title').textContent = 'Add New Product';
  document.getElementById('product-form').reset();
  document.getElementById('product-id').value = '';
  populateProductFormSelects();
  new bootstrap.Modal(modal).show();
}

async function editProduct(id) {
  try {
    const data = await api(`/products/${id}`);
    const p = data.data;
    document.getElementById('product-modal-title').textContent = 'Edit Product';
    document.getElementById('product-id').value = p.id;
    document.getElementById('f-product-sku').value = p.sku;
    document.getElementById('f-product-name').value = p.name;
    document.getElementById('f-product-description').value = p.description || '';
    document.getElementById('f-product-unit').value = p.unit;
    document.getElementById('f-product-unit-cost').value = p.unit_cost;
    document.getElementById('f-product-selling-price').value = p.selling_price;
    document.getElementById('f-product-current-stock').value = p.current_stock;
    document.getElementById('f-product-min-stock').value = p.minimum_stock;
    document.getElementById('f-product-max-stock').value = p.maximum_stock;
    document.getElementById('f-product-reorder').value = p.reorder_point;
    document.getElementById('f-product-location').value = p.location || '';
    document.getElementById('f-product-barcode').value = p.barcode || '';
    populateProductFormSelects(p.category_id, p.supplier_id);
    new bootstrap.Modal(document.getElementById('product-modal')).show();
  } catch (err) {
    showToast('Failed to load product: ' + err.message, 'error');
  }
}

function populateProductFormSelects(selectedCategory, selectedSupplier) {
  const catEl = document.getElementById('f-product-category');
  const supEl = document.getElementById('f-product-supplier');
  if (catEl) catEl.innerHTML = '<option value="">-- Select Category --</option>' + allCategories.map(c => `<option value="${c.id}" ${c.id == selectedCategory ? 'selected' : ''}>${escHtml(c.name)}</option>`).join('');
  if (supEl) supEl.innerHTML = '<option value="">-- Select Supplier --</option>' + allSuppliers.filter(s => s.is_active).map(s => `<option value="${s.id}" ${s.id == selectedSupplier ? 'selected' : ''}>${escHtml(s.name)}</option>`).join('');
}

async function saveProduct() {
  const id = document.getElementById('product-id').value;
  const payload = {
    sku: document.getElementById('f-product-sku').value.trim(),
    name: document.getElementById('f-product-name').value.trim(),
    description: document.getElementById('f-product-description').value.trim(),
    category_id: document.getElementById('f-product-category').value || null,
    supplier_id: document.getElementById('f-product-supplier').value || null,
    unit: document.getElementById('f-product-unit').value,
    unit_cost: parseFloat(document.getElementById('f-product-unit-cost').value) || 0,
    selling_price: parseFloat(document.getElementById('f-product-selling-price').value) || 0,
    current_stock: parseInt(document.getElementById('f-product-current-stock').value) || 0,
    minimum_stock: parseInt(document.getElementById('f-product-min-stock').value) || 0,
    maximum_stock: parseInt(document.getElementById('f-product-max-stock').value) || 9999,
    reorder_point: parseInt(document.getElementById('f-product-reorder').value) || 0,
    location: document.getElementById('f-product-location').value.trim(),
    barcode: document.getElementById('f-product-barcode').value.trim(),
  };

  if (!payload.name) { showToast('Product name is required', 'error'); return; }

  try {
    if (id) {
      await api(`/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Product updated successfully');
    } else {
      await api('/products', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Product created successfully');
    }
    bootstrap.Modal.getInstance(document.getElementById('product-modal'))?.hide();
    loadProducts();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function quickStockIn(productId) {
  navigateTo('stock-in');
  setTimeout(() => {
    const sel = document.getElementById('si-product');
    if (sel) { sel.value = productId; sel.dispatchEvent(new Event('change')); }
  }, 300);
}

function quickStockOut(productId) {
  navigateTo('stock-out');
  setTimeout(() => {
    const sel = document.getElementById('so-product');
    if (sel) { sel.value = productId; sel.dispatchEvent(new Event('change')); }
  }, 300);
}

// ============================================================
// CATEGORIES
// ============================================================
async function loadCategories() {
  try {
    const data = await api('/categories');
    allCategories = data.data || [];
    renderCategoriesTable(allCategories);
  } catch (err) {
    showToast('Failed to load categories: ' + err.message, 'error');
  }
}

function renderCategoriesTable(cats) {
  const tbody = document.getElementById('categories-tbody');
  if (!cats.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">No categories found</td></tr>';
    return;
  }
  const canEdit = currentUser.role === 'admin' || currentUser.role === 'manager';
  tbody.innerHTML = cats.map(c => `<tr>
    <td>${escHtml(c.name)}</td>
    <td>${escHtml(c.description || '-')}</td>
    <td><span class="badge bg-primary rounded-pill">${c.product_count || 0}</span></td>
    <td>
      ${canEdit ? `<button class="btn btn-sm btn-outline-primary me-1" onclick="editCategory(${c.id}, '${escAttr(c.name)}', '${escAttr(c.description || '')}')"><i class="fas fa-edit"></i></button>` : ''}
      ${currentUser.role === 'admin' && (c.product_count || 0) === 0 ? `<button class="btn btn-sm btn-outline-danger" onclick="deleteCategory(${c.id}, '${escAttr(c.name)}')"><i class="fas fa-trash"></i></button>` : ''}
    </td>
  </tr>`).join('');
}

function openAddCategoryModal() {
  document.getElementById('category-modal-title').textContent = 'Add Category';
  document.getElementById('category-form').reset();
  document.getElementById('category-id').value = '';
  new bootstrap.Modal(document.getElementById('category-modal')).show();
}

function editCategory(id, name, description) {
  document.getElementById('category-modal-title').textContent = 'Edit Category';
  document.getElementById('category-id').value = id;
  document.getElementById('f-category-name').value = name;
  document.getElementById('f-category-description').value = description;
  new bootstrap.Modal(document.getElementById('category-modal')).show();
}

async function saveCategory() {
  const id = document.getElementById('category-id').value;
  const name = document.getElementById('f-category-name').value.trim();
  const description = document.getElementById('f-category-description').value.trim();
  if (!name) { showToast('Category name is required', 'error'); return; }
  try {
    if (id) {
      await api(`/categories/${id}`, { method: 'PUT', body: JSON.stringify({ name, description }) });
      showToast('Category updated');
    } else {
      await api('/categories', { method: 'POST', body: JSON.stringify({ name, description }) });
      showToast('Category created');
    }
    bootstrap.Modal.getInstance(document.getElementById('category-modal'))?.hide();
    loadCategories();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteCategory(id, name) {
  if (!confirm(`Delete category "${name}"?`)) return;
  try {
    await api(`/categories/${id}`, { method: 'DELETE' });
    showToast('Category deleted');
    loadCategories();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================================
// SUPPLIERS
// ============================================================
async function loadSuppliers() {
  try {
    const data = await api('/suppliers');
    allSuppliers = data.data || [];
    renderSuppliersTable(allSuppliers);
  } catch (err) {
    showToast('Failed to load suppliers: ' + err.message, 'error');
  }
}

function renderSuppliersTable(suppliers) {
  const tbody = document.getElementById('suppliers-tbody');
  if (!suppliers.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">No suppliers found</td></tr>';
    return;
  }
  const canEdit = currentUser.role === 'admin' || currentUser.role === 'manager';
  tbody.innerHTML = suppliers.map(s => `<tr>
    <td><strong>${escHtml(s.name)}</strong></td>
    <td>${escHtml(s.contact_person || '-')}</td>
    <td>${escHtml(s.phone || '-')}</td>
    <td>${escHtml(s.email || '-')}</td>
    <td>${escHtml(s.address || '-')}</td>
    <td>
      <span class="badge ${s.is_active ? 'bg-success' : 'bg-secondary'}">${s.is_active ? 'Active' : 'Inactive'}</span>
      ${canEdit ? `<button class="btn btn-sm btn-outline-primary ms-1" onclick="editSupplier(${s.id})"><i class="fas fa-edit"></i></button>` : ''}
    </td>
  </tr>`).join('');
}

function openAddSupplierModal() {
  document.getElementById('supplier-modal-title').textContent = 'Add Supplier';
  document.getElementById('supplier-form').reset();
  document.getElementById('supplier-id').value = '';
  new bootstrap.Modal(document.getElementById('supplier-modal')).show();
}

async function editSupplier(id) {
  const supplier = allSuppliers.find(s => s.id === id);
  if (!supplier) return;
  document.getElementById('supplier-modal-title').textContent = 'Edit Supplier';
  document.getElementById('supplier-id').value = id;
  document.getElementById('f-supplier-name').value = supplier.name;
  document.getElementById('f-supplier-contact').value = supplier.contact_person || '';
  document.getElementById('f-supplier-phone').value = supplier.phone || '';
  document.getElementById('f-supplier-email').value = supplier.email || '';
  document.getElementById('f-supplier-address').value = supplier.address || '';
  new bootstrap.Modal(document.getElementById('supplier-modal')).show();
}

async function saveSupplier() {
  const id = document.getElementById('supplier-id').value;
  const payload = {
    name: document.getElementById('f-supplier-name').value.trim(),
    contact_person: document.getElementById('f-supplier-contact').value.trim(),
    phone: document.getElementById('f-supplier-phone').value.trim(),
    email: document.getElementById('f-supplier-email').value.trim(),
    address: document.getElementById('f-supplier-address').value.trim(),
  };
  if (!payload.name) { showToast('Supplier name is required', 'error'); return; }
  try {
    if (id) {
      await api(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Supplier updated');
    } else {
      await api('/suppliers', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Supplier created');
    }
    bootstrap.Modal.getInstance(document.getElementById('supplier-modal'))?.hide();
    loadSuppliers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================================
// STOCK IN PAGE
// ============================================================
function loadStockInPage() {
  populateProductSelect('si-product');
}

function populateProductSelect(selectId, selectedId) {
  const el = document.getElementById(selectId);
  if (!el) return;
  el.innerHTML = '<option value="">-- Select Product --</option>' +
    allProducts.map(p => `<option value="${p.id}" ${p.id == selectedId ? 'selected' : ''}>[${escHtml(p.sku)}] ${escHtml(p.name)} (Stock: ${p.current_stock} ${p.unit})</option>`).join('');
}

function onStockInProductChange() {
  const id = document.getElementById('si-product').value;
  const product = allProducts.find(p => p.id == id);
  const infoEl = document.getElementById('si-product-info');
  if (product) {
    infoEl.innerHTML = `<div class="alert alert-info py-2"><strong>${escHtml(product.name)}</strong> | Current Stock: <strong>${product.current_stock} ${product.unit}</strong> | Unit Cost: RM ${formatNumber(product.unit_cost)}</div>`;
    document.getElementById('si-unit-cost').value = product.unit_cost;
  } else {
    infoEl.innerHTML = '';
  }
}

async function submitStockIn() {
  const product_id = document.getElementById('si-product').value;
  const quantity = document.getElementById('si-quantity').value;
  const unit_cost = document.getElementById('si-unit-cost').value;
  const reference_no = document.getElementById('si-reference').value.trim();
  const notes = document.getElementById('si-notes').value.trim();

  if (!product_id) { showToast('Please select a product', 'error'); return; }
  if (!quantity || quantity <= 0) { showToast('Please enter a valid quantity', 'error'); return; }

  try {
    const data = await api('/transactions/in', {
      method: 'POST',
      body: JSON.stringify({ product_id: parseInt(product_id), quantity: parseInt(quantity), unit_cost: parseFloat(unit_cost), reference_no, notes }),
    });
    showToast(`Stock IN recorded! Transaction: ${data.data.transaction_no}. New stock: ${data.data.new_stock}`);
    document.getElementById('stock-in-form').reset();
    document.getElementById('si-product-info').innerHTML = '';
    // Refresh product list in memory
    const idx = allProducts.findIndex(p => p.id == product_id);
    if (idx >= 0) allProducts[idx].current_stock = data.data.new_stock;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================================
// STOCK OUT PAGE
// ============================================================
function loadStockOutPage() {
  populateProductSelect('so-product');
}

function onStockOutProductChange() {
  const id = document.getElementById('so-product').value;
  const product = allProducts.find(p => p.id == id);
  const infoEl = document.getElementById('so-product-info');
  if (product) {
    const badge = getStockBadge(product.current_stock, product.reorder_point, product.minimum_stock);
    infoEl.innerHTML = `<div class="alert ${product.current_stock === 0 ? 'alert-danger' : 'alert-info'} py-2"><strong>${escHtml(product.name)}</strong> | Current Stock: <strong>${product.current_stock} ${product.unit}</strong> ${badge}</div>`;
    document.getElementById('so-max-qty').textContent = `Max: ${product.current_stock}`;
  } else {
    infoEl.innerHTML = '';
    document.getElementById('so-max-qty').textContent = '';
  }
}

async function submitStockOut() {
  const product_id = document.getElementById('so-product').value;
  const quantity = document.getElementById('so-quantity').value;
  const reference_no = document.getElementById('so-reference').value.trim();
  const notes = document.getElementById('so-notes').value.trim();

  if (!product_id) { showToast('Please select a product', 'error'); return; }
  if (!quantity || quantity <= 0) { showToast('Please enter a valid quantity', 'error'); return; }

  try {
    const data = await api('/transactions/out', {
      method: 'POST',
      body: JSON.stringify({ product_id: parseInt(product_id), quantity: parseInt(quantity), reference_no, notes }),
    });
    showToast(`Stock OUT recorded! Transaction: ${data.data.transaction_no}. New stock: ${data.data.new_stock}`);
    document.getElementById('stock-out-form').reset();
    document.getElementById('so-product-info').innerHTML = '';
    document.getElementById('so-max-qty').textContent = '';
    const idx = allProducts.findIndex(p => p.id == product_id);
    if (idx >= 0) allProducts[idx].current_stock = data.data.new_stock;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================================
// TRANSACTIONS
// ============================================================
async function loadTransactions() {
  const type = document.getElementById('tx-type-filter')?.value || '';
  const startDate = document.getElementById('tx-start-date')?.value || '';
  const endDate = document.getElementById('tx-end-date')?.value || '';
  const { offset, limit } = pagination.transactions;

  try {
    let endpoint = `/transactions?limit=${limit}&offset=${offset}`;
    if (type) endpoint += `&type=${type}`;
    if (startDate) endpoint += `&start_date=${startDate}`;
    if (endDate) endpoint += `&end_date=${endDate}`;

    const data = await api(endpoint);
    pagination.transactions.total = data.total;
    renderTransactionsTable(data.data);
    renderTransactionsPagination();
  } catch (err) {
    showToast('Failed to load transactions: ' + err.message, 'error');
  }
}

function renderTransactionsTable(txns) {
  const tbody = document.getElementById('transactions-tbody');
  if (!txns.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><i class="fas fa-exchange-alt"></i><br>No transactions found</td></tr>';
    return;
  }
  tbody.innerHTML = txns.map(t => `<tr>
    <td><code style="font-size:0.78rem">${t.transaction_no}</code></td>
    <td>${getTypeBadge(t.type)}</td>
    <td>
      <div style="font-weight:500">${escHtml(t.product_name)}</div>
      <div style="font-size:0.75rem;color:#9ca3af">${escHtml(t.product_sku)}</div>
    </td>
    <td class="text-end ${t.type === 'IN' ? 'text-success' : 'text-danger'}"><strong>${t.type === 'IN' ? '+' : t.type === 'OUT' || t.type === 'RETURN' ? '-' : ''}${Math.abs(t.quantity)}</strong> ${t.product_unit}</td>
    <td class="text-end">RM ${formatNumber(t.unit_cost || 0)}</td>
    <td class="text-end">RM ${formatNumber(t.total_cost || 0)}</td>
    <td>${escHtml(t.user_name)}</td>
    <td class="text-muted" style="font-size:0.8rem">${formatDateTime(t.created_at)}</td>
  </tr>`).join('');
}

function renderTransactionsPagination() {
  const { offset, limit, total } = pagination.transactions;
  const el = document.getElementById('tx-pagination');
  if (!el) return;
  const totalPages = Math.ceil(total / limit);
  const currentPageNum = Math.floor(offset / limit) + 1;

  let pages = '';
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - currentPageNum) <= 2) {
      pages += `<li class="page-item ${i === currentPageNum ? 'active' : ''}">
        <button class="page-link" onclick="goToTxPage(${i})">${i}</button>
      </li>`;
    } else if (Math.abs(i - currentPageNum) === 3) {
      pages += '<li class="page-item disabled"><span class="page-link">...</span></li>';
    }
  }
  el.innerHTML = `<ul class="pagination pagination-sm mb-0">
    <li class="page-item ${offset === 0 ? 'disabled' : ''}">
      <button class="page-link" onclick="goToTxPage(${currentPageNum - 1})">Previous</button>
    </li>
    ${pages}
    <li class="page-item ${offset + limit >= total ? 'disabled' : ''}">
      <button class="page-link" onclick="goToTxPage(${currentPageNum + 1})">Next</button>
    </li>
  </ul>
  <small class="text-muted ms-3">Showing ${offset + 1}–${Math.min(offset + limit, total)} of ${total}</small>`;
}

function goToTxPage(page) {
  const { limit } = pagination.transactions;
  pagination.transactions.offset = (page - 1) * limit;
  loadTransactions();
}

// ============================================================
// REPORTS
// ============================================================
async function loadReports() {
  // Default to inventory report
  await showInventoryReport();
}

async function showInventoryReport() {
  document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('report-tab-inventory').classList.add('active');
  try {
    const data = await api('/reports/inventory');
    const d = data.data;
    document.getElementById('report-content').innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 class="mb-0">Inventory Report</h5>
          <small class="text-muted">Generated: ${formatDateTime(d.generated_at)}</small>
        </div>
        <div class="text-end">
          <div class="fw-bold text-primary">Total Items: ${d.total_products}</div>
          <div class="fw-bold text-success">Total Value: RM ${formatNumber(d.total_value)}</div>
        </div>
      </div>
      <div class="table-responsive">
        <table class="table table-hover table-sm">
          <thead>
            <tr>
              <th>SKU</th><th>Product</th><th>Category</th><th>Supplier</th>
              <th class="text-end">Stock</th><th>Unit</th>
              <th class="text-end">Unit Cost</th><th class="text-end">Value</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${d.products.map(p => `<tr>
              <td><code style="font-size:0.78rem">${escHtml(p.sku)}</code></td>
              <td>${escHtml(p.name)}</td>
              <td>${escHtml(p.category_name || '-')}</td>
              <td>${escHtml(p.supplier_name || '-')}</td>
              <td class="text-end">${p.current_stock}</td>
              <td>${p.unit}</td>
              <td class="text-end">RM ${formatNumber(p.unit_cost)}</td>
              <td class="text-end fw-bold">RM ${formatNumber(p.stock_value)}</td>
              <td>${getStockBadge(p.current_stock, p.reorder_point, p.minimum_stock)}</td>
            </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr class="table-light fw-bold">
              <td colspan="7" class="text-end">Total Inventory Value:</td>
              <td class="text-end text-success">RM ${formatNumber(d.total_value)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  } catch (err) {
    showToast('Failed to load report: ' + err.message, 'error');
  }
}

async function showTransactionReport() {
  document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('report-tab-transactions').classList.add('active');

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + '01';

  try {
    const data = await api(`/reports/transactions?start_date=${monthStart}&end_date=${today}`);
    const d = data.data;
    document.getElementById('report-content').innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 class="mb-0">Transaction Report</h5>
          <small class="text-muted">Period: ${monthStart} to ${today}</small>
        </div>
        <div class="row g-2 text-center">
          <div class="col"><div class="stat-card p-2"><div class="text-success fw-bold">+${d.summary.total_in}</div><div class="text-muted" style="font-size:0.75rem">Stock IN</div></div></div>
          <div class="col"><div class="stat-card p-2"><div class="text-danger fw-bold">-${d.summary.total_out}</div><div class="text-muted" style="font-size:0.75rem">Stock OUT</div></div></div>
          <div class="col"><div class="stat-card p-2"><div class="text-primary fw-bold">${d.summary.total_adjustments}</div><div class="text-muted" style="font-size:0.75rem">Adjustments</div></div></div>
        </div>
      </div>
      <div class="table-responsive">
        <table class="table table-hover table-sm">
          <thead>
            <tr><th>Tx No.</th><th>Type</th><th>Product</th><th class="text-end">Qty</th><th class="text-end">Value</th><th>Ref.</th><th>By</th><th>Date</th></tr>
          </thead>
          <tbody>
            ${d.transactions.map(t => `<tr>
              <td><code style="font-size:0.78rem">${t.transaction_no}</code></td>
              <td>${getTypeBadge(t.type)}</td>
              <td>${escHtml(t.product_name)}</td>
              <td class="text-end ${t.type === 'IN' ? 'text-success' : 'text-danger'}">${t.type === 'IN' ? '+' : '-'}${Math.abs(t.quantity)} ${t.product_unit}</td>
              <td class="text-end">RM ${formatNumber(t.total_cost || 0)}</td>
              <td>${escHtml(t.reference_no || '-')}</td>
              <td>${escHtml(t.user_name)}</td>
              <td style="font-size:0.78rem">${formatDateTime(t.created_at)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    showToast('Failed to load report: ' + err.message, 'error');
  }
}

// ============================================================
// USERS
// ============================================================
async function loadUsers() {
  if (currentUser.role !== 'admin') {
    document.getElementById('page-users').innerHTML = '<div class="alert alert-warning">Access restricted to administrators only.</div>';
    return;
  }
  try {
    const data = await api('/auth/users');
    renderUsersTable(data.data);
  } catch (err) {
    showToast('Failed to load users: ' + err.message, 'error');
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = users.map(u => `<tr>
    <td>${escHtml(u.username)}</td>
    <td>${escHtml(u.full_name)}</td>
    <td><span class="badge ${u.role === 'admin' ? 'bg-danger' : u.role === 'manager' ? 'bg-warning text-dark' : 'bg-primary'}">${u.role}</span></td>
    <td>${escHtml(u.email || '-')}</td>
    <td><span class="badge ${u.is_active ? 'bg-success' : 'bg-secondary'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
    <td>${formatDateTime(u.created_at)}</td>
    <td>
      <button class="btn btn-sm btn-outline-primary me-1" onclick="editUser(${u.id}, '${escAttr(u.full_name)}', '${escAttr(u.role)}', '${escAttr(u.email || '')}')"><i class="fas fa-edit"></i></button>
      ${u.id !== currentUser.id ? `<button class="btn btn-sm btn-outline-${u.is_active ? 'warning' : 'success'}" onclick="toggleUser(${u.id}, ${u.is_active})" title="${u.is_active ? 'Deactivate' : 'Activate'}"><i class="fas fa-${u.is_active ? 'ban' : 'check'}"></i></button>` : ''}
    </td>
  </tr>`).join('');
}

function openAddUserModal() {
  document.getElementById('user-modal-title').textContent = 'Add User';
  document.getElementById('user-form').reset();
  document.getElementById('user-id').value = '';
  document.getElementById('user-password-group').style.display = 'block';
  new bootstrap.Modal(document.getElementById('user-modal')).show();
}

function editUser(id, fullName, role, email) {
  document.getElementById('user-modal-title').textContent = 'Edit User';
  document.getElementById('user-id').value = id;
  document.getElementById('f-user-fullname').value = fullName;
  document.getElementById('f-user-role').value = role;
  document.getElementById('f-user-email').value = email;
  document.getElementById('user-password-group').style.display = 'none';
  new bootstrap.Modal(document.getElementById('user-modal')).show();
}

async function saveUser() {
  const id = document.getElementById('user-id').value;
  const payload = {
    full_name: document.getElementById('f-user-fullname').value.trim(),
    role: document.getElementById('f-user-role').value,
    email: document.getElementById('f-user-email').value.trim(),
  };
  if (!id) {
    payload.username = document.getElementById('f-user-username').value.trim();
    payload.password = document.getElementById('f-user-password').value;
    if (!payload.username || !payload.password) { showToast('Username and password are required', 'error'); return; }
  }
  if (!payload.full_name) { showToast('Full name is required', 'error'); return; }
  try {
    if (id) {
      await api(`/auth/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('User updated');
    } else {
      await api('/auth/users', { method: 'POST', body: JSON.stringify(payload) });
      showToast('User created');
    }
    bootstrap.Modal.getInstance(document.getElementById('user-modal'))?.hide();
    loadUsers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function toggleUser(id, isActive) {
  const action = isActive ? 'deactivate' : 'activate';
  if (!confirm(`Are you sure you want to ${action} this user?`)) return;
  try {
    await api(`/auth/users/${id}`, { method: 'PUT', body: JSON.stringify({ is_active: isActive ? 0 : 1 }) });
    showToast(`User ${action}d`);
    loadUsers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================================
// CHANGE PASSWORD
// ============================================================
async function changePassword() {
  const current = document.getElementById('cp-current').value;
  const newPass = document.getElementById('cp-new').value;
  const confirm = document.getElementById('cp-confirm').value;
  if (!current || !newPass) { showToast('All fields required', 'error'); return; }
  if (newPass !== confirm) { showToast('Passwords do not match', 'error'); return; }
  if (newPass.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
  try {
    await api('/auth/change-password', { method: 'PUT', body: JSON.stringify({ current_password: current, new_password: newPass }) });
    showToast('Password changed successfully');
    document.getElementById('change-password-form').reset();
    bootstrap.Modal.getInstance(document.getElementById('change-password-modal'))?.hide();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================================
// HELPERS
// ============================================================
function getStockBadge(current, reorderPoint, minStock) {
  if (current === 0) return '<span class="stock-badge stock-out">Out of Stock</span>';
  if (current <= reorderPoint) return '<span class="stock-badge stock-critical">Critical</span>';
  if (current <= minStock * 1.5) return '<span class="stock-badge stock-low">Low Stock</span>';
  return '<span class="stock-badge stock-ok">In Stock</span>';
}

function getTypeBadge(type) {
  const map = { IN: 'type-in', OUT: 'type-out', ADJUSTMENT: 'type-adjustment', RETURN: 'type-return', TRANSFER: 'type-transfer' };
  return `<span class="type-badge ${map[type] || ''}">${type}</span>`;
}

function formatNumber(num) {
  return (parseFloat(num) || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateTime(dt) {
  if (!dt) return '-';
  return new Date(dt).toLocaleString('en-MY', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escAttr(str) {
  if (!str) return '';
  // Escape for use inside HTML attribute values (both single and double quotes, backslash, and control chars)
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;')
    .replace(/\r/g, '')
    .replace(/\n/g, '\\n');
}

// ============================================================
// ON PAGE LOAD
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Check if already logged in
  const savedUser = localStorage.getItem('tb_user');
  if (token && savedUser) {
    currentUser = JSON.parse(savedUser);
    // Verify token is still valid
    api('/auth/me').then(data => {
      currentUser = data.user;
      initApp();
    }).catch(() => {
      token = null;
      localStorage.removeItem('tb_token');
      localStorage.removeItem('tb_user');
    });
  }

  // Login form enter key
  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') login();
  });
  document.getElementById('login-username').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('login-password').focus();
  });
});
