export async function apiFetch(url, options = {}) {
  const res = await fetch(url, options);
 
  if (res.status === 401) {
    window.location.href = 'login.html';
    // Interrompe o fluxo de quem chamou; a página já está sendo trocada.
    throw new Error('Sessão expirada. Redirecionando para o login...');
  }
 
  return res;
}