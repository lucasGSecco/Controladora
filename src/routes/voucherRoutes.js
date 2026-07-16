const express = require('express');
const unifiService = require('../services/unifiService');

const router = express.Router();

// GET /api/vouchers - lista todos os vouchers
router.get('/', async (req, res) => {
  try {
    const vouchers = await unifiService.listVouchers();
    res.json(vouchers);
  } catch (error) {
    console.error(error);
    res.status(502).json({ error: error.message });
  }
});

// POST /api/vouchers - cria um novo voucher
// body esperado: { minutes, count, usageLimit, note }
router.post('/', async (req, res) => {
  const { minutes, count, usageLimit, note } = req.body;

  if (!minutes || Number(minutes) <= 0) {
    return res.status(400).json({ error: 'Informe "minutes" com um valor maior que zero.' });
  }

  try {
    await unifiService.createVoucher({
      minutes: Number(minutes),
      count: count ? Number(count) : 1,
      usageLimit: usageLimit !== undefined ? Number(usageLimit) : 1,
      note,
    });

    // A controladora nao retorna o codigo do voucher no create,
    // entao buscamos a lista atualizada e devolvemos os mais recentes.
    const vouchers = await unifiService.listVouchers();
    const sorted = vouchers.sort((a, b) => b.create_time - a.create_time);
    const created = sorted.slice(0, count ? Number(count) : 1);

    res.status(201).json(created);
  } catch (error) {
    console.error(error);
    res.status(502).json({ error: error.message });
  }
});

// DELETE /api/vouchers/:id - revoga um voucher
router.delete('/:id', async (req, res) => {
  try {
    await unifiService.revokeVoucher(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(502).json({ error: error.message });
  }
});

module.exports = router;
