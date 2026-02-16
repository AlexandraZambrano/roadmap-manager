const API_URL = window.APP_CONFIG?.API_URL || window.location.origin;

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadDashboard();
});

function checkAuth() {
    const token = localStorage.getItem('token');
    const userJson = localStorage.getItem('user');

    if (!token || !userJson) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const user = JSON.parse(userJson);
        document.getElementById('student-name').textContent = user.name;
    } catch (e) {
        logout();
    }
}

async function loadDashboard() {
    try {
        const token = localStorage.getItem('token');

        const response = await fetch(`${API_URL}/api/my-enrollments`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const promotions = await response.json();
            if (promotions.length > 0) {
                // Load the first promotion found for the student view
                const promotion = promotions[0];
                populateDashboard(promotion);
            } else {
                showNoEnrollments();
            }
        } else {
            console.error('Failed to fetch enrollments');
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function showNoEnrollments() {
    document.querySelector('.section-container').innerHTML = `
        <div class="alert alert-warning text-center p-5">
            <h3>No Active Programs</h3>
            <p>You seem to not be enrolled in any bootcamp yet.</p>
        </div>
    `;
}

function populateDashboard(promotion) {
    // 1. Description
    if (promotion.description) {
        document.getElementById('promotion-description').innerHTML = escapeHtml(promotion.description);
    }

    // 2. Roadmap / Gantt
    generateGantt(promotion);

    // 3. Calendar
    loadCalendar(promotion.id);

    // 4. Quick Links
    loadQuickLinks(promotion.id);

    // 5. Dynamic Sections (Modules/Competencias)
    if (promotion.modules && promotion.modules.length > 0) {
        renderModulesAccordion(promotion.modules);
    }

    // 6. Extended Info (Schedule, Team, Resources, Evaluation)
    loadExtendedInfo(promotion.id);
}

async function loadExtendedInfo(promotionId) {
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/extended-info`);
        if (response.ok) {
            const info = await response.json();
            renderSchedule(info.schedule);
            renderTeam(info.team);
            renderResources(info.resources);
            renderEvaluation(info.evaluation);
        }
    } catch (error) {
        console.error('Error loading extended info:', error);
    }
}

function renderSchedule(schedule) {
    const container = document.getElementById('horario').querySelector('.card-body');
    if (!schedule || (!schedule.online && !schedule.presential)) return; // Keep default if no data

    let html = `
        <h5 class="card-title section-title">
            <i class="bi bi-clock"></i> Horario
        </h5>
        <br/>
    `;

    if (schedule.notes) {
        html += `<div class="mb-3">${escapeHtml(schedule.notes)}</div>`;
    }

    html += '<div class="row">';

    // Online Column
    if (schedule.online) {
        html += `
            <div class="col-md-6">
                <h6 class="text-primary">Online Days</h6>
                <ul class="list-unstyled">
                    <li><strong>Entry:</strong> ${schedule.online.entry || '-'}</li>
                    <li><strong>Start:</strong> ${schedule.online.start || '-'}</li>
                    <li><strong>Break:</strong> ${schedule.online.break || '-'}</li>
                    <li><strong>Lunch:</strong> ${schedule.online.lunch || '-'}</li>
                    <li><strong>Finish:</strong> ${schedule.online.finish || '-'}</li>
                </ul>
            </div>
        `;
    }

    // Presential Column
    if (schedule.presential) {
        html += `
            <div class="col-md-6">
                <h6 class="text-success">Presential Days</h6>
                <ul class="list-unstyled">
                    <li><strong>Entry:</strong> ${schedule.presential.entry || '-'}</li>
                    <li><strong>Start:</strong> ${schedule.presential.start || '-'}</li>
                    <li><strong>Break:</strong> ${schedule.presential.break || '-'}</li>
                    <li><strong>Lunch:</strong> ${schedule.presential.lunch || '-'}</li>
                    <li><strong>Finish:</strong> ${schedule.presential.finish || '-'}</li>
                </ul>
            </div>
        `;
    }

    html += '</div>';
    container.innerHTML = html;
}

function renderTeam(team) {
    const container = document.getElementById('team-list'); // UL element
    if (!team || team.length === 0) return;

    container.innerHTML = '';
    team.forEach(member => {
        const li = document.createElement('li');
        li.innerHTML = `
            <a href="${escapeHtml(member.linkedin)}" target="_blank" rel="noopener noreferrer">
                ${escapeHtml(member.name)} <i class="bi bi-linkedin"></i>
            </a> 
            : ${escapeHtml(member.email)} — <strong>${escapeHtml(member.role)}</strong>
        `;
        container.appendChild(li);
    });
}

function renderResources(resources) {
    // This targets the specific "Recursos de interés" section
    const container = document.getElementById('resources').querySelector('.card-body');
    if (!resources || resources.length === 0) return;

    // We can group by category or just list them. Let's group.
    const grouped = {};
    resources.forEach(res => {
        const cat = res.category || 'Other';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(res);
    });

    let html = `
        <h5 class="card-title section-title">
            <i class="bi bi-tools"></i> Recursos de interés
        </h5>
        <div class="row">
    `;

    // Split into 2 columns
    const categories = Object.keys(grouped);
    const half = Math.ceil(categories.length / 2);

    const col1 = categories.slice(0, half);
    const col2 = categories.slice(half);

    const renderCol = (cats) => {
        let colHtml = '<div class="col-md-6"><div class="d-grid gap-2"><br>';
        cats.forEach(cat => {
            colHtml += `<strong>${escapeHtml(cat)}</strong><ul>`;
            grouped[cat].forEach(item => {
                colHtml += `
                    <li>
                        <a href="${escapeHtml(item.url)}" target="_blank">${escapeHtml(item.title)}</a>
                    </li>
                `;
            });
            colHtml += '</ul>';
        });
        colHtml += '</div></div>';
        return colHtml;
    };

    html += renderCol(col1);
    if (col2.length > 0) html += renderCol(col2);

    html += '</div>';
    container.innerHTML = html;
}

function renderEvaluation(evaluation) {
    const container = document.getElementById('evaluacion').querySelector('.card-body');
    if (!evaluation) return;

    // Convert newlines to breaks or paragraphs
    const content = escapeHtml(evaluation).replace(/\n/g, '<br>');

    container.innerHTML = `
        <h5 class="card-title section-title">
            <i class="bi bi-clipboard-check"></i> Evaluación
        </h5>
        <br/>
        <div>
            ${content}
        </div>
    `;
}

function generateGantt(promotion) {
    const table = document.getElementById('gantt-table');
    table.innerHTML = '';
    document.getElementById('gantt-loading').classList.add('hidden');

    const weeks = promotion.weeks || 24; // Default to 24 if not set
    const modules = promotion.modules || [];

    if (modules.length === 0) {
        table.innerHTML = '<tr><td class="text-center p-3">No modules defined</td></tr>';
        return;
    }

    // Header Row
    const headerRow = document.createElement('tr');
    const emptyHeader = document.createElement('th');
    emptyHeader.className = 'label';
    emptyHeader.textContent = 'Módulos / Semanas';
    headerRow.appendChild(emptyHeader);

    for (let i = 1; i <= weeks; i++) {
        const th = document.createElement('th');
        th.textContent = i;
        headerRow.appendChild(th);
    }
    table.appendChild(headerRow);

    // Data Rows
    let weekCounter = 0;

    // Define colors/classes based on user CSS
    const classTypes = ['tema', 'proyecto', 'transicion'];

    modules.forEach((module, index) => {
        // Module Row
        const row = document.createElement('tr');
        const label = document.createElement('td');
        label.className = 'label';
        label.innerHTML = `<strong>${escapeHtml(module.name)}</strong>`;
        row.appendChild(label);

        // Calculate start and end week for this module
        // We assume modules are sequential
        const startWeek = weekCounter;
        const endWeek = weekCounter + module.duration;

        for (let i = 0; i < weeks; i++) {
            const cell = document.createElement('td');
            if (i >= startWeek && i < endWeek) {
                // Just cycle through styles for variety or use specific logic
                // Using 'tema' (orange) as default for modules
                cell.className = 'block tema';
                cell.title = module.name;
                // Optional: Inner text if needed, but user CSS hides text mostly or colors it white
            } else {
                cell.className = 'empty';
            }
            row.appendChild(cell);
        }
        table.appendChild(row);

        // Show individual courses
        if (module.courses && module.courses.length > 0) {
            module.courses.forEach(course => {
                const courseName = typeof course === 'string' ? course : course.name || course;
                const courseUrl = typeof course === 'object' ? course.url : '';

                const courseRow = document.createElement('tr');
                const courseLabel = document.createElement('td');
                courseLabel.className = 'label';
                const courseLink = courseUrl ? `<a href="${escapeHtml(courseUrl)}" target="_blank" class="text-decoration-none">📖 ${escapeHtml(courseName)}</a>` : `📖 ${escapeHtml(courseName)}`;
                courseLabel.innerHTML = courseLink;
                courseRow.appendChild(courseLabel);

                for (let i = 0; i < weeks; i++) {
                    const cell = document.createElement('td');
                    if (i >= startWeek && i < endWeek) {
                        cell.className = 'block tema'; // Green for courses
                    } else {
                        cell.className = 'empty';
                    }
                    courseRow.appendChild(cell);
                }
                table.appendChild(courseRow);
            });
        }

        // Show individual projects
        if (module.projects && module.projects.length > 0) {
            module.projects.forEach(project => {
                const projectName = typeof project === 'string' ? project : project.name || project;
                const projectUrl = typeof project === 'object' ? project.url : '';

                const projRow = document.createElement('tr');
                const projLabel = document.createElement('td');
                projLabel.className = 'label';
                const projectLink = projectUrl ? `<a href="${escapeHtml(projectUrl)}" target="_blank" class="text-decoration-none">🎯 ${escapeHtml(projectName)}</a>` : `🎯 ${escapeHtml(projectName)}`;
                projLabel.innerHTML = projectLink;
                projRow.appendChild(projLabel);

                for (let i = 0; i < weeks; i++) {
                    const cell = document.createElement('td');
                    if (i >= startWeek && i < endWeek) {
                        cell.className = 'block proyecto'; // Orange for projects
                    } else {
                        cell.className = 'empty';
                    }
                    projRow.appendChild(cell);
                }
                table.appendChild(projRow);
            });
        }

        weekCounter += module.duration;
    });
}

async function loadCalendar(promotionId) {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/calendar`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const calendar = await response.json();
            const iframe = document.getElementById('calendar-iframe');
            if (calendar.googleCalendarId) {
                iframe.src = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(calendar.googleCalendarId)}&ctz=Europe/Madrid`;
                document.getElementById('no-calendar-msg').classList.add('hidden');
                iframe.classList.remove('hidden');
            } else {
                document.getElementById('no-calendar-msg').classList.remove('hidden');
                iframe.classList.add('hidden');
            }
        }
    } catch (error) {
        console.error('Error loading calendar:', error);
    }
}

async function loadQuickLinks(promotionId) {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/quick-links`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const links = await response.json();
            renderQuickLinks(links);
        }
    } catch (error) {
        console.error('Error loading quick links:', error);
    }
}

function renderQuickLinks(links) {
    const container = document.getElementById('quick-links-container');
    container.innerHTML = '';

    // User HTML had hardcoded structure in #link section. 
    // We will append to it or replace content. 
    // The user HTML has a list of buttons in columns.

    const platformIcons = {
        'zoom': 'bi-camera-video',
        'discord': 'bi-discord',
        'classroom': 'bi-grid-3x3-gap',
        'github': 'bi-github',
        'custom': 'bi-link'
    };

    if (links.length === 0) {
        container.innerHTML = '<div class="col-12 text-center">No links available</div>';
        return;
    }

    // Simply list them as buttons in columns
    links.forEach(link => {
        const icon = platformIcons[link.platform] || platformIcons['custom'];

        const col = document.createElement('div');
        col.className = 'col-md-4 mb-3';
        col.innerHTML = `
            <div class="d-grid gap-2">
                <a href="${escapeHtml(link.url)}" target="_blank" class="btn btn-outline-primary text-start">
                    <i class="bi ${icon} me-2"></i> ${escapeHtml(link.name)}
                </a>
            </div>
        `;
        container.appendChild(col);
    });
}

function renderModulesAccordion(modules) {
    const container = document.getElementById('accordion');
    container.innerHTML = '';

    modules.forEach((module, index) => {
        const id = `collapse${index}`;
        const item = document.createElement('div');
        item.className = 'accordion-item';

        // Handle courses - support both string and object formats
        const coursesList = (module.courses || []).map(c => {
            const courseName = typeof c === 'string' ? c : c.name || c;
            const courseUrl = typeof c === 'object' ? c.url : '';
            if (courseUrl) {
                return `<li><a href="${escapeHtml(courseUrl)}" target="_blank">${escapeHtml(courseName)}</a></li>`;
            } else {
                return `<li>${escapeHtml(courseName)}</li>`;
            }
        }).join('');

        // Handle projects - support both string and object formats
        const projectsList = (module.projects || []).map(p => {
            const projectName = typeof p === 'string' ? p : p.name || p;
            const projectUrl = typeof p === 'object' ? p.url : '';
            if (projectUrl) {
                return `<li><a href="${escapeHtml(projectUrl)}" target="_blank">${escapeHtml(projectName)}</a></li>`;
            } else {
                return `<li>${escapeHtml(projectName)}</li>`;
            }
        }).join('');

        item.innerHTML = `
            <h2 class="accordion-header" id="heading${index}">
                <button class="accordion-button ${index !== 0 ? 'collapsed' : ''}" type="button" data-bs-toggle="collapse" data-bs-target="#${id}">
                    Módulo ${index + 1}: ${escapeHtml(module.name)}
                </button>
            </h2>
            <div id="${id}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" data-bs-parent="#accordion">
                <div class="accordion-body">
                    <p><strong>Duration:</strong> ${module.duration} weeks</p>
                    ${coursesList ? `<h6>Temas:</h6><ul>${coursesList}</ul>` : ''}
                    ${projectsList ? `<h6>Proyectos:</h6><ul>${projectsList}</ul>` : ''}
                </div>
            </div>
        `;
        container.appendChild(item);
    });
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    window.location.href = 'login.html';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
