const API_URL = window.APP_CONFIG?.API_URL || window.location.origin;
let promotionId = null;
let passwordModal = null;
let promotionHasPassword = false;
let isAccessVerified = false;
let isPreviewMode = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    promotionId = params.get('id');
    isPreviewMode = params.get('preview') === '1';

    if (!promotionId) {
        document.body.innerHTML = '<div class="alert alert-danger m-5">Promotion not found</div>';
        return;
    }

    // Initialize password modal (student access mode only)
    const modalEl = document.getElementById('passwordModal');
    if (modalEl) {
        passwordModal = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
    }

    if (isPreviewMode) {
        // In preview mode (from teacher overview), bypass password and tracking
        loadPromotionContent();
    } else {
        // Check if promotion requires password
        checkPasswordRequirement();
    }
});

async function checkPasswordRequirement() {
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}`);

        if (response.ok) {
            const promotion = await response.json();
            promotionHasPassword = !!promotion.accessPassword;

            if (promotionHasPassword && !isAccessVerified) {
                // Show password modal
                if (passwordModal) {
                    passwordModal.show();
                }
            } else {
                // Load promotion content
                loadPromotionContent();
            }
        }
    } catch (error) {
        console.error('Error checking password requirement:', error);
    }
}

// Verify promotion password
window.verifyPromotionPassword = async function () {
    const password = document.getElementById('access-password').value;
    const alertEl = document.getElementById('password-alert');
    const btnSpinner = document.querySelector('.modal-footer .spinner-border');

    if (!password) {
        alertEl.textContent = 'Please enter the password';
        alertEl.classList.remove('hidden');
        return;
    }

    alertEl.classList.add('hidden');
    btnSpinner.classList.remove('hidden');

    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/verify-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        const contentType = response.headers.get('content-type');
        let data;
        try {
            data = contentType && contentType.includes('application/json')
                ? await response.json()
                : {};
        } catch (parseError) {
            console.error('Error parsing response:', parseError);
            alertEl.textContent = 'Invalid server response. Please try again.';
            alertEl.classList.remove('hidden');
            btnSpinner.classList.add('hidden');
            return;
        }

        if (response.ok) {
            // Store access token in session storage (not localStorage) for security
            sessionStorage.setItem('promotionAccessToken', data.accessToken);
            sessionStorage.setItem('promotionId', promotionId);

            isAccessVerified = true;

            // Hide modal and load content
            if (passwordModal) {
                passwordModal.hide();
            }

            // Auto-track student without prompting for info
            await trackStudentQuietly();
        } else {
            const errorMsg = data.error || 'Invalid password. Please try again.';
            alertEl.textContent = errorMsg;
            alertEl.classList.remove('hidden');
            console.error('Password verification failed:', response.status, data);
        }
    } catch (error) {
        console.error('Password verification error:', error);
        alertEl.textContent = 'Connection error. Please try again.';
        alertEl.classList.remove('hidden');
    } finally {
        btnSpinner.classList.add('hidden');
    }
};

// Auto-track student without prompting
async function trackStudentQuietly() {
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/track-student`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        if (response.ok) {
            const data = await response.json();
            sessionStorage.setItem('studentId', data.student.id);
        } else {
            console.error('Error tracking student:', response.status);
        }
    } catch (error) {
        console.error('Error tracking student:', error);
    }

    // Load content regardless of tracking result
    loadPromotionContent();
}

async function loadPromotionContent() {
    loadPromotion();
    loadModules();
    loadQuickLinks();
    loadSections();
    loadCalendar();
}

async function loadPromotion() {
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}`);

        if (response.ok) {
            const promotion = await response.json();
            document.getElementById('promotion-title').textContent = `¡Hola Coder! 👋 - ${promotion.name}`;
            document.getElementById('promotion-desc').textContent = promotion.description || '';
            document.title = `${promotion.name} - Bootcamp`;

            generateGanttChart(promotion);
        }
    } catch (error) {
        console.error('Error loading promotion:', error);
    }
}

async function loadModules() {
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}`);

        if (response.ok) {
            const promotion = await response.json();
            generateGanttChart(promotion);
        }
    } catch (error) {
        console.error('Error loading modules:', error);
    }
}

function generateGanttChart(promotion) {
    const table = document.getElementById('gantt-table');
    table.innerHTML = '';

    const weeks = promotion.weeks || 0;
    const modules = promotion.modules || [];
    const employability = promotion.employability || [];

    if (modules.length === 0) {
        table.innerHTML = '<tr><td class="text-muted">No modules configured</td></tr>';
        return;
    }

    // Helper function to get month for a week (1-indexed)
    function getMonthForWeek(weekNum) {
        return Math.ceil(weekNum / 4);
    }

    // Create month header
    const monthRow = document.createElement('tr');
    const monthHeaderCell = document.createElement('th');
    monthHeaderCell.innerHTML = '<strong>Months</strong>';
    monthRow.appendChild(monthHeaderCell);

    let currentMonth = 0;
    let monthSpan = 0;
    let monthCell = null;

    for (let i = 1; i <= weeks; i++) {
        const month = getMonthForWeek(i);

        if (month !== currentMonth) {
            if (monthCell) {
                monthCell.colSpan = monthSpan;
            }
            currentMonth = month;
            monthCell = document.createElement('th');
            monthCell.innerHTML = `<strong>M${month}</strong>`;
            monthCell.style.textAlign = 'center';
            monthCell.style.fontSize = '0.8rem';
            monthCell.style.borderRight = '2px solid #0e7a9f';
            monthRow.appendChild(monthCell);
            monthSpan = 1;
        } else {
            monthSpan++;
        }
    }
    if (monthCell) {
        monthCell.colSpan = monthSpan;
    }

    table.appendChild(monthRow);

    // Create week header
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = '<th>Module</th>';

    for (let i = 1; i <= weeks; i++) {
        const th = document.createElement('th');
        th.textContent = `W${i}`;
        th.style.textAlign = 'center';
        th.style.fontSize = '0.8rem';
        headerRow.appendChild(th);
    }

    table.appendChild(headerRow);

    // Sesiones Empleabilidad before modules
    if (employability && employability.length > 0) {
        // Separator row
        const separatorRow = document.createElement('tr');
        separatorRow.style.height = '10px';
        const separatorCell = document.createElement('td');
        separatorCell.colSpan = weeks + 1;
        separatorRow.appendChild(separatorCell);
        table.appendChild(separatorRow);

        // Section header (Sesiones Empleabilidad)
        const sectionHeaderRow = document.createElement('tr');
        const sectionHeaderCell = document.createElement('td');
        sectionHeaderCell.innerHTML = '<strong>💼 Sesiones Empleabilidad</strong>';
        sectionHeaderCell.colSpan = weeks + 1;
        sectionHeaderRow.appendChild(sectionHeaderCell);
        table.appendChild(sectionHeaderRow);

        // Employability items
        employability.forEach((item) => {
            const itemRow = document.createElement('tr');
            const itemLabel = document.createElement('td');
            const itemUrl = item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" class="text-decoration-none">${escapeHtml(item.name)}</a>` : escapeHtml(item.name);
            itemLabel.innerHTML = `<small>${itemUrl}</small>`;
            itemRow.appendChild(itemLabel);

            // Convert months to weeks: startMonth is 1-indexed
            const startWeek = (item.startMonth - 1) * 4;
            const endWeek = startWeek + (item.duration * 4);

            for (let i = 0; i < weeks; i++) {
                const cell = document.createElement('td');
                cell.style.textAlign = 'center';
                cell.style.height = '30px';

                if (i >= startWeek && i < endWeek) {
                    cell.style.backgroundColor = '#fff3cd';
                    cell.innerHTML = '●';
                }
                itemRow.appendChild(cell);
            }
            table.appendChild(itemRow);
        });
    }

    // Create rows for modules (below Sesiones Empleabilidad)
    let weekCounter = 0;
    modules.forEach((module, index) => {
        const row = document.createElement('tr');
        const nameCell = document.createElement('td');
        nameCell.innerHTML = `<strong>Module ${index + 1}: ${escapeHtml(module.name)}</strong>`;
        nameCell.style.maxWidth = '200px';
        row.appendChild(nameCell);

        for (let i = 0; i < weeks; i++) {
            const cell = document.createElement('td');
            cell.style.textAlign = 'center';
            cell.style.height = '40px';

            if (i >= weekCounter && i < weekCounter + module.duration) {
                cell.style.backgroundColor = '#667eea';
                cell.style.color = 'white';
                cell.innerHTML = '●';
            }

            row.appendChild(cell);
        }

        table.appendChild(row);

        // Create rows for courses and projects
        if (module.courses && module.courses.length > 0) {
            module.courses.forEach(courseObj => {
                const isObj = courseObj && typeof courseObj === 'object';
                const courseName = isObj ? (courseObj.name || 'Unnamed') : String(courseObj);
                const courseUrl = isObj ? (courseObj.url || '') : '';
                const courseDur = isObj ? (Number(courseObj.duration) || 1) : 1;
                const courseOff = isObj ? (Number(courseObj.startOffset) || 0) : 0;

                const coursesRow = document.createElement('tr');
                const coursesLabel = document.createElement('td');
                const courseLink = courseUrl ? `<a href="${escapeHtml(courseUrl)}" target="_blank" class="text-decoration-none">📖 ${escapeHtml(courseName)}</a>` : `📖 ${escapeHtml(courseName)}`;
                coursesLabel.innerHTML = `<small>${courseLink}</small>`;
                coursesRow.appendChild(coursesLabel);

                const absoluteStart = weekCounter + courseOff;
                const absoluteEnd = absoluteStart + courseDur;

                for (let i = 0; i < weeks; i++) {
                    const cell = document.createElement('td');
                    if (i >= absoluteStart && i < absoluteEnd) {
                        cell.style.backgroundColor = '#d1e7dd';
                        cell.innerHTML = '●';
                    }
                    coursesRow.appendChild(cell);
                }
                table.appendChild(coursesRow);
            });
        }

        if (module.projects && module.projects.length > 0) {
            module.projects.forEach(projectObj => {
                const isObj = projectObj && typeof projectObj === 'object';
                const projectName = isObj ? (projectObj.name || 'Unnamed') : String(projectObj);
                const projectUrl = isObj ? (projectObj.url || '') : '';
                const projectDur = isObj ? (Number(projectObj.duration) || 1) : 1;
                const projectOff = isObj ? (Number(projectObj.startOffset) || 0) : 0;

                const projectsRow = document.createElement('tr');
                const projectsLabel = document.createElement('td');
                const projectLink = projectUrl ? `<a href="${escapeHtml(projectUrl)}" target="_blank" class="text-decoration-none">🎯 ${escapeHtml(projectName)}</a>` : `🎯 ${escapeHtml(projectName)}`;
                projectsLabel.innerHTML = `<small>${projectLink}</small>`;
                projectsRow.appendChild(projectsLabel);

                const absoluteStart = weekCounter + projectOff;
                const absoluteEnd = absoluteStart + projectDur;

                for (let i = 0; i < weeks; i++) {
                    const cell = document.createElement('td');
                    if (i >= absoluteStart && i < absoluteEnd) {
                        cell.style.backgroundColor = '#fce4e4';
                        cell.innerHTML = '●';
                    }
                    projectsRow.appendChild(cell);
                }
                table.appendChild(projectsRow);
            });
        }

        // Correct position for weekCounter update
        weekCounter += module.duration;
    });
}

async function loadQuickLinks() {
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/quick-links`);

        if (response.ok) {
            const links = await response.json();
            displayQuickLinks(links);
        }
    } catch (error) {
        console.error('Error loading quick links:', error);
    }
}

function displayQuickLinks(links) {
    const list = document.getElementById('quick-links-list');
    list.innerHTML = '';

    if (links.length === 0) {
        document.getElementById('quick-links').classList.add('hidden');
        return;
    }

    links.forEach(link => {
        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-3';
        col.innerHTML = `
            <div class="d-grid gap-2">
                <a href="${escapeHtml(link.url)}" target="_blank" class="btn btn-outline-primary">
                    <i class="bi bi-box-arrow-up-right me-2"></i> ${escapeHtml(link.name)}
                </a>
            </div>
        `;
        list.appendChild(col);
    });
}

async function loadSections() {
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/sections`);

        if (response.ok) {
            const sections = await response.json();
            displaySections(sections);
        }
    } catch (error) {
        console.error('Error loading sections:', error);
    }
}

function displaySections(sections) {
    const container = document.getElementById('sections-container');
    container.innerHTML = '';

    sections.forEach((section, index) => {
        const col = document.createElement('div');
        col.className = 'col-md-12';
        col.id = section.id;
        col.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <h5 class="card-title section-title">
                        <i class="bi bi-file-text me-2"></i> ${escapeHtml(section.title)}
                    </h5>
                    <p class="card-text">${escapeHtml(section.content).replace(/\n/g, '<br>')}</p>
                </div>
            </div>
        `;
        container.appendChild(col);
    });

    // Update sidebar navigation
    updateSidebar(sections);
}

function updateSidebar(sections) {
    const nav = document.getElementById('sidebar-nav');
    nav.innerHTML = `
        <li class="nav-item"><a class="nav-link" href="#overview"><i class="bi bi-eye me-2"></i>Overview</a></li>
        <li class="nav-item"><a class="nav-link" href="#roadmap"><i class="bi bi-map me-2"></i>Roadmap</a></li>
    `;

    sections.forEach(section => {
        const li = document.createElement('li');
        li.className = 'nav-item';
        li.innerHTML = `<a class="nav-link" href="#${section.id}"><i class="bi bi-file-text me-2"></i>${escapeHtml(section.title)}</a>`;
        nav.appendChild(li);
    });

    const li = document.createElement('li');
    li.className = 'nav-item';
    li.innerHTML = '<a class="nav-link" href="#quick-links"><i class="bi bi-lightning-charge me-2"></i>Quick Links</a>';
    nav.appendChild(li);
}

async function loadCalendar() {
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/calendar`);

        if (response.ok) {
            const calendar = await response.json();
            const calendarCard = document.getElementById('calendar').querySelector('.card');
            calendarCard.classList.remove('hidden');
            document.getElementById('calendar-iframe').src = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(calendar.googleCalendarId)}&ctz=Europe/Madrid`;
        }
    } catch (error) {
        console.error('Error loading calendar:', error);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
