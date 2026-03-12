/* Tao Bin Inventory System - Frontend Application */
(function () {
  'use strict';

  const API = '/api';
  let token = localStorage.getItem('token');
  let currentUser = JSON.parse(localStorage.getItem('user') || 'null');

  // ── Helpers ──
  function headers() {
    return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
  }

  async function api(method, path, body) {
    const opts = { method, headers: headers() };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(API + path, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }
  function show(el) { el.classList.remove('d-none'); }
  function hide(el) { el.classList.add('d-none'); }

  // ── Auth ──
  function showLogin() {
    hide($('#app-page'));
    show($('#login-page'));
  }

  function showApp() {
    hide($('#login-page'));
    show($('#app-page'));
    $('#user-display').textContent = currentUser.full_name + ' (' + currentUser.role + ')';
    if (currentUser.role !== 'admin') hide($('#nav-users'));
    else show($('#nav-users'));
    navigateTo('dashboard');
  }

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = $('#login-error');
    hide(errEl);
    try {
      const data = await fetch(API + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: $('#login-username').value,
          password: $('#login-password').value
        })
      }).then(r => r.json());
      if (data.error) throw new Error(data.error);
      token = data.token;
      currentUser = data.user;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(currentUser));
      showApp();
    } catch (err) {
      errEl.textContent = err.message;
      show(errEl);
    }
  });

  $('#btn-logout').addEventListener('click', () => {
    token = null;
    currentUser = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    showLogin();
  });

  // ── Navigation ──
  function navigateTo(page) {
    $$('.page-content').forEach(el => el.classList.add('d-none'));
    $$('.sidebar .nav-link').forEach(a => a.classList.remove('active'));
    const target = $('#page-' + page);
    if (target) show(target);
    const link = document.querySelector('[data-page="' + page + '"]');
    if (link) link.classList.add('active');
    if (page === 'dashboard') loadDashboard();
    else if (page === 'products') loadProducts();
    else if (page === 'categories') loadCategories();
    else if (page === 'transactions') loadTransactions();
    else if (page === 'users') loadUsers();
  }

  $$('[data-page]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(a.dataset.page);
    });
  });

  $('#sidebar-toggle').addEventListener('click', () => {
    $('#sidebar').classList.toggle('show');
  });

  // ── Dashboard ──
  async function loadDashboard() {
    try {
      const [stats, lowStock, recent] = await Promise.all([
        api('GET', '/dashboard/stats'),
        api('GET', '/dashboard/low-stock'),
        api('GET', '/dashboard/recent-transactions')
      ]);
      const el = $('#page-dashboard');
      el.innerHTML = `
        <h4 class="mb-4">Dashboard</h4>
        <div class="row g-3 mb-4">
          <div class="col-sm-6 col-xl-3">
            <div class="card stat-card shadow-sm">
              <div class="card-body d-flex align-items-center gap-3">
                <div class="stat-icon bg-primary bg-opacity-10 text-primary"><i class="bi bi-box"></i></div>
                <div><div class="text-muted small">Products</div><div class="fs-4 fw-bold">${stats.totalProducts}</div></div>
              </div>
            </div>
          </div>
          <div class="col-sm-6 col-xl-3">
            <div class="card stat-card shadow-sm">
              <div class="card-body d-flex align-items-center gap-3">
                <div class="stat-icon bg-success bg-opacity-10 text-success"><i class="bi bi-tags"></i></div>
                <div><div class="text-muted small">Categories</div><div class="fs-4 fw-bold">${stats.totalCategories}</div></div>
              </div>
            </div>
          </div>
          <div class="col-sm-6 col-xl-3">
            <div class="card stat-card shadow-sm">
              <div class="card-body d-flex align-items-center gap-3">
                <div class="stat-icon bg-warning bg-opacity-10 text-warning"><i class="bi bi-exclamation-triangle"></i></div>
                <div><div class="text-muted small">Low Stock</div><div class="fs-4 fw-bold">${stats.lowStockCount}</div></div>
              </div>
            </div>
          </div>
          <div class="col-sm-6 col-xl-3">
            <div class="card stat-card shadow-sm">
              <div class="card-body d-flex align-items-center gap-3">
                <div class="stat-icon bg-info bg-opacity-10 text-info"><i class="bi bi-arrow-left-right"></i></div>
                <div><div class="text-muted small">Today In/Out</div><div class="fs-4 fw-bold">${stats.todayIn} / ${stats.todayOut}</div></div>
              </div>
            </div>
          </div>
        </div>
        <div class="row g-3">
          <div class="col-lg-6">
            <div class="card shadow-sm">
              <div class="card-header bg-white fw-bold"><i class="bi bi-exclamation-triangle text-warning"></i> Low Stock Alerts</div>
              <div class="card-body p-0">
                ${lowStock.length === 0 ? '<p class="p-3 text-muted mb-0">All stock levels are healthy.</p>' : `
                <div class="table-responsive">
                  <table class="table table-hover mb-0">
                    <thead><tr><th>Product</th><th>SKU</th><th>Qty</th><th>Min</th></tr></thead>
                    <tbody>${lowStock.map(p => `<tr><td>${esc(p.name)}</td><td>${esc(p.sku)}</td><td class="text-danger fw-bold">${p.quantity}</td><td>${p.min_stock}</td></tr>`).join('')}</tbody>
                  </table>
                </div>`}
              </div>
            </div>
          </div>
          <div class="col-lg-6">
            <div class="card shadow-sm">
              <div class="card-header bg-white fw-bold"><i class="bi bi-clock-history"></i> Recent Transactions</div>
              <div class="card-body p-0">
                ${recent.length === 0 ? '<p class="p-3 text-muted mb-0">No transactions yet.</p>' : `
                <div class="table-responsive">
                  <table class="table table-hover mb-0">
                    <thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Qty</th><th>By</th></tr></thead>
                    <tbody>${recent.slice(0, 10).map(t => `<tr>
                      <td class="small">${new Date(t.created_at).toLocaleString()}</td>
                      <td>${esc(t.product_name)}</td>
                      <td><span class="badge ${t.type === 'IN' ? 'badge-in' : 'badge-out'}">${t.type}</span></td>
                      <td>${t.quantity}</td>
                      <td>${esc(t.performed_by_name || '-')}</td>
                    </tr>`).join('')}</tbody>
                  </table>
                </div>`}
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      handleAuthError(err);
    }
  }

  // ── Products ──
  async function loadProducts() {
    try {
      const [products, categories] = await Promise.all([
        api('GET', '/products'),
        api('GET', '/categories')
      ]);
      const el = $('#page-products');
      const catOptions = categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
      el.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h4 class="mb-0">Products</h4>
          <button class="btn btn-primary" id="btn-add-product"><i class="bi bi-plus-lg"></i> Add Product</button>
        </div>
        <div class="card shadow-sm">
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead><tr><th>SKU</th><th>Name</th><th>Category</th><th>Qty</th><th>Min</th><th>Unit</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>${products.length === 0 ? '<tr><td colspan="9" class="text-center text-muted p-4">No products found</td></tr>' :
                  products.map(p => `<tr>
                    <td><code>${esc(p.sku)}</code></td>
                    <td>${esc(p.name)}</td>
                    <td>${esc(p.category_name || '-')}</td>
                    <td class="fw-bold">${p.quantity}</td>
                    <td>${p.min_stock}</td>
                    <td>${esc(p.unit)}</td>
                    <td>${esc(p.location || '-')}</td>
                    <td>${p.quantity <= p.min_stock ? '<span class="badge badge-low">Low</span>' : '<span class="badge badge-ok">OK</span>'}</td>
                    <td>
                      <button class="btn btn-sm btn-outline-primary me-1 btn-edit-product" data-id="${p.id}"><i class="bi bi-pencil"></i></button>
                      <button class="btn btn-sm btn-outline-danger btn-delete-product" data-id="${p.id}"><i class="bi bi-trash"></i></button>
                    </td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <!-- Product Modal -->
        <div class="modal fade" id="productModal" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
          <div class="modal-header"><h5 class="modal-title" id="productModalTitle">Add Product</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
          <form id="product-form">
            <div class="modal-body">
              <input type="hidden" id="product-id">
              <div class="row g-3">
                <div class="col-md-6"><label class="form-label">SKU *</label><input type="text" id="product-sku" class="form-control" required></div>
                <div class="col-md-6"><label class="form-label">Name *</label><input type="text" id="product-name" class="form-control" required></div>
                <div class="col-12"><label class="form-label">Description</label><textarea id="product-desc" class="form-control" rows="2"></textarea></div>
                <div class="col-md-6"><label class="form-label">Category</label><select id="product-category" class="form-select"><option value="">-- None --</option>${catOptions}</select></div>
                <div class="col-md-6"><label class="form-label">Unit</label><input type="text" id="product-unit" class="form-control" value="pcs"></div>
                <div class="col-md-4"><label class="form-label">Initial Qty</label><input type="number" id="product-qty" class="form-control" value="0" min="0"></div>
                <div class="col-md-4"><label class="form-label">Min Stock</label><input type="number" id="product-min" class="form-control" value="10" min="0"></div>
                <div class="col-md-4"><label class="form-label">Location</label><input type="text" id="product-location" class="form-control"></div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">Save</button>
            </div>
          </form>
        </div></div></div>
      `;
      // Event listeners
      $('#btn-add-product').addEventListener('click', () => {
        $('#product-id').value = '';
        $('#product-form').reset();
        $('#product-qty').closest('.col-md-4').style.display = '';
        $('#productModalTitle').textContent = 'Add Product';
        new bootstrap.Modal($('#productModal')).show();
      });
      el.querySelectorAll('.btn-edit-product').forEach(btn => {
        btn.addEventListener('click', async () => {
          const p = await api('GET', '/products/' + btn.dataset.id);
          $('#product-id').value = p.id;
          $('#product-sku').value = p.sku;
          $('#product-name').value = p.name;
          $('#product-desc').value = p.description || '';
          $('#product-category').value = p.category_id || '';
          $('#product-unit').value = p.unit;
          $('#product-min').value = p.min_stock;
          $('#product-location').value = p.location || '';
          $('#product-qty').closest('.col-md-4').style.display = 'none';
          $('#productModalTitle').textContent = 'Edit Product';
          new bootstrap.Modal($('#productModal')).show();
        });
      });
      el.querySelectorAll('.btn-delete-product').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Delete this product?')) return;
          await api('DELETE', '/products/' + btn.dataset.id);
          loadProducts();
        });
      });
      $('#product-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = $('#product-id').value;
        const body = {
          sku: $('#product-sku').value,
          name: $('#product-name').value,
          description: $('#product-desc').value,
          category_id: $('#product-category').value || null,
          min_stock: parseInt($('#product-min').value) || 10,
          unit: $('#product-unit').value || 'pcs',
          location: $('#product-location').value || null
        };
        if (!id) body.quantity = parseInt($('#product-qty').value) || 0;
        await api(id ? 'PUT' : 'POST', '/products' + (id ? '/' + id : ''), body);
        bootstrap.Modal.getInstance($('#productModal')).hide();
        loadProducts();
      });
    } catch (err) {
      handleAuthError(err);
    }
  }

  // ── Categories ──
  async function loadCategories() {
    try {
      const categories = await api('GET', '/categories');
      const el = $('#page-categories');
      el.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h4 class="mb-0">Categories</h4>
          <button class="btn btn-primary" id="btn-add-category"><i class="bi bi-plus-lg"></i> Add Category</button>
        </div>
        <div class="card shadow-sm">
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead><tr><th>Name</th><th>Description</th><th>Products</th><th>Actions</th></tr></thead>
                <tbody>${categories.length === 0 ? '<tr><td colspan="4" class="text-center text-muted p-4">No categories found</td></tr>' :
                  categories.map(c => `<tr>
                    <td class="fw-bold">${esc(c.name)}</td>
                    <td>${esc(c.description || '-')}</td>
                    <td>${c.product_count}</td>
                    <td>
                      <button class="btn btn-sm btn-outline-primary me-1 btn-edit-cat" data-id="${c.id}"><i class="bi bi-pencil"></i></button>
                      <button class="btn btn-sm btn-outline-danger btn-delete-cat" data-id="${c.id}"><i class="bi bi-trash"></i></button>
                    </td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="modal fade" id="catModal" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
          <div class="modal-header"><h5 class="modal-title" id="catModalTitle">Add Category</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
          <form id="cat-form">
            <div class="modal-body">
              <input type="hidden" id="cat-id">
              <div class="mb-3"><label class="form-label">Name *</label><input type="text" id="cat-name" class="form-control" required></div>
              <div class="mb-3"><label class="form-label">Description</label><textarea id="cat-desc" class="form-control" rows="2"></textarea></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">Save</button>
            </div>
          </form>
        </div></div></div>
      `;
      $('#btn-add-category').addEventListener('click', () => {
        $('#cat-id').value = '';
        $('#cat-form').reset();
        $('#catModalTitle').textContent = 'Add Category';
        new bootstrap.Modal($('#catModal')).show();
      });
      el.querySelectorAll('.btn-edit-cat').forEach(btn => {
        btn.addEventListener('click', async () => {
          const c = await api('GET', '/categories/' + btn.dataset.id);
          $('#cat-id').value = c.id;
          $('#cat-name').value = c.name;
          $('#cat-desc').value = c.description || '';
          $('#catModalTitle').textContent = 'Edit Category';
          new bootstrap.Modal($('#catModal')).show();
        });
      });
      el.querySelectorAll('.btn-delete-cat').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Delete this category?')) return;
          await api('DELETE', '/categories/' + btn.dataset.id);
          loadCategories();
        });
      });
      $('#cat-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = $('#cat-id').value;
        const body = { name: $('#cat-name').value, description: $('#cat-desc').value };
        await api(id ? 'PUT' : 'POST', '/categories' + (id ? '/' + id : ''), body);
        bootstrap.Modal.getInstance($('#catModal')).hide();
        loadCategories();
      });
    } catch (err) {
      handleAuthError(err);
    }
  }

  // ── Transactions ──
  async function loadTransactions() {
    try {
      const [transactions, products] = await Promise.all([
        api('GET', '/transactions'),
        api('GET', '/products')
      ]);
      const el = $('#page-transactions');
      const prodOptions = products.map(p => `<option value="${p.id}">${esc(p.name)} (${esc(p.sku)}) — Qty: ${p.quantity}</option>`).join('');
      el.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h4 class="mb-0">Stock In / Out</h4>
          <button class="btn btn-primary" id="btn-add-txn"><i class="bi bi-plus-lg"></i> New Transaction</button>
        </div>
        <div class="card shadow-sm">
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead><tr><th>Date</th><th>Product</th><th>SKU</th><th>Type</th><th>Qty</th><th>Reference</th><th>Notes</th><th>By</th></tr></thead>
                <tbody>${transactions.length === 0 ? '<tr><td colspan="8" class="text-center text-muted p-4">No transactions yet</td></tr>' :
                  transactions.map(t => `<tr>
                    <td class="small">${new Date(t.created_at).toLocaleString()}</td>
                    <td>${esc(t.product_name)}</td>
                    <td><code>${esc(t.sku)}</code></td>
                    <td><span class="badge ${t.type === 'IN' ? 'badge-in' : 'badge-out'}">${t.type}</span></td>
                    <td class="fw-bold">${t.quantity}</td>
                    <td>${esc(t.reference || '-')}</td>
                    <td>${esc(t.notes || '-')}</td>
                    <td>${esc(t.performed_by_name || '-')}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="modal fade" id="txnModal" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">New Transaction</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
          <form id="txn-form">
            <div class="modal-body">
              <div class="mb-3"><label class="form-label">Product *</label><select id="txn-product" class="form-select" required><option value="">-- Select --</option>${prodOptions}</select></div>
              <div class="mb-3"><label class="form-label">Type *</label>
                <div class="btn-group w-100" role="group">
                  <input type="radio" class="btn-check" name="txn-type" id="txn-type-in" value="IN" checked>
                  <label class="btn btn-outline-success" for="txn-type-in"><i class="bi bi-box-arrow-in-down"></i> Stock IN</label>
                  <input type="radio" class="btn-check" name="txn-type" id="txn-type-out" value="OUT">
                  <label class="btn btn-outline-danger" for="txn-type-out"><i class="bi bi-box-arrow-up"></i> Stock OUT</label>
                </div>
              </div>
              <div class="mb-3"><label class="form-label">Quantity *</label><input type="number" id="txn-qty" class="form-control" min="1" required></div>
              <div class="mb-3"><label class="form-label">Reference</label><input type="text" id="txn-ref" class="form-control" placeholder="e.g. PO-2024-001"></div>
              <div class="mb-3"><label class="form-label">Notes</label><textarea id="txn-notes" class="form-control" rows="2"></textarea></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">Submit</button>
            </div>
          </form>
        </div></div></div>
      `;
      $('#btn-add-txn').addEventListener('click', () => {
        $('#txn-form').reset();
        new bootstrap.Modal($('#txnModal')).show();
      });
      $('#txn-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const type = document.querySelector('input[name="txn-type"]:checked').value;
        await api('POST', '/transactions', {
          product_id: parseInt($('#txn-product').value),
          type,
          quantity: parseInt($('#txn-qty').value),
          reference: $('#txn-ref').value || null,
          notes: $('#txn-notes').value || null
        });
        bootstrap.Modal.getInstance($('#txnModal')).hide();
        loadTransactions();
      });
    } catch (err) {
      handleAuthError(err);
    }
  }

  // ── Users ──
  async function loadUsers() {
    if (currentUser.role !== 'admin') return;
    try {
      const users = await api('GET', '/users');
      const el = $('#page-users');
      el.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h4 class="mb-0">User Management</h4>
          <button class="btn btn-primary" id="btn-add-user"><i class="bi bi-plus-lg"></i> Add User</button>
        </div>
        <div class="card shadow-sm">
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead><tr><th>Username</th><th>Full Name</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>${users.map(u => `<tr>
                  <td>${esc(u.username)}</td>
                  <td>${esc(u.full_name)}</td>
                  <td><span class="badge ${u.role === 'admin' ? 'bg-primary' : 'bg-secondary'}">${u.role}</span></td>
                  <td>${u.active ? '<span class="badge badge-ok">Active</span>' : '<span class="badge bg-danger">Inactive</span>'}</td>
                  <td>
                    <button class="btn btn-sm btn-outline-primary btn-edit-user" data-id="${u.id}"><i class="bi bi-pencil"></i></button>
                  </td>
                </tr>`).join('')}</tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="modal fade" id="userModal" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
          <div class="modal-header"><h5 class="modal-title" id="userModalTitle">Add User</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
          <form id="user-form">
            <div class="modal-body">
              <input type="hidden" id="user-id">
              <div class="mb-3"><label class="form-label">Username *</label><input type="text" id="user-username" class="form-control" required></div>
              <div class="mb-3"><label class="form-label">Full Name *</label><input type="text" id="user-fullname" class="form-control" required></div>
              <div class="mb-3"><label class="form-label">Password <span id="pw-hint" class="text-muted small">(required)</span></label><input type="password" id="user-password" class="form-control" autocomplete="new-password"></div>
              <div class="mb-3"><label class="form-label">Role</label>
                <select id="user-role" class="form-select"><option value="staff">Staff</option><option value="admin">Admin</option></select>
              </div>
              <div class="mb-3 form-check">
                <input type="checkbox" id="user-active" class="form-check-input" checked>
                <label class="form-check-label" for="user-active">Active</label>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">Save</button>
            </div>
          </form>
        </div></div></div>
      `;
      $('#btn-add-user').addEventListener('click', () => {
        $('#user-id').value = '';
        $('#user-form').reset();
        $('#user-active').checked = true;
        $('#user-password').required = true;
        $('#pw-hint').textContent = '(required)';
        $('#userModalTitle').textContent = 'Add User';
        new bootstrap.Modal($('#userModal')).show();
      });
      el.querySelectorAll('.btn-edit-user').forEach(btn => {
        btn.addEventListener('click', () => {
          const u = users.find(x => x.id === parseInt(btn.dataset.id));
          $('#user-id').value = u.id;
          $('#user-username').value = u.username;
          $('#user-fullname').value = u.full_name;
          $('#user-password').value = '';
          $('#user-password').required = false;
          $('#pw-hint').textContent = '(leave blank to keep current)';
          $('#user-role').value = u.role;
          $('#user-active').checked = !!u.active;
          $('#userModalTitle').textContent = 'Edit User';
          new bootstrap.Modal($('#userModal')).show();
        });
      });
      $('#user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = $('#user-id').value;
        const body = {
          username: $('#user-username').value,
          full_name: $('#user-fullname').value,
          role: $('#user-role').value,
          active: $('#user-active').checked ? 1 : 0
        };
        const pw = $('#user-password').value;
        if (pw) body.password = pw;
        if (!id && !pw) { alert('Password is required for new users'); return; }
        await api(id ? 'PUT' : 'POST', '/users' + (id ? '/' + id : ''), body);
        bootstrap.Modal.getInstance($('#userModal')).hide();
        loadUsers();
      });
    } catch (err) {
      handleAuthError(err);
    }
  }

  // ── Utilities ──
  function esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function handleAuthError(err) {
    if (err.message && err.message.includes('Authentication')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      showLogin();
    }
  }

  // ── Init ──
  if (token && currentUser) {
    showApp();
  } else {
    showLogin();
  }
})();
