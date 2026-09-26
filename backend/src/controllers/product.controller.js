const productService = require('../services/product.service');
const scrapeService = require('../services/scrape.service');

const productController = {
  // GET /api/products?search=...
  async searchProducts(req, res) {
    try {
      const search = req.query.search || '';
      const products = await productService.searchProducts(search);
      return res.json({
        success: true,
        count: products.length,
        products
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  // GET /api/products/:id
  async getProduct(req, res) {
    try {
      const product = await productService.getProductById(req.params.id);
      if (!product) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }
      return res.json({ success: true, product });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  // POST /api/products/:id/track
  async trackProduct(req, res) {
    try {
      const productId = req.params.id;
      const { frequencyHours = 2, targetPrice = null } = req.body;
      const tracked = await productService.trackProduct(productId, frequencyHours, targetPrice);

      // Perform an immediate initial scrape in the background
      scrapeService.scrapeSingleProduct(productId).catch(() => {});

      return res.status(201).json({
        success: true,
        message: `Product #${productId} is now tracked`,
        tracked
      });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  },

  // DELETE /api/products/:id/track
  async untrackProduct(req, res) {
    try {
      await productService.untrackProduct(req.params.id);
      return res.json({ success: true, message: `Product #${req.params.id} untracked` });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  // GET /api/tracked-products
  async getTrackedProducts(req, res) {
    try {
      const tracked = await productService.getTrackedProducts();
      return res.json({
        success: true,
        count: tracked.length,
        tracked
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
};

module.exports = productController;
