const API_URL = window.APP_CONFIG?.API_URL || window.location.origin;
let selectedRole = 'teacher';

function selectRole(role) {
    selectedRole = role;

    // Update UI
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-role="${role}"]`).classList.add('active');

    // Update help text
    const helpText = document.getElementById('help-text');
    if (role === 'student') {
        helpText.textContent = 'Use the password sent to your email';
    } else {
        helpText.textContent = 'Use your assigned password';
    }

    hideAlerts();
}

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

    // Legacy support just in case
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

// Expose to window for direct onclick access
window.handleLogin = async function () {
    console.log('handleLogin called');

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
        showAlert('Please enter both email and password', 'danger');
        return;
    }

    hideAlerts();
    setLoading(true);

    console.log(`Attempting login for: ${email} as ${selectedRole}`);

    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, role: selectedRole })
        });

        const data = await response.json();
        console.log('Login response:', data);

        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('role', data.user.role);
            showAlert('Login successful! Redirecting...', 'success');

            setTimeout(() => {
                if (selectedRole === 'admin') {
                    window.location.href = 'admin.html';
                } else if (selectedRole === 'teacher') {
                    window.location.href = 'dashboard.html';
                } else {
                    window.location.href = 'student-dashboard.html';
                }
            }, 1000);
        } else {
            showAlert(data.error || 'Login failed', 'danger');
        }
    } catch (error) {
        console.error('Login error:', error);
        showAlert('Connection error. Please try again.', 'danger');
    } finally {
        setLoading(false);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Set default role UI
    selectRole('teacher');

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
