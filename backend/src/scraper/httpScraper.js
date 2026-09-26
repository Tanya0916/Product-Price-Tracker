const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const { parseProductHtml } = require('./parser');
const { validateScrapedData } = require('./validator');
const { executeWithRetry } = require('./retry');

/**
 * Lightweight HTTP Scraper Client
 */
class HttpScraper {
  constructor() {
    this.client = axios.create({
      baseURL: config.mockStoreUrl,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
  }

  /**
   * Fetches the products catalog via HTTP API
   * @param {number} page
   * @param {number} pageSize
   */
  async fetchCatalog(page = 1, pageSize = 20) {
    return executeWithRetry(async (attempt) => {
      logger.info(`[HTTP] Fetching catalog page ${page} (Attempt ${attempt})...`);
      const res = await this.client.get(`/api/catalog?page=${page}&pageSize=${pageSize}`);
      return res.data;
    }, {
      maxRetries: config.scraper.maxRetries,
      baseDelayMs: config.scraper.retryDelayMs
    });
  }

  /**
   * Fetches product metadata via HTTP API
   * @param {number} productId
   */
  async fetchProductMetadata(productId) {
    return executeWithRetry(async (attempt) => {
      logger.info(`[HTTP] Fetching metadata for product #${productId} (Attempt ${attempt})...`);
      const res = await this.client.get(`/api/product/${productId}`);
      return res.data;
    }, {
      maxRetries: 1,
      baseDelayMs: 500
    });
  }

  /**
   * Scrapes product page via HTTP
   * @param {number} productId
   * @returns {Promise<{ success: boolean, requiresBrowser?: boolean, data?: any, error?: string }>}
   */
  async scrapeProduct(productId) {
    const url = `${config.mockStoreUrl}/product/${productId}`;
    logger.info(`[HTTP Scraper] Requesting ${url}...`);

    try {
      // Step 1: Attempt to fetch metadata from API or HTML
      let metadata = null;
      try {
        const metaRes = await this.fetchProductMetadata(productId);
        metadata = metaRes.result;
      } catch (err) {
        logger.warn(`[HTTP Scraper] Direct metadata API unavailable: ${err.message}`);
      }

      // Step 2: Fetch HTML page
      const htmlRes = await this.client.get(`/product/${productId}`);
      const parsed = parseProductHtml(htmlRes.data);

      // Check if price is missing or hidden behind client-side challenge
      if (!parsed || parsed.isPriceHidden || !parsed.price) {
        logger.info(`[HTTP Scraper] Price is dynamically rendered or interactive gate detected. Delegating to Playwright.`);
        return {
          success: false,
          requiresBrowser: true,
          productMetadata: metadata,
          reason: 'Client-side dynamic price rendering requires browser execution'
        };
      }

      // If price was found directly in HTML, validate it
      const validated = validateScrapedData({
        productId,
        price: parsed.price,
        currency: parsed.currency,
        mrp: parsed.mrp,
        discountPct: parsed.discountPct,
        stockCount: parsed.stockCount,
        stockStatus: parsed.stockStatus
      });

      return {
        success: true,
        scraperType: 'HTTP',
        data: validated,
        productMetadata: metadata
      };
    } catch (err) {
      logger.warn(`[HTTP Scraper] HTTP scrape attempt failed: ${err.message}`);
      return {
        success: false,
        requiresBrowser: true,
        error: err.message,
        reason: 'HTTP fetch failed or blocked, falling back to browser'
      };
    }
  }
}

module.exports = new HttpScraper();
