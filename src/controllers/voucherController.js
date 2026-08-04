const unifiService = require('../services/unifiService');
const googleSheetsService = require('../services/planilhaService');

exports.listVouchers = async (req, res) => {
  try {
    const vouchers = await unifiService.listAllVouchersWithHistory();
    res.json(vouchers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createVoucher = async (req, res) => {
  try {
    const {
      minutes,
      count,
      usageLimit,
      uploadLimitKbps,
      downloadLimitKbps,
      dataQuotaMB,
      note,
      nome,
      setor,
      funcao,
      responsavel
    } = req.body;

    console.log('--- REQ.BODY RECEBIDO NO BACKEND ---', req.body);

    const result = await unifiService.createVoucher({
      minutes: Number(minutes),
      count: Number(count),
      usageLimit: Number(usageLimit),
      uploadLimitKbps: uploadLimitKbps ? Number(uploadLimitKbps) : undefined,
      downloadLimitKbps: downloadLimitKbps ? Number(downloadLimitKbps) : undefined,
      dataQuotaMB: dataQuotaMB ? Number(dataQuotaMB) : undefined,
      note,
      nome,
      setor,
      funcao,
      responsavel
    });

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteVoucher = async (req, res) => {
  try {
    await unifiService.revokeVoucher(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};