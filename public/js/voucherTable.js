// voucherTable.js
// Responsabilidade única: exibir a lista de vouchers — filtro, paginação e
// renderização das linhas. Não sabe nada sobre o formulário nem sobre a API
// (o "onRevoke" é injetado por quem monta o app).

import { formatVoucherCode, formatMinutes, isVoucherUsed, normalizeText } from './utils.js';

const ITEMS_PER_PAGE = 10;

export function createVoucherTable({ bodyEl, paginationContainerEl, onRevoke }) {
  let allVouchers = [];
  let currentPage = 1;
  let searchQuery = '';
  let statusFilter = 'all';

  ensurePaginationElements();
  bindRevokeClicks();

  function ensurePaginationElements() {
    let prevBtn = paginationContainerEl.querySelector('#prev-page');
    let nextBtn = paginationContainerEl.querySelector('#next-page');

    if (!prevBtn || !nextBtn) {
      paginationContainerEl.innerHTML = `
        <button id="prev-page" class="secondary" type="button" disabled>&laquo; Anterior</button>
        <span id="page-info">Página 1 de 1</span>
        <button id="next-page" class="secondary" type="button" disabled>Próxima &raquo;</button>
      `;
      prevBtn = paginationContainerEl.querySelector('#prev-page');
      nextBtn = paginationContainerEl.querySelector('#next-page');
    }

    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        render();
      }
    });

    nextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(getFiltered().length / ITEMS_PER_PAGE);
      if (currentPage < totalPages) {
        currentPage++;
        render();
      }
    });
  }

  function bindRevokeClicks() {
    bodyEl.addEventListener('click', async (e) => {
      if (!e.target.classList.contains('revoke-btn')) return;

      const { id, mac, numeroVoucher } = e.target.dataset;
      const confirmed = confirm('Revogar este voucher? Essa ação não pode ser desfeita.');
      if (!confirmed) return;

      e.target.disabled = true;
      e.target.textContent = 'Revogando...';

      try {
        await onRevoke(id, mac, numeroVoucher);
      } catch (err) {
        alert(err.message);
        e.target.disabled = false;
        e.target.textContent = 'Revogar';
      }
    });
  }

  function getFiltered() {
    return allVouchers.filter((voucher) => {
      const nameToSearch = voucher.nome || voucher.note || '';
      const textMatch =
        searchQuery === '' ||
        normalizeText(nameToSearch).includes(searchQuery) ||
        normalizeText(voucher.code).includes(searchQuery);

      if (!textMatch) return false;

      switch (statusFilter) {
        case 'used':
          return isVoucherUsed(voucher);
        case 'unused':
          return !isVoucherUsed(voucher);
        default:
          return true;
      }
    });
  }

  function updatePaginationUI(totalPages) {
    const prevBtn = paginationContainerEl.querySelector('#prev-page');
    const nextBtn = paginationContainerEl.querySelector('#next-page');
    const pageInfo = paginationContainerEl.querySelector('#page-info');
    if (!prevBtn || !nextBtn || !pageInfo) return;

    const pages = totalPages > 0 ? totalPages : 1;
    pageInfo.textContent = `Página ${currentPage} de ${pages}`;
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages || totalPages === 0;
  }

  function rowHtml(voucher) {
    let usage = 'Uso único';
    if (voucher.quota === 0) usage = 'Ilimitado';
    else if (voucher.quota > 1) usage = `${voucher.used || 0}/${voucher.quota} usos`;

    const displayName = voucher.nome || voucher.note || '—';
    const macAddress = voucher.client_mac || voucher.used_by || '—————————————————';

    return `
      <tr data-id="${voucher._id}">
        <td class="voucher-code">${formatVoucherCode(voucher.code)}</td>
        <td>${displayName}</td>
        <td>${formatMinutes(voucher.duration)}</td>
        <td>${usage}</td>
        <td><code>${macAddress}</code></td>
        <td>
          <button
            class="revoke-btn"
            data-id="${voucher._id}"
            data-mac="${macAddress}"
            data-numero-voucher="${voucher.code}">
            Revogar
          </button>
        </td>
      </tr>
    `;
  }

  function render() {
    const filtered = getFiltered();
    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

    if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageItems = filtered.slice(start, start + ITEMS_PER_PAGE);

    if (!pageItems.length) {
      bodyEl.innerHTML = '<tr><td colspan="6" class="empty">Nenhum voucher encontrado.</td></tr>';
      updatePaginationUI(0);
      return;
    }

    bodyEl.innerHTML = pageItems.map(rowHtml).join('');
    updatePaginationUI(totalPages);
  }

  return {
    setVouchers(list) {
      allVouchers = [...list].sort((a, b) => (b.create_time || 0) - (a.create_time || 0));
      render();
    },
    setSearchQuery(query) {
      searchQuery = normalizeText(query);
      currentPage = 1;
      render();
    },
    setStatusFilter(status) {
      statusFilter = status;
      currentPage = 1;
      render();
    },
    resetPage() {
      currentPage = 1;
    },
    showLoading() {
      bodyEl.innerHTML = '<tr><td colspan="6" class="empty">Carregando...</td></tr>';
    },
    showError(message) {
      bodyEl.innerHTML = `<tr><td colspan="6" class="empty">Erro ao carregar vouchers: ${message}</td></tr>`;
    },
  };
}