const axios = require('axios');
const https = require('https');
const { appendVoucherRow, deleteVoucherRow, formatDateBR } = require('./planilhaService');

const {
  UNIFI_HOST,
  UNIFI_SITE = 'default',
} = process.env;

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const client = axios.create({
  baseURL: UNIFI_HOST,
  httpsAgent,
  withCredentials: true,
  validateStatus: () => true,
  timeout: 10000,
});

function extractSessionCookie(setCookieHeader) {
  if (!setCookieHeader) return null;
  const found = setCookieHeader.find((c) => c.startsWith('unifises='));
  return found ? found.split(';')[0] : null;
}

async function login(username, password) {
  const response = await client.post('/api/login', {
    username,
    password,
  });

  if (response.status !== 200) {
    throw new Error('Usuário ou senha incorretos.');
  }

  const cookie = extractSessionCookie(response.headers['set-cookie']);
  if (!cookie) {
    throw new Error('Nenhum cookie de sessão foi recebido.');
  }

  return {
    sessionCookie: cookie,
    csrfToken: response.headers['x-csrf-token'] || null
  };
}

async function executeWithSession(session, requestFn) {
  if (!session || !session.sessionCookie) {
    const error = new Error('Sessão inválida ou expirada');
    error.status = 401;
    throw error;
  }

  const headers = { Cookie: session.sessionCookie };
  if (session.csrfToken) headers['X-CSRF-Token'] = session.csrfToken;

  const response = await requestFn(headers);

  // Tratamento de expiração no UniFi
  if (response.status === 401) {
    const error = new Error('Sessão UniFi expirada');
    error.status = 401;
    throw error;
  }

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Erro na API UniFi (status ${response.status}): ${JSON.stringify(response.data)}`);
  }
  
  return response.data;
}

async function createVoucher(session, params) {
  const {
    minutes, count = 1, usageLimit = 1, uploadLimitKbps,
    downloadLimitKbps, dataQuotaMB, note, nome, setor, funcao, responsavel
  } = params;

  const payload = {
    cmd: 'create-voucher',
    expire: minutes,
    n: count,
    quota: usageLimit,
  };

  if (uploadLimitKbps) payload.up = uploadLimitKbps;
  if (downloadLimitKbps) payload.down = downloadLimitKbps;
  if (dataQuotaMB) payload.bytes = dataQuotaMB;
  if (note) payload.note = note;

  const data = await executeWithSession(session, (headers) =>
    client.post(`/api/s/${UNIFI_SITE}/cmd/hotspot`, payload, { headers })
  );

  try {
    const created = (data.data || [])[0];
    let rawCode = '';

    if (created && created.create_time) {
      const voucherRes = await executeWithSession(session, (headers) =>
        client.get(`/api/s/${UNIFI_SITE}/stat/voucher?create_time=${created.create_time}`, { headers })
      );
      const foundVoucher = (voucherRes.data || [])[0];
      if (foundVoucher) {
        rawCode = foundVoucher.code || foundVoucher.key || '';
      }
    }

    if (rawCode.length === 10) rawCode = `${rawCode.slice(0, 5)}-${rawCode.slice(5)}`;
    const diasLiberado = minutes ? Math.round(minutes / 1440) : null;
    if (diasLiberado >= 30) {
      await appendVoucherRow({
        nome, setor, funcao, numeroVoucher: rawCode,
        dataLiberacao: formatDateBR(), responsavel, diasLiberado,
      });
      
    }
    
  } catch (err) {
    console.error('Erro ao salvar voucher na planilha Google:', err.message);
  }

  return data;
}

async function listVouchers(session) {
  const data = await executeWithSession(session, (headers) =>
    client.get(`/api/s/${UNIFI_SITE}/stat/voucher`, { headers })
  );
  return data.data || [];
}

async function listHotspotGuests(session) {
  try {
    const data = await executeWithSession(session, (headers) =>
      client.get(`/api/s/${UNIFI_SITE}/stat/guest`, { headers })
    );
    return data.data || [];
  } catch (error) {
    return [];
  }
}

async function listAllVouchersWithHistory(session) {
  const activeVouchers = await listVouchers(session);
  const guests = await listHotspotGuests(session);

  const usedVouchers = guests
    .filter((g) => g.voucher_code || g.voucher_id)
    .map((g) => ({
      _id: g._id,
      code: g.voucher_code || '—',
      note: g.voucher_note || g.name || `Usado por ${g.hostname || g.mac}`,
      client_mac: g.mac,
      duration: Math.round((g.duration || 0) / 60),
      status: 'USED',
      used: 1,
      quota: 1,
      create_time: g.assoc_time || g.start,
      use_time: g.assoc_time || g.start,
    }));

  return [...activeVouchers, ...usedVouchers];
}

async function revokeVoucher(session, voucherId, macAddress = null, numeroVoucher = null) {
  if (macAddress) {
    const cleanMac = macAddress.toLowerCase();
    await executeWithSession(session, (headers) =>
      client.post(`/api/s/${UNIFI_SITE}/cmd/stamgr`, { cmd: 'forget-sta', macs: [cleanMac] }, { headers })
    ).catch(() => {});
  }

  let result = null;
  try {
    result = await executeWithSession(session, (headers) =>
      client.post(`/api/s/${UNIFI_SITE}/cmd/hotspot`, { cmd: 'delete-voucher', _id: voucherId }, { headers })
    );
  } catch (err) {
    result = await executeWithSession(session, (headers) =>
      client.delete(`/api/s/${UNIFI_SITE}/rest/voucher/${voucherId}`, { headers })
    );
  }

  const targetVoucher = numeroVoucher || voucherId;
  if (targetVoucher) {
    try {
      await deleteVoucherRow(targetVoucher);
    } catch (sheetError) {}
  }

  return result;
}

module.exports = {
  login,
  createVoucher,
  listAllVouchersWithHistory,
  revokeVoucher,
};