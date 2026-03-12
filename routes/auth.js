'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database/db');
const { authenticate, requireRole, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// Rate limiter for login endpoint – brute force protection
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // max 20 attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
});

// POST /api/auth/login
router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ success: false, message: 'Invalid username or password' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  // Log login
  db.prepare(`INSERT INTO audit_log (user_id, action, table_name, ip_address) VALUES (?, ?, ?, ?)`)
    .run(user.id, 'LOGIN', 'users', req.ip);

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      email: user.email,
    },
  });
});

// POST /api/auth/logout
router.post('/logout', authenticate, (req, res) => {
  const db = getDb();
  db.prepare(`INSERT INTO audit_log (user_id, action, table_name, ip_address) VALUES (?, ?, ?, ?)`)
    .run(req.user.id, 'LOGOUT', 'users', req.ip);
  res.json({ success: true, message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ success: true, user: req.user });
});

// PUT /api/auth/change-password
router.put('/change-password', authenticate, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ success: false, message: 'Current and new passwords are required' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current_password, user.password)) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect' });
  }

  const hashed = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password = ?, updated_at = datetime(\'now\') WHERE id = ?').run(hashed, req.user.id);
  res.json({ success: true, message: 'Password changed successfully' });
});

// GET /api/auth/users - Admin/Manager only
router.get('/users', authenticate, requireRole('admin', 'manager'), (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, username, full_name, role, email, is_active, created_at FROM users ORDER BY username').all();
  res.json({ success: true, data: users });
});

// POST /api/auth/users - Admin only
router.post('/users', authenticate, requireRole('admin'), (req, res) => {
  const { username, password, full_name, role, email } = req.body;
  if (!username || !password || !full_name) {
    return res.status(400).json({ success: false, message: 'Username, password, and full name are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
  }
  const validRoles = ['admin', 'manager', 'staff'];
  if (role && !validRoles.includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ success: false, message: 'Username already exists' });
  }

  const hashed = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (username, password, full_name, role, email) VALUES (?, ?, ?, ?, ?)
  `).run(username, hashed, full_name, role || 'staff', email || null);

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: { id: result.lastInsertRowid, username, full_name, role: role || 'staff', email },
  });
});

// PUT /api/auth/users/:id - Admin only
router.put('/users/:id', authenticate, requireRole('admin'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { full_name, role, email, is_active } = req.body;

  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const validRoles = ['admin', 'manager', 'staff'];
  if (role && !validRoles.includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role' });
  }

  db.prepare(`
    UPDATE users SET
      full_name = COALESCE(?, full_name),
      role = COALESCE(?, role),
      email = COALESCE(?, email),
      is_active = COALESCE(?, is_active),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(full_name || null, role || null, email !== undefined ? email : null, is_active !== undefined ? is_active : null, id);

  res.json({ success: true, message: 'User updated successfully' });
});

// DELETE /api/auth/users/:id - Admin only
router.delete('/users/:id', authenticate, requireRole('admin'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (id === req.user.id) {
    return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
  }

  const db = getDb();
  db.prepare('UPDATE users SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ?').run(id);
  res.json({ success: true, message: 'User deactivated successfully' });
});

module.exports = router;
