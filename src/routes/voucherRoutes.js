const express = require('express');
const router = express.Router();
const voucherController = require('../controllers/voucherController');

router.get('/', voucherController.listVouchers);
router.post('/', voucherController.createVoucher);
router.delete('/:id', voucherController.deleteVoucher);

module.exports = router;