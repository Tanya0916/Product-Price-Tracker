const express = require('express');
const cors = require('cors');
const productRoutes = require('./routes/product.routes');
const historyRoutes = require('./routes/history.routes');
const scrapeRoutes = require('./routes/scrape.routes');
const alertRoutes = require('./routes/alert.routes');
const productController = require('./controllers/product.controller');
const db = require('./database/supabase');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!req.path.includes('/health')) {
      console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// API Routes
app.use('/api/products', productRoutes);
app.use('/api/products', historyRoutes);
app.get('/api/tracked-products', productController.getTrackedProducts);
app.use('/api/scrape', scrapeRoutes);
app.use('/api/alerts', alertRoutes);

// Health check endpoint (Used by Render & cron-job.org to keep instances warm)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'UP',
    database: db.isUsingSupabase() ? 'SUPABASE_POSTGRES' : 'LOCAL_REPOSITORY',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.url}` });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

module.exports = app;
