const express = require('express');
const router = express.Router();
const historyController = require('../controllers/history.controller');

// Matches /api/products/:id/history and /api/products/:id/scrape-logs
router.get('/:id/history', historyController.getPriceHistory);
router.get('/:id/scrape-logs', historyController.getScrapeLogs);

module.exports = router;
