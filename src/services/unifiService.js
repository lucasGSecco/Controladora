const axios = require('axios');
const https = require('https');
const { appendVoucherRow, formatDateBR } = require('./planilhaService');

const {
  UNIFI_HOST,
  UNIFI_USERNAME,
  UNIFI_PASSWORD,
  UNIFI_SITE = 'default',
} = process.env;

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const client = axios.create({
  baseURL: UNIFI_HOST,
  httpsAgent,
  withCredentials: true,
  validateStatus: () => true,
  timeout: 5000,
});

let sessionCookie = null;
let csrfToken = null;

function extractSessionCookie(setCookieHeader) {
  if (!setCookieHeader) return null;
  const found = setCookieHeader.find((c) => c.startsWith('unifises='));
  return found ? found.split(';')[0] : null;
}

async function login() {
  const response = await client.post('/api/login', {
    username: UNIFI_USERNAME,
    password: UNIFI_PASSWORD,
  });

  if (response.status !== 200) {
    throw new Error(
      `Falha ao autenticar na controladora UniFi (status ${response.status}): ` +
        JSON.stringify(response.data)
    );
  }

  const cookie = extractSessionCookie(response.headers['set-cookie']);
  if (!cookie) {
    throw new Error('Login retornou 200 mas nenhum cookie de sessao foi recebido.');
  }

  sessionCookie = cookie;
  csrfToken = response.headers['x-csrf-token'] || null;
}

async function withSession(requestFn) {
  if (!sessionCookie) {
    await login();
  }
  console.log("withSession 1");
  const execute = async () => {
    const headers = { Cookie: sessionCookie };
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    return await requestFn(headers);
  };
  console.log("withSession 2");
  try {
    let response = await execute();
    
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Erro na API UniFi (status ${response.status}): ${JSON.stringify(response.data)}`);
    }
    console.log("withSession 3");
    return response.data;
  } catch (error) {
    // Se for erro 401 (Sessão expirada), tenta relogar e refazer 1 vez
    if (error.response && error.response.status === 401) {
      await login();
      let retryResponse = await execute();
      return retryResponse.data;
    }
    
    // Se for outro erro, lança para ser tratado fora
    throw error;
  }
  console.log("withSession 4");
}

async function createVoucher(params) {
  const {
    minutes,
    count = 1,
    usageLimit = 1,
    uploadLimitKbps,
    downloadLimitKbps,
    dataQuotaMB,
    note,
    nome,
    setor,
    funcao,
    responsavel,
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

  const data = await withSession((headers) =>
    client.post(`/api/s/${UNIFI_SITE}/cmd/hotspot`, payload, { headers })
  );

  try {
    const createdList = data.data || [];
    const created = createdList[0];
    
    let rawCode = '';

    if (created && created.create_time) {
      const voucherRes = await withSession((headers) =>
        client.get(`/api/s/${UNIFI_SITE}/stat/voucher?create_time=${created.create_time}`, { headers })
      );

      const foundVoucher = (voucherRes.data || [])[0];
      if (foundVoucher) {
        rawCode = foundVoucher.code || foundVoucher.key || '';
      }
    }

    if (rawCode.length === 10) {
      rawCode = `${rawCode.slice(0, 5)}-${rawCode.slice(5)}`;
    }

    const diasLiberado = minutes ? Math.round(minutes / 1440) : null;

    console.log("Número do voucher encontrado no UniFi:", rawCode);


    await appendVoucherRow({
      nome,
      setor,
      funcao,
      numeroVoucher: rawCode,
      dataLiberacao: formatDateBR(),
      responsavel,
      diasLiberado,
    });
  } catch (err) {
    console.error('Erro ao salvar voucher na planilha Google:', err.message);
  }

  return data;
}

async function listVouchers() {
  const data = await withSession((headers) =>
    client.get(`/api/s/${UNIFI_SITE}/stat/voucher`, { headers })
  );

  return data.data || [];
}

async function listHotspotGuests() {
  try {
    const data = await withSession((headers) =>
      client.get(`/api/s/${UNIFI_SITE}/stat/guest`, { headers })
    );
    return data.data || [];
  } catch (error) {
    console.error('Erro ao buscar convidados do hotspot:', error.message);
    return [];
  }
}

async function listAllVouchersWithHistory() {
  const activeVouchers = await listVouchers();
  const guests = await listHotspotGuests();


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

async function revokeVoucher(voucherId, macAddress = null) {
  try {
    console.log("TESTE 1");
    if (macAddress && macAddress !== null) {
      const cleanMac = macAddress.toLowerCase();

      console.log("TESTE 2");

    

      console.log("TESTE 3");

      await withSession((headers) =>
        client.post(
          `/api/s/${UNIFI_SITE}/cmd/stamgr`,
          { cmd: 'forget-sta', macs: [cleanMac] },
          { headers }
        )
      ).catch(() => {});
      console.log("TESTE 4");
    }
  } catch (error) {
    console.warn('Aviso ao remover o dispositivo:', error.message);
  }

  try {
    console.log("TESTE 5");
    return await withSession((headers) =>
      client.post(
        `/api/s/${UNIFI_SITE}/cmd/hotspot`,
        { cmd: 'delete-voucher', _id: voucherId },
        { headers }
      )
    );
  } catch (err) {
    return await withSession((headers) =>
      client.delete(`/api/s/${UNIFI_SITE}/rest/voucher/${voucherId}`, { headers })
    );
  }
  console.log("TESTE 6");
}

module.exports = {
  login,
  createVoucher,
  listVouchers,
  listHotspotGuests,
  listAllVouchersWithHistory,
  revokeVoucher,
};