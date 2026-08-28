// utils.js
// Funções puras: formatação e regras de domínio simples.
// Não tocam no DOM nem fazem chamadas de rede — só recebem dados e devolvem dados.

export function normalizeText(text) {
  return (text || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function formatVoucherCode(code) {
  if (!code) return '—';
  const clean = code.toString().replace(/[^a-zA-Z0-9]/g, '');
  if (clean.length === 10) {
    return `${clean.slice(0, 5)}-${clean.slice(5)}`;
  }
  return code;
}

export function formatMinutes(minutes) {
  if (!minutes) return '—';
  if (minutes % 1440 === 0) {
    return `${minutes / 1440}d`;
  }
  if (minutes % 60 === 0) {
    return `${minutes / 60}h`;
  }
  return `${minutes}min`;
}

export function isVoucherUsed(voucher) {
  const status = (voucher.status || '').toUpperCase();

  if (status.includes('USED') || voucher.used === true) return true;

  if (
    voucher.used_by ||
    voucher.client_mac ||
    voucher.last_seen ||
    voucher.end_time ||
    voucher.authorized
  ) {
    return true;
  }

  if (
    typeof voucher.used === 'number' &&
    typeof voucher.quota === 'number' &&
    voucher.quota > 0 &&
    voucher.used >= voucher.quota
  ) {
    return true;
  }

  return false;
}