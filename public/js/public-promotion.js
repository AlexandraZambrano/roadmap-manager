const API_URL = window.APP_CONFIG?.API_URL || window.location.origin;
let promotionId = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    promotionId = new URLSearchParams(window.location.search).get('id');

    if (!promotionId) {
        document.body.innerHTML = '<div class="alert alert-danger m-5">Promotion not found</div>';
        return;
    }

    loadPromotion();
    loadModules();
    loadQuickLinks();
    loadSections();
    loadCalendar();
});

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

    if (modules.length === 0) {
        table.innerHTML = '<tr><td class="text-muted">No modules configured</td></tr>';
        return;
    }

    // Create header
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

    // Create rows for modules
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
        weekCounter += module.duration;

        // Add courses row if available
        if (module.courses && module.courses.length > 0) {
            const coursesRow = document.createElement('tr');
            const coursesLabel = document.createElement('td');
            coursesLabel.innerHTML = `<small class="text-muted">Courses</small>`;
            coursesRow.appendChild(coursesLabel);
            for (let i = 0; i < weeks; i++) {
                const cell = document.createElement('td');
                if (i >= weekCounter - module.duration && i < weekCounter) {
                    cell.innerHTML = `<small>${module.courses.join(', ')}</small>`;
                }
                coursesRow.appendChild(cell);
            }
            table.appendChild(coursesRow);
        }

        // Add projects row if available
        if (module.projects && module.projects.length > 0) {
            const projectsRow = document.createElement('tr');
            const projectsLabel = document.createElement('td');
            projectsLabel.innerHTML = `<small class="text-muted">Projects</small>`;
            projectsRow.appendChild(projectsLabel);
            for (let i = 0; i < weeks; i++) {
                const cell = document.createElement('td');
                if (i >= weekCounter - module.duration && i < weekCounter) {
                    cell.innerHTML = `<small>${module.projects.join(', ')}</small>`;
                }
                projectsRow.appendChild(cell);
            }
            table.appendChild(projectsRow);
        }
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
