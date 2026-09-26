const db = require('../database/supabase');

class HistoryService {
  /**
   * Retrieves price & stock history for a given product
   * @param {number} productId
   */
  async getPriceHistory(productId) {
    const history = await db.getPriceHistory(productId);
    
    // Calculate summary statistics
    let stats = {
      count: history.length,
      currentPrice: null,
      minPrice: null,
      maxPrice: null,
      averagePrice: null,
      latestStockStatus: null,
      latestStockCount: null
    };

    if (history.length > 0) {
      const prices = history.map(h => Number(h.price));
      const latest = history[history.length - 1];
      const sum = prices.reduce((a, b) => a + b, 0);

      stats = {
        count: history.length,
        currentPrice: Number(latest.price),
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        averagePrice: Math.round((sum / prices.length) * 100) / 100,
        latestStockStatus: latest.stock_status,
        latestStockCount: latest.stock_count,
        lastScrapedAt: latest.scraped_at
      };
    }

    return {
      productId: Number(productId),
      stats,
      history
    };
  }

  /**
   * Retrieves scrape attempts audit logs for a given product
   * @param {number} productId
   * @param {number} limit
   */
  async getScrapeLogs(productId, limit = 50) {
    const logs = await db.getScrapeLogs(productId, limit);
    return {
      productId: Number(productId),
      count: logs.length,
      logs
    };
  }
}

module.exports = new HistoryService();
