// public/auth.js

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginMessageEl = document.getElementById('loginMessage');
    const registerMessageEl = document.getElementById('registerMessage');

    // Função para exibir mensagens
    function showMessage(element, message, isError = false) {
        element.textContent = message;
        element.className = 'form-message'; // Limpa classes antigas
        if (isError) {
            element.classList.add('error');
        } else {
            element.classList.add('success');
        }
    }

    // Event Listener para o formulário de REGISTRO
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
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
            }
        });
    }

    // Event Listener para o formulário de LOGIN
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
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

                // Redireciona para a página de anunciar vaga ou principal após 1 segundo
                setTimeout(() => {
                    window.location.href = 'add-listing.html';
                }, 1000);

            } catch (error) {
                showMessage(loginMessageEl, error.message, true);
            }
        });
    }
});