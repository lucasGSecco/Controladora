const unifiService = require('../services/unifiService');

// 1. Guarda o usuário na sessão ao fazer login
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const sessionData = await unifiService.login(username, password);
    
    req.session.unifi = sessionData;
    req.session.user = { nome: username };
    
    res.status(200).json({ message: 'Autenticado com sucesso' });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
};

function handleApiError(res, error, req) {
  if (error.status === 401) {
    if (req && req.session) req.session.destroy();
    return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
  }
  res.status(500).json({ error: error.message });
}

exports.listVouchers = async (req, res) => {
  try {
    const vouchers = await unifiService.listAllVouchersWithHistory(req.session.unifi);
    res.json(vouchers);
  } catch (error) {
    handleApiError(res, error, req);
  }
};

exports.createVoucher = async (req, res) => {
  try {
    const {
      minutes, count, usageLimit, uploadLimitKbps,
      downloadLimitKbps, dataQuotaMB, note, nome,
      setor, funcao
    } = req.body;

    const responsavel = req.session?.user?.nome || req.user?.nome || 'Não identificado';

    const result = await unifiService.createVoucher(req.session.unifi, {
      minutes: Number(minutes),
      count: Number(count),
      usageLimit: Number(usageLimit),
      uploadLimitKbps: uploadLimitKbps ? Number(uploadLimitKbps) : undefined,
      downloadLimitKbps: downloadLimitKbps ? Number(downloadLimitKbps) : undefined,
      dataQuotaMB: dataQuotaMB ? Number(dataQuotaMB) : undefined,
      note, nome, setor, funcao,
      responsavel
    });

    res.status(201).json(result);
  } catch (error) {
    handleApiError(res, error, req);
  }
};

exports.deleteVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const mac = req.query.mac || req.body?.mac;
    const numeroVoucher = req.body.numeroVoucher;
    
    await unifiService.revokeVoucher(req.session.unifi, id, mac, numeroVoucher);

    res.status(204).send();
  } catch (error) {
    handleApiError(res, error, req);
  }
};