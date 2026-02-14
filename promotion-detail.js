const API_URL = window.location.origin;
let promotionId = null;
let moduleModal, quickLinkModal, sectionModal, studentModal, studentSuccessModal, teamModal, resourceModal;
const userRole = localStorage.getItem('role') || 'student';
let extendedInfoData = {
    schedule: {},
    team: [],
    resources: [],
    evaluation: ''
};

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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    promotionId = new URLSearchParams(window.location.search).get('id');

    if (!promotionId) {
        window.location.href = '/dashboard.html';
        return;
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

    const studentSuccessModalEl = document.getElementById('studentSuccessModal');
    if (studentSuccessModalEl) studentSuccessModal = new bootstrap.Modal(studentSuccessModalEl);

    // New Modals (Teacher)
    const teamModalEl = document.getElementById('teamModal');
    if (teamModalEl) teamModal = new bootstrap.Modal(teamModalEl);

    const resourceModalEl = document.getElementById('resourceModal');
    if (resourceModalEl) resourceModal = new bootstrap.Modal(resourceModalEl);

    if (userRole === 'teacher') {
        loadStudents();
        loadExtendedInfo();
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
});

async function loadExtendedInfo() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/extended-info`); // Public endpoint
        if (response.ok) {
            extendedInfoData = await response.json();

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

            // Populate Evaluation
            document.getElementById('evaluation-text').value = extendedInfoData.evaluation || '';
        }
    } catch (error) {
        console.error('Error loading extended info:', error);
    }
}

function displayTeam() {
    const tbody = document.getElementById('team-list-body');
    tbody.innerHTML = '';
    (extendedInfoData.team || []).forEach((member, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHtml(member.name)}</td>
            <td>${escapeHtml(member.role)}</td>
            <td>${escapeHtml(member.email)}</td>
            <td><a href="${escapeHtml(member.linkedin)}" target="_blank"><i class="bi bi-linkedin"></i></a></td>
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

function openTeamModal() {
    document.getElementById('team-form').reset();
    teamModal.show();
}

function addTeamMember() {
    const name = document.getElementById('team-name').value;
    const role = document.getElementById('team-role').value;
    const email = document.getElementById('team-email').value;
    const linkedin = document.getElementById('team-linkedin').value;

    if (!name) return;

    extendedInfoData.team.push({ name, role, email, linkedin });
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

    // Gather Evaluation
    const evaluation = document.getElementById('evaluation-text').value;

    // Update global object
    extendedInfoData.schedule = schedule;
    extendedInfoData.evaluation = evaluation;

    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/extended-info`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(extendedInfoData)
        });

        if (response.ok) {
            alert('Program info saved successfully!');
        } else {
            try {
                const errorData = await response.json();
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

function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login';
    }
}

function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.section-content').forEach(el => {
        el.classList.add('hidden');
    });

    // Show selected tab
    const tabElement = document.getElementById(tabName + '-tab');
    if (tabElement) {
        tabElement.classList.remove('hidden');
    }

    // Update active nav link
    document.querySelectorAll('.sidebar .nav-link').forEach(link => {
        link.classList.remove('active');
    });
    event.target.classList.add('active');
}

async function loadPromotion() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const promotion = await response.json();
            document.getElementById('promotion-title').textContent = promotion.name;
            document.getElementById('promotion-desc').textContent = promotion.description || '';
            document.getElementById('promotion-weeks').textContent = promotion.weeks || '-';
            document.getElementById('promotion-start').textContent = promotion.startDate || '-';
            document.getElementById('promotion-end').textContent = promotion.endDate || '-';
            document.getElementById('modules-count').textContent = (promotion.modules || []).length;
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
        card.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <h5 class="card-title">Module ${index + 1}: ${escapeHtml(module.name)}</h5>
                    <p><strong>Duration:</strong> ${module.duration} weeks</p>
                    ${module.courses && module.courses.length > 0 ? `<p><strong>Courses:</strong> ${module.courses.join(', ')}</p>` : ''}
                    ${module.projects && module.projects.length > 0 ? `<p><strong>Projects:</strong> ${module.projects.join(', ')}</p>` : ''}
                </div>
            </div>
        `;
        list.appendChild(card);
    });
}

function generateGanttChart(promotion) {
    const table = document.getElementById('gantt-table');
    table.innerHTML = '';

    const weeks = promotion.weeks || 0;
    const modules = promotion.modules || [];

    if (modules.length === 0) {
        table.innerHTML = '<tr><td class="text-muted">No modules configured</td></tr>';
        return;
    }

    // Add wrapper styles for better readability
    const wrapper = table.parentElement;
    wrapper.style.overflowX = 'auto';

    // 1. Weeks Row (Top)
    const weekRow = document.createElement('tr');
    weekRow.style.backgroundColor = '#f8f9fa';
    weekRow.style.position = 'sticky';
    weekRow.style.top = '0';
    const weekHeaderCell = document.createElement('th');
    weekHeaderCell.innerHTML = '<strong>Weeks</strong>';
    weekHeaderCell.style.minWidth = '300px';
    weekHeaderCell.style.position = 'sticky';
    weekHeaderCell.style.left = '0';
    weekHeaderCell.style.zIndex = '10';
    weekHeaderCell.style.backgroundColor = '#f8f9fa';
    weekRow.appendChild(weekHeaderCell);

    for (let i = 1; i <= weeks; i++) {
        const th = document.createElement('th');
        th.textContent = i;
        th.className = 'text-center';
        th.style.width = '50px';
        th.style.minWidth = '50px';
        th.style.fontSize = '0.85rem';
        th.style.padding = '10px 4px';
        th.style.fontWeight = 'bold';
        th.style.borderRight = '1px solid #dee2e6';
        weekRow.appendChild(th);
    }
    table.appendChild(weekRow);

    // Add CSS for the table
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';

    // 2. Modules Row
    let weekCounter = 0;
    const moduleColors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#feca57', '#48dbfb'];

    modules.forEach((module, index) => {
        const moduleColor = moduleColors[index % moduleColors.length];

        // Module row
        const moduleRow = document.createElement('tr');
        const moduleCell = document.createElement('td');
        const editBtn = userRole === 'teacher' ? `<button class="btn btn-xs btn-sm btn-outline-warning ms-2" onclick="editModule('${escapeHtml(module.id)}')"><i class="bi bi-pencil"></i></button>` : '';
        const deleteBtn = userRole === 'teacher' ? `<button class="btn btn-xs btn-sm btn-outline-danger" onclick="deleteModule('${escapeHtml(module.id)}')"><i class="bi bi-trash"></i></button>` : '';
        moduleCell.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <strong style="color: ${moduleColor};">📚 Module ${index + 1}: ${escapeHtml(module.name)}</strong>
                <div>${editBtn} ${deleteBtn}</div>
            </div>
        `;
        moduleCell.style.minWidth = '300px';
        moduleCell.style.position = 'sticky';
        moduleCell.style.left = '0';
        moduleCell.style.backgroundColor = '#fff';
        moduleCell.style.zIndex = '5';
        moduleRow.appendChild(moduleCell);

        for (let i = 0; i < weeks; i++) {
            const cell = document.createElement('td');
            cell.style.textAlign = 'center';
            cell.style.height = '40px';
            cell.style.padding = '4px';
            cell.style.borderRight = '1px solid #dee2e6';
            cell.style.minWidth = '50px';

            if (i >= weekCounter && i < weekCounter + module.duration) {
                cell.style.backgroundColor = moduleColor;
                cell.style.borderRadius = '4px';
                cell.style.opacity = '0.8';
            }

            moduleRow.appendChild(cell);
        }
        table.appendChild(moduleRow);

        // Courses rows
        if (module.courses && module.courses.length > 0) {
            module.courses.forEach((courseObj, courseIndex) => {
                const courseName = typeof courseObj === 'string' ? courseObj : courseObj.name || courseObj;
                const courseUrl = typeof courseObj === 'object' ? courseObj.url : '';

                const courseRow = document.createElement('tr');
                const courseCell = document.createElement('td');
                const courseLink = courseUrl ? `<a href="${escapeHtml(courseUrl)}" target="_blank" class="text-decoration-none">📖 ${escapeHtml(courseName)} <i class="bi bi-box-arrow-up-right"></i></a>` : `📖 ${escapeHtml(courseName)}`;
                const deleteCourseBtn = userRole === 'teacher' ? `<button class="btn btn-xs btn-sm btn-outline-danger ms-2" onclick="deleteCourseFromModule('${escapeHtml(module.id)}', ${courseIndex})"><i class="bi bi-trash"></i></button>` : '';

                courseCell.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <small style="color: #666;">${courseLink}</small>
                        <div>${deleteCourseBtn}</div>
                    </div>
                `;
                courseCell.style.minWidth = '300px';
                courseCell.style.fontSize = '0.85rem';
                courseCell.style.paddingLeft = '20px';
                courseCell.style.position = 'sticky';
                courseCell.style.left = '0';
                courseCell.style.backgroundColor = '#fff';
                courseCell.style.zIndex = '5';
                courseRow.appendChild(courseCell);

                for (let i = 0; i < weeks; i++) {
                    const cell = document.createElement('td');
                    cell.style.textAlign = 'center';
                    cell.style.height = '30px';
                    cell.style.padding = '2px';
                    cell.style.borderRight = '1px solid #dee2e6';
                    cell.style.minWidth = '50px';

                    if (i >= weekCounter && i < weekCounter + module.duration) {
                        cell.style.backgroundColor = '#d1e7dd';
                        cell.style.borderRadius = '2px';
                    }
                    courseRow.appendChild(cell);
                }
                table.appendChild(courseRow);
            });
        }

        // Projects rows
        if (module.projects && module.projects.length > 0) {
            module.projects.forEach((projectObj, projectIndex) => {
                const projectName = typeof projectObj === 'string' ? projectObj : projectObj.name || projectObj;
                const projectUrl = typeof projectObj === 'object' ? projectObj.url : '';

                const projectRow = document.createElement('tr');
                const projectCell = document.createElement('td');
                const projectLink = projectUrl ? `<a href="${escapeHtml(projectUrl)}" target="_blank" class="text-decoration-none">🎯 ${escapeHtml(projectName)} <i class="bi bi-box-arrow-up-right"></i></a>` : `🎯 ${escapeHtml(projectName)}`;
                const deleteProjectBtn = userRole === 'teacher' ? `<button class="btn btn-xs btn-sm btn-outline-danger ms-2" onclick="deleteProjectFromModule('${escapeHtml(module.id)}', ${projectIndex})"><i class="bi bi-trash"></i></button>` : '';

                projectCell.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <small style="color: #666;">${projectLink}</small>
                        <div>${deleteProjectBtn}</div>
                    </div>
                `;
                projectCell.style.minWidth = '300px';
                projectCell.style.fontSize = '0.85rem';
                projectCell.style.paddingLeft = '20px';
                projectCell.style.position = 'sticky';
                projectCell.style.left = '0';
                projectCell.style.backgroundColor = '#fff';
                projectCell.style.zIndex = '5';
                projectRow.appendChild(projectCell);

                for (let i = 0; i < weeks; i++) {
                    const cell = document.createElement('td');
                    cell.style.textAlign = 'center';
                    cell.style.height = '30px';
                    cell.style.padding = '2px';
                    cell.style.borderRight = '1px solid #dee2e6';
                    cell.style.minWidth = '50px';

                    if (i >= weekCounter && i < weekCounter + module.duration) {
                        cell.style.backgroundColor = '#fce4e4';
                        cell.style.borderRadius = '2px';
                    }
                    projectRow.appendChild(cell);
                }
                table.appendChild(projectRow);
            });
        }

        weekCounter += module.duration;
    });
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

            // Clear and populate courses
            document.getElementById('courses-container').innerHTML = '';
            if (module.courses && module.courses.length > 0) {
                module.courses.forEach(course => {
                    const courseName = typeof course === 'string' ? course : course.name || course;
                    const courseUrl = typeof course === 'object' ? course.url : '';
                    addCoursField(courseName, courseUrl);
                });
            }

            // Clear and populate projects
            document.getElementById('projects-container').innerHTML = '';
            if (module.projects && module.projects.length > 0) {
                module.projects.forEach(project => {
                    const projectName = typeof project === 'string' ? project : project.name || project;
                    const projectUrl = typeof project === 'object' ? project.url : '';
                    addProjectField(projectName, projectUrl);
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
        card.className = 'col-md-6 col-lg-4';
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
                <p>${escapeHtml(section.content)}</p>
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

function addCoursField(courseName = '', courseUrl = '') {
    const container = document.getElementById('courses-container');
    const id = Date.now();
    const courseItem = document.createElement('div');
    courseItem.className = 'course-item mb-3 p-2 border rounded bg-white';
    courseItem.innerHTML = `
        <div class="row align-items-end g-2">
            <div class="col-md-6">
                <label class="form-label form-label-sm">Course Name</label>
                <input type="text" class="form-control form-control-sm course-name" placeholder="e.g., JavaScript Basics" value="${escapeHtml(courseName)}" required />
            </div>
            <div class="col-md-4">
                <label class="form-label form-label-sm">Course URL (optional)</label>
                <input type="url" class="form-control form-control-sm course-url" placeholder="https://..." value="${escapeHtml(courseUrl)}" />
            </div>
            <div class="col-md-2 text-end">
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

function addProjectField(projectName = '', projectUrl = '') {
    const container = document.getElementById('projects-container');
    const id = Date.now();
    const projectItem = document.createElement('div');
    projectItem.className = 'project-item mb-3 p-2 border rounded bg-white';
    projectItem.innerHTML = `
        <div class="row align-items-end g-2">
            <div class="col-md-6">
                <label class="form-label form-label-sm">Project Name</label>
                <input type="text" class="form-control form-control-sm project-name" placeholder="e.g., Build a Todo App" value="${escapeHtml(projectName)}" required />
            </div>
            <div class="col-md-4">
                <label class="form-label form-label-sm">Project URL (optional)</label>
                <input type="url" class="form-control form-control-sm project-url" placeholder="https://github.com/..." value="${escapeHtml(projectUrl)}" />
            </div>
            <div class="col-md-2 text-end">
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeProjectField(this)">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>
    `;
    container.appendChild(projectItem);
}

function removeProjectField(button) {
    button.closest('.project-item').remove();
}

function setupForms() {
    // Module form
    document.getElementById('module-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('module-name').value;
        const duration = parseInt(document.getElementById('module-duration').value);

        // Collect courses with URLs
        const courses = [];
        document.querySelectorAll('#courses-container .course-item').forEach(item => {
            const courseName = item.querySelector('.course-name')?.value || '';
            const courseUrl = item.querySelector('.course-url')?.value || '';
            if (courseName) {
                courses.push({ name: courseName, url: courseUrl });
            }
        });

        // Collect projects with URLs
        const projects = [];
        document.querySelectorAll('#projects-container .project-item').forEach(item => {
            const projectName = item.querySelector('.project-name')?.value || '';
            const projectUrl = item.querySelector('.project-url')?.value || '';
            if (projectName) {
                projects.push({ name: projectName, url: projectUrl });
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
                    projects
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
                    body: JSON.stringify({ name, duration, courses, projects })
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

        const email = document.getElementById('student-email').value;
        const name = document.getElementById('student-name').value;
        const token = localStorage.getItem('token');

        try {
            const response = await fetch(`${API_URL}/api/promotions/${promotionId}/students`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ email, name })
            });

            if (response.ok) {
                const data = await response.json();
                studentModal.hide();
                document.getElementById('student-form').reset();
                loadStudents();

                // Show success modal with temp password
                document.getElementById('new-student-email').textContent = data.student.email;
                document.getElementById('new-student-password').textContent = data.tempPassword || 'Error';
                studentSuccessModal.show();
            } else {
                alert('Error adding student');
            }
        } catch (error) {
            console.error('Error adding student:', error);
        }
    });
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

function previewPromotion() {
    const isPreview = document.body.classList.toggle('preview-mode');
    const btn = document.querySelector('button[onclick="previewPromotion()"]');

    if (isPreview) {
        btn.innerHTML = '<i class="bi bi-eye-slash me-2"></i>Exit Preview';
        btn.classList.replace('btn-info', 'btn-warning');

        // Hide teacher-only elements
        document.querySelectorAll('.btn-primary, .btn-danger, .btn-outline-danger').forEach(el => el.classList.add('d-none'));
        // Also hide the students tab link
        const studentsLink = document.querySelector('a[href="#students"]');
        if (studentsLink) studentsLink.parentElement.classList.add('d-none');

        alert('You are now viewing this page as a student.');

    } else {
        btn.innerHTML = '<i class="bi bi-eye me-2"></i>Preview';
        btn.classList.replace('btn-warning', 'btn-info');

        // Show teacher-only elements
        document.querySelectorAll('.btn-primary, .btn-danger, .btn-outline-danger').forEach(el => el.classList.remove('d-none'));
        const studentsLink = document.querySelector('a[href="#students"]');
        if (studentsLink) studentsLink.parentElement.classList.remove('d-none');
    }
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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Student Management Functions
async function loadStudents() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/students`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const students = await response.json();
            displayStudents(students);
        }
    } catch (error) {
        console.error('Error loading students:', error);
    }
}

function displayStudents(students) {
    const list = document.getElementById('students-list');
    list.innerHTML = '';

    if (students.length === 0) {
        list.innerHTML = '<div class="col-12"><p class="text-muted">No students enrolled yet</p></div>';
        return;
    }

    students.forEach(student => {
        const card = document.createElement('div');
        card.className = 'col-md-6 mb-3';
        card.innerHTML = `
            <div class="card">
                <div class="card-body d-flex justify-content-between align-items-center">
                    <div>
                        <h5 class="card-title mb-1">${escapeHtml(student.name)}</h5>
                        <p class="card-text text-muted mb-0">${escapeHtml(student.email)}</p>
                    </div>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteStudent('${student.id}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        `;
        list.appendChild(card);
    });
}

async function deleteStudent(studentId) {
    if (!confirm('Are you sure you want to remove this student?')) return;

    const token = localStorage.getItem('token');
    try {
        await fetch(`${API_URL}/api/promotions/${promotionId}/students/${studentId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadStudents();
    } catch (error) {
        console.error('Error deleting student:', error);
    }
}
