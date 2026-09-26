const historyService = require('../services/history.service');

const historyController = {
  // GET /api/products/:id/history
  async getPriceHistory(req, res) {
    try {
      const data = await historyService.getPriceHistory(req.params.id);
      return res.json({ success: true, ...data });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  // GET /api/products/:id/scrape-logs
  async getScrapeLogs(req, res) {
    try {
      const limit = parseInt(req.query.limit || '50', 10);
      const data = await historyService.getScrapeLogs(req.params.id, limit);
      return res.json({ success: true, ...data });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
};

module.exports = historyController;
