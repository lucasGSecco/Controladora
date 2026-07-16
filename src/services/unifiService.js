const axios = require('axios');
const https = require('https');

const {
  UNIFI_HOST,
  UNIFI_USERNAME,
  UNIFI_PASSWORD,
  UNIFI_SITE = 'default',
} = process.env;

// A controladora usa certificado autoassinado, entao desativamos a
// verificacao de TLS apenas para esse cliente HTTP dedicado a ela.
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const client = axios.create({
  baseURL: UNIFI_HOST,
  httpsAgent,
  withCredentials: true,
  validateStatus: () => true, // tratamos os status manualmente
});

let sessionCookie = null;
let csrfToken = null;

/**
 * Extrai o cookie de sessao (unifises) do header set-cookie da resposta.
 */
function extractSessionCookie(setCookieHeader) {
  if (!setCookieHeader) return null;
  const found = setCookieHeader.find((c) => c.startsWith('unifises='));
  return found ? found.split(';')[0] : null;
}

/**
 * Faz login na controladora e guarda o cookie de sessao e o token CSRF
 * (algumas versoes do UniFi exigem o CSRF em requisicoes POST/PUT/DELETE).
 */
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

/**
 * Garante que existe uma sessao valida antes de chamar a API.
 * Reautentica automaticamente se a sessao expirou (401).
 */
async function withSession(requestFn) {
  if (!sessionCookie) {
    await login();
  }

  const headers = { Cookie: sessionCookie };
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

  let response = await requestFn(headers);

  if (response.status === 401) {
    // sessao expirada, tenta logar de novo uma vez
    await login();
    const retryHeaders = { Cookie: sessionCookie };
    if (csrfToken) retryHeaders['X-CSRF-Token'] = csrfToken;
    response = await requestFn(retryHeaders);
  }

  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      `Erro na API UniFi (status ${response.status}): ${JSON.stringify(response.data)}`
    );
  }

  return response.data;
}

/**
 * Cria um ou mais vouchers.
 * @param {Object} opts
 * @param {number} opts.minutes - validade do voucher em minutos
 * @param {number} opts.count - quantidade de vouchers a gerar
 * @param {number} opts.usageLimit - 1 = uso unico, 0 = multiplos usos (ate quota definida)
 * @param {number} [opts.uploadLimitKbps] - limite opcional de upload
 * @param {number} [opts.downloadLimitKbps] - limite opcional de download
 * @param {number} [opts.dataQuotaMB] - limite opcional de dados em MB
 * @param {string} [opts.note] - observacao/identificacao do voucher
 */
async function createVoucher({
  minutes,
  count = 1,
  usageLimit = 1,
  uploadLimitKbps,
  downloadLimitKbps,
  dataQuotaMB,
  note,
}) {
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

  // A criacao nao retorna o codigo do voucher diretamente, apenas confirma
  // a criacao. Buscamos os vouchers recem-criados filtrando pela nota/hora.
  return data;
}

/**
 * Lista todos os vouchers cadastrados no site.
 */
async function listVouchers() {
  const data = await withSession((headers) =>
    client.get(`/api/s/${UNIFI_SITE}/stat/voucher`, { headers })
  );
  return data.data || [];
}

/**
 * Revoga (deleta) um voucher pelo seu _id interno da controladora.
 */
async function revokeVoucher(voucherId) {
  const data = await withSession((headers) =>
    client.post(
      `/api/s/${UNIFI_SITE}/cmd/hotspot`,
      { cmd: 'delete-voucher', _id: voucherId },
      { headers }
    )
  );
  return data;
}

module.exports = {
  login,
  createVoucher,
  listVouchers,
  revokeVoucher,
};
