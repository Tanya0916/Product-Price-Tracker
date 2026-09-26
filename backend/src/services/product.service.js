const db = require('../database/supabase');
const httpScraper = require('../scraper/httpScraper');
const logger = require('../utils/logger');
const config = require('../config');

class ProductService {
  /**
   * Searches INE mock store products by query
   * @param {string} search
   * @returns {Promise<Array>}
   */
  async searchProducts(search = '') {
    try {
      // Fetch catalog from INE mock store — pages of 20, grab first 3 pages (60 products)
      let allItems = [];
      for (let page = 1; page <= 3; page++) {
        try {
          const catalogRes = await httpScraper.fetchCatalog(page, 20);
          const items = catalogRes.items || catalogRes.result?.items || catalogRes.products || [];
          if (items.length === 0) break;
          allItems = allItems.concat(items);
        } catch (err) {
          logger.warn(`Catalog page ${page} fetch failed: ${err.message}`);
          break;
        }
      }

      // Upsert discovered products into DB
      for (const item of allItems) {
        await db.upsertProduct({
          id: item.id,
          name: item.name,
          brand: item.brand || 'INE Brand',
          category: item.category || 'General',
          sku: item.sku || `SKU-${item.id}`,
          url: `${config.mockStoreUrl}/product/${item.id}`,
          image_url: item.image_url || item.image || null
        });
      }

      if (allItems.length > 0) {
        logger.success(`Catalog refreshed: ${allItems.length} products upserted from INE Mock Store.`);
      }
    } catch (err) {
      logger.warn(`Could not refresh catalog from mock store: ${err.message}. Using stored database products.`);
    }

    // Return products filtered from database
    return db.getProducts(search);
  }

  /**
   * Retrieves single product by ID
   * @param {number} id
   */
  async getProductById(id) {
    let product = await db.getProductById(id);
    if (!product) {
      try {
        const metaRes = await httpScraper.fetchProductMetadata(id);
        const item = metaRes.result;
        if (item) {
          product = await db.upsertProduct({
            id: item.id,
            name: item.name,
            brand: item.brand,
            category: item.category,
            sku: item.sku,
            url: `${config.mockStoreUrl}/product/${item.id}`,
            image_url: item.image || null
          });
        }
      } catch (err) {
        logger.warn(`Failed to fetch metadata for product #${id}: ${err.message}`);
      }
    }
    return product;
  }

  /**
   * Tracks a product
   * @param {number} productId
   * @param {number} frequencyHours
   * @param {number|null} targetPrice
   */
  async trackProduct(productId, frequencyHours = 2, targetPrice = null) {
    // Ensure product exists in DB
    const product = await this.getProductById(productId);
    if (!product) {
      throw new Error(`Product with ID ${productId} not found in store catalog`);
    }

    const tracked = await db.trackProduct(productId, frequencyHours, targetPrice);
    logger.success(`Product #${productId} (${product.name}) is now tracked.`);
    return { ...tracked, product };
  }

  /**
   * Untracks a product
   * @param {number} productId
   */
  async untrackProduct(productId) {
    return db.untrackProduct(productId);
  }

  /**
   * Gets all tracked products along with their most recent price and stock observation
   */
  async getTrackedProducts() {
    const trackedList = await db.getTrackedProducts();
    const enriched = [];

    for (const item of trackedList) {
      const history = await db.getPriceHistory(item.product_id);
      const latestPrice = history.length > 0 ? history[history.length - 1] : null;
      const recentLogs = await db.getScrapeLogs(item.product_id, 1);
      const latestLog = recentLogs.length > 0 ? recentLogs[0] : null;

      enriched.push({
        ...item,
        latestPrice,
        latestLog
      });
    }

    return enriched;
  }
}

module.exports = new ProductService();
