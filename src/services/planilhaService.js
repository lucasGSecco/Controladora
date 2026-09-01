require('dotenv').config();
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const {
  GOOGLE_SHEET_ID,
  GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_PRIVATE_KEY,
  GOOGLE_SHEET_TAB_NAME,
} = process.env;

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

/**
 * @param {string|number} numeroVoucher
 * @returns {Promise<boolean>}
 */
async function deleteVoucherRow(numeroVoucher) {
  if (!numeroVoucher) {
    return false;
  }

  const normalize = (val) => String(val || '').replace(/[^a-zA-Z0-9]/g, '');
  const targetCode = normalize(numeroVoucher);

  const sheet = await getSheet();
  const rows = await sheet.getRows();

  const targetRow = rows.find((row) => {
    const cellValue = 
      (typeof row.get === 'function' ? row.get('Numero do Voucher') : null) ||
      (typeof row.get === 'function' ? row.get('Número do Voucher') : null) ||
      row['Numero do Voucher'] ||
      row['Número do Voucher'] ||
      '';

    const sheetCode = normalize(cellValue);
    return sheetCode === targetCode;
  });

  if (targetRow) {
    await targetRow.delete();
    return true;
  }

  return false;
}

module.exports = { appendVoucherRow, deleteVoucherRow, formatDateBR, COLUNAS };