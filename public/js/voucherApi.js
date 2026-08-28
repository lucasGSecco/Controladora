// voucherApi.js
// Única responsabilidade: falar com o backend (/api/vouchers).
// Não conhece DOM, não formata nada para exibição — só request/response.
// A sessão expirada (401) é tratada de forma centralizada pelo apiFetch.
 
import { apiFetch } from './httpClient.js';
 
export async function fetchVouchers() {
  const res = await apiFetch('/api/vouchers', {
    headers: { 'Cache-Control': 'no-cache' },
  });
  if (!res.ok) throw new Error('Falha ao buscar vouchers');
 
  const data = await res.json();
  return Array.isArray(data) ? data : data.data || [];
}
 
export async function createVoucher(payload) {
  const res = await apiFetch('/api/vouchers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
 
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao gerar voucher');
  }
  return data;
}
 
export async function revokeVoucher(id, mac, numeroVoucher) {
  const hasValidMac = mac && !mac.includes('—————————————————');
  const url = hasValidMac
    ? `/api/vouchers/${id}?mac=${encodeURIComponent(mac)}`
    : `/api/vouchers/${id}`;
 
  const res = await apiFetch(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ numeroVoucher }),
  });
 
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Erro ao revogar voucher');
  }
}