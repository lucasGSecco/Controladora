export async function apiFetch(url, options = {}) {
  const res = await fetch(url, options);
 
  if (res.status === 401) {
    window.location.href = 'login.html';
    throw new Error('Sessão expirada. Redirecionando para o login...');
  }
 
  return res;
}