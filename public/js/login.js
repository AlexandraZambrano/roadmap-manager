const API_URL = window.APP_CONFIG?.API_URL || window.location.origin;
// External auth calls go via our own server proxy to avoid CORS issues

function showAlert(message, type = 'danger') {
    const alert = document.getElementById(`${type}-alert`);
    alert.textContent = message;
    alert.classList.remove('hidden');

    if (type === 'success') {
        setTimeout(() => alert.classList.add('hidden'), 3000);
    }
}

function hideAlerts() {
    const danger = document.getElementById('danger-alert');
    if (danger) danger.classList.add('hidden');

    const success = document.getElementById('success-alert');
    if (success) success.classList.add('hidden');

    const error = document.getElementById('error-alert');
    if (error) error.classList.add('hidden');
}

function setLoading(isLoading) {
    const spinner = document.querySelector('.spinner-sm');
    const button = document.querySelector('.btn-login');

    if (isLoading) {
        spinner.style.display = 'inline-block';
        button.disabled = true;
    } else {
        spinner.style.display = 'none';
        button.disabled = false;
    }
}

// Map external roles array → internal role string
// ROLE_SUPER_ADMIN              → superadmin (teacher view + admin button)
// ROLE_ADMIN + ROLE_USER        → superadmin (teacher view + admin button)
// ROLE_ADMIN (alone, no ROLE_USER) → teacher (teacher view only, no admin button)
// ROLE_STUDENT                  → student
// ROLE_USER (alone)             → teacher
function mapExternalRole(roles = []) {
    if (roles.includes('ROLE_SUPER_ADMIN') || roles.includes('ROLE_SUPERADMIN')) return 'superadmin';
    if (roles.includes('ROLE_ADMIN') && roles.includes('ROLE_USER')) return 'superadmin';
    if (roles.includes('ROLE_ADMIN')) return 'teacher'; // ROLE_ADMIN alone → teacher view only
    if (roles.includes('ROLE_STUDENT')) return 'student';
    return 'teacher'; // ROLE_USER alone → teacher by default
}

// Expose to window for direct onclick access
window.handleLogin = async function () {
    console.log('handleLogin called');

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
        showAlert('Por favor, introduce email y contraseña', 'danger');
        return;
    }

    hideAlerts();
    setLoading(true);

    try {
        const extRes = await fetch(`${API_URL}/api/auth/external-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const extData = await extRes.json();

        if (extRes.ok && extData.success && extData.data?.token) {
            const { token, userId, email: userEmail, name, roles } = extData.data;
            const role = mapExternalRole(roles);

            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify({ id: String(userId), name: name || userEmail, email: userEmail, role }));
            localStorage.setItem('role', role);

            showAlert('¡Acceso correcto! Redirigiendo...', 'success');
            setTimeout(() => {
                if (role === 'student') window.location.href = 'student-dashboard.html';
                else window.location.href = 'dashboard.html';
            }, 800);
            return;
        }

        // External API returned a failure — show the message
        const errorMsg = extData.message || extData.error || 'Email o contraseña incorrectos';
        showAlert(errorMsg, 'danger');
    } catch (networkErr) {
        console.error('Login error:', networkErr.message);
        showAlert('Error de conexión. Inténtalo de nuevo.', 'danger');
    } finally {
        setLoading(false);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Add enter key listener
    const form = document.getElementById('login-form');
    if (form) {
        form.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handleLogin();
            }
        });
    }
});
