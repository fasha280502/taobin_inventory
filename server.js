'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const os = require('os');

const { initializeDatabase } = require('./database/db');
const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/categories');
const supplierRoutes = require('./routes/suppliers');
const productRoutes = require('./routes/products');
const transactionRoutes = require('./routes/transactions');
const reportRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      fontSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
    },
  },
}));
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// General API rate limiter – protects against abuse on the LAN
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300,                 // 300 requests/min is ample for a warehouse team
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// API Routes (with general rate limiter)
app.use('/api/auth', apiLimiter, authRoutes);
app.use('/api/categories', apiLimiter, categoryRoutes);
app.use('/api/suppliers', apiLimiter, supplierRoutes);
app.use('/api/products', apiLimiter, productRoutes);
app.use('/api/transactions', apiLimiter, transactionRoutes);
app.use('/api/reports', apiLimiter, reportRoutes);

// Health check
app.get('/api/health', apiLimiter, (req, res) => {
  res.json({ success: true, message: 'Tao Bin Inventory System is running', version: '1.0.0' });
});

// Serve frontend for all other routes (SPA)
app.get('/{*path}', apiLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, _next) => {
  console.error('[Error]', err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// Initialize DB then start server
initializeDatabase();

app.listen(PORT, '0.0.0.0', () => {
  const ifaces = os.networkInterfaces();
  const lanAddresses = [];
  Object.values(ifaces).forEach(iface => {
    if (!iface) return;
    iface.forEach(addr => {
      if (addr.family === 'IPv4' && !addr.internal) {
        lanAddresses.push(addr.address);
      }
    });
  });

  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║      TAO BIN MALAYSIA - WAREHOUSE INVENTORY SYSTEM   ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');
  console.log(`  Local:   http://localhost:${PORT}`);
  lanAddresses.forEach(ip => {
    console.log(`  Network: http://${ip}:${PORT}`);
  });
  console.log('\n  Default Login: admin / admin123');
  console.log('  ⚠️  Please change the default password after first login!\n');
});

module.exports = app;
