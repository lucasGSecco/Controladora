const express = require('express');
const router = express.Router();
const voucherController = require('../controllers/voucherController');

function requireAuth(req, res, next) {
  if (!req.session || !req.session.unifi) {
    return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
  }
  next();
}

// Rota pública para autenticação
router.post('/login', voucherController.login);

// Rotas protegidas por autenticação
router.get('/vouchers', requireAuth, voucherController.listVouchers);
router.post('/vouchers', requireAuth, voucherController.createVoucher);
router.delete('/vouchers/:id', requireAuth, voucherController.deleteVoucher);

module.exports = router;