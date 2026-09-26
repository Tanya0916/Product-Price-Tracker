const scrapeService = require('../services/scrape.service');
const config = require('../config');
const logger = require('../utils/logger');

const scrapeController = {
  // POST /api/scrape/run (Called by cron-job.org or manual UI trigger)
  async triggerScheduledRun(req, res) {
    try {
      // Optional security header check for cron-job.org
      const authHeader = req.headers['authorization'] || '';
      const secretHeader = req.headers['x-cron-secret'] || req.query.secret;
      const token = authHeader.replace(/^Bearer\s+/i, '');

      if (config.cronSecret && config.nodeEnv === 'production') {
        if (token !== config.cronSecret && secretHeader !== config.cronSecret) {
          logger.warn('Unauthorized cron trigger attempt rejected.');
          return res.status(401).json({ success: false, error: 'Invalid cron secret token' });
        }
      }

      logger.info('External scraper trigger received (/api/scrape/run). Running batch...');

      // Execute scheduled scrapes across active tracked products
      const summary = await scrapeService.runScheduledScrapes();

      return res.json({
        success: true,
        message: 'Batch scrape execution completed',
        summary
      });
    } catch (err) {
      logger.error('Failed to execute batch scrape run:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  // POST /api/scrape/:id (Single product on-demand trigger)
  async scrapeProductNow(req, res) {
    try {
      const productId = req.params.id;
      const { headed = false } = req.body;

      logger.info(`On-demand scrape triggered for product #${productId}`);
      const result = await scrapeService.scrapeSingleProduct(productId, { headed });

      return res.json({
        success: result.success,
        result
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
};

module.exports = scrapeController;
