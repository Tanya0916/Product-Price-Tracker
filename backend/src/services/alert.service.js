const db = require('../database/supabase');
const logger = require('../utils/logger');
const config = require('../config');

class AlertService {
  /**
   * Compares prior observation with new observation and generates alerts
   */
  async checkAndTriggerAlerts(productId, prior, current) {
    if (!prior || !current) return;

    const priorPrice = Number(prior.price);
    const currPrice = Number(current.price);
    const prod = await db.getProductById(productId);
    const prodName = prod ? prod.name : `Product #${productId}`;

    // 1. Price drop alert
    if (currPrice < priorPrice) {
      const dropAmount = priorPrice - currPrice;
      const dropPct = Math.round((dropAmount / priorPrice) * 100);
      const msg = `Price Drop! "${prodName}" decreased by ${dropPct}% (₹${priorPrice} → ₹${currPrice})`;
      
      logger.info(`[ALERT: PRICE_DROP] ${msg}`);
      await db.addAlert({
        product_id: productId,
        type: 'PRICE_DROP',
        message: msg
      });

      this.sendEmailNotification('Price Drop Alert', msg);
    }

    // 2. Back in stock alert
    if (prior.stock_status === 'OUT_OF_STOCK' && (current.stock_status === 'IN_STOCK' || current.stock_status === 'LOW_STOCK')) {
      const msg = `Back In Stock! "${prodName}" is now available (${current.stock_count ? current.stock_count + ' units' : 'in stock'})`;
      
      logger.info(`[ALERT: BACK_IN_STOCK] ${msg}`);
      await db.addAlert({
        product_id: productId,
        type: 'BACK_IN_STOCK',
        message: msg
      });

      this.sendEmailNotification('Back in Stock Alert', msg);
    }
  }

  /**
   * Records a scrape failure alert
   */
  async recordScrapeFailureAlert(productId, reason) {
    const prod = await db.getProductById(productId);
    const prodName = prod ? prod.name : `Product #${productId}`;
    const msg = `Scrape issue detected for "${prodName}": ${reason}`;
    
    await db.addAlert({
      product_id: productId,
      type: 'SCRAPE_FAILURE',
      message: msg
    });
  }

  /**
   * Records page structure change alert
   */
  async recordStructureChange(selectorName, details) {
    const msg = `Page structure shift detected for "${selectorName}": ${details}`;
    logger.warn(`[ALERT: STRUCTURE_CHANGE] ${msg}`);

    await db.addAlert({
      product_id: null,
      type: 'STRUCTURE_CHANGE',
      message: msg
    });

    await db.recordStructureHealth(selectorName, 'SHIFTED', details);
  }

  /**
   * Helper to send email alerts (SendGrid or webhook simulation)
   */
  sendEmailNotification(subject, body) {
    if (!config.emailAlerts.enabled) {
      return;
    }
    // If SendGrid API key configured, can trigger email dispatch
    logger.info(`[EMAIL ALERT DISPATCH] Subject: ${subject} | To: ${config.emailAlerts.alertEmailTo}`);
  }

  /**
   * Gets alerts for API
   */
  async getAlerts(unreadOnly = false) {
    return db.getAlerts(unreadOnly);
  }

  /**
   * Marks alert as read
   */
  async markAlertAsRead(alertId) {
    return db.markAlertRead(alertId);
  }
}

module.exports = new AlertService();
