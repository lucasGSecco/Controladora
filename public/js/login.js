document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const loginFeedback = document.getElementById('login-feedback');

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    loginFeedback.className = 'feedback text-center';
    loginFeedback.textContent = 'Autenticando...';

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Falha ao realizar login.');
      }

      loginFeedback.className = 'feedback success text-center';
      loginFeedback.textContent = 'Login efetuado com sucesso! Redirecionando...';

      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1000);
    } catch (error) {
      loginFeedback.className = 'feedback error text-center';
      loginFeedback.textContent = error.message;
    }
  });
});