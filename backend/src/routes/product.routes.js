const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');

router.get('/', productController.searchProducts);
router.get('/:id', productController.getProduct);
router.post('/:id/track', productController.trackProduct);
router.delete('/:id/track', productController.untrackProduct);

module.exports = router;
