const db = require('../database/supabase');
const httpScraper = require('../scraper/httpScraper');
const playwrightScraper = require('../scraper/playwrightScraper');
const alertService = require('./alert.service');
const logger = require('../utils/logger');

class ScrapeService {
  constructor() {
    this.isScrapingInProgress = false;
  }

  /**
   * Scrapes a single product through the full reliability layer
   * (HTTP first -> Playwright fallback -> Validator -> DB Persistence)
   * @param {number} productId
   * @param {Object} options
   */
  async scrapeSingleProduct(productId, options = {}) {
    const numId = Number(productId);
    const startTime = Date.now();
    let currentAttempt = 1;
    let scraperUsed = 'HTTP';

    logger.info(`>>> Beginning scrape execution for product #${numId}...`);

    try {
      // Phase 1: Try lightweight HTTP scraper first
      const httpResult = await httpScraper.scrapeProduct(numId);

      let validatedData = null;

      if (httpResult.success && httpResult.data) {
        validatedData = httpResult.data;
        scraperUsed = 'HTTP';
        logger.success(`[HTTP Scraper] Successfully extracted verified price for product #${numId}`);
      } else {
        // Phase 2: Switch to Playwright for client-side challenges or dynamic rendering
        scraperUsed = 'PLAYWRIGHT';
        logger.info(`[Playwright Fallback] Invoking browser scraper for product #${numId}...`);
        
        const pwResult = await playwrightScraper.scrapeProduct(numId, {
          headed: Boolean(options.headed),
          slowMo: options.slowMo || 0
        });

        validatedData = pwResult.result;
        currentAttempt = pwResult.attempts;
      }

      // Phase 3: Verified Success Persistence
      const completedTime = Date.now();
      const durationMs = completedTime - startTime;

      // 1. Record honest SUCCESS in scrape_logs
      await db.addScrapeLog({
        product_id: numId,
        attempt: currentAttempt,
        status: 'SUCCESS',
        scraper_type: scraperUsed,
        duration_ms: durationMs,
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date(completedTime).toISOString()
      });

      // 2. Fetch prior price before inserting new to check for alerts
      const priorHistory = await db.getPriceHistory(numId);
      const priorRecord = priorHistory.length > 0 ? priorHistory[priorHistory.length - 1] : null;

      // 3. Persist valid price into price_history
      const savedHistory = await db.addPriceHistory({
        product_id: numId,
        price: validatedData.price,
        currency: validatedData.currency,
        mrp: validatedData.mrp,
        discount_pct: validatedData.discountPct,
        stock_count: validatedData.stockCount,
        stock_status: validatedData.stockStatus,
        scraped_at: new Date().toISOString()
      });

      // 4. Update last_scraped_at timestamp on tracked product
      await db.updateTrackedProductLastScraped(numId);

      // 5. Trigger alerts if price dropped or back in stock
      if (priorRecord) {
        await alertService.checkAndTriggerAlerts(numId, priorRecord, savedHistory);
      }

      logger.success(`Scrape complete for product #${numId}: ₹${validatedData.price} (${validatedData.stockStatus}) in ${durationMs}ms`);

      return {
        success: true,
        productId: numId,
        scraperType: scraperUsed,
        attempts: currentAttempt,
        durationMs,
        data: savedHistory
      };

    } catch (err) {
      // Phase 4: Honest Failure Handling
      // The assignment strictly mandates: never silently stop or store incorrect/fake data!
      const durationMs = Date.now() - startTime;
      const errorMsg = err.message || 'Unknown scrape failure';

      logger.error(`Scrape failed for product #${numId} after ${currentAttempt} attempts: ${errorMsg}`);

      // Log failure honestly in scrape_logs
      await db.addScrapeLog({
        product_id: numId,
        attempt: err.attemptsCount || currentAttempt,
        status: 'FAILED',
        scraper_type: scraperUsed,
        duration_ms: durationMs,
        error_message: errorMsg,
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString()
      });

      // Record alert for scrape failure
      await alertService.recordScrapeFailureAlert(numId, errorMsg);

      return {
        success: false,
        productId: numId,
        scraperType: scraperUsed,
        attempts: err.attemptsCount || currentAttempt,
        durationMs,
        error: errorMsg
      };
    }
  }

  /**
   * Scrapes all active tracked products (Called by cron or manual trigger)
   */
  async runScheduledScrapes() {
    if (this.isScrapingInProgress) {
      logger.warn('Scraping run already in progress. Skipping overlapping request.');
      return { status: 'SKIPPED', message: 'A scrape run is already in progress' };
    }

    this.isScrapingInProgress = true;
    const runStart = Date.now();
    logger.info('========================================================');
    logger.info('Starting batch scrape run for all active tracked products');
    logger.info('========================================================');

    try {
      const trackedList = await db.getTrackedProducts();
      const activeItems = trackedList.filter(t => t.active);

      logger.info(`Found ${activeItems.length} active products to scrape.`);

      const results = [];
      for (const item of activeItems) {
        const result = await this.scrapeSingleProduct(item.product_id);
        results.push(result);
      }

      const totalTime = Date.now() - runStart;
      const successCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;

      logger.info(`Batch scrape run finished in ${totalTime}ms: ${successCount} Succeeded, ${failedCount} Failed.`);

      return {
        status: 'COMPLETED',
        totalProducts: activeItems.length,
        succeeded: successCount,
        failed: failedCount,
        durationMs: totalTime,
        results
      };

    } finally {
      this.isScrapingInProgress = false;
    }
  }
}

module.exports = new ScrapeService();
