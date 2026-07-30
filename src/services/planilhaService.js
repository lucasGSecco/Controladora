require('dotenv').config();
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const {
  GOOGLE_SHEET_ID,
  GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_PRIVATE_KEY,
  GOOGLE_SHEET_TAB_NAME, // opcional: nome da aba. Se vazio, usa a primeira aba do arquivo.
} = process.env;

// Precisam bater EXATAMENTE com o texto da primeira linha da planilha
// (mesma acentuação, maiúsculas/minúsculas e espaços).
const COLUNAS = [
  'Nome',
  'Setor',
  'Função',
  'Numero do Voucher',
  'Data da liberação',
  'Responsável',
  'Dias Liberado',
];

let cachedDoc = null;

function getJwtClient() {
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    throw new Error(
      'Credenciais do Google ausentes. Defina GOOGLE_SERVICE_ACCOUNT_EMAIL e GOOGLE_PRIVATE_KEY.'
    );
  }

  return new JWT({
    email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function getDoc() {
  if (cachedDoc) return cachedDoc;

  if (!GOOGLE_SHEET_ID) {
    throw new Error('GOOGLE_SHEET_ID nao definido.');
  }

  const jwt = getJwtClient();
  const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, jwt);
  await doc.loadInfo();

  cachedDoc = doc;
  return doc;
}

async function getSheet() {
  const doc = await getDoc();

  const sheet = GOOGLE_SHEET_TAB_NAME
    ? doc.sheetsByTitle[GOOGLE_SHEET_TAB_NAME]
    : doc.sheetsByIndex[0];

  if (!sheet) {
    throw new Error(
      `Aba da planilha nao encontrada${GOOGLE_SHEET_TAB_NAME ? ` ("${GOOGLE_SHEET_TAB_NAME}")` : ''}.`
    );
  }

  await sheet.loadHeaderRow();
  return sheet;
}

function formatDateBR(date = new Date()) {
  return date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Adiciona uma linha na planilha no formato:
 * Nome | Setor | Função | Numero do Voucher | Data da liberação | Responsável | Dias Liberado
 */
async function appendVoucherRow({
  nome,
  setor,
  funcao,
  numeroVoucher,
  dataLiberacao,
  responsavel,
  diasLiberado,
}) {
  const sheet = await getSheet();

  await sheet.addRow({
    Nome: nome || '',
    Setor: setor || '',
    Função: funcao || '',
    'Numero do Voucher': numeroVoucher || '',
    'Data da liberação': dataLiberacao || formatDateBR(),
    Responsável: responsavel || '',
    'Dias Liberado': diasLiberado != null ? diasLiberado : '',
  });
}

module.exports = { appendVoucherRow, formatDateBR, COLUNAS };