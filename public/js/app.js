// app.js
// Ponto de entrada da tela de vouchers. Não tem regra de negócio própria:
// só liga API + tabela + formulário entre si.

import { fetchVouchers, createVoucher, revokeVoucher } from './voucherApi.js';
import { createVoucherTable } from './voucherTable.js';
import { initVoucherForm } from './voucherForm.js';

const formEl = document.getElementById('voucher-form');
const feedbackEl = document.getElementById('form-feedback');
const bodyEl = document.getElementById('voucher-list');
const refreshBtn = document.getElementById('refresh-btn');
const searchInput = document.getElementById('search-input');
const statusFilterEl = document.getElementById('status-filter');
const paginationContainerEl = document.querySelector('.pagination-container');

const table = createVoucherTable({
  bodyEl,
  paginationContainerEl,
  onRevoke: async (id, mac, numeroVoucher) => {
    await revokeVoucher(id, mac, numeroVoucher);
    await loadVouchers();
  },
});

async function loadVouchers() {
  table.showLoading();
  try {
    const vouchers = await fetchVouchers();
    table.setVouchers(vouchers);
  } catch (err) {
    table.showError(err.message);
  }
}

initVoucherForm({
  formEl,
  feedbackEl,
  onSubmit: async (payload) => {
    await createVoucher(payload);
    table.resetPage();
    await loadVouchers();
  },
});

refreshBtn.addEventListener('click', loadVouchers);
searchInput.addEventListener('input', (e) => table.setSearchQuery(e.target.value));
statusFilterEl.addEventListener('change', (e) => table.setStatusFilter(e.target.value));

loadVouchers();