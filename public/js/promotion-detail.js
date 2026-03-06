const API_URL = window.APP_CONFIG?.API_URL || window.location.origin;

/** Capitaliza la primera letra de cada palabra y deja el resto en minúsculas */
function toTitleCase(str) {
    if (!str) return '';
    return str.trim().replace(/\S+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/** Devuelve el nombre completo de un estudiante en Title Case */
function studentFullName(student) {
    return toTitleCase(`${student.name || ''} ${student.lastname || ''}`).trim();
}


// ==================== PROFILE MANAGEMENT ====================

let profileModal;

function initProfileModal() {
    profileModal = new bootstrap.Modal(document.getElementById('profileModal'));
}

window.openProfileModal = async function () {
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
            saveBtn.onclick = function () {
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

window.saveProfileInfo = async function () {
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

window.changePassword = async function () {
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




let promotionId = null;
let moduleModal, quickLinkModal, sectionModal, studentModal, studentProgressModal, teamModal, resourceModal, collaboratorModal, projectAssignmentDetailModal;
const userRole = localStorage.getItem('role') || 'student';
let currentUser = {};
let promotionModules = []; // Store promotion modules
window.promotionModules = promotionModules; // Expose for program-competences.js
let currentModuleIndex = 0; // Track current module for píldoras navigation

let deletePromotionModal;
try {
    const userJson = localStorage.getItem('user');
    currentUser = userJson && userJson !== 'undefined' ? JSON.parse(userJson) : {};
} catch (e) {
    console.error('Error parsing user data', e);
}
let extendedInfoData = {
    schedule: {},
    team: [],
    resources: [],
    evaluation: '',
    pildoras: [],
    pildorasAssignmentOpen: false
};

// Attendance state
let currentAttendanceMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
let attendanceData = []; // Store attendance records for the current month
let studentsForAttendance = []; // Local copy of students for rendering current view
let promotionHolidays = new Set(); // Set of YYYY-MM-DD strings for festivos


// Utility function to escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, function (m) { return map[m]; });
}

// Utility function to toggle password visibility
function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const button = event.target.closest('.password-toggle');
    
    if (input) {
        if (input.type === 'password') {
            input.type = 'text';
            if (button) {
                button.innerHTML = '<i class="bi bi-eye-slash"></i>';
            }
        } else {
            input.type = 'password';
            if (button) {
                button.innerHTML = '<i class="bi bi-eye"></i>';
            }
        }
    }
}

// Immediate CSS injection for student view (to prevent flicker)
if (userRole === 'student') {
    const style = document.createElement('style');
    style.innerHTML = `
        .teacher-only, 
        .btn-primary:not(#login-button):not(.nav-link), 
        .btn-danger, 
        .btn-outline-danger, 
        .btn-warning,
        #students-tab-nav { display: none !important; }
        
        /* Ensure navigation to students tab is hidden */
        .nav-link[onclick*="students"] { display: none !important; }
        a[href="#students"] { display: none !important; }
    `;
    document.head.appendChild(style);
    document.body.classList.add('student-view');
}

// Initialize Mobile Hamburger Menu
function initMobileMenu() {
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('show');
            if (sidebarOverlay) {
                sidebarOverlay.classList.toggle('show');
            }
        });
        
        // Close sidebar when clicking overlay
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', () => {
                sidebar.classList.remove('show');
                sidebarOverlay.classList.remove('show');
            });
        }
        
        // Close sidebar when clicking on a nav link
        const navLinks = sidebar.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                sidebar.classList.remove('show');
                if (sidebarOverlay) {
                    sidebarOverlay.classList.remove('show');
                }
            });
        });
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    promotionId = new URLSearchParams(window.location.search).get('id');

    if (!promotionId) {
        window.location.href = 'dashboard.html';
        return;
    }

    // Initialize mobile menu
    initMobileMenu();

    // Set up student dashboard preview iframe in Overview
    const previewIframe = document.getElementById('student-preview-iframe');
    if (previewIframe) {
        const baseUrl = window.location.origin;
        const isGitHubPages = window.location.hostname.includes('github.io');

        let previewPath;
        if (isGitHubPages) {
            // GitHub Pages needs the repository name in the path
            const pathParts = window.location.pathname.split('/');
            const repoName = pathParts[1];
            previewPath = `/${repoName}/public-promotion.html`;
        } else {
            const path = window.location.pathname;
            const directory = path.substring(0, path.lastIndexOf('/'));
            previewPath = (directory === '/' ? '' : directory) + '/public-promotion.html';
        }

        previewIframe.src = `${baseUrl}${previewPath}?id=${promotionId}&preview=1`;
    }

    // Initialize modals only if elements exist (teacher view)
    const moduleModalEl = document.getElementById('moduleModal');
    if (moduleModalEl) moduleModal = new bootstrap.Modal(moduleModalEl);

    const quickLinkModalEl = document.getElementById('quickLinkModal');
    if (quickLinkModalEl) quickLinkModal = new bootstrap.Modal(quickLinkModalEl);

    const sectionModalEl = document.getElementById('sectionModal');
    if (sectionModalEl) sectionModal = new bootstrap.Modal(sectionModalEl);

    const studentModalEl = document.getElementById('studentModal');
    if (studentModalEl) studentModal = new bootstrap.Modal(studentModalEl);

    const studentProgressModalEl = document.getElementById('studentProgressModal');
    if (studentProgressModalEl) studentProgressModal = new bootstrap.Modal(studentProgressModalEl);

    const projectAssignmentDetailModalEl = document.getElementById('projectAssignmentDetailModal');
    if (projectAssignmentDetailModalEl) projectAssignmentDetailModal = new bootstrap.Modal(projectAssignmentDetailModalEl);

    // New Modals (Teacher)
    const teamModalEl = document.getElementById('teamModal');
    if (teamModalEl) teamModal = new bootstrap.Modal(teamModalEl);

    const resourceModalEl = document.getElementById('resourceModal');
    if (resourceModalEl) resourceModal = new bootstrap.Modal(resourceModalEl);

    const deletePromotionModalEl = document.getElementById('deletePromotionModal');
    if (deletePromotionModalEl) deletePromotionModal = new bootstrap.Modal(deletePromotionModalEl);

    const collaboratorModalEl = document.getElementById('collaboratorModal');
    if (collaboratorModalEl) collaboratorModal = new bootstrap.Modal(collaboratorModalEl);

    initEmployabilityModal();

    if (userRole === 'teacher') {
        // Overlay gates only on ExtendedInfo (Acta data) — students load independently in the background
        _showExtendedInfoLoading(true);
        loadExtendedInfo().finally(() => {
            _showExtendedInfoLoading(false);
            // Open Acta modal AFTER overlay finishes fading (320ms fade + buffer)
            if (new URLSearchParams(window.location.search).get('openActa') === '1') {
                setTimeout(() => openActaModal(), 400);
            }
        });
        loadStudents(); // runs independently, no overlay dependency
        loadCollaborators();
    } else {
        // Remove preview button for students
        const previewBtn = document.querySelector('button[onclick="previewPromotion()"]');
        if (previewBtn) previewBtn.remove();
    }

    loadPromotion();
    loadModules();
    loadQuickLinks();
    loadSections();
    loadCalendar();

    if (userRole === 'teacher') {
        setupForms();
    }

    // Set overview as active tab on initial load
    window.location.hash = 'overview';
    switchTab('overview');

    // Inicializar módulo de Fichas de Seguimiento (independiente)
    if (typeof window.StudentTracking !== 'undefined') {
        window.StudentTracking.init(promotionId);
    }
});

async function loadExtendedInfo() {
    const token = localStorage.getItem('token');
    try {
        // Ensure Schedule tab is active on load
        const scheduleTab = document.getElementById('program-details-schedule-tab');
        if (scheduleTab) {
            const tab = new bootstrap.Tab(scheduleTab);
            tab.show();
        }

        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/extended-info`); // Public endpoint
        if (response.ok) {
            extendedInfoData = await response.json();
            // Expose competences globally so the project competence picker can access them
            // even before ProgramCompetences.init() runs
            window._extendedInfoCompetences = extendedInfoData.competences || [];

            // Populate Schedule
            const sched = extendedInfoData.schedule || {};
            if (sched.online) {
                document.getElementById('sched-online-entry').value = sched.online.entry || '';
                document.getElementById('sched-online-start').value = sched.online.start || '';
                document.getElementById('sched-online-break').value = sched.online.break || '';
                document.getElementById('sched-online-lunch').value = sched.online.lunch || '';
                document.getElementById('sched-online-finish').value = sched.online.finish || '';
            }
            if (sched.presential) {
                document.getElementById('sched-presential-entry').value = sched.presential.entry || '';
                document.getElementById('sched-presential-start').value = sched.presential.start || '';
                document.getElementById('sched-presential-break').value = sched.presential.break || '';
                document.getElementById('sched-presential-lunch').value = sched.presential.lunch || '';
                document.getElementById('sched-presential-finish').value = sched.presential.finish || '';
            }
            document.getElementById('sched-notes').value = sched.notes || '';

            // Populate Additional Lists
            displayTeam();
            displayResources();

            // Load modules and display píldoras (await so promotionModules is populated before ProgramCompetences.init)
            await loadModulesPildoras();

            // Populate Evaluation
            const defaultEvaluation = `Evaluación del Proyecto

Se brindará retroalimentación oral el mismo día de la presentación del proyecto, mientras que la autoevaluación (en proyectos individuales) y evaluación grupal (en proyectos grupales) se realizará al día siguiente y posteriormente, el equipo formativo compartirá las impresiones finales. Todo ello deberá almacenarse en Google Classroom.

Se tendrán en cuenta los siguientes aspectos:

• Análisis de los commits realizados por los coders, valorando tanto la cantidad como la calidad
• Participación individual en la presentación del proyecto
• Capacidad de responder preguntas específicas de manera clara y fundamentada
• Desarrollo y demostración de las competencias adquiridas durante el proyecto

Evaluación de las Píldoras

Las píldoras se asignarán la primera semana, se apuntarán en el calendario y se valorarán los siguientes aspectos:
• Que tenga un poco de inglés (hablado, no solo en la presentación)
• Que tenga parte teórica y parte práctica. Énfasis en la práctica
• Tiempo mínimo 1 hora
• Crear un repositorio en Github y/o publicar un artículo en Medium

Evaluación Global al Final del Bootcamp

• Valoración de los proyectos entregados
• Valoración de los cursos realizados
• Valoración de las píldoras realizadas
• Valoración de competencias transversales`;

            document.getElementById('evaluation-text').value = extendedInfoData.evaluation || defaultEvaluation;

            // Acta de Inicio fields are loaded into extendedInfoData and populated
            // into the modal on demand when openActaModal() is called.

            // Set Píldoras Assignment Toggle
            const assignmentToggle = document.getElementById('pildoras-assignment-toggle');
            if (assignmentToggle) {
                assignmentToggle.checked = !!extendedInfoData.pildorasAssignmentOpen;
            }

            // Init Competencias module
            if (window.ProgramCompetences) {
                window.ProgramCompetences.init(extendedInfoData.competences || []);
            }

        }
    } catch (error) {
        console.error('Error loading extended info:', error);
    }
}

// ── Loading overlay helper ────────────────────────────────────────────────────
function _showExtendedInfoLoading(show) {
    let overlay = document.getElementById('extended-info-loading-overlay');
    if (show) {
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'extended-info-loading-overlay';
            overlay.style.cssText = `
                position: fixed; inset: 0; z-index: 9999;
                background: rgba(255,255,255,0.85);
                display: flex; flex-direction: column;
                align-items: center; justify-content: center;
                gap: 1rem;
            `;
            overlay.innerHTML = `
                <div class="spinner-border" style="width:3rem;height:3rem;color:#FF6B35;" role="status"></div>
                <p class="fw-semibold mb-0" style="font-size:1.1rem;color:#FF6B35;">Cargando información de la promoción…</p>
            `;
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'flex';
    } else {
        if (overlay) {
            overlay.style.transition = 'opacity 0.3s';
            overlay.style.opacity = '0';
            setTimeout(() => overlay && overlay.remove(), 320);
        }
    }
}

function displayTeam() {
    const tbody = document.getElementById('team-list-body');
    tbody.innerHTML = '';
    (extendedInfoData.team || []).forEach((member, index) => {
        const tr = document.createElement('tr');
        const moduleCell = member.moduleName
            ? `<span class="badge bg-light text-dark border">${escapeHtml(member.moduleName)}</span>`
            : '<span class="text-muted small">—</span>';
        const linkedinCell = member.linkedin
            ? `<a href="${escapeHtml(member.linkedin)}" target="_blank"><i class="bi bi-linkedin"></i></a>`
            : '<span class="text-muted small">—</span>';
        tr.innerHTML = `
            <td>${escapeHtml(member.name)}</td>
            <td>${escapeHtml(member.role || '')}</td>
            <td>${escapeHtml(member.email || '')}</td>
            <td>${moduleCell}</td>
            <td>${linkedinCell}</td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="deleteTeamMember(${index})"><i class="bi bi-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function displayResources() {
    const tbody = document.getElementById('resources-list-body');
    tbody.innerHTML = '';
    (extendedInfoData.resources || []).forEach((res, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHtml(res.title)}</td>
            <td><span class="badge bg-info text-dark">${escapeHtml(res.category)}</span></td>
            <td><a href="${escapeHtml(res.url)}" target="_blank" class="text-truncate d-inline-block" style="max-width: 150px;">${escapeHtml(res.url)}</a></td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="deleteResource(${index})"><i class="bi bi-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Load modules and píldoras data
async function loadModulesPildoras() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/modules-pildoras`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            promotionModules = data.modules || [];
            window.promotionModules = promotionModules; // Keep window reference in sync

            // Always sync modulesPildoras from this specialized endpoint if it has data
            if (data.modulesPildoras) {
                extendedInfoData.modulesPildoras = data.modulesPildoras;
            }

            // Ensure all modules have entries
            promotionModules.forEach(module => {
                const existingModulePildoras = extendedInfoData.modulesPildoras.find(mp => mp.moduleId === module.id);
                if (!existingModulePildoras) {
                    extendedInfoData.modulesPildoras.push({
                        moduleId: module.id,
                        moduleName: module.name,
                        pildoras: []
                    });
                }
            });

            // Show/hide module navigation based on modules availability
            const moduleNav = document.getElementById('pildoras-module-nav');
            if (moduleNav) {
                if (promotionModules.length > 1) {
                    moduleNav.style.display = 'flex';
                } else {
                    moduleNav.style.display = 'none';
                }
            }

            // Set current module to first module
            currentModuleIndex = 0;
            displayPildoras();
        } else {
            console.error('Error loading modules píldoras:', response.statusText);
            // Fallback to regular píldoras display
            displayPildoras();
        }
    } catch (error) {
        console.error('Error loading modules píldoras:', error);
        // Fallback to regular píldoras display
        displayPildoras();
    }
}

function displayPildoras() {
    const tbody = document.getElementById('pildoras-list-body');
    if (!tbody) return;

    // Get current module píldoras
    const currentModule = promotionModules[currentModuleIndex];
    if (!currentModule) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-muted">No modules found.</td></tr>';
        return;
    }

    // Find píldoras for current module
    const modulesPildoras = extendedInfoData.modulesPildoras || [];
    const currentModulePildoras = modulesPildoras.find(mp => mp.moduleId === currentModule.id);
    const pildoras = currentModulePildoras ? currentModulePildoras.pildoras : [];

    const students = window.currentStudents || [];

    // Update module navigation display
    updateModuleNavigation();

    if (pildoras.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-muted">No píldoras configuradas para ${currentModule.name}.</td></tr>`;
        return;
    }

    tbody.innerHTML = '';

    pildoras.forEach((p, index) => {
        const selectedIds = (p.students || []).map(s => s.id);
        const modeValue = p.mode || 'Virtual';
        const statusValue = p.status || '';

        // Ensure date doesn't default to 1970 or empty if we prefer today
        const todayStr = new Date().toISOString().split('T')[0];
        let dateValue = p.date || '';
        if (!dateValue || dateValue === '1970-01-01') {
            dateValue = todayStr;
        }

        const tr = document.createElement('tr');
        tr.dataset.index = index;
        tr.innerHTML = `
            <td>
                <select class="form-select form-select-sm pildora-mode pildora-mode-${modeValue.toLowerCase().replace(' ', '-')}">
                    <option value="Virtual" ${modeValue === 'Virtual' ? 'selected' : ''}>Virtual</option>
                    <option value="Presencial" ${modeValue === 'Presencial' ? 'selected' : ''}>Presencial</option>
                    <option value="Otro" ${modeValue === 'Otro' ? 'selected' : ''}>Otro</option>
                </select>
            </td>
            <td>
                <input type="date" class="form-control form-control-sm pildora-date" value="${escapeHtml(dateValue)}">
            </td>
            <td>
                <input type="text" class="form-control form-control-sm pildora-title" value="${escapeHtml(p.title || '')}" placeholder="Título de la píldora">
            </td>
            <td>
                <div class="dropdown pildora-students-dropdown">
                    <button class="btn btn-outline-secondary btn-sm dropdown-toggle w-100 text-start" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                        ${selectedIds.length > 0
                ? (selectedIds.length === 1
                    ? students.find(s => s.id === selectedIds[0])?.name + ' ' + (students.find(s => s.id === selectedIds[0])?.lastname || '')
                    : `${selectedIds.length} estudiantes seleccionados`)
                : 'Seleccionar estudiantes'}
                    </button>
                    <ul class="dropdown-menu w-100" style="max-height: 300px; overflow-y: auto;">
                        ${students.length === 0
                ? '<li><span class="dropdown-item-text text-muted">No students available</span></li>'
                : students.map(s => {
                    const value = s.id || '';
                    const label = `${s.name || ''} ${s.lastname || ''}`.trim() || value;
                    const checked = selectedIds.includes(value) ? 'checked' : '';
                    const inputId = `pild-${index}-${escapeHtml(value)}`;
                    return `
                                    <li class="dropdown-item-custom">
                                        <div class="form-check">
                                            <input class="form-check-input pildora-student-checkbox" 
                                                   type="checkbox" 
                                                   value="${escapeHtml(value)}" 
                                                   id="${inputId}" 
                                                   ${checked}
                                                   data-pildora-index="${index}">
                                            <label class="form-check-label" for="${inputId}">${escapeHtml(label)}</label>
                                        </div>
                                    </li>
                                `;
                }).join('')
            }
                    </ul>
                </div>
            </td>
            <td>
                <select class="form-select form-select-sm pildora-status pildora-status-${statusValue.toLowerCase().replace(' ', '-')}">
                    <option value=""></option>
                    <option value="Presentada" ${statusValue === 'Presentada' ? 'selected' : ''}>Presentada</option>
                    <option value="No presentada" ${statusValue === 'No presentada' ? 'selected' : ''}>No presentada</option>
                </select>
            </td>
            <td>
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="deletePildoraRow(${index})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Apply color coding to select elements
    applyPildorasColorCoding();

    // Add event listeners for student checkboxes
    document.querySelectorAll('.pildora-student-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function () {
            updatePildoraStudentSelection(parseInt(this.dataset.pildoraIndex), this.value, this.checked);
        });
    });

    // Add event listeners for other fields to sync data locally
    document.querySelectorAll('.pildora-mode').forEach(select => {
        select.addEventListener('change', function () {
            const index = parseInt(this.closest('tr').dataset.index);
            updatePildoraField(index, 'mode', this.value);
            applyPildorasColorCoding();
        });
    });

    document.querySelectorAll('.pildora-date').forEach(input => {
        input.addEventListener('change', function () {
            const index = parseInt(this.closest('tr').dataset.index);
            updatePildoraField(index, 'date', this.value);
        });
        // Also sync on blur/input to be safe
        input.addEventListener('blur', function () {
            const index = parseInt(this.closest('tr').dataset.index);
            updatePildoraField(index, 'date', this.value);
        });
    });

    document.querySelectorAll('.pildora-title').forEach(input => {
        input.addEventListener('blur', function () {
            const index = parseInt(this.closest('tr').dataset.index);
            updatePildoraField(index, 'title', this.value);
        });
        input.addEventListener('input', function () {
            const index = parseInt(this.closest('tr').dataset.index);
            updatePildoraField(index, 'title', this.value);
        });
    });

    document.querySelectorAll('.pildora-status').forEach(select => {
        select.addEventListener('change', function () {
            const index = parseInt(this.closest('tr').dataset.index);
            updatePildoraField(index, 'status', this.value);
            applyPildorasColorCoding();
        });
    });
}

// Helper function to update other fields for píldoras
function updatePildoraField(pildoraIndex, field, value) {
    const currentModule = promotionModules[currentModuleIndex];
    if (!currentModule) return;

    const modulePildoras = extendedInfoData.modulesPildoras?.find(mp => mp.moduleId === currentModule.id);
    if (!modulePildoras || !modulePildoras.pildoras || !modulePildoras.pildoras[pildoraIndex]) return;

    modulePildoras.pildoras[pildoraIndex][field] = value;
    console.log(`Updated píldora ${pildoraIndex} field ${field} to:`, value);
}

function applyPildorasColorCoding() {
    // Apply colors to mode selects
    document.querySelectorAll('.pildora-mode').forEach(select => {
        const value = select.value.toLowerCase();
        select.style.fontWeight = '600';

        if (value === 'presencial') {
            select.style.color = '#198754'; // Green
            select.style.backgroundColor = '#f8fff9';
        } else if (value === 'virtual') {
            select.style.color = '#0d6efd'; // Blue  
            select.style.backgroundColor = '#f8fafe';
        } else {
            select.style.color = '#6c757d'; // Gray
            select.style.backgroundColor = '#f8f9fa';
        }
    });

    // Apply colors to status selects
    document.querySelectorAll('.pildora-status').forEach(select => {
        const value = select.value.toLowerCase();
        select.style.fontWeight = '600';

        if (value === 'presentada') {
            select.style.color = '#198754'; // Green
            select.style.backgroundColor = '#f8fff9';
        } else if (value === 'no presentada') {
            select.style.color = '#dc3545'; // Red
            select.style.backgroundColor = '#fdf8f8';
        } else {
            select.style.color = '#6c757d'; // Gray
            select.style.backgroundColor = '#f8f9fa';
        }
    });
}

function addPildoraRow() {
    const currentModule = promotionModules[currentModuleIndex];
    if (!currentModule) {
        alert('No module selected');
        return;
    }

    // Initialize modulesPildoras if needed
    if (!extendedInfoData.modulesPildoras) {
        extendedInfoData.modulesPildoras = [];
    }

    // Find or create module píldoras entry
    let modulePildoras = extendedInfoData.modulesPildoras.find(mp => mp.moduleId === currentModule.id);
    if (!modulePildoras) {
        modulePildoras = {
            moduleId: currentModule.id,
            moduleName: currentModule.name,
            pildoras: []
        };
        extendedInfoData.modulesPildoras.push(modulePildoras);
    }

    // Add new píldora to current module with today's date as default
    const today = new Date().toISOString().split('T')[0];
    modulePildoras.pildoras.push({
        mode: 'Virtual',
        date: today,
        title: '',
        students: [],
        status: ''
    });

    displayPildoras();
}

function deletePildoraRow(index) {
    const currentModule = promotionModules[currentModuleIndex];
    if (!currentModule) return;

    const modulePildoras = extendedInfoData.modulesPildoras?.find(mp => mp.moduleId === currentModule.id);
    if (!modulePildoras || !modulePildoras.pildoras) return;

    if (index < 0 || index >= modulePildoras.pildoras.length) return;

    if (!confirm('Are you sure you want to delete this píldora?')) return;

    // Remove from local data
    modulePildoras.pildoras.splice(index, 1);

    // Save changes to server
    savePildorasToServer(currentModule);

    // Update display
    displayPildoras();
}

// Save píldoras changes to server
async function savePildorasToServer(module) {
    try {
        const modulePildoras = extendedInfoData.modulesPildoras?.find(mp => mp.moduleId === module.id);
        if (!modulePildoras) return;

        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No auth token found');
            return;
        }

        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/modules/${module.id}/pildoras`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                pildoras: modulePildoras.pildoras
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to save píldoras: ${response.statusText}`);
        }

        console.log('Píldoras saved successfully');
    } catch (error) {
        console.error('Error saving píldoras:', error);
        alert('Error saving changes to server');
    }
}

// Update module navigation display
function updateModuleNavigation() {
    const moduleNameEl = document.getElementById('current-module-name');
    const prevBtn = document.getElementById('prev-module-btn');
    const nextBtn = document.getElementById('next-module-btn');
    const countEl = document.getElementById('module-pildoras-count');

    if (!moduleNameEl || !prevBtn || !nextBtn || !countEl) return;

    const currentModule = promotionModules[currentModuleIndex];
    if (!currentModule) return;

    // Update module name
    moduleNameEl.textContent = currentModule.name;

    // Update navigation buttons
    prevBtn.disabled = currentModuleIndex === 0;
    nextBtn.disabled = currentModuleIndex === promotionModules.length - 1;

    // Update píldoras count
    const modulePildoras = extendedInfoData.modulesPildoras?.find(mp => mp.moduleId === currentModule.id);
    const count = modulePildoras ? modulePildoras.pildoras.length : 0;
    countEl.textContent = count;
}

// Navigation functions
function navigateToPreviousModule() {
    if (currentModuleIndex > 0) {
        currentModuleIndex--;
        displayPildoras();
    }
}

function navigateToNextModule() {
    if (currentModuleIndex < promotionModules.length - 1) {
        currentModuleIndex++;
        displayPildoras();
    }
}

// Helper function to update student selection for píldoras
function updatePildoraStudentSelection(pildoraIndex, studentId, isChecked) {
    const currentModule = promotionModules[currentModuleIndex];
    if (!currentModule) return;

    const modulePildoras = extendedInfoData.modulesPildoras?.find(mp => mp.moduleId === currentModule.id);
    if (!modulePildoras || !modulePildoras.pildoras || !modulePildoras.pildoras[pildoraIndex]) return;

    const pildora = modulePildoras.pildoras[pildoraIndex];
    const students = window.currentStudents || [];

    if (!pildora.students) {
        pildora.students = [];
    }

    if (isChecked) {
        // Add student if not already present
        const student = students.find(s => s.id === studentId);
        if (student && !pildora.students.some(s => s.id === studentId)) {
            pildora.students.push({
                id: student.id,
                name: student.name,
                lastname: student.lastname
            });
        }
    } else {
        // Remove student
        pildora.students = pildora.students.filter(s => s.id !== studentId);
    }

    // Update dropdown button text
    const checkbox = document.querySelector(`input[data-pildora-index="${pildoraIndex}"][value="${studentId}"]`);
    if (checkbox) {
        const dropdown = checkbox.closest('.dropdown');
        const button = dropdown.querySelector('.dropdown-toggle');
        const selectedStudents = pildora.students || [];

        if (selectedStudents.length === 0) {
            button.textContent = 'Seleccionar estudiantes';
        } else if (selectedStudents.length === 1) {
            const student = selectedStudents[0];
            button.textContent = studentFullName(student);
        } else {
            button.textContent = `${selectedStudents.length} estudiantes seleccionados`;
        }
    }
}

function importPildorasFromCsv(input) {
    const file = input.files && input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
        try {
            const text = e.target.result || '';
            const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
            if (lines.length <= 1) {
                alert('CSV file is empty or missing data.');
                return;
            }

            const headerCols = lines[0].split(';').map(h => h.trim().toLowerCase());
            const idxPresentacion = headerCols.indexOf('presentación') !== -1 ? headerCols.indexOf('presentación') : headerCols.indexOf('presentacion');
            const idxFecha = headerCols.indexOf('fecha');
            const idxPildora = headerCols.indexOf('píldora') !== -1 ? headerCols.indexOf('píldora') : headerCols.indexOf('pildora');
            const idxStudent = headerCols.indexOf('student') !== -1 ? headerCols.indexOf('student') : headerCols.indexOf('coders');
            const idxEstado = headerCols.indexOf('estado');

            if (idxPresentacion === -1 || idxFecha === -1 || idxPildora === -1 || idxStudent === -1 || idxEstado === -1) {
                alert('CSV header must include: Presentación;Fecha;Píldora;Student;Estado');
                return;
            }

            const students = window.currentStudents || [];
            const pildoras = [];
            const currentModule = promotionModules[currentModuleIndex];

            if (!currentModule) {
                alert('No module selected. Please select a module first.');
                input.value = '';
                return;
            }

            for (let i = 1; i < lines.length; i++) {
                const raw = lines[i];
                if (!raw) continue;
                const cols = raw.split(';');
                if (cols.length <= Math.min(idxPresentacion, idxFecha, idxPildora, idxStudent, idxEstado)) continue;

                const mode = (cols[idxPresentacion] || '').trim();
                const dateText = (cols[idxFecha] || '').trim();
                const title = (cols[idxPildora] || '').trim();
                const studentText = (cols[idxStudent] || '').trim();
                const status = (cols[idxEstado] || '').trim();

                const studentsForPildora = [];
                if (studentText && studentText.toLowerCase() !== 'desierta') {
                    const parts = studentText.split(',').map(p => p.trim()).filter(Boolean);
                    parts.forEach(part => {
                        const lowerPart = part.toLowerCase();
                        const s = students.find(st => {
                            const full = `${st.name || ''} ${st.lastname || ''}`.trim().toLowerCase();
                            return full && (full === lowerPart || full.includes(lowerPart) || lowerPart.includes(full));
                        });
                        if (s) {
                            if (!studentsForPildora.some(x => x.id === s.id)) {
                                studentsForPildora.push({
                                    id: s.id,
                                    name: s.name || '',
                                    lastname: s.lastname || ''
                                });
                            }
                        }
                    });
                }

                let isoDate = '';
                if (dateText && /^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
                    isoDate = dateText;
                }

                pildoras.push({
                    mode: mode || 'Virtual',
                    date: isoDate,
                    title,
                    students: studentsForPildora,
                    status
                });
            }

            // Add píldoras to the current module instead of the global pildoras array
            if (!extendedInfoData.modulesPildoras) {
                extendedInfoData.modulesPildoras = [];
            }

            // Find or create module píldoras entry
            let modulePildoras = extendedInfoData.modulesPildoras.find(mp => mp.moduleId === currentModule.id);
            if (!modulePildoras) {
                modulePildoras = {
                    moduleId: currentModule.id,
                    moduleName: currentModule.name,
                    pildoras: []
                };
                extendedInfoData.modulesPildoras.push(modulePildoras);
            }

            // Add imported píldoras to current module
            modulePildoras.pildoras.push(...pildoras);

            alert(`Successfully imported ${pildoras.length} píldoras to module "${currentModule.name}"`);
            displayPildoras();
            input.value = '';
        } catch (err) {
            console.error('Error importing CSV:', err);
            alert('Error importing CSV file');
        }
    };
    reader.readAsText(file);
}

function importPildorasFromExcel(input) {
    const file = input.files && input.files[0];
    if (!file) return;

    const currentModule = promotionModules[currentModuleIndex];
    if (!currentModule) {
        alert('No module selected. Please select a module first.');
        input.value = '';
        return;
    }

    const formData = new FormData();
    formData.append('excelFile', file);

    const token = localStorage.getItem('token');
    if (!token) {
        alert('Authentication token not found. Please login again.');
        return;
    }

    // Show loading indicator
    const originalText = document.querySelector('button[onclick="document.getElementById(\'pildoras-excel-input\').click()"]').innerHTML;
    document.querySelector('button[onclick="document.getElementById(\'pildoras-excel-input\').click()"]').innerHTML =
        '<i class="bi bi-hourglass-split"></i> Importing...';

    // Use module-specific endpoint
    fetch(`${API_URL}/api/promotions/${promotionId}/modules/${currentModule.id}/pildoras/upload-excel`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(`Error importing Excel file: ${data.error}`);
            } else {
                alert(`Successfully imported ${data.pildoras.length} píldoras to module "${data.module.name}"`);

                // Update the current module's píldoras in our local data structure
                if (!extendedInfoData.modulesPildoras) {
                    extendedInfoData.modulesPildoras = [];
                }

                let modulePildoras = extendedInfoData.modulesPildoras.find(mp => mp.moduleId === currentModule.id);
                if (!modulePildoras) {
                    modulePildoras = {
                        moduleId: currentModule.id,
                        moduleName: currentModule.name,
                        pildoras: []
                    };
                    extendedInfoData.modulesPildoras.push(modulePildoras);
                }

                // Add imported píldoras to local data structure
                modulePildoras.pildoras.push(...data.pildoras);

                // Refresh the display
                displayPildoras();
            }
            input.value = ''; // Clear input
        })
        .catch(error => {
            console.error('Error importing Excel:', error);
            alert('Error importing Excel file');
            input.value = ''; // Clear input
        })
        .finally(() => {
            // Restore button text
            document.querySelector('button[onclick="document.getElementById(\'pildoras-excel-input\').click()"]').innerHTML = originalText;
        });
}

async function openTeamModal() {
    document.getElementById('team-form').reset();
    document.getElementById('team-collab-preview').classList.add('d-none');

    // Populate module dropdown
    const moduleSelect = document.getElementById('team-module');
    moduleSelect.innerHTML = '<option value="">— No specific module —</option>';
    (window.promotionModules || []).forEach(mod => {
        const opt = document.createElement('option');
        opt.value = mod.id;
        opt.textContent = mod.name;
        moduleSelect.appendChild(opt);
    });

    // Populate collaborators dropdown (required — only collaborators can be added)
    const collabSelect = document.getElementById('team-from-collaborator');
    collabSelect.innerHTML = '<option value="">— Select a collaborator —</option>';
    collabSelect._collabData = {};

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/promotions/${promotionId}/collaborators`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const collaborators = await res.json();
            // Filter out collaborators already in the team
            const existingIds = new Set((extendedInfoData.team || []).map(m => m.collaboratorId).filter(Boolean));
            collaborators.forEach(c => {
                collabSelect._collabData[c.id] = c;
                const opt = document.createElement('option');
                opt.value = c.id;
                const role = c.userRole || 'Formador/a';
                opt.textContent = `${c.name} — ${role}`;
                if (existingIds.has(c.id)) {
                    opt.disabled = true;
                    opt.textContent += ' (already added)';
                }
                collabSelect.appendChild(opt);
            });
        }
    } catch (e) { /* silent */ }

    teamModal.show();
}

function fillTeamFromCollaborator() {
    const select = document.getElementById('team-from-collaborator');
    const collab = select._collabData && select._collabData[select.value];
    const preview = document.getElementById('team-collab-preview');

    if (!collab) {
        preview.classList.add('d-none');
        return;
    }

    // Show info preview card
    document.getElementById('team-preview-name').textContent = collab.name || '';
    document.getElementById('team-preview-email').textContent = collab.email || '';
    const roleBadge = document.getElementById('team-preview-role-badge');
    const roleColors = { 'Formador/a': 'bg-primary', 'CoFormador/a': 'bg-success', 'Coordinador/a': 'bg-warning text-dark' };
    const role = collab.userRole || 'Formador/a';
    roleBadge.className = `badge ${roleColors[role] || 'bg-secondary'}`;
    roleBadge.textContent = role;
    preview.classList.remove('d-none');

    // Pre-select the collaborator's first assigned module if any
    const moduleSelect = document.getElementById('team-module');
    const assignedModules = collab.moduleIds || [];
    if (assignedModules.length > 0) {
        // Select the first assigned module that exists in the dropdown
        for (const opt of moduleSelect.options) {
            if (assignedModules.includes(opt.value)) {
                moduleSelect.value = opt.value;
                break;
            }
        }
    } else {
        moduleSelect.value = '';
    }
}

function addTeamMember() {
    const collabSelect = document.getElementById('team-from-collaborator');
    const collab = collabSelect._collabData && collabSelect._collabData[collabSelect.value];

    if (!collab) {
        alert('Please select a collaborator.');
        return;
    }

    // Check if already added
    const alreadyAdded = (extendedInfoData.team || []).some(m => m.collaboratorId === collab.id);
    if (alreadyAdded) {
        alert(`${collab.name} is already in the team.`);
        return;
    }

    const linkedin = document.getElementById('team-linkedin').value;
    const moduleEl = document.getElementById('team-module');
    const moduleId = moduleEl.value;
    const moduleName = moduleId ? moduleEl.options[moduleEl.selectedIndex].text : '';

    extendedInfoData.team.push({
        collaboratorId: collab.id,
        name: collab.name,
        role: collab.userRole || 'Formador/a',
        email: collab.email || '',
        linkedin,
        moduleId,
        moduleName
    });
    displayTeam();
    teamModal.hide();
}

function deleteTeamMember(index) {
    if (confirm('Delete this member?')) {
        extendedInfoData.team.splice(index, 1);
        displayTeam();
    }
}

function openResourceModal() {
    document.getElementById('resource-form').reset();
    resourceModal.show();
}

function addResource() {
    const title = document.getElementById('resource-title').value;
    const category = document.getElementById('resource-category').value;
    const url = document.getElementById('resource-url').value;

    if (!title || !url) return;

    extendedInfoData.resources.push({ title, category, url });
    displayResources();
    resourceModal.hide();
}

function deleteResource(index) {
    if (confirm('Delete this resource?')) {
        extendedInfoData.resources.splice(index, 1);
        displayResources();
    }
}

let employabilityModal;
let currentEditingEmployabilityIndex = -1;

function initEmployabilityModal() {
    const modalEl = document.getElementById('employabilityModal');
    if (modalEl) {
        employabilityModal = new bootstrap.Modal(modalEl);
    }
}

function openEmployabilityModal() {
    if (!employabilityModal) initEmployabilityModal();
    document.getElementById('employability-form').reset();
    document.getElementById('employabilityModalTitle').textContent = 'Add Employability Session';
    currentEditingEmployabilityIndex = -1;
    employabilityModal.show();
}

function editEmployabilityItem(index) {
    if (!employabilityModal) initEmployabilityModal();

    const promotion = window.currentPromotion; // Will store this globally
    const item = promotion.employability[index];

    if (!item) {
        alert('Item not found');
        return;
    }

    document.getElementById('employability-name').value = item.name || '';
    document.getElementById('employability-url').value = item.url || '';
    document.getElementById('employability-start-month').value = item.startMonth || 1;
    document.getElementById('employability-duration').value = item.duration || 1;
    document.getElementById('employabilityModalTitle').textContent = 'Edit Employability Session';

    currentEditingEmployabilityIndex = index;
    employabilityModal.show();
}

async function saveEmployabilityItem() {
    const token = localStorage.getItem('token');
    const name = document.getElementById('employability-name').value;
    const url = document.getElementById('employability-url').value;
    const startMonth = parseInt(document.getElementById('employability-start-month').value) || 1;
    const duration = parseInt(document.getElementById('employability-duration').value) || 1;

    if (!name) {
        alert('Item name is required');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            alert('Error loading promotion');
            return;
        }

        const promotion = await response.json();

        if (!promotion.employability) {
            promotion.employability = [];
        }

        const item = { name, url, startMonth, duration };

        if (currentEditingEmployabilityIndex >= 0) {
            // Update existing
            promotion.employability[currentEditingEmployabilityIndex] = item;
        } else {
            // Add new
            promotion.employability.push(item);
        }

        const updateResponse = await fetch(`${API_URL}/api/promotions/${promotionId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(promotion)
        });

        if (updateResponse.ok) {
            employabilityModal.hide();
            loadPromotion();
            loadModules();
        } else {
            alert('Error saving employability item');
        }
    } catch (error) {
        console.error('Error saving employability item:', error);
        alert('Error saving employability item');
    }
}

async function deleteEmployabilityItem(index) {
    if (!confirm('Delete this employability item?')) return;

    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            alert('Error loading promotion');
            return;
        }

        const promotion = await response.json();

        if (promotion.employability && promotion.employability[index]) {
            promotion.employability.splice(index, 1);

            const updateResponse = await fetch(`${API_URL}/api/promotions/${promotionId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(promotion)
            });

            if (updateResponse.ok) {
                loadPromotion();
                loadModules();
            } else {
                alert('Error deleting employability item');
            }
        }
    } catch (error) {
        console.error('Error deleting employability item:', error);
        alert('Error deleting employability item');
    }
}

async function saveExtendedInfo() {
    const token = localStorage.getItem('token');

    // Gather Schedule Data
    const schedule = {
        online: {
            entry: document.getElementById('sched-online-entry').value,
            start: document.getElementById('sched-online-start').value,
            break: document.getElementById('sched-online-break').value,
            lunch: document.getElementById('sched-online-lunch').value,
            finish: document.getElementById('sched-online-finish').value
        },
        presential: {
            entry: document.getElementById('sched-presential-entry').value,
            start: document.getElementById('sched-presential-start').value,
            break: document.getElementById('sched-presential-break').value,
            lunch: document.getElementById('sched-presential-lunch').value,
            finish: document.getElementById('sched-presential-finish').value
        },
        notes: document.getElementById('sched-notes').value
    };

    const pildorasRows = document.querySelectorAll('#pildoras-list-body tr');

    // Collect current module píldoras from the displayed rows
    const currentModule = promotionModules[currentModuleIndex];
    if (currentModule && pildorasRows.length > 0) {
        const currentModulePildoras = [];
        const students = window.currentStudents || [];

        pildorasRows.forEach(row => {
            const modeEl = row.querySelector('.pildora-mode');
            const dateEl = row.querySelector('.pildora-date');
            const titleEl = row.querySelector('.pildora-title');
            const statusEl = row.querySelector('.pildora-status');
            const dropdown = row.querySelector('.pildora-students-dropdown');

            if (!modeEl || !dateEl || !titleEl || !statusEl || !dropdown) return;

            const mode = modeEl.value || '';
            const date = dateEl.value || '';
            const title = titleEl.value || '';
            const status = statusEl.value || '';

            // Get selected students from checkboxes in dropdown
            const selectedIds = Array.from(dropdown.querySelectorAll('input[type="checkbox"]:checked'))
                .map(input => input.value)
                .filter(Boolean);
            const studentsForPildora = selectedIds.map(id => {
                const s = students.find(st => st.id === id);
                return {
                    id,
                    name: s ? (s.name || '') : '',
                    lastname: s ? (s.lastname || '') : ''
                };
            });

            // Only add if there's actual content
            if (mode || date || title || status || studentsForPildora.length > 0) {
                currentModulePildoras.push({
                    mode,
                    date,
                    title,
                    students: studentsForPildora,
                    status
                });
            }
        });

        // Update the current module's píldoras in the data structure
        let modulePildoras = extendedInfoData.modulesPildoras?.find(mp => mp.moduleId === currentModule.id);
        if (!modulePildoras) {
            if (!extendedInfoData.modulesPildoras) {
                extendedInfoData.modulesPildoras = [];
            }
            modulePildoras = {
                moduleId: currentModule.id,
                moduleName: currentModule.name,
                pildoras: []
            };
            extendedInfoData.modulesPildoras.push(modulePildoras);
        }
        modulePildoras.pildoras = currentModulePildoras;
    }

    // Gather Evaluation
    const evaluation = document.getElementById('evaluation-text').value;

    // Note: Acta de Inicio fields are saved separately via saveActaData() from the modal.
    // extendedInfoData already holds them from the last load or saveActaData() call.

    // Update global object
    extendedInfoData.schedule = schedule;
    extendedInfoData.evaluation = evaluation;

    // Gather Competencias from ProgramCompetences module
    if (window.ProgramCompetences) {
        extendedInfoData.competences = window.ProgramCompetences.getCompetences();
        // Clear unsaved badge
        const badge = document.getElementById('competences-unsaved-badge');
        if (badge) badge.classList.add('d-none');
    }

    // Keep legacy pildoras for backward compatibility (flatten all module pildoras)
    const allPildoras = [];
    if (extendedInfoData.modulesPildoras) {
        extendedInfoData.modulesPildoras.forEach(mp => {
            if (mp.pildoras) {
                allPildoras.push(...mp.pildoras);
            }
        });
    }
    extendedInfoData.pildoras = allPildoras;

    console.log('Saving extended info for promotion:', promotionId);
    console.log('Data to save:', extendedInfoData);

    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/extended-info`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(extendedInfoData)
        });

        console.log('Save response status:', response.status);

        if (response.ok) {
            const savedData = await response.json();
            console.log('Data saved successfully:', savedData);
            alert('Program info saved successfully!');
        } else {
            try {
                const errorData = await response.json();
                console.error('Save error:', errorData);
                alert(`Failed to save info: ${response.status} - ${errorData.error || 'Unknown error'}`);
            } catch {
                alert(`Failed to save info: ${response.status} ${response.statusText}`);
            }
        }
    } catch (error) {
        console.error('Error saving info:', error);
        alert(`Error saving info: ${error.message}`);
    }
}

// ── Acta de Inicio modal ─────────────────────────────────────────────────────

const WEEKDAYS = ['lunes','martes','miércoles','jueves','viernes'];
// Map each weekday to its checkbox id suffix (avoids issues with accented chars in substring)
const WEEKDAY_IDS = { 'lunes':'lun', 'martes':'mar', 'miércoles':'mie', 'jueves':'jue', 'viernes':'vie' };

/** Build a weekday <select> with given id and optional selected value */
function _actaDaySelect(id, selected) {
    const opts = WEEKDAYS.map(d =>
        `<option value="${d}"${d === selected ? ' selected' : ''}>${d.charAt(0).toUpperCase()+d.slice(1)}</option>`
    ).join('');
    return `<select class="form-select form-select-sm" id="${id}" style="min-width:130px;">${opts}</select>`;
}

/** Re-render the KPI textareas per funder */
function actaRenderFunderKpis() {
    const container = document.getElementById('acta-funder-kpis-container');
    const emptyMsg  = document.getElementById('acta-funder-kpis-empty');
    const tags = document.querySelectorAll('#acta-funders-tags .acta-tag');
    const funders = Array.from(tags).map(t => t.dataset.value);

    if (!funders.length) {
        container.innerHTML = '';
        if (emptyMsg) emptyMsg.style.display = '';
        return;
    }
    if (emptyMsg) emptyMsg.style.display = 'none';

    // Keep existing text so editing isn't lost
    const existing = {};
    container.querySelectorAll('textarea[data-funder]').forEach(ta => {
        existing[ta.dataset.funder] = ta.value;
    });

    container.innerHTML = funders.map(f => `
        <div class="mb-2">
            <label class="form-label fw-semibold small text-secondary">${f}</label>
            <textarea class="form-control form-control-sm" data-funder="${f}" rows="2"
                placeholder="KPIs para ${f}">${existing[f] || ''}</textarea>
        </div>`).join('');
}

/** Add a funder tag */
function actaAddFunder(value) {
    const input = document.getElementById('acta-funder-input');
    const val = (value || input.value).trim();
    if (!val) return;

    // Check uniqueness
    const existing = Array.from(document.querySelectorAll('#acta-funders-tags .acta-tag'))
        .map(t => t.dataset.value);
    if (existing.includes(val)) { if (!value) { input.value=''; } return; }

    const tag = document.createElement('span');
    tag.className = 'acta-tag';
    tag.dataset.value = val;
    tag.innerHTML = `${val} <span class="rm" onclick="this.parentElement.remove(); actaRenderFunderKpis()">×</span>`;
    document.getElementById('acta-funders-tags').appendChild(tag);
    if (!value) input.value = '';
    actaRenderFunderKpis();
}

/** Add a day-off row (trainer or cotrainer) */
function actaAddDayOffRow(type, moduleName, dayValue) {
    const container = document.getElementById(`acta-${type}-dayoff-rows`);
    const rowId = `dayoff-${type}-${Date.now()}`;
    const div = document.createElement('div');
    div.className = 'acta-dayoff-row';
    div.innerHTML = `
        <input type="text" class="form-control form-control-sm" placeholder="Buscar persona..." list="acta-users-datalist" value="${moduleName||''}">
        ${_actaDaySelect(`${rowId}-day`, dayValue || 'lunes')}
        <button type="button" class="btn btn-sm btn-outline-danger" onclick="this.parentElement.remove()">
            <i class="bi bi-trash"></i>
        </button>`;
    container.appendChild(div);
}

/** Serialize day-off rows into a string */
function _actaReadDayOffRows(type) {
    const rows = document.querySelectorAll(`#acta-${type}-dayoff-rows .acta-dayoff-row`);
    return Array.from(rows).map(row => {
        const name = row.querySelector('input[type=text]')?.value.trim() || '';
        const day  = row.querySelector('select')?.value || '';
        return name ? `${name} (${day})` : day;
    }).filter(Boolean).join('. ');
}

/** Parse a stored day-off string back into rows */
function _actaPopulateDayOffRows(type, stored) {
    const container = document.getElementById(`acta-${type}-dayoff-rows`);
    container.innerHTML = '';
    if (!stored) return;
    // format: "Módulo 1. Nombre (día). Módulo 2. ..."
    // Split by '. ' but keep content between parens
    const parts = stored.split(/\.\s+(?=[A-ZÁÉÍÓÚÑ])/);
    parts.forEach(part => {
        const m = part.match(/^(.*?)\s*\((\w+)\)\s*\.?$/);
        if (m) {
            actaAddDayOffRow(type, m[1].trim(), m[2].toLowerCase());
        } else if (part.trim()) {
            actaAddDayOffRow(type, part.trim(), 'lunes');
        }
    });
    if (!container.children.length) actaAddDayOffRow(type);
}

/** Get today's date as YYYY-MM-DD for date input min */
function _actaToday() {
    return new Date().toISOString().split('T')[0];
}

function openActaModal() {
    const d = extendedInfoData;

    // Simple fields
    document.getElementById('acta-school').value         = d.school || '';
    document.getElementById('acta-project-type').value   = d.projectType || 'Bootcamp';
    document.getElementById('acta-total-hours').value    = d.totalHours || '';
    document.getElementById('acta-modality').value       = d.modality || '';
    document.getElementById('acta-materials').value      = d.materials || 'No son necesarios recursos adicionales.';
    document.getElementById('acta-funder-deadlines').value = d.funderDeadlines || '';
    document.getElementById('acta-okr-kpis').value       = d.okrKpis ||
        'PIPO3.R1 Satisfacción 4,2/5 de coders sobre la excelencia del equipo formativo de la formación\nISEC2.R1 Jornadas de selección con un 40% de personas participantes con el proceso 100% finalizado.\nISEC3.R2 Resultado 78% salida positiva.\nISECR2 Finalizar cada programa con un máximo de bajas de 10%.';
    document.getElementById('acta-project-meetings').value = d.projectMeetings || 'Ver el calendario de reuniones en Asana.';

    // Date inputs
    const today = _actaToday();
    const startEl = document.getElementById('acta-positive-exit-start');
    const endEl   = document.getElementById('acta-positive-exit-end');
    startEl.min = today;
    endEl.min   = today;
    // stored as YYYY-MM-DD or human string — if it looks like a date input value use it, else keep blank
    startEl.value = /^\d{4}-\d{2}-\d{2}$/.test(d.positiveExitStart) ? d.positiveExitStart : '';
    endEl.value   = /^\d{4}-\d{2}-\d{2}$/.test(d.positiveExitEnd)   ? d.positiveExitEnd   : '';

    // Presential days checkboxes
    const storedDays = (d.presentialDays || '').toLowerCase();
    WEEKDAYS.forEach(day => {
        const cb = document.getElementById(`pd-${WEEKDAY_IDS[day]}`);
        if (cb) cb.checked = storedDays.includes(day);
    });

    // Presential location — extract from stored string if possible
    const locationSelect = document.getElementById('acta-presential-location');
    const locations = Array.from(locationSelect.options).map(o => o.value).filter(Boolean);
    const matchedLoc = locations.find(l => (d.presentialDays||'').includes(l));
    locationSelect.value = matchedLoc || '';

    // Internships
    const inEl = document.getElementById('acta-internships');
    inEl.value = d.internships === true ? 'true' : d.internships === false ? 'false' : '';

    // Funders tags — clear and re-add
    document.getElementById('acta-funders-tags').innerHTML = '';
    const storedFunders = (d.funders || 'SAGE.\nJP Morgan.\nEn colaboración con Microsoft y Somos F5.');
    storedFunders.split('\n').map(f => f.trim()).filter(Boolean).forEach(f => actaAddFunder(f));

    // Funder KPIs — populate after funders rendered
    const storedKpis = d.funderKpis || '';
    // Parse format: "Financiador: kpi text\n---\n..."
    setTimeout(() => {
        const kpiBlocks = storedKpis.split(/\n---\n/);
        kpiBlocks.forEach(block => {
            const m = block.match(/^([^:]+):\s*([\s\S]*)$/);
            if (m) {
                const ta = document.querySelector(`#acta-funder-kpis-container textarea[data-funder="${m[1].trim()}"]`);
                if (ta) ta.value = m[2].trim();
            }
        });
    }, 50);

    // Populate users datalist from team members
    const datalist = document.getElementById('acta-users-datalist');
    if (datalist) {
        const teamMembers = extendedInfoData.team || [];
        datalist.innerHTML = teamMembers.map(m => {
            const label = m.role ? `${m.name} (${m.role})` : m.name;
            return `<option value="${label}">`;
        }).join('');
    }

    // Day-off rows
    _actaPopulateDayOffRows('trainer',   d.trainerDayOff   || '');
    _actaPopulateDayOffRows('cotrainer', d.cotrainerDayOff || '');
    if (!document.querySelector('#acta-trainer-dayoff-rows .acta-dayoff-row'))   actaAddDayOffRow('trainer');
    if (!document.querySelector('#acta-cotrainer-dayoff-rows .acta-dayoff-row')) actaAddDayOffRow('cotrainer');

    // Team meeting
    const tmParts = (d.teamMeetings || 'Semanal - jueves (14:30-15:00)').match(/(\w+)\s*\((\d{2}:\d{2})-(\d{2}:\d{2})\)/i);
    if (tmParts) {
        const dayEl = document.getElementById('acta-team-meeting-day');
        const day = tmParts[1].toLowerCase();
        if (WEEKDAYS.includes(day)) dayEl.value = day;
        document.getElementById('acta-team-meeting-start').value = tmParts[2];
        document.getElementById('acta-team-meeting-end').value   = tmParts[3];
    }

    // Approval fields
    document.getElementById('acta-approval-name').value = d.approvalName || '';
    document.getElementById('acta-approval-role').value = d.approvalRole || '';

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('actaInicioModal'));
    modal.show();
}

// Handle Enter key in funder input
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('acta-funder-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); actaAddFunder(); }
    });
});

async function saveActaData() {
    const token = localStorage.getItem('token');

    // Simple fields
    extendedInfoData.school          = document.getElementById('acta-school').value;
    extendedInfoData.projectType     = document.getElementById('acta-project-type').value;
    extendedInfoData.materials       = document.getElementById('acta-materials').value;
    extendedInfoData.funderDeadlines = document.getElementById('acta-funder-deadlines').value;
    extendedInfoData.okrKpis         = document.getElementById('acta-okr-kpis').value;
    extendedInfoData.projectMeetings = document.getElementById('acta-project-meetings').value;
    extendedInfoData.totalHours      = document.getElementById('acta-total-hours').value;
    extendedInfoData.modality        = document.getElementById('acta-modality').value;

    // Internships
    const inRaw = document.getElementById('acta-internships').value;
    extendedInfoData.internships = inRaw === 'true' ? true : inRaw === 'false' ? false : null;

    // Dates (stored as YYYY-MM-DD)
    extendedInfoData.positiveExitStart = document.getElementById('acta-positive-exit-start').value;
    extendedInfoData.positiveExitEnd   = document.getElementById('acta-positive-exit-end').value;

    // Presential days + location
    const checkedDays = WEEKDAYS.filter(day => {
        const cb = document.getElementById(`pd-${WEEKDAY_IDS[day]}`);
        return cb && cb.checked;
    });
    const location = document.getElementById('acta-presential-location').value;
    const dayCount = checkedDays.length;
    extendedInfoData.presentialDays = dayCount
        ? `${dayCount} día${dayCount>1?'s':''}, ${checkedDays.join(' y ')}${location ? ', '+location : ''}`
        : (location || '');

    // Funders (unique tags → newline-separated)
    const funderTags = Array.from(document.querySelectorAll('#acta-funders-tags .acta-tag'))
        .map(t => t.dataset.value);
    extendedInfoData.funders = funderTags.join('\n');

    // Funder KPIs (format: "Funder: kpi\n---\nFunder2: kpi2")
    const kpiBlocks = [];
    document.querySelectorAll('#acta-funder-kpis-container textarea[data-funder]').forEach(ta => {
        if (ta.value.trim()) kpiBlocks.push(`${ta.dataset.funder}: ${ta.value.trim()}`);
    });
    extendedInfoData.funderKpis = kpiBlocks.join('\n---\n');

    // Day-off rows
    extendedInfoData.trainerDayOff   = _actaReadDayOffRows('trainer');
    extendedInfoData.cotrainerDayOff = _actaReadDayOffRows('cotrainer');

    // Team meetings
    const tmDay   = document.getElementById('acta-team-meeting-day').value;
    const tmStart = document.getElementById('acta-team-meeting-start').value;
    const tmEnd   = document.getElementById('acta-team-meeting-end').value;
    extendedInfoData.teamMeetings = `Semanal - ${tmDay} (${tmStart}-${tmEnd})`;

    // Approval fields
    extendedInfoData.approvalName = document.getElementById('acta-approval-name').value.trim();
    extendedInfoData.approvalRole = document.getElementById('acta-approval-role').value.trim();

    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/extended-info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(extendedInfoData)
        });
        if (response.ok) {
            bootstrap.Modal.getInstance(document.getElementById('actaInicioModal'))?.hide();
            alert('Datos del Acta de Inicio guardados correctamente.');
        } else {
            const err = await response.json().catch(() => ({}));
            alert(`Error al guardar: ${response.status} - ${err.error || 'Error desconocido'}`);
        }
    } catch (error) {
        console.error('Error saving acta data:', error);
        alert(`Error al guardar: ${error.message}`);
    }
}

async function togglePildorasAssignment(isOpen) {
    extendedInfoData.pildorasAssignmentOpen = isOpen;
    console.log('Toggling píldoras self-assignment:', isOpen);

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/extended-info`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(extendedInfoData)
        });

        if (!response.ok) {
            alert('Failed to update assignment status');
            // Revert UI
            document.getElementById('pildoras-assignment-toggle').checked = !isOpen;
            extendedInfoData.pildorasAssignmentOpen = !isOpen;
        }
    } catch (error) {
        console.error('Error updating assignment status:', error);
        alert('Error updating assignment status');
        // Revert UI
        document.getElementById('pildoras-assignment-toggle').checked = !isOpen;
        extendedInfoData.pildorasAssignmentOpen = !isOpen;
    }
}

function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
    }
}

function switchTab(tabId) {
    document.querySelectorAll('.section-content').forEach(section => {
        section.classList.add('hidden');
    });

    const activeTab = document.getElementById(`${tabId}-tab`);
    if (activeTab) {
        activeTab.classList.remove('hidden');
    }

    // Refresh data if needed
    if (tabId === 'calendar') loadCalendar();
    if (tabId === 'roadmap') loadModules();
    if (tabId === 'students') loadStudents();
    if (tabId === 'attendance') loadAttendance();
    if (tabId === 'info') loadExtendedInfo();
    if (tabId === 'collaborators') loadCollaborators();
    if (tabId === 'access-settings') loadAccessPassword();

    // Update active state in sidebar
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('onclick') && link.getAttribute('onclick').includes(tabId)) {
            link.classList.add('active');
        }
    });

    // Handle iframe height to fit content if possible
    if (tabId === 'overview') {
        const previewIframe = document.getElementById('student-preview-iframe');
        if (previewIframe) {
            previewIframe.style.height = '600px';
        }
    }
}

async function loadPromotion() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const promotion = await response.json();
            window.currentPromotion = promotion; // Store globally for editing
            document.getElementById('promotion-title').textContent = promotion.name;
            document.getElementById('promotion-desc').textContent = promotion.description || '';
            document.getElementById('promotion-weeks').textContent = promotion.weeks || '-';
            document.getElementById('promotion-start').textContent = promotion.startDate || '-';
            document.getElementById('promotion-end').textContent = promotion.endDate || '-';
            document.getElementById('modules-count').textContent = (promotion.modules || []).length;

            // Load teaching content button
            if (promotion.teachingContentUrl) {
                const teachingContentBtn = document.getElementById('teaching-content-btn');
                if (teachingContentBtn) {
                    teachingContentBtn.href = promotion.teachingContentUrl;
                    teachingContentBtn.classList.remove('hidden');
                }
            }

            // Check if current user is owner (to enable/disable collaborator management)
            if (userRole === 'teacher') {
                const isOwner = promotion.teacherId === currentUser.id;
                const addCollabBtn = document.getElementById('add-collaborator-btn');
                if (addCollabBtn) {
                    addCollabBtn.style.display = isOwner ? 'block' : 'none';
                }
            }
        }
    } catch (error) {
        console.error('Error loading promotion:', error);
    }
}

async function loadModules() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const promotion = await response.json();
            displayModules(promotion.modules || []);
            generateGanttChart(promotion);
        }
    } catch (error) {
        console.error('Error loading modules:', error);
    }
}

function displayModules(modules) {
    const list = document.getElementById('modules-list');
    list.innerHTML = '';

    if (modules.length === 0) {
        list.innerHTML = '<div class="col-12"><p class="text-muted">No modules yet</p></div>';
        return;
    }

    modules.forEach((module, index) => {
        const card = document.createElement('div');
        card.className = 'col-md-6 mb-3';
        const coursesText = (module.courses || []).map(c => typeof c === 'string' ? c : (c.name || 'Unnamed Course')).join(', ');
        const projectsText = (module.projects || []).map(p => typeof p === 'string' ? p : (p.name || 'Unnamed Project')).join(', ');
        const pildorasText = (module.pildoras || []).map(p => {
            const title = typeof p === 'string' ? p : (p.title || 'Píldora');
            const type = typeof p === 'object' && p.type === 'couple' ? 'pareja' : 'individual';
            return `${title} (${type})`;
        }).join(', ');

        // card.innerHTML = `
        //     <div class="card">
        //         <div class="card-body">
        //             <h5 class="card-title">Module ${index + 1}: ${escapeHtml(module.name)}</h5>
        //             <p><strong>Duration:</strong> ${module.duration} weeks</p>
        //             ${coursesText ? `<p><strong>Courses:</strong> ${escapeHtml(coursesText)}</p>` : ''}
        //             ${projectsText ? `<p><strong>Projects:</strong> ${escapeHtml(projectsText)}</p>` : ''}
        //             ${pildorasText ? `<p><strong>Píldoras:</strong> ${escapeHtml(pildorasText)}</p>` : ''}
        //         </div>
        //     </div>
        // `;
        // list.appendChild(card);
    });
}

function generateGanttChart(promotion) {
    const table = document.getElementById('gantt-table');
    table.innerHTML = '';

    const weeks = promotion.weeks || 0;
    const modules = promotion.modules || [];
    const employability = promotion.employability || [];

    if (modules.length === 0) {
        table.innerHTML = '<tbody><tr><td class="text-muted">No modules configured</td></tr></tbody>';
        return;
    }

    // Compact table — override the generous default padding from style.css
    table.className = 'table table-sm table-bordered gantt-table';
    table.style.fontSize = '0.65rem';
    table.style.borderCollapse = 'collapse';
    table.style.tableLayout = 'auto';

    // Inject a scoped style block once to force tight cell sizing
    if (!document.getElementById('gantt-compact-style')) {
        const s = document.createElement('style');
        s.id = 'gantt-compact-style';
        s.textContent = `
            #gantt-table th, #gantt-table td {
                padding: 1px 2px !important;
                font-size: 0.6rem;
                border: 1px solid #dee2e6 !important;
                box-sizing: border-box;
            }
            #gantt-table .gantt-label-cell {
                white-space: nowrap;
                overflow: visible;
                position: sticky;
                left: 0;
                background: white;
                z-index: 2;
            }
            #gantt-table .gantt-week-cell {
                writing-mode: vertical-rl;
                text-orientation: mixed;
                padding: 3px 1px !important;
            }
        `;
        document.head.appendChild(s);
    }

    const tableContainer = table.closest('.table-responsive') || table.parentElement;
    if (tableContainer) {
        tableContainer.style.overflowX = 'auto';
        tableContainer.style.maxWidth = '100%';
    }

    function getMonthForWeek(w) { return Math.ceil(w / 4); }

    // ── 1. Header: month + week rows go in <thead> ────────────────────────────
    const thead = document.createElement('thead');

    const monthRow = document.createElement('tr');
    const monthHeaderCell = document.createElement('th');
    monthHeaderCell.innerHTML = '<strong>Meses</strong>';
    monthHeaderCell.className = 'gantt-label-cell';
    monthRow.appendChild(monthHeaderCell);

    let currentMonth = 0, monthSpan = 0, monthCell = null;
    for (let i = 1; i <= weeks; i++) {
        const m = getMonthForWeek(i);
        if (m !== currentMonth) {
            if (monthCell) monthCell.colSpan = monthSpan;
            currentMonth = m;
            monthCell = document.createElement('th');
            monthCell.innerHTML = `<strong>M${m}</strong>`;
            monthCell.style.textAlign = 'center';
            monthRow.appendChild(monthCell);
            monthSpan = 1;
        } else { monthSpan++; }
    }
    if (monthCell) monthCell.colSpan = monthSpan;
    thead.appendChild(monthRow);

    const weekRow = document.createElement('tr');
    const weekHeaderCell = document.createElement('th');
    weekHeaderCell.innerHTML = '<strong>Sem.</strong>';
    weekHeaderCell.className = 'gantt-label-cell';
    weekRow.appendChild(weekHeaderCell);
    for (let i = 1; i <= weeks; i++) {
        const th = document.createElement('th');
        th.textContent = `${i}`;
        th.className = 'gantt-week-cell text-center';
        weekRow.appendChild(th);
    }
    thead.appendChild(weekRow);
    table.appendChild(thead);

    // ── 2. Employability section — one <tbody> for header + sessions ──────────
    const employabilityId = 'employability-section';
    const isEmpExpanded = localStorage.getItem(`gantt-expanded-${employabilityId}`) !== 'false';

    const empTbody = document.createElement('tbody');
    empTbody.id = `tbody-${employabilityId}`;

    // Compute overall span for the header bar
    const empStarts = employability.map(e => (e.startMonth - 1) * 4);
    const empEnds   = employability.map(e => (e.startMonth - 1) * 4 + e.duration * 4);
    const empMin = empStarts.length ? Math.min(...empStarts) : -1;
    const empMax = empEnds.length   ? Math.min(Math.max(...empEnds), weeks) : -1;

    // Header row (always visible — lives in empTbody)
    const empHeaderRow = document.createElement('tr');
    empHeaderRow.className = 'gantt-employability-header';
    empHeaderRow.style.cursor = 'pointer';
    empHeaderRow.title = 'Click para expandir/colapsar';

    const empLabelCell = document.createElement('td');
    empLabelCell.className = 'gantt-label-cell';
    empLabelCell.colSpan = weeks + 1;
    empLabelCell.style.backgroundColor = '#fff8e1';
    empLabelCell.style.position = 'sticky';
    empLabelCell.style.left = '0';

    // Build inline span bar: a thin colored strip showing the overall range
    let spanBarHtml = '';
    if (empMin >= 0 && empMax > empMin) {
        const leftPct  = ((empMin / weeks) * 100).toFixed(1);
        const widthPct = (((empMax - empMin) / weeks) * 100).toFixed(1);
        spanBarHtml = `
            <div style="position:relative;height:4px;background:#f3e5ab;border-radius:2px;margin-top:2px;overflow:hidden;">
                <div style="position:absolute;left:${leftPct}%;width:${widthPct}%;height:100%;background:#f59e0b;border-radius:2px;"></div>
            </div>`;
    }

    empLabelCell.innerHTML = `
        <div class="d-flex align-items-center gap-1">
            <i class="bi ${isEmpExpanded ? 'bi-chevron-down' : 'bi-chevron-right'} gantt-emp-chevron" style="font-size:0.6rem;"></i>
            <strong>Empleabilidad</strong>
            <span class="badge bg-warning text-dark" style="font-size:0.55rem;">${employability.length}</span>
        </div>
        ${spanBarHtml}`;
    empHeaderRow.appendChild(empLabelCell);
    empHeaderRow.addEventListener('click', () => toggleEmployabilityExpansion());
    empTbody.appendChild(empHeaderRow);

    // Session rows — in a separate <tbody> that gets hidden/shown as a unit
    const empContentTbody = document.createElement('tbody');
    empContentTbody.id = `tbody-content-${employabilityId}`;
    empContentTbody.style.display = isEmpExpanded ? '' : 'none';

    employability.forEach((item, index) => {
        const itemRow = document.createElement('tr');

        const itemCell = document.createElement('td');
        itemCell.className = 'gantt-label-cell';
        itemCell.style.backgroundColor = '#fffff8';

        const itemUrl = item.url
            ? `<a href="${escapeHtml(item.url)}" target="_blank" class="text-decoration-none">${escapeHtml(item.name)}</a>`
            : escapeHtml(item.name);
        const editBtn = userRole === 'teacher'
            ? `<button class="btn btn-xs btn-outline-warning py-0 px-1" style="font-size:0.55rem;" onclick="event.stopPropagation();editEmployabilityItem(${index})"><i class="bi bi-pencil"></i></button>` : '';
        const delBtn = userRole === 'teacher'
            ? `<button class="btn btn-xs btn-outline-danger py-0 px-1" style="font-size:0.55rem;" onclick="event.stopPropagation();deleteEmployabilityItem(${index})"><i class="bi bi-trash"></i></button>` : '';

        itemCell.innerHTML = `
            <div class="d-flex align-items-center justify-content-between gap-1" style="padding-left:14px;">
                <small style="font-size:0.58rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:110px;">${itemUrl}</small>
                <div class="d-flex gap-1">${editBtn}${delBtn}</div>
            </div>`;
        itemRow.appendChild(itemCell);

        const sw = (item.startMonth - 1) * 4;
        const ew = sw + item.duration * 4;
        for (let i = 0; i < weeks; i++) {
            const cell = document.createElement('td');
            cell.style.height = '18px';
            if (i >= sw && i < ew) cell.style.backgroundColor = '#fff3cd';
            itemRow.appendChild(cell);
        }
        empContentTbody.appendChild(itemRow);
    });

    table.appendChild(empTbody);
    table.appendChild(empContentTbody);

    // ── 3. Module rows — one <tbody> per module (header + sub-rows) ───────────
    let weekCounter = 0;
    modules.forEach((module, index) => {
        const moduleId = `module-${index}`;
        const isExpanded = localStorage.getItem(`gantt-expanded-${moduleId}`) !== 'false';

        // Module header gets its own single-row <tbody>
        const modHeaderTbody = document.createElement('tbody');
        modHeaderTbody.id = `tbody-header-${moduleId}`;

        const moduleRow = document.createElement('tr');
        moduleRow.className = 'gantt-module-header';
        moduleRow.dataset.moduleIndex = index;
        moduleRow.style.cursor = 'pointer';
        moduleRow.title = 'Click para expandir/colapsar';

        const moduleCell = document.createElement('td');
        moduleCell.className = 'gantt-label-cell';

        const editBtn   = userRole === 'teacher'
            ? `<button class="btn btn-xs btn-outline-warning py-0 px-1" style="font-size:0.55rem;" onclick="event.stopPropagation();editModule('${escapeHtml(module.id)}')"><i class="bi bi-pencil"></i></button>` : '';
        const deleteBtn = userRole === 'teacher'
            ? `<button class="btn btn-xs btn-outline-danger py-0 px-1" style="font-size:0.55rem;" onclick="event.stopPropagation();deleteModule('${escapeHtml(module.id)}')"><i class="bi bi-trash"></i></button>` : '';

        moduleCell.innerHTML = `
            <div class="d-flex align-items-center justify-content-between gap-1">
                <div class="d-flex align-items-center gap-1">
                    <i class="bi ${isExpanded ? 'bi-chevron-down' : 'bi-chevron-right'} gantt-mod-chevron" style="font-size:0.6rem;"></i>
                    <strong>M${index + 1}: ${escapeHtml(module.name)}</strong>
                </div>
                <div class="d-flex gap-1">${editBtn}${deleteBtn}</div>
            </div>`;
        moduleRow.appendChild(moduleCell);

        for (let i = 0; i < weeks; i++) {
            const cell = document.createElement('td');
            cell.style.height = '22px';
            if (i >= weekCounter && i < weekCounter + module.duration) {
                cell.style.backgroundColor = '#667eea';
            }
            moduleRow.appendChild(cell);
        }
        moduleRow.addEventListener('click', () => toggleModuleExpansion(moduleId, index));
        modHeaderTbody.appendChild(moduleRow);
        table.appendChild(modHeaderTbody);

        // Sub-rows (courses + projects) go in a single collapsible <tbody>
        const modContentTbody = document.createElement('tbody');
        modContentTbody.id = `tbody-content-${moduleId}`;
        modContentTbody.style.display = isExpanded ? '' : 'none';

        // Course rows
        (module.courses || []).forEach((courseObj, courseIndex) => {
            const courseName = typeof courseObj === 'string' ? courseObj : (courseObj.name || 'Unnamed');
            const courseUrl  = typeof courseObj === 'object' ? (courseObj.url || '') : '';
            const courseDur  = typeof courseObj === 'object' ? (Number(courseObj.duration) || 1) : 1;
            const courseOff  = typeof courseObj === 'object' ? (Number(courseObj.startOffset) || 0) : 0;

            const courseRow = document.createElement('tr');
            const courseCell = document.createElement('td');
            courseCell.className = 'gantt-label-cell';
            courseCell.style.backgroundColor = '#f8fffc';

            const link = courseUrl
                ? `<a href="${escapeHtml(courseUrl)}" target="_blank" class="text-decoration-none">${escapeHtml(courseName)}</a>`
                : escapeHtml(courseName);
            const delBtn = userRole === 'teacher'
                ? `<button class="btn btn-xs btn-outline-danger py-0 px-1" style="font-size:0.55rem;" onclick="event.stopPropagation();deleteCourseFromModule('${escapeHtml(module.id)}',${courseIndex})"><i class="bi bi-trash"></i></button>` : '';

            courseCell.innerHTML = `
                <div class="d-flex align-items-center justify-content-between gap-1" style="padding-left:14px;">
                    <small style="font-size:0.58rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:115px;">${link}</small>
                    <div>${delBtn}</div>
                </div>`;
            courseRow.appendChild(courseCell);

            const as = weekCounter + courseOff, ae = as + courseDur;
            for (let i = 0; i < weeks; i++) {
                const cell = document.createElement('td');
                cell.style.height = '18px';
                if (i >= as && i < ae) cell.style.backgroundColor = '#d1e7dd';
                courseRow.appendChild(cell);
            }
            modContentTbody.appendChild(courseRow);
        });

        // Project rows
        (module.projects || []).forEach((projectObj, projectIndex) => {
            const projectName = typeof projectObj === 'string' ? projectObj : (projectObj.name || 'Unnamed');
            const projectUrl  = typeof projectObj === 'object' ? (projectObj.url || '') : '';
            const projectDur  = typeof projectObj === 'object' ? (Number(projectObj.duration) || 1) : 1;
            const projectOff  = typeof projectObj === 'object' ? (Number(projectObj.startOffset) || 0) : 0;

            const projectRow = document.createElement('tr');
            const projectCell = document.createElement('td');
            projectCell.className = 'gantt-label-cell';
            projectCell.style.backgroundColor = '#fff8f8';

            const link = projectUrl
                ? `<a href="${escapeHtml(projectUrl)}" target="_blank" class="text-decoration-none">${escapeHtml(projectName)}</a>`
                : escapeHtml(projectName);
            const delBtn = userRole === 'teacher'
                ? `<button class="btn btn-xs btn-outline-danger py-0 px-1" style="font-size:0.55rem;" onclick="event.stopPropagation();deleteProjectFromModule('${escapeHtml(module.id)}',${projectIndex})"><i class="bi bi-trash"></i></button>` : '';

            projectCell.innerHTML = `
                <div class="d-flex align-items-center justify-content-between gap-1" style="padding-left:14px;">
                    <small style="font-size:0.58rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:115px;">${link}</small>
                    <div>${delBtn}</div>
                </div>`;
            projectRow.appendChild(projectCell);

            const as = weekCounter + projectOff, ae = as + projectDur;
            for (let i = 0; i < weeks; i++) {
                const cell = document.createElement('td');
                cell.style.height = '18px';
                if (i >= as && i < ae) cell.style.backgroundColor = '#fce4e4';
                projectRow.appendChild(cell);
            }
            modContentTbody.appendChild(projectRow);
        });

        table.appendChild(modContentTbody);
        weekCounter += module.duration;
    });
}

// Toggle module expansion
function toggleModuleExpansion(moduleId, index) {
    const contentTbody = document.getElementById(`tbody-content-${moduleId}`);
    const chevron = document.querySelector(`[data-module-index="${index}"] .gantt-mod-chevron`);
    const isCurrentlyExpanded = contentTbody?.style.display !== 'none';

    if (contentTbody) contentTbody.style.display = isCurrentlyExpanded ? 'none' : '';

    if (chevron) {
        chevron.className = isCurrentlyExpanded
            ? 'bi bi-chevron-right gantt-mod-chevron'
            : 'bi bi-chevron-down gantt-mod-chevron';
    }

    localStorage.setItem(`gantt-expanded-${moduleId}`, !isCurrentlyExpanded);
}

// Toggle employability expansion
function toggleEmployabilityExpansion() {
    const employabilityId = 'employability-section';
    const contentTbody = document.getElementById(`tbody-content-${employabilityId}`);
    const headerRow = document.querySelector('.gantt-employability-header');
    const chevron = headerRow?.querySelector('.gantt-emp-chevron');
    const isCurrentlyExpanded = contentTbody?.style.display !== 'none';

    if (contentTbody) contentTbody.style.display = isCurrentlyExpanded ? 'none' : '';

    if (chevron) {
        chevron.className = isCurrentlyExpanded
            ? 'bi bi-chevron-right gantt-emp-chevron'
            : 'bi bi-chevron-down gantt-emp-chevron';
    }

    localStorage.setItem(`gantt-expanded-${employabilityId}`, !isCurrentlyExpanded);
}

async function editModule(moduleId) {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}`);
        if (response.ok) {
            const promotion = await response.json();
            const module = promotion.modules.find(m => m.id === moduleId);

            if (!module) {
                alert('Module not found');
                return;
            }

            // Populate form with module data
            document.getElementById('module-name').value = module.name;
            document.getElementById('module-duration').value = module.duration;
            document.getElementById('moduleModalTitle').textContent = 'Edit Module';

            // Clear containers
            document.getElementById('courses-container').innerHTML = '';
            document.getElementById('projects-container').innerHTML = '';
            const pildorasContainer = document.getElementById('pildoras-container');
            if (pildorasContainer) pildorasContainer.innerHTML = '';

            // Populate courses
            if (module.courses && module.courses.length > 0) {
                module.courses.forEach(course => {
                    const isObj = course && typeof course === 'object';
                    const courseName = isObj ? (course.name || '') : String(course);
                    const courseUrl = isObj ? (course.url || '') : '';
                    const courseDur = isObj ? (Number(course.duration) || 1) : 1;
                    const courseOff = isObj ? (Number(course.startOffset) || 0) : 0;
                    addCoursField(courseName, courseUrl, courseDur, courseOff);
                });
            }

            // Populate projects
            if (module.projects && module.projects.length > 0) {
                module.projects.forEach(project => {
                    const isObj = project && typeof project === 'object';
                    const projectName = isObj ? (project.name || '') : String(project);
                    const projectUrl = isObj ? (project.url || '') : '';
                    const projectDur = isObj ? (Number(project.duration) || 1) : 1;
                    const projectOff = isObj ? (Number(project.startOffset) || 0) : 0;
                    const projectCompIds = isObj ? (project.competenceIds || []) : [];
                    addProjectField(projectName, projectUrl, projectDur, projectOff, projectCompIds);
                });
            }

            // Populate pildoras
            if (module.pildoras && module.pildoras.length > 0) {
                module.pildoras.forEach(p => {
                    addPildoraField(p.title || '', p.type || 'individual');
                });
            }

            currentEditingModuleId = moduleId;
            moduleModal.show();
        }
    } catch (error) {
        console.error('Error editing module:', error);
        alert('Error loading module data');
    }
}

async function deleteModule(moduleId) {
    if (!confirm('Are you sure you want to delete this module? This action cannot be undone.')) return;

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}`);
        if (response.ok) {
            const promotion = await response.json();
            const moduleIndex = promotion.modules.findIndex(m => m.id === moduleId);

            if (moduleIndex === -1) {
                alert('Module not found');
                return;
            }

            promotion.modules.splice(moduleIndex, 1);

            const updateResponse = await fetch(`${API_URL}/api/promotions/${promotionId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(promotion)
            });

            if (updateResponse.ok) {
                loadModules();
                loadPromotion();
                alert('Module deleted successfully');
            } else {
                alert('Error deleting module');
            }
        }
    } catch (error) {
        console.error('Error deleting module:', error);
        alert('Error deleting module');
    }
}

async function deleteCourseFromModule(moduleId, courseIndex) {
    if (!confirm('Delete this course?')) return;

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}`);
        if (response.ok) {
            const promotion = await response.json();
            const module = promotion.modules.find(m => m.id === moduleId);

            if (!module) {
                alert('Module not found');
                return;
            }

            if (module.courses && module.courses[courseIndex]) {
                module.courses.splice(courseIndex, 1);

                const updateResponse = await fetch(`${API_URL}/api/promotions/${promotionId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(promotion)
                });

                if (updateResponse.ok) {
                    loadModules();
                    loadPromotion();
                } else {
                    alert('Error deleting course');
                }
            }
        }
    } catch (error) {
        console.error('Error deleting course:', error);
        alert('Error deleting course');
    }
}

async function deleteProjectFromModule(moduleId, projectIndex) {
    if (!confirm('Delete this project?')) return;

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}`);
        if (response.ok) {
            const promotion = await response.json();
            const module = promotion.modules.find(m => m.id === moduleId);

            if (!module) {
                alert('Module not found');
                return;
            }

            if (module.projects && module.projects[projectIndex]) {
                module.projects.splice(projectIndex, 1);

                const updateResponse = await fetch(`${API_URL}/api/promotions/${promotionId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(promotion)
                });

                if (updateResponse.ok) {
                    loadModules();
                    loadPromotion();
                } else {
                    alert('Error deleting project');
                }
            }
        }
    } catch (error) {
        console.error('Error deleting project:', error);
        alert('Error deleting project');
    }
}

async function loadQuickLinks() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/quick-links`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const links = await response.json();
            displayQuickLinks(links);
            document.getElementById('quicklinks-count').textContent = links.length;
        }
    } catch (error) {
        console.error('Error loading quick links:', error);
    }
}

function displayQuickLinks(links) {
    const list = document.getElementById('quick-links-list');
    list.innerHTML = '';

    if (links.length === 0) {
        list.innerHTML = '<div class="col-12"><p class="text-muted">No quick links yet</p></div>';
        return;
    }

    links.forEach(link => {
        const platform = link.platform || 'custom';
        const platformInfo = platformIcons[platform] || platformIcons['custom'];

        const deleteBtn = userRole === 'teacher' ? `
            <button class="btn btn-sm btn-danger" onclick="deleteQuickLink('${link.id}')">
                <i class="bi bi-trash"></i>
            </button>` : '';

        const card = document.createElement('div');
        card.className = 'col-md-6 col-lg-3';
        card.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                        <i class="bi ${platformInfo.icon}" style="font-size: 1.3rem; color: ${platformInfo.color};"></i>
                        <h5 class="card-title" style="margin: 0;">${escapeHtml(link.name)}</h5>
                    </div>
                    <a href="${escapeHtml(link.url)}" target="_blank" class="btn btn-sm btn-primary">
                        <i class="bi bi-box-arrow-up-right me-1"></i>Open Link
                    </a>
                    ${deleteBtn}
                </div>
            </div>
        `;
        list.appendChild(card);
    });
}

async function loadSections() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/sections`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const sections = await response.json();
            displaySections(sections);
            document.getElementById('sections-count').textContent = sections.length;
        }
    } catch (error) {
        console.error('Error loading sections:', error);
    }
}

function displaySections(sections) {
    const list = document.getElementById('sections-list');
    list.innerHTML = '';

    if (sections.length === 0) {
        list.innerHTML = '<p class="text-muted">No sections yet</p>';
        return;
    }

    sections.forEach(section => {
        const actionBtns = userRole === 'teacher' ? `
            <div>
                <button class="btn btn-sm btn-warning" onclick="editSection('${section.id}')">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteSection('${section.id}')">
                    <i class="bi bi-trash"></i>
                </button>
            </div>` : '';

        const card = document.createElement('div');
        card.className = 'card mb-3';
        card.innerHTML = `
            <div class="card-header">
                <div class="d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">${escapeHtml(section.title)}</h5>
                    ${actionBtns}
                </div>
            </div>
            <div class="card-body">
                <div style="white-space: pre-wrap;">${escapeHtml(section.content)}</div>
            </div>
        `;
        list.appendChild(card);
    });
}

async function loadCalendar() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/calendar`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const calendar = await response.json();
            document.getElementById('google-calendar-id').value = calendar.googleCalendarId;
            displayCalendar(calendar.googleCalendarId);
        }
    } catch (error) {
        console.error('Error loading calendar:', error);
    }
}

function displayCalendar(calendarId) {
    const preview = document.getElementById('calendar-preview');
    const iframe = document.getElementById('calendar-iframe');

    if (calendarId) {
        iframe.src = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(calendarId)}&ctz=Europe/Madrid`;
        preview.classList.remove('hidden');
    }
}

let currentEditingModuleId = null;

function addCoursField(courseName = '', courseUrl = '', courseDuration = 1, courseOffset = 0) {
    const container = document.getElementById('courses-container');
    const courseItem = document.createElement('div');
    courseItem.className = 'course-item mb-3 p-2 border rounded bg-white';

    // Reverse calculate UI values from stored values (force Number to avoid string concat)
    const semanaInicio = Number(courseOffset) + 1;
    const semanaFinal = Number(courseOffset) + Number(courseDuration);

    courseItem.innerHTML = `
        <div class="row align-items-end g-2">
            <div class="col-md-4">
                <label class="form-label form-label-sm">Nombre Curso</label>
                <input type="text" class="form-control form-control-sm course-name" placeholder="e.g., JavaScript Basics" value="${escapeHtml(courseName)}" required />
            </div>
            <div class="col-md-3">
                <label class="form-label form-label-sm">URL (opt)</label>
                <input type="url" class="form-control form-control-sm course-url" placeholder="https://..." value="${escapeHtml(courseUrl)}" />
            </div>
            <div class="col-md-2">
                <label class="form-label form-label-sm">Semana Inicio</label>
                <input type="number" class="form-control form-control-sm course-start-week" min="1" value="${semanaInicio}" required />
            </div>
            <div class="col-md-2">
                <label class="form-label form-label-sm">Semana Final</label>
                <input type="number" class="form-control form-control-sm course-end-week" min="1" value="${semanaFinal}" required />
            </div>
            <div class="col-md-1 text-end">
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeCoursField(this)">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>
    `;
    container.appendChild(courseItem);
}

function removeCoursField(button) {
    button.closest('.course-item').remove();
}

function addProjectField(projectName = '', projectUrl = '', projectDuration = 1, projectOffset = 0, projectCompetenceIds = []) {
    const container = document.getElementById('projects-container');
    const projectItem = document.createElement('div');
    projectItem.className = 'project-item mb-3 p-2 border rounded bg-white';

    // Reverse calculate UI values from stored values (force Number to avoid string concat)
    const semanaInicio = Number(projectOffset) + 1;
    const semanaFinal = Number(projectOffset) + Number(projectDuration);

    projectItem.innerHTML = `
        <div class="row align-items-end g-2">
            <div class="col-md-4">
                <label class="form-label form-label-sm">Nombre Proyecto</label>
                <input type="text" class="form-control form-control-sm project-name" placeholder="e.g., Build a Todo App" value="${escapeHtml(projectName)}" required />
            </div>
            <div class="col-md-3">
                <label class="form-label form-label-sm">URL (opt)</label>
                <input type="url" class="form-control form-control-sm project-url" placeholder="https://github.com/..." value="${escapeHtml(projectUrl)}" />
            </div>
            <div class="col-md-2">
                <label class="form-label form-label-sm">Semana Inicio</label>
                <input type="number" class="form-control form-control-sm project-start-week" min="1" value="${semanaInicio}" required />
            </div>
            <div class="col-md-2">
                <label class="form-label form-label-sm">Semana Final</label>
                <input type="number" class="form-control form-control-sm project-end-week" min="1" value="${semanaFinal}" required />
            </div>
            <div class="col-md-1 text-end">
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeProjectField(this)">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>
        <div class="mt-2">
            <div class="d-flex align-items-center gap-2">
                <button type="button" class="btn btn-xs btn-outline-warning py-0 px-2" style="font-size:0.75rem;"
                    onclick="openProjectCompetencePicker(this)">
                    <i class="bi bi-award me-1"></i>Competencias
                    <span class="badge bg-warning text-dark ms-1 project-comp-badge">${projectCompetenceIds.length || 0}</span>
                </button>
                <small class="text-muted project-comp-labels fst-italic"></small>
            </div>
            <input type="hidden" class="project-competence-ids" value="${escapeHtml(JSON.stringify(projectCompetenceIds))}">
        </div>
    `;
    container.appendChild(projectItem);

    // If we already have competence IDs, render the labels
    if (projectCompetenceIds.length) {
        _updateProjectCompetenceLabels(projectItem, projectCompetenceIds);
    }
}

function removeProjectField(button) {
    button.closest('.project-item').remove();
}

// ─── Helper: update the competence labels shown next to a project row ────────
function _updateProjectCompetenceLabels(projectItem, competenceIds) {
    const labelEl = projectItem.querySelector('.project-comp-labels');
    const badgeEl = projectItem.querySelector('.project-comp-badge');
    if (!labelEl || !badgeEl) return;

    const programComps = window.ProgramCompetences ? window.ProgramCompetences.getCompetences() : (window._extendedInfoCompetences || []);
    if (!competenceIds.length) {
        labelEl.textContent = '';
        badgeEl.textContent = '0';
        return;
    }
    const names = competenceIds.map(id => {
        const c = programComps.find(c => c.id == id);
        return c ? c.name : `#${id}`;
    });
    badgeEl.textContent = competenceIds.length;
    labelEl.textContent = names.join(', ');
}

// ─── Opens the competence picker popover for a project row ───────────────────
function openProjectCompetencePicker(btn) {
    const projectItem = btn.closest('.project-item');
    const hiddenInput = projectItem.querySelector('.project-competence-ids');
    let currentIds = [];
    try { currentIds = JSON.parse(hiddenInput.value || '[]'); } catch (e) { currentIds = []; }

    // Remove any existing picker
    document.getElementById('project-comp-picker')?.remove();

    const programComps = window.ProgramCompetences ? window.ProgramCompetences.getCompetences() : (window._extendedInfoCompetences || []);

    if (!programComps.length) {
        alert('No hay competencias añadidas al programa. Ve a Contenido del Programa → Competencias para añadirlas primero.');
        return;
    }

    const checkboxes = programComps.map((c, i) => {
        const checked = currentIds.includes(c.id) ? 'checked' : '';
        const safeId = `pcp-${i}`;
        return `<div class="form-check py-1 border-bottom">
            <input class="form-check-input pcp-check" type="checkbox" value="${escapeHtml(String(c.id))}" id="${safeId}" ${checked}>
            <label class="form-check-label small" for="${safeId}">
                <span class="badge bg-secondary me-1" style="font-size:.65rem;">${escapeHtml(c.area || '')}</span>
                ${escapeHtml(c.name)}
            </label>
        </div>`;
    }).join('');

    const picker = document.createElement('div');
    picker.id = 'project-comp-picker';
    picker.className = 'card shadow border position-absolute';
    picker.style.cssText = 'z-index:9999; min-width:320px; max-width:400px; max-height:320px; overflow-y:auto;';
    picker.innerHTML = `
        <div class="card-header py-2 px-3 d-flex justify-content-between align-items-center bg-light">
            <strong class="small"><i class="bi bi-award me-1"></i>Competencias de este proyecto</strong>
            <button type="button" class="btn-close btn-sm" onclick="document.getElementById('project-comp-picker')?.remove()"></button>
        </div>
        <div class="card-body py-2 px-3">
            <p class="text-muted small mb-2">Selecciona las competencias que se evaluarán en este proyecto:</p>
            ${checkboxes}
        </div>
        <div class="card-footer py-2 px-3 d-flex gap-2">
            <button type="button" class="btn btn-sm btn-primary flex-grow-1" onclick="saveProjectCompetencePicker()">
                <i class="bi bi-check-lg me-1"></i>Aplicar
            </button>
            <button type="button" class="btn btn-sm btn-secondary" onclick="document.getElementById('project-comp-picker')?.remove()">Cancelar</button>
        </div>`;

    // Store reference to projectItem for save
    picker._targetProjectItem = projectItem;
    document.body.appendChild(picker);

    // Position near the button
    const rect = btn.getBoundingClientRect();
    const pickerH = 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow > pickerH ? rect.bottom + window.scrollY + 4 : rect.top + window.scrollY - pickerH - 4;
    picker.style.top = `${top}px`;
    picker.style.left = `${Math.min(rect.left + window.scrollX, window.innerWidth - 420)}px`;

    // Close on outside click
    setTimeout(() => {
        document.addEventListener('click', _closePicker, { once: true });
    }, 50);
}

function _closePicker(e) {
    const picker = document.getElementById('project-comp-picker');
    if (picker && !picker.contains(e.target)) picker.remove();
}

function saveProjectCompetencePicker() {
    const picker = document.getElementById('project-comp-picker');
    if (!picker || !picker._targetProjectItem) return;

    const selectedIds = [...picker.querySelectorAll('.pcp-check:checked')].map(cb => {
        const n = parseInt(cb.value);
        return isNaN(n) ? cb.value : n;
    });

    const projectItem = picker._targetProjectItem;
    const hiddenInput = projectItem.querySelector('.project-competence-ids');
    hiddenInput.value = JSON.stringify(selectedIds);
    _updateProjectCompetenceLabels(projectItem, selectedIds);
    picker.remove();
}

// Píldoras UI
function addPildoraField(title = '', type = 'individual') {
    const container = document.getElementById('pildoras-container');
    const item = document.createElement('div');
    item.className = 'pildora-item mb-3 p-2 border rounded bg-white';
    item.innerHTML = `
        <div class="row align-items-end g-2">
            <div class="col-md-6">
                <label class="form-label form-label-sm">Título de la Píldora</label>
                <input type="text" class="form-control form-control-sm pildora-title" placeholder="e.g., Intro a Node.js" value="${escapeHtml(title)}" required />
            </div>
            <div class="col-md-4">
                <label class="form-label form-label-sm">Tipo</label>
                <select class="form-select form-select-sm pildora-type">
                    <option value="individual" ${type === 'individual' ? 'selected' : ''}>Individual</option>
                    <option value="couple" ${type === 'couple' ? 'selected' : ''}>Pareja</option>
                </select>
            </div>
            <div class="col-md-2 text-end">
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="removePildoraField(this)">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>
    `;
    container.appendChild(item);
}

function removePildoraField(button) {
    button.closest('.pildora-item').remove();
}

function setupForms() {
    // Module form
    document.getElementById('module-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('module-name').value;
        const duration = parseInt(document.getElementById('module-duration').value);

        // Collect courses with URLs, duration, and offset (calculated from semana inicio/final)
        const courses = [];
        document.querySelectorAll('#courses-container .course-item').forEach(item => {
            const courseName = item.querySelector('.course-name')?.value || '';
            const courseUrl = item.querySelector('.course-url')?.value || '';
            const valInicio = item.querySelector('.course-start-week')?.value;
            const valFinal = item.querySelector('.course-end-week')?.value;

            const semanaInicio = parseInt(valInicio) || 1;
            const semanaFinal = parseInt(valFinal) || 1;

            const startOffset = Math.max(0, semanaInicio - 1);
            const duration = Math.max(1, semanaFinal - semanaInicio + 1);

            if (courseName) {
                courses.push({ name: courseName, url: courseUrl, duration: Number(duration), startOffset: Number(startOffset) });
            }
        });

        // Collect projects with URLs, duration, and offset
        const projects = [];
        document.querySelectorAll('#projects-container .project-item').forEach(item => {
            const projectName = item.querySelector('.project-name')?.value || '';
            const projectUrl = item.querySelector('.project-url')?.value || '';
            const valInicio = item.querySelector('.project-start-week')?.value;
            const valFinal = item.querySelector('.project-end-week')?.value;

            const semanaInicio = parseInt(valInicio) || 1;
            const semanaFinal = parseInt(valFinal) || 1;

            const startOffset = Math.max(0, semanaInicio - 1);
            const duration = Math.max(1, semanaFinal - semanaInicio + 1);

            let competenceIds = [];
            try { competenceIds = JSON.parse(item.querySelector('.project-competence-ids')?.value || '[]'); } catch (e) { competenceIds = []; }

            if (projectName) {
                projects.push({ name: projectName, url: projectUrl, duration: Number(duration), startOffset: Number(startOffset), competenceIds });
            }
        });

        // Collect pildoras
        const pildoras = [];
        document.querySelectorAll('#pildoras-container .pildora-item').forEach(item => {
            const title = item.querySelector('.pildora-title')?.value || '';
            const type = item.querySelector('.pildora-type')?.value || 'individual';
            if (title) {
                pildoras.push({ title, type, assignedStudentIds: [] });
            }
        });

        const token = localStorage.getItem('token');

        try {
            // Check if we're editing an existing module
            if (currentEditingModuleId) {
                // Update existing module
                const promotionResponse = await fetch(`${API_URL}/api/promotions/${promotionId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!promotionResponse.ok) {
                    alert('Error loading promotion data');
                    return;
                }

                const promotion = await promotionResponse.json();
                const moduleIndex = promotion.modules.findIndex(m => m.id === currentEditingModuleId);

                if (moduleIndex === -1) {
                    alert('Module not found');
                    return;
                }

                // Update the module while preserving its ID and creation date
                promotion.modules[moduleIndex] = {
                    ...promotion.modules[moduleIndex],
                    name,
                    duration,
                    courses,
                    projects,
                    pildoras: pildoras.length > 0 ? pildoras : (promotion.modules[moduleIndex].pildoras || [])
                };

                const updateResponse = await fetch(`${API_URL}/api/promotions/${promotionId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(promotion)
                });

                if (updateResponse.ok) {
                    moduleModal.hide();
                    document.getElementById('module-form').reset();
                    currentEditingModuleId = null;
                    loadModules();
                    loadPromotion();
                    alert('Module updated successfully');
                } else {
                    const error = await updateResponse.json();
                    alert(`Error: ${error.error || 'Failed to update module'}`);
                }
            } else {
                // Create new module
                const response = await fetch(`${API_URL}/api/promotions/${promotionId}/modules`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ name, duration, courses, projects, pildoras })
                });

                if (response.ok) {
                    moduleModal.hide();
                    document.getElementById('module-form').reset();
                    currentEditingModuleId = null;
                    loadModules();
                    loadPromotion();
                    alert('Module created successfully');
                } else {
                    const error = await response.json();
                    alert(`Error: ${error.error || 'Failed to save module'}`);
                }
            }
        } catch (error) {
            console.error('Error saving module:', error);
            alert('Error saving module');
        }
    });

    // Quick link form
    document.getElementById('quick-link-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('link-name').value;
        const url = document.getElementById('link-url').value;
        const platform = document.getElementById('link-platform').value || 'custom';

        const token = localStorage.getItem('token');

        try {
            const response = await fetch(`${API_URL}/api/promotions/${promotionId}/quick-links`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name, url, platform })
            });

            if (response.ok) {
                quickLinkModal.hide();
                document.getElementById('quick-link-form').reset();
                loadQuickLinks();
            }
        } catch (error) {
            console.error('Error adding quick link:', error);
        }
    });

    // Section form
    document.getElementById('section-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = document.getElementById('section-title').value;
        const content = document.getElementById('section-content').value;

        const token = localStorage.getItem('token');

        try {
            const response = await fetch(`${API_URL}/api/promotions/${promotionId}/sections`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ title, content })
            });

            if (response.ok) {
                sectionModal.hide();
                document.getElementById('section-form').reset();
                loadSections();
                loadPromotion();
            }
        } catch (error) {
            console.error('Error adding section:', error);
        }
    });

    // Calendar form
    document.getElementById('calendar-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const googleCalendarId = document.getElementById('google-calendar-id').value;

        if (!googleCalendarId) {
            alert('Please enter a Google Calendar ID');
            return;
        }

        const token = localStorage.getItem('token');

        try {
            const response = await fetch(`${API_URL}/api/promotions/${promotionId}/calendar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ googleCalendarId })
            });

            if (response.ok) {
                displayCalendar(googleCalendarId);
                alert('Calendar saved successfully!');
            }
        } catch (error) {
            console.error('Error saving calendar:', error);
        }
    });

    // Student form
    document.getElementById('student-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('student-name').value;
        const lastname = document.getElementById('student-lastname').value;
        const email = document.getElementById('student-email').value;
        const phone = document.getElementById('student-phone').value;
        const age = document.getElementById('student-age').value;
        const administrativeSituation = document.getElementById('student-admin-situation').value;
        const nationality = document.getElementById('student-nationality').value;
        const identificationDocument = document.getElementById('student-document').value;
        const gender = document.getElementById('student-gender').value;
        const englishLevel = document.getElementById('student-english-level').value;
        const educationLevel = document.getElementById('student-education-level').value;
        const profession = document.getElementById('student-profession').value;
        const community = document.getElementById('student-community').value;

        // Check if we're editing an existing student
        const editingStudentId = document.getElementById('student-form').dataset.editingStudentId;

        const token = localStorage.getItem('token');

        const studentData = {
            name,
            lastname,
            email,
            phone,
            age: age ? parseInt(age) : null,
            administrativeSituation,
            nationality,
            identificationDocument,
            gender,
            englishLevel,
            educationLevel,
            profession,
            community
        };

        console.log('Sending student data:', studentData);

        try {
            let response;

            if (editingStudentId) {
                // Update existing student using the /profile endpoint which works reliably
                response = await fetch(`${API_URL}/api/promotions/${promotionId}/students/${editingStudentId}/profile`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(studentData)
                });
            } else {
                // Create new student
                response = await fetch(`${API_URL}/api/promotions/${promotionId}/students`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(studentData)
                });
            }

            if (response.ok) {
                const data = await response.json();
                studentModal.hide();
                document.getElementById('student-form').reset();
                delete document.getElementById('student-form').dataset.editingStudentId;
                loadStudents();

                const action = editingStudentId ? 'updated' : 'added';
                alert(`Student ${action} successfully!`);
            } else {
                console.error('Response status:', response.status);
                console.error('Response headers:', response.headers);
                let errorMessage = 'Unknown error';

                // Clone the response so we can read it multiple times if needed
                const responseClone = response.clone();

                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    // If response is not JSON (like HTML error page), get text from the clone
                    try {
                        const errorText = await responseClone.text();
                        console.error('Error response text:', errorText.substring(0, 200));
                        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                    } catch (textError) {
                        console.error('Could not read response text:', textError);
                        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                    }
                }

                alert(`Error ${editingStudentId ? 'updating' : 'adding'} student: ${errorMessage}`);
            }
        } catch (error) {
            console.error(`Error ${editingStudentId ? 'updating' : 'adding'} student:`, error);
            alert(`Error ${editingStudentId ? 'updating' : 'adding'} student`);
        }
    });
}

// ==================== STUDENT MANAGEMENT FUNCTIONS ====================
async function importStudentsFromExcel(input) {
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const formData = new FormData();
    formData.append('excelFile', file);

    const token = localStorage.getItem('token');

    const btn = document.querySelector('button[onclick*="students-excel-input"]');
    const originalBtnContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Importando...';

    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/students/upload-excel`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            let msg = result.message || 'Importación completada';
            if (result.errors && result.errors.length) {
                msg += '\n\nErrores:\n' + result.errors.join('\n');
            }
            if (result.skipped && result.skipped.length) {
                msg += '\n\nOmitidos (ya existían):\n' + result.skipped.join('\n');
            }
            alert(msg);
            loadStudents();
        } else {
            alert(`Error al importar: ${result.error || 'Error desconocido'}`);
        }
    } catch (error) {
        console.error('Error importing students:', error);
        alert('Error al importar estudiantes desde Excel');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalBtnContent;
        input.value = '';
    }
}

// Download a blank Excel template with the correct column headers for student import
function downloadStudentsExcelTemplate() {
    const headers = [
        'Nombre', 'Apellidos', 'Email', 'Teléfono', 'Edad',
        'Situación Administrativa', 'Nacionalidad', 'Documento',
        'Sexo', 'Nivel Inglés', 'Nivel Educativo', 'Profesión', 'Comunidad'
    ];
    // Add a hint row showing accepted values for enum columns
    const hints = [
        '(requerido)', '(requerido)', '(requerido)', '(requerido)', '(requerido, número)',
        'nacional | solicitante_asilo | ciudadano_europeo | permiso_trabajo | no_permiso_trabajo | otro',
        '', 'DNI / NIE / Pasaporte',
        'mujer | hombre | no_binario | no_especifica',
        'A1 | A2 | B1 | B2 | C1 | C2',
        'sin_estudios | eso | bachillerato | fp_medio | fp_superior | grado | postgrado | doctorado',
        '', 'Comunidad Autónoma'
    ];

    // Build CSV content (no XLSX library on the client side — CSV opens fine in Excel)
    const escape = v => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [
        headers.map(escape).join(','),
        hints.map(escape).join(',')
    ];
    const csvContent = rows.join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel UTF-8
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plantilla_importar_estudiantes.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}


// Debug function to test student endpoints
async function debugStudentEndpoints() {
    console.log('=== TESTING STUDENT ENDPOINTS ===');
    const token = localStorage.getItem('token');

    if (!window.currentStudents || window.currentStudents.length === 0) {
        console.log('No students available for testing');
        return;
    }

    const student = window.currentStudents[0];
    console.log('Testing with student:', student);
    console.log('Student fields present:', {
        id: !!student.id,
        name: !!student.name,
        lastname: !!student.lastname,
        email: !!student.email,
        age: !!student.age,
        nationality: !!student.nationality,
        profession: !!student.profession,
        address: !!student.address
    });

    // Test GET endpoint
    try {
        const getResponse = await fetch(`${API_URL}/api/promotions/${promotionId}/students/${student.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('GET /students/:id status:', getResponse.status);
        if (getResponse.ok) {
            const studentData = await getResponse.json();
            console.log('GET student data:', studentData);
        }
    } catch (error) {
        console.log('GET /students/:id error:', error.message);
    }

    // Test PUT /profile endpoint
    try {
        const testData = {
            name: student.name || 'Test Name',
            lastname: student.lastname || 'Test Lastname',
            email: student.email,
            age: student.age || 25,
            nationality: student.nationality || 'Test Nationality',
            profession: student.profession || 'Test Profession',
            address: student.address || 'Test Address'
        };

        console.log('Testing PUT with data:', testData);

        const putResponse = await fetch(`${API_URL}/api/promotions/${promotionId}/students/${student.id}/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(testData)
        });

        console.log('PUT /students/:id/profile status:', putResponse.status);
        if (putResponse.ok) {
            const updatedData = await putResponse.json();
            console.log('✓ Profile endpoint works!');
            console.log('Updated student data:', updatedData);
        } else {
            const errorText = await putResponse.text();
            console.log('PUT error response:', errorText);
        }
    } catch (error) {
        console.log('PUT /students/:id/profile error:', error.message);
    }
}

// Load and display students for the promotion
async function loadStudents(retryCount = 0) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/students`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            // On a brand-new promotion the server may not have committed the record yet — retry once with short backoff
            if (response.status === 404 && retryCount < 1) {
                await new Promise(resolve => setTimeout(resolve, 600));
                return loadStudents(retryCount + 1);
            }
            // For any other error just log silently — don't block the page with an alert
            console.warn(`loadStudents: HTTP ${response.status}`);
            const studentsContainer = document.getElementById('students-list');
            if (studentsContainer) {
                studentsContainer.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No se pudo cargar la lista de estudiantes.</td></tr>';
            }
            return;
        }

        const students = await response.json();
        console.log('Loaded students:', students);

        // Store students data globally for multi-select operations
        // Backend already normalizes the ID field, so we can use it directly
        window.currentStudents = students;
        displayStudents(window.currentStudents);
    } catch (error) {
        console.error('Error loading students:', error);
        // Never show a blocking alert during page load — just display inline message
        const studentsContainer = document.getElementById('students-list');
        if (studentsContainer) {
            studentsContainer.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Error al cargar estudiantes.</td></tr>';
        }
    }
}

// Display students in a table format for better readability
function displayStudents(students) {
    const studentsContainer = document.getElementById('students-list');
    if (!studentsContainer) {
        console.warn('Students container not found');
        return;
    }

    if (!students || students.length === 0) {
        studentsContainer.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No students registered yet.</td></tr>';
        return;
    }

    studentsContainer.innerHTML = students.map((student, index) => `
        <tr>
            <td>
                <input type="checkbox" class="form-check-input student-checkbox" 
                       data-student-id="${student.id}" 
                       onchange="updateSelectionState()">
            </td>
            <td>
                <div class="fw-bold">${student.name || student.lastname ? studentFullName(student) : 'N/A'}</div>
            </td>
            <td>${student.email || 'N/A'}</td>
            <td>${student.nationality || 'N/A'}</td>
            <td>${student.profession || 'N/A'}</td>
            <td class="text-end">
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-success" onclick="window.StudentTracking?.openFicha('${student.id}')" title="Ficha de Seguimiento">
                        <i class="bi bi-person-lines-fill"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="window.Reports?.printTechnical('${student.id}', promotionId)" title="PDF Seguimiento Técnico">
                        <i class="bi bi-file-earmark-bar-graph"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="window.Reports?.printTransversal('${student.id}', promotionId)" title="PDF Seguimiento Transversal">
                        <i class="bi bi-file-earmark-person"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteStudent('${student.id}', '${student.email}')" title="Delete">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    updateSelectionState();
}

// Delete individual student
async function deleteStudent(studentId, studentEmail) {
    if (!confirm(`Are you sure you want to delete student ${studentEmail}?`)) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/students/${studentId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            alert('Student deleted successfully');
            loadStudents();
        } else {
            alert('Error deleting student');
        }
    } catch (error) {
        console.error('Error deleting student:', error);
        alert('Error deleting student');
    }
}

// Edit student - populate form with existing data
function editStudent(studentId) {
    const student = window.currentStudents?.find(s => s.id === studentId);
    if (!student) {
        alert('Student not found');
        return;
    }

    // Populate the form with existing data
    document.getElementById('student-name').value = student.name || '';
    document.getElementById('student-lastname').value = student.lastname || '';
    document.getElementById('student-email').value = student.email || '';
    document.getElementById('student-phone').value = student.phone || '';
    document.getElementById('student-age').value = student.age || '';
    document.getElementById('student-admin-situation').value = student.administrativeSituation || '';
    document.getElementById('student-nationality').value = student.nationality || '';
    document.getElementById('student-document').value = student.identificationDocument || '';
    document.getElementById('student-gender').value = student.gender || '';
    document.getElementById('student-english-level').value = student.englishLevel || '';
    document.getElementById('student-education-level').value = student.educationLevel || '';
    document.getElementById('student-profession').value = student.profession || '';
    document.getElementById('student-community').value = student.community || '';

    // Store the student ID for updating
    document.getElementById('student-form').dataset.editingStudentId = studentId;

    // Update modal title
    const modalTitle = document.querySelector('#studentModal .modal-title');
    if (modalTitle) modalTitle.textContent = 'Edit Student';

    // Show the modal
    studentModal.show();
}

// Export all students as CSV
function exportStudentsToCSV(students, filename) {
    const rows = [];
    rows.push(['Nombre', 'Apellidos', 'Email', 'Teléfono', 'Edad', 'Situación Administrativa',
        'Nacionalidad', 'Documento', 'Sexo', 'Nivel Inglés', 'Nivel Educativo', 'Profesión', 'Comunidad'].join(','));

    students.forEach(student => {
        const escape = v => `"${(v || '').toString().replace(/"/g, '""')}"`;
        rows.push([
            escape(student.name),
            escape(student.lastname),
            escape(student.email),
            escape(student.phone),
            student.age || '',
            escape(student.administrativeSituation),
            escape(student.nationality),
            escape(student.identificationDocument),
            escape(student.gender),
            escape(student.englishLevel),
            escape(student.educationLevel),
            escape(student.profession),
            escape(student.community)
        ].join(','));
    });

    const csvContent = rows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Export all students
function exportAllStudentsCSV() {
    const students = window.currentStudents || [];
    if (students.length === 0) {
        alert('No students to export.');
        return;
    }
    exportStudentsToCSV(students, `all-students-promotion-${promotionId}.csv`);
}

const platformIcons = {
    'zoom': { name: 'Zoom', icon: 'bi-camera-video', color: '#2D8CFF' },
    'discord': { name: 'Discord', icon: 'bi-discord', color: '#5865F2' },
    'classroom': { name: 'Google Classroom', icon: 'bi-google', color: '#EA4335' },
    'github': { name: 'GitHub', icon: 'bi-github', color: '#333' },
    'custom': { name: 'Link', icon: 'bi-link', color: '#667eea' }
};

function updateLinkName() {
    const platform = document.getElementById('link-platform').value;
    const nameInput = document.getElementById('link-name');

    if (platform && platform !== 'custom' && platformIcons[platform]) {
        nameInput.value = platformIcons[platform].name;
        // nameInput.readOnly = true; // User requested ability to change name
    } else {
        // nameInput.readOnly = false;
        if (platform === 'custom') {
            nameInput.value = '';
        }
    }
}

function openModuleModal() {
    document.getElementById('module-form').reset();
    document.getElementById('moduleModalTitle').textContent = 'Add Module';
    document.getElementById('courses-container').innerHTML = '';
    document.getElementById('projects-container').innerHTML = '';
    currentEditingModuleId = null;

    // Add one empty course field to start
    addCoursField();
    // Add one empty project field to start
    addProjectField();

    moduleModal.show();
}

function openQuickLinkModal() {
    document.getElementById('quick-link-form').reset();
    document.getElementById('link-platform').value = '';
    document.getElementById('link-name').readOnly = false;
    quickLinkModal.show();
}

function openSectionModal() {
    document.getElementById('section-form').reset();
    sectionModal.show();
}

function openStudentModal() {
    document.getElementById('student-form').reset();

    // Clear any editing state
    delete document.getElementById('student-form').dataset.editingStudentId;

    // Update modal title
    const modalTitle = document.querySelector('#studentModal .modal-title');
    if (modalTitle) modalTitle.textContent = 'Add Student';

    studentModal.show();
}

async function deleteQuickLink(linkId) {
    if (!confirm('Are you sure?')) return;

    const token = localStorage.getItem('token');

    try {
        await fetch(`${API_URL}/api/promotions/${promotionId}/quick-links/${linkId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadQuickLinks();
    } catch (error) {
        console.error('Error deleting link:', error);
    }
}

function openDeletePromotionModal() {
    if (!deletePromotionModal) {
        const el = document.getElementById('deletePromotionModal');
        if (!el) return;
        deletePromotionModal = new bootstrap.Modal(el);
    }
    const input = document.getElementById('delete-promotion-confirm-input');
    if (input) {
        input.value = '';
        input.focus();
    }
    deletePromotionModal.show();
}

async function confirmDeletePromotion() {
    const input = document.getElementById('delete-promotion-confirm-input');
    if (!input || input.value.trim().toUpperCase() !== 'ELIMINAR') {
        alert('Para confirmar, escribe exactamente "ELIMINAR".');
        return;
    }

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            if (deletePromotionModal) {
                deletePromotionModal.hide();
            }
            window.location.href = 'dashboard.html';
        } else {
            alert('Error al eliminar la promoción');
        }
    } catch (error) {
        console.error('Error deleting promotion:', error);
        alert('Error al eliminar la promoción');
    }
}

async function deleteSection(sectionId) {
    if (!confirm('Are you sure?')) return;

    const token = localStorage.getItem('token');

    try {
        await fetch(`${API_URL}/api/promotions/${promotionId}/sections/${sectionId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadSections();
        loadPromotion();
    } catch (error) {
        console.error('Error deleting section:', error);
    }
}

async function previewPromotion() {
    // Generate the same link as Access Settings
    const baseUrl = window.location.origin;
    const isLiveServer = window.location.port === '5500' || window.location.hostname === '127.0.0.1';
    const isGitHubPages = window.location.hostname.includes('github.io');

    let path;
    if (isLiveServer) {
        path = '/public/public-promotion.html';
    } else if (isGitHubPages) {
        const pathParts = window.location.pathname.split('/');
        const repoName = pathParts[1];
        path = `/${repoName}/public-promotion.html`;
    } else {
        path = '/public-promotion.html';
    }

    let previewLink = `${baseUrl}${path}?id=${promotionId}&preview=1`;

    // Try to get the password to auto-verify access
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const promotion = await response.json();
            if (promotion.accessPassword) {
                // Include password in URL for auto-verification
                previewLink += `&pwd=${encodeURIComponent(promotion.accessPassword)}`;
            }
        }
    } catch (error) {
        console.error('Error loading promotion for preview:', error);
    }

    // Open in a new window
    window.open(previewLink, '_blank');
}

// Check role on load to hide elements if actual student
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const role = localStorage.getItem('role');
        if (role === 'student') {
            document.body.classList.add('student-view');
            // Remove the preview button
            const previewBtn = document.querySelector('button[onclick="previewPromotion()"]');
            if (previewBtn) previewBtn.remove();

            // Hide Add buttons and Students tab via CSS
            const style = document.createElement('style');
            style.innerHTML = `
                .btn-primary, .btn-danger, .btn-outline-danger, 
                a[href="#students"] { display: none !important; }
                #students-tab { display: none !important; } 
            `;
            document.head.appendChild(style);

            // Hide the students nav item specifically
            const studentsLink = document.querySelector('a[href="#students"]');
            if (studentsLink && studentsLink.parentElement) {
                studentsLink.parentElement.style.display = 'none';
            }
        }
    }, 100);
});

// ==================== COLLABORATORS ====================

// ==================== COLLABORATORS ====================

async function loadCollaborators() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/collaborators`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const collaborators = await response.json();
            _currentCollabModulesList = collaborators;
            displayCollaborators(collaborators);
        }
    } catch (error) {
        console.error('Error loading collaborators:', error);
    }
}

async function displayCollaborators(collaborators) {
    const tbody = document.getElementById('collaborators-list-body');
    const listGroup = document.getElementById('collaborators-list');

    if (!tbody && !listGroup) return;

    const isOwner = window.currentPromotion && window.currentPromotion.teacherId === currentUser.id;
    const modules = window.promotionModules || [];
    const roleColors = { 'Formador/a': 'primary', 'CoFormador/a': 'success', 'Coordinador/a': 'warning' };

    const getModuleNames = (moduleIds) => {
        if (!moduleIds || moduleIds.length === 0) return '<span class="text-muted small">—</span>';
        if (modules.length > 0 && moduleIds.length === modules.length) return '<span class="badge bg-secondary">Todos</span>';
        return moduleIds.map(mid => {
            const mod = modules.find(m => m.id === mid);
            return mod ? `<span class="badge bg-light text-dark border me-1">${escapeHtml(mod.name)}</span>` : '';
        }).join('');
    };

    // Update table view
    if (tbody) {
        tbody.innerHTML = '';
        if (collaborators.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No collaborators added yet</td></tr>';
        } else {
            collaborators.forEach(collab => {
                const userRole = collab.userRole || 'Formador/a';
                const badgeColor = roleColors[userRole] || 'secondary';
                const ownerBadge = collab.isOwner ? '<span class="badge bg-dark ms-1">Owner</span>' : '';
                const editModulesBtn = isOwner
                    ? `<button class="btn btn-sm btn-outline-secondary me-1" onclick="openCollaboratorModulesModal('${collab.id}', '${escapeHtml(collab.name)}')" title="Editar módulos"><i class="bi bi-journal-bookmark"></i></button>`
                    : '';
                const removeBtn = (isOwner && !collab.isOwner)
                    ? `<button class="btn btn-sm btn-outline-danger" onclick="removeCollaborator('${collab.id}')" title="Remove collaborator"><i class="bi bi-person-dash"></i></button>`
                    : '';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${escapeHtml(collab.name)} ${ownerBadge}</td>
                    <td><span class="badge bg-${badgeColor}">${escapeHtml(userRole)}</span></td>
                    <td>${escapeHtml(collab.email)}</td>
                    <td>${getModuleNames(collab.moduleIds)}</td>
                    <td class="text-nowrap">${editModulesBtn}${removeBtn || (!isOwner ? '' : '')}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    }

    // Update list-group view
    if (listGroup) {
        listGroup.innerHTML = '';
        if (collaborators.length === 0) {
            listGroup.innerHTML = '<p class="text-muted p-3">No collaborators yet</p>';
        } else {
            collaborators.forEach(teacher => {
                const userRole = teacher.userRole || 'Formador/a';
                const badgeColor = roleColors[userRole] || 'secondary';
                const ownerBadge = teacher.isOwner ? '<span class="badge bg-dark ms-2">Owner</span>' : '';
                const editModulesBtn = isOwner
                    ? `<button class="btn btn-sm btn-outline-secondary me-1" onclick="openCollaboratorModulesModal('${teacher.id}', '${escapeHtml(teacher.name)}')" title="Editar módulos"><i class="bi bi-journal-bookmark"></i></button>`
                    : '';
                const deleteBtn = (isOwner && !teacher.isOwner)
                    ? `<button class="btn btn-sm btn-outline-danger" onclick="removeCollaborator('${teacher.id}')"><i class="bi bi-trash"></i></button>`
                    : '';
                const div = document.createElement('div');
                div.className = 'list-group-item d-flex justify-content-between align-items-center';
                div.innerHTML = `
                    <div>
                        <h6 class="mb-1">${escapeHtml(teacher.name)} ${ownerBadge}</h6>
                        <span class="badge bg-${badgeColor} me-2">${escapeHtml(userRole)}</span>
                        <span class="text-muted small">${escapeHtml(teacher.email)}</span>
                        <div class="mt-1">${getModuleNames(teacher.moduleIds)}</div>
                    </div>
                    <div class="d-flex gap-1">${editModulesBtn}${deleteBtn}</div>
                `;
                listGroup.appendChild(div);
            });
        }
    }
}

let collaboratorModulesModal;
let _currentCollabModulesId = null;
let _currentCollabModulesList = [];

function openCollaboratorModulesModal(collaboratorId, collaboratorName) {
    if (!collaboratorModulesModal) {
        collaboratorModulesModal = new bootstrap.Modal(document.getElementById('collaboratorModulesModal'));
    }
    _currentCollabModulesId = collaboratorId;

    document.getElementById('collab-modules-name').textContent = collaboratorName;

    const modules = window.promotionModules || [];
    const checklist = document.getElementById('collab-modules-checklist');
    checklist.innerHTML = '';

    // Find current module assignments for this person
    const allCollabs = _currentCollabModulesList;
    const entry = allCollabs.find(c => c.id === collaboratorId);
    const selected = entry ? (entry.moduleIds || []) : [];

    if (modules.length === 0) {
        checklist.innerHTML = '<p class="text-muted small">No hay módulos definidos en el roadmap.</p>';
    } else {
        modules.forEach(mod => {
            const checked = selected.includes(mod.id) ? 'checked' : '';
            const div = document.createElement('div');
            div.className = 'form-check';
            div.innerHTML = `
                <input class="form-check-input" type="checkbox" value="${mod.id}" id="collab-mod-${mod.id}" ${checked}>
                <label class="form-check-label" for="collab-mod-${mod.id}">${escapeHtml(mod.name)}</label>
            `;
            checklist.appendChild(div);
        });
    }

    collaboratorModulesModal.show();
}

async function saveCollaboratorModules() {
    const checkboxes = document.querySelectorAll('#collab-modules-checklist .form-check-input:checked');
    const moduleIds = Array.from(checkboxes).map(cb => cb.value);

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/collaborators/${_currentCollabModulesId}/modules`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ moduleIds })
        });
        if (response.ok) {
            collaboratorModulesModal.hide();
            loadCollaborators();
        } else {
            const data = await response.json();
            alert(data.error || 'Error guardando módulos');
        }
    } catch (error) {
        alert('Error de conexión');
    }
}

async function openCollaboratorModal() {
    const select = document.getElementById('collaborator-select');
    if (!select) return;

    // Reset preview
    document.getElementById('collaborator-info-preview').classList.add('d-none');

    // Populate module checkboxes
    const moduleChecklist = document.getElementById('collaborator-module-checklist');
    const modules = window.promotionModules || [];
    if (modules.length === 0) {
        moduleChecklist.innerHTML = '<span class="text-muted small">No hay módulos definidos en el roadmap.</span>';
    } else {
        moduleChecklist.innerHTML = '';
        modules.forEach(mod => {
            const div = document.createElement('div');
            div.className = 'form-check';
            div.innerHTML = `
                <input class="form-check-input" type="checkbox" value="${mod.id}" id="add-collab-mod-${mod.id}">
                <label class="form-check-label" for="add-collab-mod-${mod.id}">${escapeHtml(mod.name)}</label>
            `;
            moduleChecklist.appendChild(div);
        });
    }

    select.innerHTML = '<option value="">Loading users...</option>';
    collaboratorModal.show();

    const token = localStorage.getItem('token');
    try {
        const [teachersRes, collabRes, promoRes] = await Promise.all([
            fetch(`${API_URL}/api/teachers`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${API_URL}/api/promotions/${promotionId}/collaborators`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${API_URL}/api/promotions/${promotionId}`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (teachersRes.ok && collabRes.ok && promoRes.ok) {
            const allTeachers = await teachersRes.json();
            const currentCollaborators = await collabRes.json();
            const promo = await promoRes.json();

            const existingIds = new Set(currentCollaborators.map(c => c.id));

            const available = allTeachers.filter(t =>
                t.id !== currentUser.id &&
                t.id !== promo.teacherId &&
                !existingIds.has(t.id)
            );

            // Store teacher data for preview use
            select._teacherData = {};
            available.forEach(t => { select._teacherData[t.id] = t; });

            if (available.length === 0) {
                select.innerHTML = '<option value="">No other users available</option>';
            } else {
                select.innerHTML = '<option value="">Select a user...</option>';
                available.forEach(t => {
                    const opt = document.createElement('option');
                    opt.value = t.id;
                    opt.textContent = `${t.name} — ${t.userRole || 'Formador/a'} (${t.email})`;
                    select.appendChild(opt);
                });
            }
        }
    } catch (error) {
        console.error('Error loading users:', error);
        if (select) select.innerHTML = '<option value="">Error loading users</option>';
    }
}

function onCollaboratorSelected() {
    const select = document.getElementById('collaborator-select');
    const preview = document.getElementById('collaborator-info-preview');
    const teacher = select._teacherData && select._teacherData[select.value];
    if (!teacher) { preview.classList.add('d-none'); return; }

    const roleColors = { 'Formador/a': 'primary', 'CoFormador/a': 'success', 'Coordinador/a': 'warning' };
    const role = teacher.userRole || 'Formador/a';
    document.getElementById('collab-preview-name').textContent = teacher.name;
    document.getElementById('collab-preview-email').textContent = teacher.email;
    const badge = document.getElementById('collab-preview-role-badge');
    badge.textContent = role;
    badge.className = `badge bg-${roleColors[role] || 'secondary'} mt-1`;
    preview.classList.remove('d-none');
}

async function addCollaboratorById() {
    const teacherId = document.getElementById('collaborator-select').value;
    if (!teacherId) {
        alert('Please select a user');
        return;
    }
    const checked = document.querySelectorAll('#collaborator-module-checklist .form-check-input:checked');
    const moduleIds = Array.from(checked).map(cb => cb.value);
    console.log('[addCollaboratorById] teacherId:', teacherId, 'moduleIds:', moduleIds, 'checked count:', checked.length);
    console.log('[addCollaboratorById] all checkboxes in list:', document.querySelectorAll('#collaborator-module-checklist .form-check-input').length);

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/collaborators`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ teacherId, moduleIds })
        });

        if (response.ok) {
            collaboratorModal.hide();
            loadCollaborators();
            alert('Collaborator added successfully');
        } else {
            const data = await response.json();
            alert(data.error || 'Failed to add collaborator');
        }
    } catch (error) {
        console.error('Error adding collaborator:', error);
        alert('Connection error');
    }
}

async function removeCollaborator(teacherId) {
    if (!confirm('Are you sure you want to remove this collaborator?')) return;

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/collaborators/${teacherId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            loadCollaborators();
            alert('Collaborator removed successfully');
        } else {
            const data = await response.json();
            alert(data.error || 'Failed to remove collaborator');
        }
    } catch (error) {
        console.error('Error removing collaborator:', error);
        alert('Connection error');
    }
}

// ==================== ACCESS SETTINGS ====================

async function loadAccessPassword() {
    if (userRole !== 'teacher') return;

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/access-password`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            const passwordInput = document.getElementById('access-password-input');
            const accessLinkInput = document.getElementById('student-access-link');

            if (passwordInput) {
                passwordInput.value = data.accessPassword || '';
            }

            // Update the access link
            if (accessLinkInput) {
                const baseUrl = window.location.origin;
                // Detect different environments and adjust path accordingly
                const isLiveServer = window.location.port === '5500' || window.location.hostname === '127.0.0.1';
                const isGitHubPages = window.location.hostname.includes('github.io');

                let path;
                if (isLiveServer) {
                    path = '/public/public-promotion.html';
                } else if (isGitHubPages) {
                    // GitHub Pages needs the repository name in the path
                    const pathParts = window.location.pathname.split('/');
                    const repoName = pathParts[1]; // Extract repo name from current path
                    path = `/${repoName}/public-promotion.html`;
                } else {
                    path = '/public-promotion.html';
                }

                accessLinkInput.value = `${baseUrl}${path}?id=${promotionId}`;
            }
        }
    } catch (error) {
        console.error('Error loading access password:', error);
    }

    // Load teaching content
    loadTeachingContent();
}

async function updateAccessPassword() {
    if (userRole !== 'teacher') return;

    const token = localStorage.getItem('token');
    const passwordInput = document.getElementById('access-password-input');
    const alertEl = document.getElementById('password-alert');
    const password = passwordInput ? passwordInput.value.trim() : '';

    try {
        let response;
        if (password) {
            // Set new password
            response = await fetch(`${API_URL}/api/promotions/${promotionId}/access-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ password })
            });
        } else {
            // Remove password protection (if endpoint exists)
            response = await fetch(`${API_URL}/api/promotions/${promotionId}/access-password`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        }

        if (response.ok) {
            if (alertEl) {
                alertEl.className = 'alert alert-success';
                alertEl.textContent = password
                    ? 'Access password updated successfully! Students can now use the link below to access this promotion.'
                    : 'Password protection removed successfully!';
                alertEl.classList.remove('hidden');

                setTimeout(() => {
                    alertEl.classList.add('hidden');
                }, 5000);
            }

            // Update the access link
            const accessLinkInput = document.getElementById('student-access-link');
            if (accessLinkInput) {
                const baseUrl = window.location.origin;
                // Detect different environments and adjust path accordingly
                const isLiveServer = window.location.port === '5500' || window.location.hostname === '127.0.0.1';
                const isGitHubPages = window.location.hostname.includes('github.io');

                let path;
                if (isLiveServer) {
                    path = '/public/public-promotion.html';
                } else if (isGitHubPages) {
                    // GitHub Pages needs the repository name in the path
                    const pathParts = window.location.pathname.split('/');
                    const repoName = pathParts[1]; // Extract repo name from current path
                    path = `/${repoName}/public-promotion.html`;
                } else {
                    path = '/public-promotion.html';
                }

                accessLinkInput.value = `${baseUrl}${path}?id=${promotionId}`;
            }
        } else {
            const data = await response.json();
            if (alertEl) {
                alertEl.className = 'alert alert-danger';
                alertEl.textContent = data.error || 'Error updating password';
                alertEl.classList.remove('hidden');
            }
        }
    } catch (error) {
        console.error('Error updating access password:', error);
        if (alertEl) {
            alertEl.className = 'alert alert-danger';
            alertEl.textContent = 'Connection error. Please try again.';
            alertEl.classList.remove('hidden');
        }
    }
}

function copyAccessLink() {
    const accessLinkInput = document.getElementById('student-access-link');
    if (accessLinkInput && accessLinkInput.value) {
        navigator.clipboard.writeText(accessLinkInput.value).then(() => {
            // Show success feedback
            const copyBtn = document.querySelector('[onclick="copyAccessLink()"]');
            if (copyBtn) {
                const originalText = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="bi bi-check me-2"></i>Copied!';
                copyBtn.classList.add('btn-success');
                copyBtn.classList.remove('btn-outline-secondary');

                setTimeout(() => {
                    copyBtn.innerHTML = originalText;
                    copyBtn.classList.remove('btn-success');
                    copyBtn.classList.add('btn-outline-secondary');
                }, 2000);
            }
        }).catch(err => {
            console.error('Failed to copy link:', err);
            // Fallback selection method
            accessLinkInput.select();
            accessLinkInput.setSelectionRange(0, 99999);
            try {
                document.execCommand('copy');
                alert('Link copied to clipboard!');
            } catch (fallbackErr) {
                alert('Could not copy link. Please copy manually.');
            }
        });
    }
}

// ==================== TEACHING CONTENT FUNCTIONS ====================

async function loadTeachingContent() {
    if (userRole !== 'teacher') return;

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/teaching-content`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            const urlInput = document.getElementById('teaching-content-url');
            const previewBtn = document.getElementById('teaching-content-preview-btn');
            const overviewBtn = document.getElementById('teaching-content-btn');
            const noContentMsg = document.getElementById('no-content-message');
            const removeBtn = document.getElementById('remove-teaching-btn');

            if (data.teachingContentUrl) {
                if (urlInput) {
                    urlInput.value = data.teachingContentUrl;
                }
                if (previewBtn) {
                    previewBtn.href = data.teachingContentUrl;
                    previewBtn.classList.remove('hidden');
                }
                if (overviewBtn) {
                    overviewBtn.href = data.teachingContentUrl;
                    overviewBtn.classList.remove('hidden');
                }
                if (noContentMsg) {
                    noContentMsg.style.display = 'none';
                }
                if (removeBtn) {
                    removeBtn.style.display = 'inline-block';
                }
            } else {
                if (previewBtn) {
                    previewBtn.classList.add('hidden');
                }
                if (overviewBtn) {
                    overviewBtn.classList.add('hidden');
                }
                if (noContentMsg) {
                    noContentMsg.style.display = 'block';
                }
                if (removeBtn) {
                    removeBtn.style.display = 'none';
                }
                if (urlInput) {
                    urlInput.value = '';
                }
            }
        }
    } catch (error) {
        console.error('Error loading teaching content:', error);
    }
}

async function updateTeachingContent() {
    if (userRole !== 'teacher') return;

    const token = localStorage.getItem('token');
    const urlInput = document.getElementById('teaching-content-url');
    const alertEl = document.getElementById('teaching-content-alert');
    const url = urlInput ? urlInput.value.trim() : '';

    if (!url) {
        if (alertEl) {
            alertEl.className = 'alert alert-warning';
            alertEl.textContent = 'Please enter a URL for the teaching content';
            alertEl.classList.remove('hidden');
        }
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/teaching-content`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ teachingContentUrl: url })
        });

        if (response.ok) {
            if (alertEl) {
                alertEl.className = 'alert alert-success';
                alertEl.textContent = 'Teaching content link saved successfully! The button will now appear in the Overview section.';
                alertEl.classList.remove('hidden');

                setTimeout(() => {
                    alertEl.classList.add('hidden');
                }, 5000);
            }

            // Update the preview button
            loadTeachingContent();
        } else {
            const data = await response.json();
            if (alertEl) {
                alertEl.className = 'alert alert-danger';
                alertEl.textContent = data.error || 'Error saving teaching content';
                alertEl.classList.remove('hidden');
            }
        }
    } catch (error) {
        console.error('Error updating teaching content:', error);
        if (alertEl) {
            alertEl.className = 'alert alert-danger';
            alertEl.textContent = 'Connection error. Please try again.';
            alertEl.classList.remove('hidden');
        }
    }
}

async function removeTeachingContent() {
    if (userRole !== 'teacher') return;

    if (!confirm('Are you sure you want to remove the teaching content link?')) {
        return;
    }

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/teaching-content`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const alertEl = document.getElementById('teaching-content-alert');
            if (alertEl) {
                alertEl.className = 'alert alert-success';
                alertEl.textContent = 'Teaching content link removed successfully!';
                alertEl.classList.remove('hidden');

                setTimeout(() => {
                    alertEl.classList.add('hidden');
                }, 5000);
            }

            // Update the UI
            loadTeachingContent();
        } else {
            const data = await response.json();
            alert(data.error || 'Error removing teaching content');
        }
    } catch (error) {
        console.error('Error removing teaching content:', error);
        alert('Connection error. Please try again.');
    }
}

// ==================== STUDENT SELECTION FUNCTIONS ====================

function updateSelectionState() {
    const checkboxes = document.querySelectorAll('.student-checkbox');
    const selectAllCheckboxHeader = document.getElementById('select-all-students-header');
    const selectAllCheckboxControls = document.getElementById('select-all-students');
    const selectedCountEl = document.getElementById('selected-count');
    const selectionControls = document.getElementById('selection-controls');
    const exportSelectedBtn = document.getElementById('export-selected-btn');
    const deleteSelectedBtn = document.getElementById('delete-selected-btn');

    const selectedCheckboxes = document.querySelectorAll('.student-checkbox:checked');
    const selectedCount = selectedCheckboxes.length;
    const totalCount = checkboxes.length;

    // Update selected count display
    if (selectedCountEl) {
        selectedCountEl.textContent = `${selectedCount} selected`;
    }

    // Helper to update checkbox state (including indeterminate)
    const updateCheckbox = (cb) => {
        if (!cb || totalCount === 0) return;
        if (selectedCount === 0) {
            cb.indeterminate = false;
            cb.checked = false;
        } else if (selectedCount === totalCount) {
            cb.indeterminate = false;
            cb.checked = true;
        } else {
            cb.indeterminate = true;
            cb.checked = false;
        }
    };

    updateCheckbox(selectAllCheckboxHeader);
    updateCheckbox(selectAllCheckboxControls);

    // Show/hide selection controls and buttons
    if (selectionControls) {
        selectionControls.style.display = totalCount > 0 ? 'block' : 'none';
    }

    if (exportSelectedBtn) {
        exportSelectedBtn.style.display = selectedCount > 0 ? 'inline-block' : 'none';
    }

    if (deleteSelectedBtn) {
        deleteSelectedBtn.style.display = selectedCount > 0 ? 'inline-block' : 'none';
    }

    const bulkReportsDropdown = document.getElementById('bulk-reports-dropdown');
    if (bulkReportsDropdown) {
        bulkReportsDropdown.style.display = selectedCount > 0 ? 'inline-block' : 'none';
    }
}

function toggleAllStudents(source) {
    const studentCheckboxes = document.querySelectorAll('.student-checkbox');
    const isChecked = source.checked;

    studentCheckboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
    });

    // Sync the other "Select All" checkbox
    const selectAllHeader = document.getElementById('select-all-students-header');
    const selectAllControls = document.getElementById('select-all-students');

    if (source === selectAllHeader && selectAllControls) selectAllControls.checked = isChecked;
    if (source === selectAllControls && selectAllHeader) selectAllHeader.checked = isChecked;

    updateSelectionState();
}

// Export selected students to CSV
function exportSelectedStudentsCsv() {
    const selectedCheckboxes = document.querySelectorAll('.student-checkbox:checked');
    const selectedStudentIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.studentId);

    if (selectedStudentIds.length === 0) {
        alert('No students selected for export.');
        return;
    }

    const selectedStudents = window.currentStudents?.filter(student =>
        selectedStudentIds.includes(student.id)
    ) || [];

    if (selectedStudents.length === 0) {
        alert('Selected students not found.');
        return;
    }

    exportStudentsToCSV(selectedStudents, `selected-students-promotion-${promotionId}.csv`);
}

// ── Bulk PDF Report helpers ───────────────────────────────────────────────────
function _getSelectedStudentIds() {
    return Array.from(document.querySelectorAll('.student-checkbox:checked'))
        .map(cb => cb.dataset.studentId);
}

function _bulkReportTechnical() {
    const ids = _getSelectedStudentIds();
    if (!ids.length) { alert('Selecciona al menos un estudiante.'); return; }
    window.Reports?.printBulkTechnical(ids, promotionId);
}

function _bulkReportTransversal() {
    const ids = _getSelectedStudentIds();
    if (!ids.length) { alert('Selecciona al menos un estudiante.'); return; }
    window.Reports?.printBulkTransversal(ids, promotionId);
}

async function _bulkReportByProject() {
    // Remove any existing modal
    document.getElementById('_project-picker-modal')?.remove();

    // Show a loading modal while we fetch the promotion roadmap
    const loadingModal = document.createElement('div');
    loadingModal.id = '_project-picker-modal';
    loadingModal.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9000;display:flex;align-items:center;justify-content:center;">
            <div style="background:#fff;border-radius:10px;padding:32px 40px;min-width:280px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.25);">
                <div style="width:36px;height:36px;border:4px solid #FF6B35;border-top-color:transparent;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 14px;"></div>
                <div style="font-family:Inter,sans-serif;font-size:14px;color:#444;">Cargando proyectos…</div>
                <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
            </div>
        </div>`;
    document.body.appendChild(loadingModal);

    try {
        const token = localStorage.getItem('token');

        // Fetch just the promotion to read the roadmap projects
        const promoRes = await fetch(`${API_URL}/api/promotions/${promotionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const promo = promoRes.ok ? await promoRes.json() : {};

        // Collect all project names from the roadmap (modules[].projects[].name)
        const allProjects = [];
        const seen = new Set();
        (promo.modules || []).forEach(mod => {
            (mod.projects || []).forEach(p => {
                if (p.name && !seen.has(p.name.trim())) {
                    seen.add(p.name.trim());
                    allProjects.push({ name: p.name.trim(), moduleName: mod.name || '' });
                }
            });
        });

        // Remove loading modal
        document.getElementById('_project-picker-modal')?.remove();

        if (!allProjects.length) {
            alert('No hay proyectos definidos en el roadmap de esta promoción.');
            return;
        }

        // Build the dropdown options grouped by module
        const options = allProjects.map(({ name, moduleName }) =>
            `<option value="${name.replace(/"/g, '&quot;')}" data-module="${moduleName.replace(/"/g, '&quot;')}">${name}</option>`
        ).join('');

        // Get selected student IDs to know how many PDFs will be generated
        const selectedIds = _getSelectedStudentIds();

        // Build the picker modal
        const modal = document.createElement('div');
        modal.id = '_project-picker-modal';
        modal.innerHTML = `
            <div style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9000;display:flex;align-items:center;justify-content:center;">
                <div style="background:#fff;border-radius:12px;padding:28px 28px 22px;min-width:360px;max-width:480px;box-shadow:0 8px 32px rgba(0,0,0,.28);font-family:Inter,sans-serif;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
                        <div>
                            <div style="font-size:11px;color:#FF6B35;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px;">Informes por Proyecto</div>
                            <strong style="font-size:16px;color:#1A1A2E;">Selecciona un proyecto</strong>
                        </div>
                        <button onclick="document.getElementById('_project-picker-modal').remove()"
                            style="background:none;border:1px solid #dee2e6;border-radius:6px;padding:4px 10px;font-size:13px;cursor:pointer;color:#666;">✕</button>
                    </div>
                    <div style="margin-bottom:16px;">
                        <label style="font-size:12px;font-weight:600;color:#4A4A6A;display:block;margin-bottom:6px;">Proyecto del roadmap</label>
                        <select id="_proj-select"
                            style="width:100%;padding:10px 12px;border:1.5px solid #dee2e6;border-radius:8px;font-size:14px;
                                   font-family:Inter,sans-serif;color:#1A1A2E;background:#fff;outline:none;cursor:pointer;">
                            <option value="" disabled selected>— Elige un proyecto —</option>
                            ${options}
                        </select>
                    </div>
                    <div id="_proj-preview" style="min-height:28px;margin-bottom:16px;font-size:12px;color:#4A4A6A;">
                        ${selectedIds.length
                            ? `<span style="background:#fff8f0;color:#FF6B35;border-radius:6px;padding:4px 10px;display:inline-block;">
                                Se generará un PDF por cada uno de los <strong>${selectedIds.length}</strong> coders seleccionados
                              </span>`
                            : `<span style="background:#fff3cd;color:#856404;border-radius:6px;padding:4px 10px;display:inline-block;">
                                ⚠ No hay coders seleccionados. Se procesarán todos los de la promoción.
                              </span>`
                        }
                    </div>
                    <div style="display:flex;gap:10px;justify-content:flex-end;">
                        <button onclick="document.getElementById('_project-picker-modal').remove()"
                            style="padding:9px 18px;border:1px solid #dee2e6;border-radius:8px;font-size:13px;
                                   background:#fff;color:#666;cursor:pointer;font-family:Inter,sans-serif;">
                            Cancelar
                        </button>
                        <button id="_proj-download-btn" disabled
                            onclick="_confirmBulkProjectDownload()"
                            style="padding:9px 22px;border:none;border-radius:8px;font-size:13px;font-weight:600;
                                   background:#FF6B35;color:#fff;cursor:pointer;font-family:Inter,sans-serif;
                                   opacity:0.5;transition:opacity .15s;">
                            <i class="bi bi-download me-1"></i> Descargar PDFs
                        </button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modal);

        // Wire up the select change
        const sel = document.getElementById('_proj-select');
        const btn = document.getElementById('_proj-download-btn');
        sel.addEventListener('change', () => {
            if (sel.value) {
                btn.disabled = false;
                btn.style.opacity = '1';
            } else {
                btn.disabled = true;
                btn.style.opacity = '0.5';
            }
        });

    } catch (err) {
        document.getElementById('_project-picker-modal')?.remove();
        console.error('[BulkByProject] Error cargando proyectos:', err);
        alert('Error al cargar los proyectos: ' + err.message);
    }
}

function _confirmBulkProjectDownload() {
    const sel = document.getElementById('_proj-select');
    const projectName = sel?.value;
    if (!projectName) return;
    document.getElementById('_project-picker-modal')?.remove();
    // Pass the currently selected student IDs (or null = all students)
    const selectedIds = _getSelectedStudentIds();
    window.Reports?.printBulkByProject(projectName, promotionId, selectedIds.length ? selectedIds : null);
}
// ── /Bulk PDF Report helpers ──────────────────────────────────────────────────

// Delete selected students
async function deleteSelectedStudents() {
    const selectedCheckboxes = document.querySelectorAll('.student-checkbox:checked');
    const selectedStudentIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.studentId);

    if (selectedStudentIds.length === 0) {
        alert('No students selected for deletion.');
        return;
    }

    const confirmMessage = `Are you sure you want to delete ${selectedStudentIds.length} selected student(s)? This action cannot be undone.`;
    if (!confirm(confirmMessage)) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const deletePromises = selectedStudentIds.map(studentId =>
            fetch(`${API_URL}/api/promotions/${promotionId}/students/${studentId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })
        );

        await Promise.all(deletePromises);

        alert(`Successfully deleted ${selectedStudentIds.length} student(s).`);
        loadStudents(); // Reload the students list
    } catch (error) {
        console.error('Error deleting selected students:', error);
        alert('Error deleting students. Please try again.');
    }
}

// Attendance Control Functions
async function loadAttendance() {
    try {
        const token = localStorage.getItem('token');
        const [year, month] = currentAttendanceMonth.split('-');

        // Update display
        const monthNames = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];
        document.getElementById('current-attendance-month-display').textContent = `${monthNames[parseInt(month) - 1]} ${year}`;

        // Get students first (if not already loaded)
        const studentsRes = await fetch(`${API_URL}/api/promotions/${promotionId}/students`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        studentsForAttendance = await studentsRes.json();

        // Get attendance data
        const attendanceRes = await fetch(`${API_URL}/api/promotions/${promotionId}/attendance?month=${currentAttendanceMonth}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        attendanceData = await attendanceRes.json();

        // Load holidays (only once per page load; refresh when promotionId changes)
        if (promotionHolidays.size === 0) {
            try {
                const holRes = await fetch(`${API_URL}/api/promotions/${promotionId}/holidays`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (holRes.ok) {
                    const { holidays } = await holRes.json();
                    promotionHolidays = new Set(holidays || []);
                }
            } catch (_) {}
        }

        renderAttendanceTable();
    } catch (error) {
        console.error('Error loading attendance:', error);
    }
}

function renderAttendanceTable() {
    const headerRow = document.getElementById('attendance-header-row');
    const weekdayRow = document.getElementById('attendance-weekday-row');
    const body = document.getElementById('attendance-body');

    // Clear previous
    headerRow.innerHTML = '<th class="sticky-column bg-light" style="min-width: 250px; z-index: 10;">Student</th>';
    if (weekdayRow) weekdayRow.innerHTML = '<th class="sticky-column bg-light" style="min-width: 250px; z-index: 10;"></th>';
    body.innerHTML = '';

    if (studentsForAttendance.length === 0) {
        body.innerHTML = '<tr><td colspan="100" class="text-center py-4 text-muted">No students found in this promotion.</td></tr>';
        return;
    }

    // Determine days in month
    const [year, month] = currentAttendanceMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    // Weekday abbreviations (0=Sun, 1=Mon, ..., 6=Sat)
    const WEEKDAY_ABBR = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

    // Generate headers (weekday row + day number row)
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${day < 10 ? '0' : ''}${day}`;
        const dateKey = `${currentAttendanceMonth}-${dateStr}`;
        const dayOfWeek = new Date(year, month - 1, day).getDay(); // 0=Sun, 6=Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isHoliday = promotionHolidays.has(dateKey);
        const isBlocked = isWeekend || isHoliday;

        const weekendStyle = isBlocked ? ' background-color:#e5e5e5; color:#888;' : '';
        const holidayMark = isHoliday ? ' title="Festivo – clic derecho para quitar"' : (!isWeekend ? ' title="Clic derecho para marcar como festivo"' : '');

        if (weekdayRow) {
            const th = document.createElement('th');
            th.className = 'text-center';
            th.style.cssText = `font-size:0.7rem; font-weight:500; padding:2px 4px;${weekendStyle}`;
            th.textContent = WEEKDAY_ABBR[dayOfWeek];
            weekdayRow.appendChild(th);
        }

        const thDay = document.createElement('th');
        thDay.className = 'text-center';
        thDay.style.cssText = weekendStyle;
        thDay.dataset.date = dateKey;
        if (isHoliday) {
            thDay.innerHTML = `<span style="font-size:0.65rem;">🎉</span><br><small>${dateStr}</small>`;
        } else {
            thDay.textContent = dateStr;
        }
        // Right-click on weekday header (not on weekends) to toggle holiday
        if (!isWeekend) {
            thDay.style.cursor = 'context-menu';
            thDay.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                toggleHoliday(dateKey);
            });
        }
        headerRow.appendChild(thDay);
    }

    // Generate rows
    studentsForAttendance.sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(student => {
        const tr = document.createElement('tr');

        // Name column
        const nameTd = document.createElement('td');
        nameTd.className = 'sticky-column bg-white student-name-cell';
        nameTd.textContent = studentFullName(student);
        nameTd.onclick = () => openAttendanceModal(student.id, null); // Open first day or just general stats
        tr.appendChild(nameTd);

        // Day columns
        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = `${currentAttendanceMonth}-${day < 10 ? '0' : ''}${day}`;
            const record = attendanceData.find(a => a.studentId === student.id && a.date === dateKey);
            const status = record ? record.status : '';
            const note = (record && record.note) ? record.note : '';

            const dayOfWeek = new Date(year, month - 1, day).getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isHoliday = promotionHolidays.has(dateKey);
            const isBlocked = isWeekend || isHoliday;

            const td = document.createElement('td');

            if (isBlocked) {
                // Non-working day: grey, no click, no status shown
                td.className = 'attendance-cell attendance-blocked';
                td.style.backgroundColor = isHoliday ? '#f0e8ff' : '#e5e5e5';
                td.style.color = isHoliday ? '#7c3aed' : '#aaa';
                td.style.cursor = 'default';
                td.innerHTML = isHoliday ? '<i class="bi bi-balloon" style="font-size:0.75rem;"></i>' : '';
                tr.appendChild(td);
                continue;
            }

            let statusClass = '';
            if (status === 'Presente') statusClass = 'attendance-present';
            else if (status === 'Ausente') statusClass = 'attendance-absent';
            else if (status === 'Con retraso') statusClass = 'attendance-late';
            else if (status === 'Justificado') statusClass = 'attendance-justified';
            else if (status === 'Sale antes') statusClass = 'attendance-early-leave';

            td.className = `attendance-cell ${statusClass} ${note ? 'attendance-has-note' : ''}`;
            td.dataset.studentId = student.id;
            td.dataset.date = dateKey;
            td.dataset.status = status;

            // Icon or text representation
            if (status === 'Presente') td.innerHTML = '<i class="bi bi-check-lg"></i>';
            else if (status === 'Ausente') td.innerHTML = '<i class="bi bi-x-lg"></i>';
            else if (status === 'Con retraso') td.innerHTML = '<i class="bi bi-clock"></i>';
            else if (status === 'Justificado') td.innerHTML = '<i class="bi bi-info-circle"></i>';
            else if (status === 'Sale antes') td.innerHTML = '<i class="bi bi-box-arrow-left"></i>';
            else td.innerHTML = '';

            td.onclick = (e) => {
                if (e.shiftKey) {
                    openAttendanceModal(student.id, dateKey);
                } else {
                    cycleAttendanceStatus(td);
                }
            };
            td.oncontextmenu = (e) => {
                e.preventDefault();
                openAttendanceModal(student.id, dateKey);
            };
            tr.appendChild(td);
        }

        body.appendChild(tr);
    });

    updateAttendanceStats();
}

// ── Holiday toggle ───────────────────────────────────────────────────────────
async function toggleHoliday(dateKey) {
    const token = localStorage.getItem('token');
    if (promotionHolidays.has(dateKey)) {
        promotionHolidays.delete(dateKey);
    } else {
        promotionHolidays.add(dateKey);
    }
    // Persist to server
    try {
        await fetch(`${API_URL}/api/promotions/${promotionId}/holidays`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ holidays: [...promotionHolidays] })
        });
    } catch (_) {}
    renderAttendanceTable();
}

function updateAttendanceStats() {    const totalDays = studentsForAttendance.length * new Date(
        ...currentAttendanceMonth.split('-').map(Number), 0
    ).getDate();

    let present = 0, absent = 0, late = 0, justified = 0, earlyLeave = 0;

    attendanceData.forEach(record => {
        if (record.status === 'Presente') present++;
        else if (record.status === 'Ausente') absent++;
        else if (record.status === 'Con retraso') late++;
        else if (record.status === 'Justificado') justified++;
        else if (record.status === 'Sale antes') earlyLeave++;
    });

    document.getElementById('stat-present-total').textContent = present;
    document.getElementById('stat-absent-total').textContent = absent;
    document.getElementById('stat-late-total').textContent = late;
    document.getElementById('stat-justified-total').textContent = justified;
    const earlyLeaveEl = document.getElementById('stat-early-leave-total');
    if (earlyLeaveEl) earlyLeaveEl.textContent = earlyLeave;

    const totalMarked = present + absent + late + justified + earlyLeave;
    const avg = totalMarked > 0 ? Math.round(((present + late + justified + earlyLeave) / totalMarked) * 100) : 0;
    document.getElementById('stat-attendance-avg').textContent = `${avg}%`;
}

function cycleAttendanceStatus(cell) {
    const studentId = cell.dataset.studentId;
    const date = cell.dataset.date;
    const currentStatus = cell.dataset.status;

    // Cycle: "" -> "Presente" -> "Ausente" -> "Con retraso" -> "Justificado" -> "Sale antes" -> ""
    let nextStatus = "";
    if (currentStatus === "") nextStatus = "Presente";
    else if (currentStatus === "Presente") nextStatus = "Ausente";
    else if (currentStatus === "Ausente") nextStatus = "Con retraso";
    else if (currentStatus === "Con retraso") nextStatus = "Justificado";
    else if (currentStatus === "Justificado") nextStatus = "Sale antes";
    else if (currentStatus === "Sale antes") nextStatus = "";

    updateAttendance(studentId, date, nextStatus, null, cell);
}

async function updateAttendance(studentId, date, status, note, cell) {
    try {
        const token = localStorage.getItem('token');
        const body = { studentId, date, status };
        if (note !== null && note !== undefined) body.note = note;

        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/attendance`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        if (response.ok) {
            const updatedRecord = await response.json();

            // Update local attendanceData array
            const index = attendanceData.findIndex(a => a.studentId === studentId && a.date === date);
            if (index > -1) {
                if (status === "" && (!updatedRecord.note)) {
                    attendanceData.splice(index, 1);
                } else {
                    attendanceData[index] = updatedRecord;
                }
            } else if (status !== "" || updatedRecord.note) {
                attendanceData.push(updatedRecord);
            }

            // If we have the cell element, update it directly
            if (cell) {
                cell.dataset.status = status;
                cell.className = 'attendance-cell';
                if (updatedRecord.note) cell.classList.add('attendance-has-note');

                if (status === 'Presente') {
                    cell.classList.add('attendance-present');
                    cell.innerHTML = '<i class="bi bi-check-lg"></i>';
                } else if (status === 'Ausente') {
                    cell.classList.add('attendance-absent');
                    cell.innerHTML = '<i class="bi bi-x-lg"></i>';
                } else if (status === 'Con retraso') {
                    cell.classList.add('attendance-late');
                    cell.innerHTML = '<i class="bi bi-clock"></i>';
                } else if (status === 'Justificado') {
                    cell.classList.add('attendance-justified');
                    cell.innerHTML = '<i class="bi bi-info-circle"></i>';
                } else if (status === 'Sale antes') {
                    cell.classList.add('attendance-early-leave');
                    cell.innerHTML = '<i class="bi bi-box-arrow-left"></i>';
                } else {
                    cell.innerHTML = '';
                }
            } else {
                // If no cell provided, just re-render (e.g. from modal)
                renderAttendanceTable();
            }
            updateAttendanceStats();
        }
    } catch (error) {
        console.error('Error updating attendance:', error);
    }
}

let currentModalAttendance = { studentId: null, date: null };

function openAttendanceModal(studentId, date) {
    const student = studentsForAttendance.find(s => s.id === studentId);
    if (!student) return;

    // If date is null, default to first day of currently viewed month
    if (!date) {
        date = `${currentAttendanceMonth}-01`;
    }

    currentModalAttendance = { studentId, date };
    const record = attendanceData.find(a => a.studentId === studentId && a.date === date);

    document.getElementById('attendance-modal-student-name').textContent = studentFullName(student);
    document.getElementById('attendance-modal-date').textContent = date;
    document.getElementById('attendance-modal-status').value = (record && record.status) ? record.status : '';
    document.getElementById('attendance-modal-note').value = (record && record.note) ? record.note : '';

    // Calculate student stats for this month
    let sPres = 0, sAbs = 0, sLate = 0, sJust = 0;
    attendanceData.filter(a => a.studentId === studentId).forEach(r => {
        if (r.status === 'Presente') sPres++;
        else if (r.status === 'Ausente') sAbs++;
        else if (r.status === 'Con retraso') sLate++;
        else if (r.status === 'Justificado') sJust++;
    });

    document.getElementById('student-stat-present').textContent = sPres;
    document.getElementById('student-stat-absent').textContent = sAbs;
    document.getElementById('student-stat-late').textContent = sLate;
    document.getElementById('student-stat-justified').textContent = sJust;

    const modalEl = document.getElementById('attendanceModal');
    const modal = new bootstrap.Modal(modalEl);

    // Focus note field when modal is shown
    modalEl.addEventListener('shown.bs.modal', () => {
        document.getElementById('attendance-modal-note').focus();
    }, { once: true });

    // Wire up summary button
    const summaryBtn = document.getElementById('view-student-summary-btn');
    summaryBtn.onclick = () => {
        modal.hide();
        openStudentSummary(studentId);
    };

    modal.show();
}

let _summaryStudentId = null; // tracks which student is open in the summary modal

function openStudentSummary(studentId) {
    _summaryStudentId = studentId;
    const student = studentsForAttendance.find(s => s.id === studentId);
    if (!student) return;

    document.getElementById('summary-student-name').textContent = studentFullName(student);

    const [year, month] = currentAttendanceMonth.split('-');
    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    document.getElementById('summary-month-title').textContent = `${monthNames[parseInt(month) - 1]} ${year}`;

    const tbody = document.getElementById('student-summary-body');
    tbody.innerHTML = '';

    // Get all records for this student in this month, sorted by date
    const records = attendanceData
        .filter(a => a.studentId === studentId && a.date.startsWith(currentAttendanceMonth))
        .sort((a, b) => a.date.localeCompare(b.date));

    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center py-3 text-muted">No attendance records found for this month.</td></tr>';
    } else {
        records.forEach(r => {
            const tr = document.createElement('tr');

            let statusBadge = '';
            if (r.status === 'Presente') statusBadge = '<span class="badge" style="background-color: var(--green-f5); color: var(--principal-2);">Presente</span>';
            else if (r.status === 'Ausente') statusBadge = '<span class="badge" style="background-color: var(--principal-1); color: var(--principal-3);">Ausente</span>';
            else if (r.status === 'Con retraso') statusBadge = '<span class="badge" style="background-color: var(--complementario-2); color: var(--principal-2);">Con retraso</span>';
            else if (r.status === 'Justificado') statusBadge = '<span class="badge" style="background-color: var(--blue-light-f5); color: var(--principal-2);">Justificado</span>';
            else statusBadge = '<span class="badge" style="background-color: var(--complementario-1-extra-light); color: var(--principal-2); border: 1px solid var(--complementario-1);">No marcado</span>';

            tr.innerHTML = `
                <td class="fw-bold">${r.date.split('-')[2]}</td>
                <td>${statusBadge}</td>
                <td class="small">${escapeHtml(r.note || '-')}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    const summaryModal = new bootstrap.Modal(document.getElementById('studentSummaryModal'));
    summaryModal.show();
}

/**
 * Genera y descarga un PDF con el resumen de asistencia de un estudiante.
 * @param {'month'|'all'} mode  - 'month' = solo el mes visible; 'all' = todos los meses con registro
 */
async function exportStudentAttendancePdf(mode) {
    const studentId = _summaryStudentId;
    const student = studentsForAttendance.find(s => s.id === studentId);
    if (!student) return;

    const MONTH_NAMES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                            'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const STATUS_LABELS = {
        'Presente':    'Presente',
        'Ausente':     'Ausente',
        'Con retraso': 'Con retraso',
        'Justificado': 'Justificado',
        'Sale antes':  'Sale antes'
    };
    const STATUS_COLORS = {
        'Presente':    [154, 246, 194],   // --green-f5
        'Ausente':     [255, 71, 0],      // --principal-1
        'Con retraso': [255, 163, 127],   // --complementario-2
        'Justificado': [192, 246, 248],   // --blue-light-f5
        'Sale antes':  [233, 216, 253]    // purple pastel
    };

    // ── 1. Recopilar registros ───────────────────────────────────────────────
    let records = [];

    if (mode === 'month') {
        records = attendanceData
            .filter(a => a.studentId === studentId && a.date.startsWith(currentAttendanceMonth))
            .sort((a, b) => a.date.localeCompare(b.date));
    } else {
        // Fetch ALL attendance for this promotion (reuses existing export endpoint data)
        const btn = document.getElementById('summary-pdf-all-btn');
        const orig = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Generando…';
        try {
            const token = localStorage.getItem('token');
            // Use the generic attendance endpoint month by month, or pull all via the export
            // The export endpoint returns xlsx — instead query month by month for all months with data
            // First get the promotion to know start/end
            const promoRes = await fetch(`${API_URL}/api/promotions/${promotionId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const promo = promoRes.ok ? await promoRes.json() : {};

            // Build list of YYYY-MM from promotion start to end (or ±12 months fallback)
            const start = promo.startDate ? new Date(promo.startDate) : new Date(new Date().getFullYear(), 0, 1);
            const end   = promo.endDate   ? new Date(promo.endDate)   : new Date();
            const months = [];
            const cur = new Date(start.getFullYear(), start.getMonth(), 1);
            while (cur <= end) {
                months.push(`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}`);
                cur.setMonth(cur.getMonth() + 1);
            }
            if (!months.length) months.push(currentAttendanceMonth);

            // Fetch each month in parallel
            const fetched = await Promise.all(months.map(m =>
                fetch(`${API_URL}/api/promotions/${promotionId}/attendance?month=${m}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }).then(r => r.ok ? r.json() : [])
            ));
            records = fetched.flat()
                .filter(a => a.studentId === studentId)
                .sort((a, b) => a.date.localeCompare(b.date));
        } finally {
            btn.disabled = false;
            btn.innerHTML = orig;
        }
    }

    if (!records.length) {
        alert('No hay registros de asistencia para este estudiante' + (mode === 'month' ? ' en este mes.' : '.'));
        return;
    }

    // ── 2. Construir PDF con jsPDF ───────────────────────────────────────────
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const ORANGE  = [255, 107, 53];   // #FF6B35
    const DARK    = [2, 1, 0];
    const LIGHT_BG = [245, 242, 242]; // complementario-1-extra-light approx
    const PAGE_W  = 210;
    const MARGIN  = 14;
    const COL_W   = PAGE_W - MARGIN * 2;

    // ── Header ───────────────────────────────────────────────────────────────
    doc.setFillColor(...ORANGE);
    doc.rect(0, 0, PAGE_W, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen de Asistencia', MARGIN, 10);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(studentFullName(student), MARGIN, 17);

    const scope = mode === 'month'
        ? (() => { const [y,m] = currentAttendanceMonth.split('-'); return `${MONTH_NAMES_ES[parseInt(m)-1]} ${y}`; })()
        : 'Todos los meses';
    doc.text(scope, PAGE_W - MARGIN, 17, { align: 'right' });

    // ── Global totals (used in header summary + final summary) ───────────────
    let y = 30;
    const globalCounts = { 'Presente':0,'Ausente':0,'Con retraso':0,'Justificado':0,'Sale antes':0 };
    records.forEach(r => { if (globalCounts[r.status] !== undefined) globalCounts[r.status]++; });
    const totalRecords  = records.length;
    const totalAttended = globalCounts['Presente'] + globalCounts['Con retraso'] + globalCounts['Justificado'] + globalCounts['Sale antes'];
    const totalAbsent   = globalCounts['Ausente'];
    const globalPct     = totalRecords > 0 ? Math.round((totalAttended / totalRecords) * 100) : 0;
    const absentPct     = totalRecords > 0 ? Math.round((totalAbsent   / totalRecords) * 100) : 0;

    // ── Table — group by month ───────────────────────────────────────────────
    const byMonth = {};
    records.forEach(r => {
        const mo = r.date.substring(0, 7);
        if (!byMonth[mo]) byMonth[mo] = [];
        byMonth[mo].push(r);
    });

    const ROW_H = 7;
    const COL_DATE = 28, COL_STATUS = 42, COL_NOTE = COL_W - COL_DATE - COL_STATUS;
    const col1 = MARGIN, col2 = MARGIN + COL_DATE, col3 = MARGIN + COL_DATE + COL_STATUS;

    const ensureSpace = (needed) => {
        if (y + needed > 280) {
            doc.addPage();
            y = 14;
        }
    };

    Object.entries(byMonth).forEach(([mo, recs]) => {
        const [my, mm] = mo.split('-');
        const monthLabel = `${MONTH_NAMES_ES[parseInt(mm)-1]} ${my}`;

        ensureSpace(ROW_H + recs.length * ROW_H + 4);

        // Month header
        doc.setFillColor(...ORANGE);
        doc.rect(MARGIN, y, COL_W, ROW_H, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(monthLabel, MARGIN + 2, y + 5);
        const monthAttended = recs.filter(r => r.status === 'Presente' || r.status === 'Con retraso' || r.status === 'Justificado' || r.status === 'Sale antes').length;
        const monthAbsent   = recs.filter(r => r.status === 'Ausente').length;
        const monthPct = recs.length > 0 ? Math.round((monthAttended / recs.length) * 100) : 0;
        doc.text(`${monthAttended} asistidos · ${monthAbsent} faltas · ${monthPct}%`, PAGE_W - MARGIN - 2, y + 5, { align: 'right' });
        y += ROW_H;

        // Column headers
        doc.setFillColor(...LIGHT_BG);
        doc.rect(MARGIN, y, COL_W, ROW_H - 1, 'F');
        doc.setTextColor(80, 80, 80);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text('Fecha', col1 + 2, y + 4.5);
        doc.text('Estado', col2 + 2, y + 4.5);
        doc.text('Nota', col3 + 2, y + 4.5);
        y += ROW_H - 1;

        // Data rows
        recs.forEach((r, idx) => {
            ensureSpace(ROW_H);
            const rowBg = idx % 2 === 0 ? [255,255,255] : [250, 249, 248];
            doc.setFillColor(...rowBg);
            doc.rect(MARGIN, y, COL_W, ROW_H, 'F');

            // Status badge color as left border stripe
            const sc = STATUS_COLORS[r.status] || [220, 220, 220];
            doc.setFillColor(...sc);
            doc.rect(col2, y, 3, ROW_H, 'F');

            doc.setTextColor(...DARK);
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'normal');

            // Date: day/month
            const [, rmo, rd] = r.date.split('-');
            doc.text(`${rd}/${rmo}`, col1 + 2, y + 5);

            // Status text
            doc.setFont('helvetica', 'bold');
            doc.text(STATUS_LABELS[r.status] || r.status || '—', col2 + 5, y + 5);

            // Note (truncated)
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            const noteText = r.note ? doc.splitTextToSize(r.note, COL_NOTE - 4)[0] : '—';
            doc.text(noteText, col3 + 2, y + 5);

            y += ROW_H;
        });

        y += 4; // gap between months
    });

    // ── Global summary at the end ────────────────────────────────────────────
    if (mode === 'all' || Object.keys(byMonth).length >= 1) {
        ensureSpace(58);
        y += 4;

        // Section title
        doc.setFillColor(...ORANGE);
        doc.rect(MARGIN, y, COL_W, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.text('Resumen Global', MARGIN + 2, y + 5.5);
        y += 8;

        // Big numbers row: attended / % attendance | absent / % absence
        doc.setFillColor(...LIGHT_BG);
        doc.rect(MARGIN, y, COL_W, 22, 'F');

        // ── Asistió
        const col_A = MARGIN + COL_W * 0.15;
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 140, 80);
        doc.text(String(totalAttended), col_A, y + 12, { align: 'center' });
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        doc.text('días asistidos', col_A, y + 18, { align: 'center' });

        // ── % asistencia
        const col_B = MARGIN + COL_W * 0.38;
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 140, 80);
        doc.text(`${globalPct}%`, col_B, y + 12, { align: 'center' });
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        doc.text('% asistencia', col_B, y + 18, { align: 'center' });

        // Vertical divider
        doc.setDrawColor(200, 200, 200);
        doc.line(MARGIN + COL_W * 0.52, y + 2, MARGIN + COL_W * 0.52, y + 20);

        // ── Faltó
        const col_C = MARGIN + COL_W * 0.65;
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(200, 50, 10);
        doc.text(String(totalAbsent), col_C, y + 12, { align: 'center' });
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        doc.text('días faltados', col_C, y + 18, { align: 'center' });

        // ── % ausencia
        const col_D = MARGIN + COL_W * 0.86;
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(200, 50, 10);
        doc.text(`${absentPct}%`, col_D, y + 12, { align: 'center' });
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        doc.text('% ausencia', col_D, y + 18, { align: 'center' });

        y += 22;

        // ── Detail row: one cell per status with count + % ───────────────────
        const allStatuses = [
            { label: 'Presente',     count: globalCounts['Presente'],     color: [40, 140, 80]   },
            { label: 'Con retraso',  count: globalCounts['Con retraso'],  color: [220, 100, 20]  },
            { label: 'Justificado',  count: globalCounts['Justificado'],  color: [20, 120, 160]  },
            { label: 'Sale antes',   count: globalCounts['Sale antes'],   color: [100, 50, 180]  },
            { label: 'Ausente',      count: globalCounts['Ausente'],      color: [200, 50, 10]   }
        ];
        const detailRowH = 13;
        doc.setFillColor(255, 255, 255);
        doc.rect(MARGIN, y, COL_W, detailRowH, 'F');
        doc.setDrawColor(220, 220, 220);
        doc.rect(MARGIN, y, COL_W, detailRowH);
        const dW = COL_W / allStatuses.length;
        allStatuses.forEach((item, i) => {
            const dx = MARGIN + i * dW + dW / 2;
            const pct = totalRecords > 0 ? Math.round((item.count / totalRecords) * 100) : 0;
            // Vertical separator between cells
            if (i > 0) {
                doc.setDrawColor(220, 220, 220);
                doc.line(MARGIN + i * dW, y + 1, MARGIN + i * dW, y + detailRowH - 1);
            }
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...item.color);
            doc.text(String(item.count), dx, y + 5.5, { align: 'center' });
            doc.setFontSize(5.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...item.color);
            doc.text(`${pct}%`, dx, y + 9, { align: 'center' });
            doc.setFontSize(5);
            doc.setTextColor(100, 100, 100);
            doc.text(item.label, dx, y + 12, { align: 'center' });
        });

        y += detailRowH;

        // ── Total records footnote ────────────────────────────────────────────
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(140, 140, 140);
        doc.text(`Total de registros: ${totalRecords}`, MARGIN + COL_W, y + 4, { align: 'right' });

        y += 6;
    }
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFillColor(...LIGHT_BG);
        doc.rect(0, 288, PAGE_W, 9, 'F');
        doc.setFontSize(7);
        doc.setTextColor(140, 140, 140);
        doc.setFont('helvetica', 'normal');
        doc.text(`Bootcamp Manager · ${studentFullName(student)}`, MARGIN, 293);
        doc.text(`Pág. ${p} / ${totalPages}`, PAGE_W - MARGIN, 293, { align: 'right' });
    }

    // ── Download ─────────────────────────────────────────────────────────────
    const safeName = studentFullName(student).replace(/\s+/g, '_');
    const fileSuffix = mode === 'month' ? currentAttendanceMonth : 'todos';
    doc.save(`asistencia_${safeName}_${fileSuffix}.pdf`);
}

function saveAttendanceFromModal() {
    const status = document.getElementById('attendance-modal-status').value;
    const note = document.getElementById('attendance-modal-note').value;

    updateAttendance(currentModalAttendance.studentId, currentModalAttendance.date, status, note, null);
    bootstrap.Modal.getInstance(document.getElementById('attendanceModal')).hide();
}

function prevAttendanceMonth() {
    const [year, month] = currentAttendanceMonth.split('-').map(Number);
    let newYear = year;
    let newMonth = month - 1;
    if (newMonth === 0) {
        newMonth = 12;
        newYear--;
    }
    currentAttendanceMonth = `${newYear}-${newMonth < 10 ? '0' : ''}${newMonth}`;
    loadAttendance();
}

function nextAttendanceMonth() {
    const [year, month] = currentAttendanceMonth.split('-').map(Number);
    let newYear = year;
    let newMonth = month + 1;
    if (newMonth === 13) {
        newMonth = 1;
        newYear++;
    }
    currentAttendanceMonth = `${newYear}-${newMonth < 10 ? '0' : ''}${newMonth}`;
    loadAttendance();
}

// Export attendance to Excel for the entire promotion period
async function exportAttendanceToExcel() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('No se encontró token de autenticación. Por favor, inicie sesión nuevamente.');
            return;
        }

        // Get promotion data to show user what period will be exported
        const promotionData = window.currentPromotion;
        let confirmMessage = 'Se exportará la asistencia completa del programa';
        
        if (promotionData && promotionData.startDate && promotionData.endDate) {
            confirmMessage = `Se exportará la asistencia desde ${promotionData.startDate} hasta ${promotionData.endDate} (solo días laborables L-V).\n\nEl archivo Excel tendrá una pestaña por cada mes con datos de asistencia.\n\n¿Desea continuar?`;
        } else {
            confirmMessage += ' para el período completo del programa.\n\nEl archivo Excel tendrá una pestaña por cada mes con datos de asistencia.\n\n¿Desea continuar?';
        }

        if (!confirm(confirmMessage)) {
            return;
        }

        // Show loading state
        const exportBtn = document.querySelector('[onclick="exportAttendanceToExcel()"]');
        const originalText = exportBtn ? exportBtn.innerHTML : '';
        if (exportBtn) {
            exportBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Exportando...';
            exportBtn.disabled = true;
        }

        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/attendance/export`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Error del servidor: ${response.status}`);
        }

        // Get the blob and create download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        
        // Extract filename from response header or use default
        const disposition = response.headers.get('Content-Disposition');
        let filename = 'asistencia-completa.xlsx';
        if (disposition && disposition.includes('filename=')) {
            filename = disposition.split('filename=')[1].replace(/"/g, '');
        }
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // Show success message
        alert('✅ Asistencia exportada exitosamente.\n\nEl archivo Excel incluye:\n• Una pestaña por cada mes del programa\n• Todos los estudiantes en cada mes\n• Solo días laborables (L-V)\n• Estados: P=Presente, A=Ausente, T=Tardanza, J=Justificado\n• Leyenda en cada pestaña');

    } catch (error) {
        console.error('Error exporting attendance:', error);
        alert(`❌ Error al exportar la asistencia: ${error.message}`);
    } finally {
        // Restore button state
        const exportBtn = document.querySelector('[onclick="exportAttendanceToExcel()"]');
        if (exportBtn) {
            exportBtn.innerHTML = '<i class="bi bi-file-earmark-spreadsheet me-2"></i>Export Excel';
            exportBtn.disabled = false;
        }
    }
}

/**
 * Update the subtitle in Program Details when switching between tabs
 * @param {string} sectionName - Name of the section being viewed
 */
function updateProgramDetailsSubtitle(sectionName) {
    const subtitle = document.getElementById('program-details-subtitle');
    if (subtitle) {
        subtitle.textContent = sectionName;
    }
}

/**
 * Switch Program Details Tabs with reliable behavior
 * @param {string} tabName - Name of the tab to activate (schedule, team, resources, pildoras, evaluation, quicklinks, sections)
 */
function switchProgramDetailsTab(tabName) {
    const tabNameMap = {
        'schedule': { tabId: 'program-details-schedule', buttonId: 'program-details-schedule-tab', label: 'Schedule' },
        'team': { tabId: 'program-details-team', buttonId: 'program-details-team-tab', label: 'Team' },
        'resources': { tabId: 'program-details-resources', buttonId: 'program-details-resources-tab', label: 'Resources' },
        'pildoras': { tabId: 'program-details-pildoras', buttonId: 'program-details-pildoras-tab', label: 'Píldoras' },
        'evaluation': { tabId: 'program-details-evaluation', buttonId: 'program-details-evaluation-tab', label: 'Evaluation' },
        'quicklinks': { tabId: 'program-details-quicklinks', buttonId: 'program-details-quicklinks-tab', label: 'Quick Links' },
        'sections': { tabId: 'program-details-sections', buttonId: 'program-details-sections-tab', label: 'Sections' },
        'competences': { tabId: 'program-details-competences', buttonId: 'program-details-competences-tab', label: 'Competencias' }
    };

    const tab = tabNameMap[tabName];
    if (!tab) return;

    // Hide all tabs
    const allTabs = document.querySelectorAll('#program-details-content .tab-pane');
    allTabs.forEach(t => {
        t.style.display = 'none';
        t.classList.remove('show', 'active');
    });

    // Remove active class from all buttons
    const allButtons = document.querySelectorAll('#program-details-tabs .nav-link');
    allButtons.forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
    });

    // Show selected tab with animation
    const selectedTab = document.getElementById(tab.tabId);
    if (selectedTab) {
        selectedTab.style.display = 'block';
        // Trigger reflow to enable animation
        void selectedTab.offsetHeight;
        selectedTab.classList.add('show', 'active');
    }

    // Activate selected button
    const selectedButton = document.getElementById(tab.buttonId);
    if (selectedButton) {
        selectedButton.classList.add('active');
        selectedButton.setAttribute('aria-selected', 'true');
    }

    // Update subtitle
    updateProgramDetailsSubtitle(tab.label);
}

// Selection state management
