/**
 * Product & Scraped Data Validation Engine
 * Ensures NO incorrect, fake, zero, or corrupt data is ever persisted.
 */

class ValidationError extends Error {
  constructor(message, field, rawValue) {
    super(`Validation Error on '${field}': ${message} (received: ${JSON.stringify(rawValue)})`);
    this.name = 'ValidationError';
    this.field = field;
    this.rawValue = rawValue;
  }
}

/**
 * Validates extracted price
 * @param {number|string} price
 * @returns {number} Clean positive float
 */
function validatePrice(price) {
  if (price === null || price === undefined || price === '') {
    throw new ValidationError('Price cannot be empty or null', 'price', price);
  }

  const num = typeof price === 'number' ? price : parseFloat(String(price).replace(/[^0-9.]/g, ''));

  if (Number.isNaN(num) || !Number.isFinite(num)) {
    throw new ValidationError('Price must be a valid finite number', 'price', price);
  }

  if (num <= 0) {
    throw new ValidationError('Price must be strictly positive (greater than 0)', 'price', price);
  }

  // Sanity upper bound check for retail products
  if (num > 100000000) {
    throw new ValidationError('Price exceeds realistic upper bound threshold', 'price', price);
  }

  return Math.round(num * 100) / 100;
}

/**
 * Validates stock count and returns standardized stock status
 * @param {number|null} count
 * @param {string} rawStatus
 * @returns {{ stockCount: number|null, stockStatus: 'IN_STOCK'|'LOW_STOCK'|'OUT_OF_STOCK' }}
 */
function validateStock(count, rawStatus = '') {
  let stockCount = null;
  if (count !== null && count !== undefined && count !== '') {
    const parsed = parseInt(String(count).replace(/[^0-9]/g, ''), 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      stockCount = parsed;
    }
  }

  const statusStr = (rawStatus || '').toLowerCase();

  let stockStatus = 'IN_STOCK';
  if (stockCount === 0 || statusStr.includes('out') || statusStr.includes('unavailable')) {
    stockStatus = 'OUT_OF_STOCK';
  } else if ((stockCount !== null && stockCount <= 5) || statusStr.includes('few') || statusStr.includes('fast') || statusStr.includes('hurry') || statusStr.includes('only')) {
    stockStatus = 'LOW_STOCK';
  } else {
    stockStatus = 'IN_STOCK';
  }

  return { stockCount, stockStatus };
}

/**
 * Validates the full scraped product data payload
 * @param {Object} data
 * @returns {Object} Validated and normalized payload
 */
function validateScrapedData(data) {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Scraped data payload must be an object', 'payload', data);
  }

  if (!data.productId && !data.product_id) {
    throw new ValidationError('Missing required productId', 'productId', data);
  }

  const cleanPrice = validatePrice(data.price);
  const { stockCount, stockStatus } = validateStock(data.stockCount ?? data.stock_count, data.stockStatus ?? data.stock_status);

  let cleanMrp = null;
  if (data.mrp !== null && data.mrp !== undefined && data.mrp !== '') {
    try {
      cleanMrp = validatePrice(data.mrp);
    } catch {
      cleanMrp = null;
    }
  }

  let discountPct = null;
  if (cleanMrp && cleanMrp > cleanPrice) {
    discountPct = Math.round(((cleanMrp - cleanPrice) / cleanMrp) * 100);
  } else if (data.discountPct || data.discount_pct) {
    discountPct = parseFloat(data.discountPct || data.discount_pct);
  }

  return {
    productId: Number(data.productId || data.product_id),
    price: cleanPrice,
    currency: data.currency || 'INR',
    mrp: cleanMrp,
    discountPct,
    stockCount,
    stockStatus,
    scrapedAt: data.scrapedAt || new Date().toISOString()
  };
}

module.exports = {
  validatePrice,
  validateStock,
  validateScrapedData,
  ValidationError
};
