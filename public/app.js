const form = document.getElementById('voucher-form');
const feedback = document.getElementById('form-feedback');
const voucherList = document.getElementById('voucher-list');
const refreshBtn = document.getElementById('refresh-btn');

function formatMinutes(minutes) {
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours}h`;
  }
  return `${minutes}min`;
}

function statusInfo(voucher) {
  // A API da UniFi retorna o campo "status" com valores como
  // VALID_ONE, VALID_MULTI, USED, EXPIRED, dependendo da versao.
  const raw = (voucher.status || '').toUpperCase();

  if (raw.includes('USED') || voucher.used >= (voucher.quota || 1)) {
    return { label: 'Usado', className: 'status-used' };
  }
  if (raw.includes('EXPIRED')) {
    return { label: 'Expirado', className: 'status-expired' };
  }
  return { label: 'Válido', className: 'status-valid' };
}

function renderVouchers(vouchers) {
  if (!vouchers.length) {
    voucherList.innerHTML = '<tr><td colspan="6" class="empty">Nenhum voucher cadastrado ainda.</td></tr>';
    return;
  }

  voucherList.innerHTML = vouchers
    .map((voucher) => {
      const status = statusInfo(voucher);
      const usage = voucher.quota === 0 ? 'Múltiplos usos' : 'Uso único';
      return `
        <tr data-id="${voucher._id}">
          <td class="voucher-code">${voucher.code}</td>
          <td>${voucher.note || '—'}</td>
          <td>${formatMinutes(voucher.duration)}</td>
          <td>${usage}</td>
          <td><span class="status-pill ${status.className}">${status.label}</span></td>
          <td><button class="revoke-btn" data-id="${voucher._id}">Revogar</button></td>
        </tr>
      `;
    })
    .join('');
}

async function loadVouchers() {
  voucherList.innerHTML = '<tr><td colspan="6" class="empty">Carregando...</td></tr>';
  try {
    const res = await fetch('/api/vouchers');
    if (!res.ok) throw new Error('Falha ao buscar vouchers');
    const vouchers = await res.json();
    // mais recentes primeiro
    vouchers.sort((a, b) => b.create_time - a.create_time);
    renderVouchers(vouchers);
  } catch (err) {
    voucherList.innerHTML = `<tr><td colspan="6" class="empty">Erro ao carregar vouchers: ${err.message}</td></tr>`;
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const minutes = document.getElementById('minutes').value;
  const count = document.getElementById('count').value;
  const usageLimit = document.getElementById('usageLimit').value;
  const note = document.getElementById('note').value;

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  feedback.textContent = 'Gerando voucher...';
  feedback.className = 'feedback';

  try {
    const res = await fetch('/api/vouchers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes, count, usageLimit, note }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Erro ao gerar voucher');
    }

    feedback.textContent = `${data.length} voucher(s) gerado(s) com sucesso.`;
    feedback.className = 'feedback success';
    form.reset();
    document.getElementById('minutes').value = 480;
    document.getElementById('count').value = 1;
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

loadVouchers();
