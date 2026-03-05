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

    // ── 1. Try the external auth API via our server proxy ────────────────────
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
                if (role === 'superadmin') window.location.href = 'dashboard.html';
                else if (role === 'teacher') window.location.href = 'dashboard.html';
                else if (role === 'student') window.location.href = 'student-dashboard.html';
                else window.location.href = 'dashboard.html';
            }, 800);
            setLoading(false);
            return;
        }

        // External API returned explicit failure — decide whether to try local login
        if (extRes.status === 401) {
            // Wrong password for an external user — try local (admin/student accounts)
            await tryLocalLogin(email, password, extData.message || null);
            return;
        }

        if (extRes.status === 404) {
            // User not found in external system at all — try local login (may be a local admin/student)
            await tryLocalLogin(email, password, null);
            return;
        }

        // Any other error from external API (500, etc.) — fall back to local silently
    } catch (networkErr) {
        console.warn('External auth proxy error, falling back to local login:', networkErr.message);
    }

    // ── 2. Fall back to our own API (admin / student local accounts) ─────────
    await tryLocalLogin(email, password, null);
};

async function tryLocalLogin(email, password, externalErrorMsg) {
    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('role', data.user.role);
            showAlert('¡Acceso correcto! Redirigiendo...', 'success');

            setTimeout(() => {
                const role = data.user.role;
                if (role === 'admin') window.location.href = 'admin.html';
                else if (role === 'teacher') window.location.href = 'dashboard.html';
                else window.location.href = 'student-dashboard.html';
            }, 800);
        } else {
            // Show the external error if there was one, otherwise local error
            showAlert(externalErrorMsg || data.error || 'Email o contraseña incorrectos', 'danger');
        }
    } catch (error) {
        console.error('Local login error:', error);
        showAlert('Error de conexión. Inténtalo de nuevo.', 'danger');
    } finally {
        setLoading(false);
    }
}

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
