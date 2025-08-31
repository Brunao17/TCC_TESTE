document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginMessageEl = document.getElementById('loginMessage');
    const registerMessageEl = document.getElementById('registerMessage');

    // Função para exibir mensagens nos formulários
    function showMessage(element, message, isError = false) {
        if (!element) return;
        element.textContent = message;
        element.className = 'form-message'; // Limpa classes
        element.classList.add(isError ? 'error' : 'success');
    }

    // Event Listener para o formulário de REGISTRO
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = registerForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;

            const formData = new FormData(registerForm);
            const data = Object.fromEntries(formData.entries());

            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });

                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.message || 'Erro ao registrar.');
                }
                
                showMessage(registerMessageEl, result.message);
                registerForm.reset();

            } catch (error) {
                showMessage(registerMessageEl, error.message, true);
            } finally {
                submitButton.disabled = false;
            }
        });
    }

    // Event Listener para o formulário de LOGIN
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = loginForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;

            const formData = new FormData(loginForm);
            const data = Object.fromEntries(formData.entries());

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });

                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.message || 'Erro no login.');
                }
                
                // Salva o token e informações do usuário no localStorage
                localStorage.setItem('token', result.token);
                localStorage.setItem('usuario', JSON.stringify(result.usuario));

                showMessage(loginMessageEl, result.message);

                // Redireciona para a página principal após 1 segundo
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000);

            } catch (error) {
                showMessage(loginMessageEl, error.message, true);
            } finally {
                submitButton.disabled = false;
            }
        });
    }
});