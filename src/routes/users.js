const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const users = db.prepare(
      'SELECT id, username, full_name, role, active, created_at, updated_at FROM users ORDER BY full_name'
    ).all();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', requireAdmin, (req, res) => {
  try {
    const { username, password, full_name, role } = req.body;
    if (!username || !password || !full_name) {
      return res.status(400).json({ error: 'Username, password, and full name are required' });
    }

    const db = getDb();
    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      'INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)'
    ).run(username, hashedPassword, full_name, role || 'staff');

    const user = db.prepare(
      'SELECT id, username, full_name, role, active, created_at FROM users WHERE id = ?'
    ).get(result.lastInsertRowid);
    res.status(201).json(user);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', requireAdmin, (req, res) => {
  try {
    const { username, password, full_name, role, active } = req.body;
    if (!username || !full_name) {
      return res.status(400).json({ error: 'Username and full name are required' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'User not found' });

    if (password) {
      const hashedPassword = bcrypt.hashSync(password, 10);
      db.prepare(
        "UPDATE users SET username = ?, password = ?, full_name = ?, role = ?, active = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(username, hashedPassword, full_name, role || 'staff', active !== undefined ? active : 1, req.params.id);
    } else {
      db.prepare(
        "UPDATE users SET username = ?, full_name = ?, role = ?, active = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(username, full_name, role || 'staff', active !== undefined ? active : 1, req.params.id);
    }

    const user = db.prepare(
      'SELECT id, username, full_name, role, active, created_at, updated_at FROM users WHERE id = ?'
    ).get(req.params.id);
    res.json(user);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
