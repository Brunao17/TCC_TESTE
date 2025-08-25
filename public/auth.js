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
            console.log("Formulário de REGISTRO enviado."); // <-- LOG 1
            const formData = new FormData(registerForm);
            const data = Object.fromEntries(formData.entries());
            console.log("Dados de registro a serem enviados:", data); // <-- LOG 2

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
                console.error("ERRO no fetch de registro:", error); // <-- LOG 3
                showMessage(registerMessageEl, error.message, true);
            }
        });
    }

    // Event Listener para o formulário de LOGIN
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log("Formulário de LOGIN enviado."); // <-- LOG 4
            const formData = new FormData(loginForm);
            const data = Object.fromEntries(formData.entries());
            console.log("Dados de login a serem enviados:", data); // <-- LOG 5

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
                console.error("ERRO no fetch de login:", error); // <-- LOG 6
                showMessage(loginMessageEl, error.message, true);
            }
        });
    }
});