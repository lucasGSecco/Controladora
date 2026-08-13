const form = document.getElementById('voucher-form');
const feedback = document.getElementById('form-feedback');
const voucherList = document.getElementById('voucher-list');
const refreshBtn = document.getElementById('refresh-btn');
const searchInput = document.getElementById('search-input');
const statusFilter = document.getElementById('status-filter');

const usageRadios = document.querySelectorAll('input[name="usageType"]');
const quotaGroup = document.getElementById('quota-group');
const quotaInput = document.getElementById('quotaLimit');

let allVouchers = [];
let currentPage = 1;
const itemsPerPage = 10;

let searchQuery = '';
let currentStatus = 'all';

if (usageRadios.length > 0) {
  usageRadios.forEach((radio) => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'multi') {
        quotaGroup.style.display = 'block';
        quotaInput.required = true;
      } else {
        quotaGroup.style.display = 'none';
        quotaInput.required = false;
      }
    });
  });
}

function formatVoucherCode(code) {
  if (!code) return '—';
  const clean = code.toString().replace(/[^a-zA-Z0-9]/g, '');
  if (clean.length === 10) {
    return `${clean.slice(0, 5)}-${clean.slice(5)}`;
  }
  return code;
}

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
    const nameToSearch = voucher.nome || voucher.note || '';
    
    const textMatch =
      searchQuery === '' ||
      normalizeText(nameToSearch).includes(searchQuery) ||
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
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return `${days}d`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours}h`;
  }
  return `${minutes}min`;
}

function statusInfo(voucher) {
  if (isVoucherUsed(voucher)) {
    return { label: 'Usado', className: 'status-used' };
  }

  const raw = (voucher.status || '').toUpperCase();

  if (raw.includes('EXPIRED')) {
    return { label: 'Expirado', className: 'status-expired' };
  }

  return { label: 'Válido', className: 'status-valid' };
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
      let usage = 'Uso único';
      if (voucher.quota === 0) {
        usage = 'Ilimitado';
      } else if (voucher.quota > 1) {
        usage = `${voucher.used || 0}/${voucher.quota} usos`;
      }

      const displayName = voucher.nome || voucher.note || '—';
      const macAddress = voucher.client_mac || voucher.used_by || '—————————————————';

      return `
        <tr data-id="${voucher._id}">
          <td class="voucher-code">${formatVoucherCode(voucher.code)}</td>
          <td>${displayName}</td>
          <td>${formatMinutes(voucher.duration)}</td>
          <td>${usage}</td>
          <td><code>${macAddress}</code></td>
          <td><button class="revoke-btn" data-id="${voucher._id}" data-mac="${macAddress}">Revogar</button></td>
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

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const nome = document.getElementById('nome')?.value || '';
  const setor = document.getElementById('setor')?.value || '';
  const funcao = document.getElementById('funcao')?.value || '';
  const responsavel = document.getElementById('responsavel')?.value || '';

  const count = parseInt(document.getElementById('count')?.value, 10) || 1;
  const usageType = document.querySelector('input[name="usageType"]:checked')?.value || 'single';
  const expirationVal = parseInt(document.getElementById('expiration')?.value, 10) || 1;
  const unit = document.getElementById('unit')?.value || 'days';

  const dataLimitVal = document.getElementById('dataLimit')?.value;
  const downLimitVal = document.getElementById('downLimit')?.value;
  const upLimitVal = document.getElementById('upLimit')?.value;

  let minutes = expirationVal;
  if (unit === 'hours') {
    minutes = expirationVal * 60;
  } else if (unit === 'days') {
    minutes = expirationVal * 1440;
  }

  let usageLimit = 1;
  if (usageType === 'unlimited') {
    usageLimit = 0;
  } else if (usageType === 'multi') {
    usageLimit = parseInt(quotaInput.value, 10) || 2;
  }

  const payload = {
    nome,
    setor,
    funcao,
    responsavel,
    note: nome, 
    count,
    minutes,
    usageLimit
  };

  const dataLimit = parseInt(dataLimitVal, 10);
  let downLimit = parseInt(downLimitVal, 10);
  let upLimit = parseInt(upLimitVal, 10);

  // Validação visual/alerta caso o usuário exceda 100
  if (!isNaN(downLimit) && downLimit > 100) {
    feedback.textContent = 'O limite de download não pode ser maior que 100 Mbps.';
    feedback.className = 'feedback error';
    return;
  }

  if (!isNaN(upLimit) && upLimit > 100) {
    feedback.textContent = 'O limite de upload não pode ser maior que 100 Mbps.';
    feedback.className = 'feedback error';
    return;
  }

  // Só atribui ao payload se for um número válido (se estiver vazio, não insere, tornando ilimitado)
  if (!isNaN(dataLimit)) payload.dataQuotaMB = dataLimit;
  if (!isNaN(downLimit)) payload.downloadLimitKbps = downLimit * 1000;
  if (!isNaN(upLimit)) payload.uploadLimitKbps = upLimit * 1000;

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  feedback.textContent = 'Gerando voucher e salvando na planilha...';
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

    feedback.textContent = 'Voucher(s) gerado(s) e registrado(s) na planilha com sucesso!';
    feedback.className = 'feedback success';

    form.reset();
    
    if (quotaGroup) {
      quotaGroup.style.display = 'none';
      quotaInput.required = false;
    }

    document.getElementById('expiration').value = 365;
    document.getElementById('count').value = 1;
    document.getElementById('downLimit').value = 30;
    document.getElementById('upLimit').value = 30;
    
    currentPage = 1;
    loadVouchers();
  } catch (err) {
    feedback.textContent = err.message;
    feedback.className = 'feedback error';
  } finally {
    submitBtn.disabled = false;
  }
});

document.getElementById('cancel-btn')?.addEventListener('click', () => {
  form.reset();
  if (quotaGroup) {
    quotaGroup.style.display = 'none';
    quotaInput.required = false;
  }
  feedback.textContent = '';
});

voucherList.addEventListener('click', async (e) => {
  if (!e.target.classList.contains('revoke-btn')) return;

  const id = e.target.dataset.id;
  const mac = e.target.dataset.mac;

  const confirmed = confirm('Revogar este voucher? Essa ação não pode ser desfeita.');
  if (!confirmed) return;

  e.target.disabled = true;
  e.target.textContent = 'Revogando...';

  try {
    const hasValidMac = mac && !mac.includes('—————————————————');
    const url = hasValidMac 
      ? `/api/vouchers/${id}?mac=${encodeURIComponent(mac)}` 
      : `/api/vouchers/${id}`;

    console.log("antes");
    const res = await fetch(url, { method: 'DELETE' });
    console.log("depois");

    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Erro ao revogar voucher');
    }

    await loadVouchers();

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