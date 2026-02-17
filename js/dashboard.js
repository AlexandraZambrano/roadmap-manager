const API_URL = window.APP_CONFIG?.API_URL || window.location.origin;

let promotionModal;
let currentPromotionId = null;
let currentUser = {};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    promotionModal = new bootstrap.Modal(document.getElementById('promotionModal'));
    loadTeacherInfo();
    loadPromotions();
    loadBootcampTemplates();
    setupNavigation();
    setupPromotionForm();
});

function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
}

function loadTeacherInfo() {
    try {
        const userJson = localStorage.getItem('user');
        currentUser = userJson ? JSON.parse(userJson) : {};
    } catch (e) {
        console.error('Error parsing user data', e);
    }
    if (currentUser && currentUser.name) {
        document.getElementById('teacher-name').textContent = currentUser.name;
    }
}

async function loadPromotions() {
    const token = localStorage.getItem('token');
    const userId = currentUser.id;
    try {
        const response = await fetch(`${API_URL}/api/my-promotions-all`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('token');
                window.location.href = '/auth.html';
            }
            return;
        }

        const promotions = await response.json();
        displayPromotions(promotions, userId);
        updateDashboardStats(promotions);
    } catch (error) {
        console.error('Error loading promotions:', error);
    }
}

function displayPromotions(promotions, userId) {
    const list = document.getElementById('promotions-list');
    list.innerHTML = '';

    if (promotions.length === 0) {
        list.innerHTML = '<div class="col-12"><p class="text-muted text-center">No promotions yet. Create one to get started!</p></div>';
        return;
    }

    promotions.forEach(promotion => {
        const card = document.createElement('div');
        card.className = 'col-md-6 col-lg-4';
        const isOwner = promotion.teacherId === userId;
        const deleteBtn = isOwner
            ? `<button type="button" class="btn btn-sm btn-outline-danger" onclick="deletePromotion('${promotion.id}', event)" title="Delete promotion"><i class="bi bi-trash"></i></button>`
            : '';
        const ownerBadge = !isOwner ? '<span class="badge bg-info">Collaborator</span>' : '';

        card.innerHTML = `
            <div class="card promotion-card" onclick="window.location.href = 'promotion-detail.html?id=${promotion.id}'">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h5 class="promotion-card-title">${escapeHtml(promotion.name)}</h5>
                        ${ownerBadge}
                    </div>
                    <p class="promotion-card-meta">${promotion.description || 'No description'}</p>
                    <div class="d-flex justify-content-between align-items-center mt-3">
                        <span class="badge-weeks">${promotion.weeks} weeks</span>
                        <div class="btn-group" role="group">
                            ${deleteBtn}
                        </div>
                    </div>
                </div>
            </div>
        `;
        list.appendChild(card);
    });
}

function updateDashboardStats(promotions) {
    document.getElementById('promotions-count').textContent = promotions.length;

    let totalModules = 0;
    promotions.forEach(p => {
        totalModules += (p.modules || []).length;
    });
    document.getElementById('modules-count').textContent = totalModules;
}

function setupNavigation() {
    const navLinks = document.querySelectorAll('.sidebar .nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const href = link.getAttribute('href');

            // Remove active class
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Hide all sections
            document.querySelectorAll('.section-content').forEach(section => {
                section.classList.add('hidden');
            });

            // Show selected section
            if (href === '#dashboard') {
                document.getElementById('dashboard-section').classList.remove('hidden');
            } else if (href === '#promotions') {
                document.getElementById('promotions-section').classList.remove('hidden');
            }
        });
    });
}

function openNewPromotionModal() {
    currentPromotionId = null;
    document.getElementById('promotion-form').reset();
    document.getElementById('promotion-modal-title').textContent = 'New Promotion';
    promotionModal.show();
}

// Templates data (loaded from server)
let bootcampTemplates = {};

// Load templates from server
async function loadBootcampTemplates() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/api/bootcamp-templates`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const templates = await response.json();
            bootcampTemplates = {};

            // Build templates object for easy lookup
            templates.forEach(template => {
                bootcampTemplates[template.id] = template;
            });

            // Populate the select dropdown
            populateTemplateSelect(templates);
        }
    } catch (error) {
        console.error('Error loading templates:', error);
    }
}

// Populate template select dropdown
function populateTemplateSelect(templates) {
    const select = document.getElementById('promotion-template');

    // Keep the first default option
    select.innerHTML = '<option value="">-- Select a template to start --</option>';

    // Add system templates first
    templates.filter(t => !t.isCustom).forEach(template => {
        const option = document.createElement('option');
        option.value = template.id;
        option.textContent = `${template.name} (${template.weeks} weeks, ${template.hours || template.weeks * 35} hours)`;
        select.appendChild(option);
    });

    // Add divider for custom templates
    if (templates.some(t => t.isCustom)) {
        const divider = document.createElement('optgroup');
        divider.label = 'Custom Templates';

        templates.filter(t => t.isCustom).forEach(template => {
            const option = document.createElement('option');
            option.value = template.id;
            option.textContent = `${template.name} (${template.weeks} weeks, ${template.hours || template.weeks * 35} hours)`;
            divider.appendChild(option);
        });

        select.appendChild(divider);
    }
}

window.applyTemplate = function() {
    const templateId = document.getElementById('promotion-template').value;

    if (!templateId) return;

    const template = bootcampTemplates[templateId];
    if (template) {
        document.getElementById('promotion-weeks').value = template.weeks;
        document.getElementById('promotion-name').value = template.name;
        document.getElementById('promotion-desc').value = template.description || '';
    }
}


function setupPromotionForm() {
    document.getElementById('promotion-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('promotion-name').value;
        const description = document.getElementById('promotion-desc').value;
        const weeks = parseInt(document.getElementById('promotion-weeks').value);
        const startDate = document.getElementById('promotion-start').value;
        const endDate = document.getElementById('promotion-end').value;

        const token = localStorage.getItem('token');
        const method = currentPromotionId ? 'PUT' : 'POST';
        const url = currentPromotionId
            ? `${API_URL}/api/promotions/${currentPromotionId}`
            : `${API_URL}/api/promotions`;

        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name, description, weeks, startDate, endDate })
            });

            if (response.ok) {
                promotionModal.hide();
                loadPromotions();
            } else {
                alert('Error saving promotion');
            }
        } catch (error) {
            console.error('Error saving promotion:', error);
        }
    });
}

async function deletePromotion(promotionId, event) {
    event.stopPropagation();

    if (!confirm('Are you sure you want to delete this promotion?')) {
        return;
    }

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            loadPromotions();
        } else {
            alert('Error deleting promotion');
        }
    } catch (error) {
        console.error('Error deleting promotion:', error);
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    window.location.href = 'login.html';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== PROFILE MANAGEMENT ====================

let profileModal;

function initProfileModal() {
    profileModal = new bootstrap.Modal(document.getElementById('profileModal'));
}

window.openProfileModal = async function() {
    if (!profileModal) {
        initProfileModal();
    }

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/api/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const profile = await response.json();

            // Populate form
            document.getElementById('profile-name').value = profile.name || '';
            document.getElementById('profile-lastName').value = profile.lastName || '';
            document.getElementById('profile-email').value = profile.email;
            document.getElementById('profile-location').value = profile.location || '';

            // Clear password fields
            document.getElementById('current-password').value = '';
            document.getElementById('new-password').value = '';
            document.getElementById('confirm-password').value = '';

            // Update save button handler
            const saveBtn = document.getElementById('profile-save-btn');
            saveBtn.onclick = function() {
                const activeTab = document.querySelector('.nav-link.active');
                if (activeTab.id === 'profile-tab') {
                    saveProfileInfo();
                } else {
                    changePassword();
                }
            };

            profileModal.show();
        } else {
            alert('Error loading profile');
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        alert('Error loading profile');
    }
};

window.saveProfileInfo = async function() {
    const token = localStorage.getItem('token');
    const name = document.getElementById('profile-name').value;
    const lastName = document.getElementById('profile-lastName').value;
    const location = document.getElementById('profile-location').value;

    try {
        const response = await fetch(`${API_URL}/api/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, lastName, location })
        });

        const alertEl = document.getElementById('profile-alert');

        if (response.ok) {
            const data = await response.json();

            // Update localStorage
            const user = JSON.parse(localStorage.getItem('user'));
            user.name = data.profile.name;
            localStorage.setItem('user', JSON.stringify(user));
            document.getElementById('teacher-name').textContent = user.name;

            alertEl.className = 'alert alert-success';
            alertEl.textContent = 'Profile updated successfully!';
            alertEl.classList.remove('hidden');

            setTimeout(() => {
                alertEl.classList.add('hidden');
            }, 3000);
        } else {
            const data = await response.json();
            alertEl.className = 'alert alert-danger';
            alertEl.textContent = data.error || 'Error updating profile';
            alertEl.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        const alertEl = document.getElementById('profile-alert');
        alertEl.className = 'alert alert-danger';
        alertEl.textContent = 'Error updating profile';
        alertEl.classList.remove('hidden');
    }
};

window.changePassword = async function() {
    const token = localStorage.getItem('token');
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    const alertEl = document.getElementById('password-alert');

    if (!currentPassword || !newPassword || !confirmPassword) {
        alertEl.className = 'alert alert-warning';
        alertEl.textContent = 'All fields are required';
        alertEl.classList.remove('hidden');
        return;
    }

    if (newPassword !== confirmPassword) {
        alertEl.className = 'alert alert-warning';
        alertEl.textContent = 'New passwords do not match';
        alertEl.classList.remove('hidden');
        return;
    }

    if (newPassword.length < 8) {
        alertEl.className = 'alert alert-warning';
        alertEl.textContent = 'Password must be at least 8 characters';
        alertEl.classList.remove('hidden');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ currentPassword, newPassword })
        });

        if (response.ok) {
            alertEl.className = 'alert alert-success';
            alertEl.textContent = 'Password changed successfully! Please log in again.';
            alertEl.classList.remove('hidden');

            setTimeout(() => {
                logout();
            }, 2000);
        } else {
            const data = await response.json();
            alertEl.className = 'alert alert-danger';
            alertEl.textContent = data.error || 'Error changing password';
            alertEl.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error changing password:', error);
        alertEl.className = 'alert alert-danger';
        alertEl.textContent = 'Error changing password';
        alertEl.classList.remove('hidden');
    }
};

// Initialize profile modal on page load
document.addEventListener('DOMContentLoaded', () => {
    initProfileModal();
});

// Toggle password visibility
function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const button = event.currentTarget;
    const icon = button.querySelector('i');

    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('bi-eye');
        icon.classList.add('bi-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('bi-eye-slash');
        icon.classList.add('bi-eye');
    }
}
