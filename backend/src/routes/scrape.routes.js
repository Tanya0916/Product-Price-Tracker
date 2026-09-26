const express = require('express');
const router = express.Router();
const scrapeController = require('../controllers/scrape.controller');

// External cron endpoint (called by cron-job.org every 2 hours)
router.post('/run', scrapeController.triggerScheduledRun);

// Single product on-demand scrape
router.post('/:id', scrapeController.scrapeProductNow);

module.exports = router;
