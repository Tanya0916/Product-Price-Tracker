const app = require('./src/app');
const config = require('./src/config');
const logger = require('./src/utils/logger');
const productService = require('./src/services/product.service');
const db = require('./src/database/supabase');

const server = app.listen(config.port, async () => {
  logger.info(`================================================================`);
  logger.info(`  INE PRODUCT PRICE TRACKER - BACKEND SERVICE RUNNING`);
  logger.info(`================================================================`);
  logger.info(`  Local URL       : http://localhost:${config.port}`);
  logger.info(`  Target Store    : ${config.mockStoreUrl}`);
  logger.info(`  Database Mode   : ${db.isUsingSupabase() ? 'Supabase PostgreSQL' : 'Local Repository (backend/data/local_db.json)'}`);
  logger.info(`  Cron Endpoint   : POST http://localhost:${config.port}/api/scrape/run`);
  logger.info(`  Health Check    : GET http://localhost:${config.port}/api/health`);
  logger.info(`================================================================`);

  // Seed / populate initial product catalog if empty
  try {
    const existing = await db.getProducts();
    if (existing.length === 0) {
      logger.info('Initializing store catalog from mock store...');
      await productService.searchProducts('');
      logger.success('Store catalog populated.');
    }
  } catch (err) {
    logger.warn(`Initial catalog refresh notice: ${err.message}`);
  }
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });
});
