// voucherForm.js
// Responsabilidade única: o formulário de criação de voucher — ler campos,
// validar, montar o payload e resetar a UI. Quem efetivamente chama a API
// é decidido por fora, via callback "onSubmit".

export function initVoucherForm({ formEl, feedbackEl, onSubmit }) {
  const quotaGroup = document.getElementById('quota-group');
  const quotaInput = document.getElementById('quotaLimit');
  const usageRadios = document.querySelectorAll('input[name="usageType"]');

  usageRadios.forEach((radio) => {
    radio.addEventListener('change', (e) => {
      const isMulti = e.target.value === 'multi';
      quotaGroup.style.display = isMulti ? 'block' : 'none';
      quotaInput.required = isMulti;
    });
  });

  function buildPayload() {
    const nome = document.getElementById('nome')?.value || '';
    const setor = document.getElementById('setor')?.value || '';
    const funcao = document.getElementById('funcao')?.value || '';
    const count = parseInt(document.getElementById('count')?.value, 10) || 1;
    const usageType = document.querySelector('input[name="usageType"]:checked')?.value || 'single';
    const expirationVal = parseInt(document.getElementById('expiration')?.value, 10) || 1;
    const unit = document.getElementById('unit')?.value || 'days';
    const dataLimitVal = document.getElementById('dataLimit')?.value;
    const downLimitVal = document.getElementById('downLimit')?.value;
    const upLimitVal = document.getElementById('upLimit')?.value;

    let minutes = expirationVal;
    if (unit === 'hours') minutes = expirationVal * 60;
    else if (unit === 'days') minutes = expirationVal * 1440;

    let usageLimit = 1;
    if (usageType === 'unlimited') usageLimit = 0;
    else if (usageType === 'multi') usageLimit = parseInt(quotaInput.value, 10) || 2;

    // O responsável não é enviado aqui; o backend o recupera via sessão.
    const payload = { nome, setor, funcao, note: nome, count, minutes, usageLimit };

    const dataLimit = parseInt(dataLimitVal, 10);
    const downLimit = parseInt(downLimitVal, 10);
    const upLimit = parseInt(upLimitVal, 10);

    if (!isNaN(downLimit) && downLimit > 100) {
      return { error: 'O limite de download não pode ser maior que 100 Mbps.' };
    }
    if (!isNaN(upLimit) && upLimit > 100) {
      return { error: 'O limite de upload não pode ser maior que 100 Mbps.' };
    }

    if (!isNaN(dataLimit)) payload.dataQuotaMB = dataLimit;
    if (!isNaN(downLimit)) payload.downloadLimitKbps = downLimit * 1000;
    if (!isNaN(upLimit)) payload.uploadLimitKbps = upLimit * 1000;

    return { payload };
  }

  function resetDefaults() {
    formEl.reset();
    quotaGroup.style.display = 'none';
    quotaInput.required = false;
    document.getElementById('expiration').value = 365;
    document.getElementById('count').value = 1;
    document.getElementById('downLimit').value = 30;
    document.getElementById('upLimit').value = 30;
  }

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();

    const { payload, error } = buildPayload();
    if (error) {
      feedbackEl.textContent = error;
      feedbackEl.className = 'feedback error';
      return;
    }

    const submitBtn = formEl.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    feedbackEl.textContent = 'Gerando voucher e salvando na planilha...';
    feedbackEl.className = 'feedback';

    try {
      await onSubmit(payload);
      feedbackEl.textContent = 'Voucher(s) gerado(s) e registrado(s) na planilha com sucesso!';
      feedbackEl.className = 'feedback success';
      resetDefaults();
    } catch (err) {
      feedbackEl.textContent = err.message;
      feedbackEl.className = 'feedback error';
    } finally {
      submitBtn.disabled = false;
    }
  });

  document.getElementById('cancel-btn')?.addEventListener('click', () => {
    formEl.reset();
    quotaGroup.style.display = 'none';
    quotaInput.required = false;
    feedbackEl.textContent = '';
  });
}