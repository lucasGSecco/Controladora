const form = document.getElementById('voucher-form');
const feedback = document.getElementById('form-feedback');
const voucherList = document.getElementById('voucher-list');
const refreshBtn = document.getElementById('refresh-btn');
const searchInput = document.getElementById('search-input');
const statusFilter = document.getElementById('status-filter');

let allVouchers = [];
let currentPage = 1;
const itemsPerPage = 10;

let searchQuery = '';
let currentStatus = 'all';

function normalizeText(text) {
  return (text || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function ensurePaginationElements() {
  let prevBtn = document.getElementById('prev-page');
  let nextBtn = document.getElementById('next-page');

  if (!prevBtn || !nextBtn) {
    const card = voucherList.closest('.card');
    if (!card) return;

    let container = card.querySelector('.pagination-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'pagination-container';
      card.appendChild(container);
    }

    container.innerHTML = `
      <button id="prev-page" class="secondary" type="button" disabled>&laquo; Anterior</button>
      <span id="page-info">Página 1 de 1</span>
      <button id="next-page" class="secondary" type="button" disabled>Próxima &raquo;</button>
    `;

    prevBtn = document.getElementById('prev-page');
    nextBtn = document.getElementById('next-page');
  }

  if (prevBtn && !prevBtn.dataset.bound) {
    prevBtn.dataset.bound = 'true';
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
      }
    });
  }

  if (nextBtn && !nextBtn.dataset.bound) {
    nextBtn.dataset.bound = 'true';
    nextBtn.addEventListener('click', () => {
      const filtered = getFilteredVouchers();
      const totalPages = Math.ceil(filtered.length / itemsPerPage);
      if (currentPage < totalPages) {
        currentPage++;
        renderTable();
      }
    });
  }
}

function isVoucherUsed(voucher) {
  const status = (voucher.status || '').toUpperCase();

  if (status.includes('USED') || voucher.used === true) return true;
  if (voucher.used_by || voucher.client_mac || voucher.last_seen || voucher.end_time || voucher.authorized) return true;

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

function getFilteredVouchers() {
  return allVouchers.filter((voucher) => {
    const textMatch =
      searchQuery === '' ||
      normalizeText(voucher.note).includes(searchQuery) ||
      normalizeText(voucher.code).includes(searchQuery);

    if (!textMatch) return false;

    switch (currentStatus) {
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
  ensurePaginationElements();

  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');
  const pageInfo = document.getElementById('page-info');

  if (!prevBtn || !nextBtn || !pageInfo) return;

  const pages = totalPages > 0 ? totalPages : 1;
  pageInfo.textContent = `Página ${currentPage} de ${pages}`;

  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages || totalPages === 0;
}

function formatMinutes(minutes) {
  if (!minutes) return '—';
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours}h`;
  }
  return `${minutes}min`;
}

function statusInfo(voucher) {
  if (isVoucherUsed(voucher)) {
    return {
      label: 'Usado',
      className: 'status-used',
    };
  }

  const raw = (voucher.status || '').toUpperCase();

  if (raw.includes('EXPIRED')) {
    return {
      label: 'Expirado',
      className: 'status-expired',
    };
  }

  return {
    label: 'Válido',
    className: 'status-valid',
  };
}

function renderTable() {
  const filteredVouchers = getFilteredVouchers();
  const totalPages = Math.ceil(filteredVouchers.length / itemsPerPage);

  if (currentPage > totalPages && totalPages > 0) {
    currentPage = totalPages;
  }
  if (currentPage < 1) {
    currentPage = 1;
  }

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageItems = filteredVouchers.slice(startIndex, endIndex);

  if (!pageItems.length) {
    voucherList.innerHTML =
      '<tr><td colspan="6" class="empty">Nenhum voucher encontrado.</td></tr>';
    updatePaginationUI(0);
    return;
  }

  voucherList.innerHTML = pageItems
    .map((voucher) => {
      const status = statusInfo(voucher);
      const usage = voucher.quota === 0 ? 'Múltiplos usos' : 'Uso único';
      
      const noteDisplay = voucher.note 
        ? voucher.note 
        : (voucher.client_mac ? `<span style="font-family: var(--mono); font-size:11px;">MAC: ${voucher.client_mac}</span>` : '—');

      return `
        <tr data-id="${voucher._id}">
          <td class="voucher-code">${voucher.code || '—'}</td>
          <td>${noteDisplay}</td>
          <td>${formatMinutes(voucher.duration)}</td>
          <td>${usage}</td>
          <td><span class="status-pill ${status.className}">${status.label}</span></td>
          <td><button class="revoke-btn" data-id="${voucher._id}">Revogar</button></td>
        </tr>
      `;
    })
    .join('');

  updatePaginationUI(totalPages);
}

async function loadVouchers() {
  voucherList.innerHTML =
    '<tr><td colspan="6" class="empty">Carregando...</td></tr>';
  try {
    const res = await fetch('/api/vouchers');
    if (!res.ok) throw new Error('Falha ao buscar vouchers');
    const data = await res.json();
    allVouchers = Array.isArray(data) ? data : data.data || [];
    
    allVouchers.sort((a, b) => (b.create_time || 0) - (a.create_time || 0));
    renderTable();
  } catch (err) {
    voucherList.innerHTML = `<tr><td colspan="6" class="empty">Erro ao carregar vouchers: ${err.message}</td></tr>`;
  }
}

// Envío do formulário integrado com o layout novo
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const note = document.getElementById('note').value;
  const count = parseInt(document.getElementById('count').value, 10) || 1;
  const usageType = document.querySelector('input[name="usageType"]:checked').value;
  const expirationVal = parseInt(document.getElementById('expiration').value, 10) || 1;
  const unit = document.getElementById('unit').value;

  const dataLimit = document.getElementById('dataLimit').value;
  const downLimit = document.getElementById('downLimit').value;
  const upLimit = document.getElementById('upLimit').value;

  // Conversão da expiração para minutos
  let minutes = expirationVal;
  if (unit === 'hours') {
    minutes = expirationVal * 60;
  } else if (unit === 'days') {
    minutes = expirationVal * 1440;
  }

  // Quota: 1 = Uso único, 0 = Múltiplos usos / Ilimitado
  let usageLimit = (usageType === 'single') ? 1 : 0;

  const payload = {
    minutes,
    count,
    usageLimit,
    note
  };

  if (dataLimit) payload.dataQuotaMB = parseInt(dataLimit, 10);
  if (downLimit) payload.downloadLimitKbps = parseInt(downLimit, 10) * 1024;
  if (upLimit) payload.uploadLimitKbps = parseInt(upLimit, 10) * 1024;

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  feedback.textContent = 'Gerando voucher...';
  feedback.className = 'feedback';

  try {
    const res = await fetch('/api/vouchers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Erro ao gerar voucher');
    }

    feedback.textContent = 'Voucher(s) gerado(s) com sucesso!';
    feedback.className = 'feedback success';

    form.reset();
    document.getElementById('expiration').value = 24;
    document.getElementById('count').value = 10;
    
    currentPage = 1;
    loadVouchers();
  } catch (err) {
    feedback.textContent = err.message;
    feedback.className = 'feedback error';
  } finally {
    submitBtn.disabled = false;
  }
});

voucherList.addEventListener('click', async (e) => {
  if (!e.target.classList.contains('revoke-btn')) return;

  const id = e.target.dataset.id;
  const confirmed = confirm('Revogar este voucher? Essa ação não pode ser desfeita.');
  if (!confirmed) return;

  e.target.disabled = true;
  e.target.textContent = 'Revogando...';

  try {
    const res = await fetch(`/api/vouchers/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Erro ao revogar voucher');
    }
    loadVouchers();
  } catch (err) {
    alert(err.message);
    e.target.disabled = false;
    e.target.textContent = 'Revogar';
  }
});

refreshBtn.addEventListener('click', loadVouchers);

searchInput.addEventListener('input', (e) => {
  searchQuery = normalizeText(e.target.value);
  currentPage = 1;
  renderTable();
});

statusFilter.addEventListener('change', (e) => {
  currentStatus = e.target.value;
  currentPage = 1;
  renderTable();
});

ensurePaginationElements();
loadVouchers();