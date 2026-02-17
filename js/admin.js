const API_URL = window.APP_CONFIG?.API_URL || window.location.origin;
let createModal, editModal, successModal;

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();

    // Initialize Modals
    createModal = new bootstrap.Modal(document.getElementById('createTeacherModal'));
    editModal = new bootstrap.Modal(document.getElementById('editTeacherModal'));
    successModal = new bootstrap.Modal(document.getElementById('successModal'));

    // Forms
    document.getElementById('create-teacher-form').addEventListener('submit', handleCreateTeacher);
    document.getElementById('edit-teacher-form').addEventListener('submit', handleUpdateTeacher);

    loadTeachers();
});

function checkAuth() {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');

    if (!token || role !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    try {
        const userJson = localStorage.getItem('user');
        if (userJson && userJson !== 'undefined') {
            const user = JSON.parse(userJson);
            // Optionally update UI with admin name
        }
    } catch (e) {
        console.error('Error parsing admin data', e);
    }
}

async function loadTeachers() {
    const token = localStorage.getItem('token');
    const listElement = document.getElementById('teachers-list');

    try {
        const response = await fetch(`${API_URL}/api/admin/teachers`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const teachers = await response.json();
            displayTeachers(teachers);
        } else {
            listElement.innerHTML = `<div class="col-12 alert alert-danger">Error loading teachers: ${response.statusText}</div>`;
        }
    } catch (error) {
        listElement.innerHTML = `<div class="col-12 alert alert-danger">Connection error.</div>`;
    }
}

function displayTeachers(teachers) {
    const listElement = document.getElementById('teachers-list');
    listElement.innerHTML = '';

    if (teachers.length === 0) {
        listElement.innerHTML = '<div class="col-12 text-center text-muted py-5">No teachers found.</div>';
        return;
    }

    teachers.forEach(teacher => {
        const card = document.createElement('div');
        card.className = 'col-md-6 col-lg-4 mb-4';
        card.innerHTML = `
            <div class="card teacher-card shadow-sm h-100">
                <div class="card-body">
                    <div class="d-flex align-items-center mb-3">
                        <div class="bg-primary bg-opacity-10 text-primary rounded-circle p-3 me-3">
                            <i class="bi bi-person-badge fs-4"></i>
                        </div>
                        <div>
                            <h5 class="card-title mb-0">${escapeHtml(teacher.name)}</h5>
                            <small class="text-muted">Teacher ID: ${teacher.id.substring(0, 8)}...</small>
                        </div>
                    </div>
                    <p class="card-text">
                        <i class="bi bi-envelope me-2 text-primary"></i>${escapeHtml(teacher.email)}
                    </p>
                    <div class="d-flex gap-2 mt-4">
                        <button class="btn btn-sm btn-outline-warning w-100" onclick="openEditModal('${teacher.id}', '${escapeHtml(teacher.name)}', '${escapeHtml(teacher.email)}')">
                            <i class="bi bi-pencil me-1"></i> Edit
                        </button>
                        <button class="btn btn-sm btn-outline-danger w-100" onclick="deleteTeacher('${teacher.id}')">
                            <i class="bi bi-trash me-1"></i> Delete
                        </button>
                    </div>
                </div>
                <div class="card-footer bg-transparent border-0 text-muted small pb-3">
                    Created: ${new Date(teacher.createdAt).toLocaleDateString()}
                </div>
            </div>
        `;
        listElement.appendChild(card);
    });
}

function openCreateTeacherModal() {
    document.getElementById('create-teacher-form').reset();
    createModal.show();
}

async function handleCreateTeacher(e) {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const name = document.getElementById('teacher-name').value;
    const email = document.getElementById('teacher-email').value;

    try {
        const response = await fetch(`${API_URL}/api/admin/teachers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, email })
        });

        const data = await response.json();

        if (response.ok) {
            createModal.hide();
            // Show success message
            alert(`Teacher created successfully! A welcome email with login credentials has been sent to ${email}`);
            loadTeachers();
        } else {
            alert(data.error || data.message || 'Failed to create teacher');
        }
    } catch (error) {
        alert('Error creating teacher');
    }
}

function openEditModal(id, name, email) {
    document.getElementById('edit-teacher-id').value = id;
    document.getElementById('edit-teacher-name').value = name;
    document.getElementById('edit-teacher-email').value = email;
    editModal.show();
}

async function handleUpdateTeacher(e) {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const id = document.getElementById('edit-teacher-id').value;
    const name = document.getElementById('edit-teacher-name').value;
    const email = document.getElementById('edit-teacher-email').value;

    try {
        const response = await fetch(`${API_URL}/api/admin/teachers/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, email })
        });

        if (response.ok) {
            editModal.hide();
            loadTeachers();
        } else {
            const data = await response.json();
            alert(data.error || 'Failed to update teacher');
        }
    } catch (error) {
        alert('Error updating teacher');
    }
}

async function deleteTeacher(id) {
    if (!confirm('Are you sure you want to delete this teacher? This action cannot be undone.')) return;

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/api/admin/teachers/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            loadTeachers();
        } else {
            const data = await response.json();
            alert(data.error || 'Failed to delete teacher');
        }
    } catch (error) {
        alert('Error deleting teacher');
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
