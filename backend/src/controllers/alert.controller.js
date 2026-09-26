const alertService = require('../services/alert.service');
const db = require('../database/supabase');

const alertController = {
  // GET /api/alerts
  async getAlerts(req, res) {
    try {
      const unreadOnly = req.query.unread === 'true';
      const alerts = await alertService.getAlerts(unreadOnly);
      return res.json({ success: true, count: alerts.length, alerts });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  // PATCH /api/alerts/:id/read
  async markRead(req, res) {
    try {
      await alertService.markAlertAsRead(req.params.id);
      return res.json({ success: true, message: 'Alert marked as read' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  // GET /api/health/structure
  async getStructureHealth(req, res) {
    try {
      const history = await db.getStructureHealth();
      return res.json({ success: true, history });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
};

module.exports = alertController;
