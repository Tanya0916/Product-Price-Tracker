const cheerio = require('cheerio');
const logger = require('../utils/logger');

/**
 * Strips zero-width spaces, non-breaking spaces, and unwanted whitespace
 * @param {string} text
 * @returns {string}
 */
function cleanText(text) {
  if (!text) return '';
  return String(text)
    // Remove zero-width spaces (\u200B, \u200C, \u200D, \uFEFF)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Replace non-breaking spaces (\u00A0) with standard space
    .replace(/\u00A0/g, ' ')
    // Normalize unicode digits if any fullwidth characters exist
    .replace(/[\uFF10-\uFF19]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    // Clean outer and duplicate whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts numeric price from a formatted currency string
 * e.g. "₹ 2,999", "Rs. 2,999/-", "2 999", "₹42.9"
 * @param {string} rawString
 * @returns {number|null}
 */
function extractNumericPrice(rawString) {
  if (!rawString) return null;
  const cleaned = cleanText(rawString);
  
  // Extract number pattern like 12,345.67 or 12345
  // Note: handle comma as thousands separator
  const match = cleaned.match(/([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)/);
  if (!match) return null;
  
  const numStr = match[1].replace(/,/g, '');
  const val = parseFloat(numStr);
  return Number.isNaN(val) ? null : val;
}

/**
 * Parses stock string into count and standardized status
 * e.g., "In stock · 14 left", "Only 3 left", "Selling fast — 5 left", "Out of stock"
 * @param {string} text
 * @returns {{ count: number|null, status: 'IN_STOCK'|'LOW_STOCK'|'OUT_OF_STOCK', raw: string }}
 */
function parseStockString(text) {
  const cleaned = cleanText(text);
  const lower = cleaned.toLowerCase();

  if (lower.includes('out of stock') || lower.includes('unavailable') || lower === '0 left') {
    return { count: 0, status: 'OUT_OF_STOCK', raw: cleaned };
  }

  // Extract count if present
  const match = cleaned.match(/([0-9]+)\s*(?:left|in stock|available)/i) || cleaned.match(/([0-9]+)/);
  const count = match ? parseInt(match[1], 10) : null;

  let status = 'IN_STOCK';
  if (count !== null && count <= 5) {
    status = 'LOW_STOCK';
  } else if (lower.includes('hurry') || lower.includes('only') || lower.includes('fast')) {
    status = 'LOW_STOCK';
  }

  return { count, status, raw: cleaned };
}

/**
 * Parses HTML from product page using Cheerio, with strict decoy evasion
 * @param {string} html Raw HTML
 * @returns {Object|null}
 */
function parseProductHtml(html) {
  if (!html) return null;
  const $ = cheerio.load(html);

  // 1. Remove obvious decoy elements injected by anti-scraping
  // (Elements with display:none or aria-hidden="true" containing decoy amounts)
  $('span[aria-hidden="true"]').each((_, el) => {
    const style = $(el).attr('style') || '';
    if (style.includes('display: none') || style.includes('display:none')) {
      $(el).remove();
    }
  });
  $('.price-value[style*="none"]').remove();
  $('.amount[data-price="true"][style*="none"]').remove();

  // 2. Check if price is still hidden behind interactive challenge
  const isPriceHidden = $('.price-status:contains("Price hidden")').length > 0 ||
                        $('.price-idle').length > 0;
  
  // 3. Extract title, brand, sku, category
  const title = cleanText($('h1').first().text());
  const brandLine = cleanText($('.detail-brand').text());
  const category = cleanText($('.tile-category').text());
  const description = cleanText($('.detail-desc').text());

  // 4. Try to extract visible price
  let price = null;
  let currency = 'INR';
  let mrp = null;
  let discountPct = null;

  // Look inside .price-main for visible price text
  const priceMain = $('.price-main');
  if (priceMain.length > 0) {
    // Check MRP
    const mrpText = priceMain.find('span[style*="line-through"]').text();
    if (mrpText) {
      mrp = extractNumericPrice(mrpText);
    }

    // Check discount badge
    const badgeText = priceMain.find('span:contains("% off")').text();
    if (badgeText) {
      const bMatch = badgeText.match(/([0-9]+)%\s*off/i);
      if (bMatch) discountPct = parseInt(bMatch[1], 10);
    }

    // Extract genuine price: find the prominent visible price carrier
    // First, clone priceMain and remove MRP and badges to isolate price
    const clone = priceMain.clone();
    clone.find('span[style*="line-through"]').remove();
    clone.find('span:contains("% off")').remove();
    clone.find('span:contains("Deal price")').remove();
    clone.find('span[aria-hidden="true"]').remove();
    clone.find('[style*="display: none"]').remove();
    clone.find('[style*="display:none"]').remove();

    const rawVisiblePrice = cleanText(clone.text());
    price = extractNumericPrice(rawVisiblePrice);
  }

  // 5. Extract stock
  let stockCount = null;
  let stockStatus = 'IN_STOCK';
  const stockBadge = $('.stock-badge');
  if (stockBadge.length > 0) {
    const stockParsed = parseStockString(stockBadge.text());
    stockCount = stockParsed.count;
    stockStatus = stockParsed.status;
  }

  return {
    title,
    brandLine,
    category,
    description,
    price,
    currency,
    mrp,
    discountPct,
    stockCount,
    stockStatus,
    isPriceHidden
  };
}

module.exports = {
  cleanText,
  extractNumericPrice,
  parseStockString,
  parseProductHtml
};
