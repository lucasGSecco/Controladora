const express = require('express');
const router = express.Router();
const unifiService = require('../services/unifiService'); // Ajuste o caminho se necessário

// GET: Listar todos os vouchers
router.get('/', async (req, res) => {
  try {
    const vouchers = await unifiService.listAllVouchersWithHistory();
    res.json(vouchers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST: Criar novo voucher
router.post('/', async (req, res) => {
  try {
    const {
      minutes,
      count,
      usageLimit,
      uploadLimitKbps,
      downloadLimitKbps,
      dataQuotaMB,
      note
    } = req.body;

    const result = await unifiService.createVoucher({
      minutes: Number(minutes),
      count: Number(count),
      usageLimit: Number(usageLimit),
      uploadLimitKbps: uploadLimitKbps ? Number(uploadLimitKbps) : undefined,
      downloadLimitKbps: downloadLimitKbps ? Number(downloadLimitKbps) : undefined,
      dataQuotaMB: dataQuotaMB ? Number(dataQuotaMB) : undefined,
      note
    });

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE: Revogar voucher por ID
router.delete('/:id', async (req, res) => {
  try {
    await unifiService.revokeVoucher(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;