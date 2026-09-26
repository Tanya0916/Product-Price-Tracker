const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alert.controller');

router.get('/', alertController.getAlerts);
router.patch('/:id/read', alertController.markRead);
router.get('/structure/health', alertController.getStructureHealth);

module.exports = router;
