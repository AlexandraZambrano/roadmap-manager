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
