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

            // Load content after successful password verification
            loadPromotionContent();
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

async function loadPromotionContent() {
    loadPromotion();
    loadModules();
    loadQuickLinks();
    loadSections();
    loadCalendar();
    loadExtendedInfo(); // Add this line to load Program Info
}

async function loadPromotion() {
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}`);

        if (response.ok) {
            const promotion = await response.json();
            document.getElementById('promotion-title').textContent = `¡Hola Coder! 👋 - ${promotion.name}`;
            document.title = `${promotion.name} - Bootcamp`;

            // Store promotion data globally for module access
            window.publicPromotionData = promotion;

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

    // Add responsive wrapper styling to the table
    table.style.fontSize = '0.75rem';
    table.className = 'table table-sm table-bordered';
    
    // Ensure parent container has proper overflow handling
    const tableContainer = table.closest('.table-responsive') || table.parentElement;
    if (tableContainer) {
        tableContainer.style.overflowX = 'auto';
        tableContainer.style.maxWidth = '100%';
    }

    // Helper function to get month for a week (1-indexed)
    function getMonthForWeek(weekNum) {
        return Math.ceil(weekNum / 4);
    }

    // Create month header
    const monthRow = document.createElement('tr');
    const monthHeaderCell = document.createElement('th');
    monthHeaderCell.innerHTML = '<strong>Meses</strong>';
    monthHeaderCell.style.minWidth = '150px';
    monthHeaderCell.style.maxWidth = '200px';
    monthHeaderCell.style.fontSize = '0.7rem';
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
            monthCell.style.fontSize = '0.65rem';
            monthCell.style.minWidth = '20px';
            monthCell.style.padding = '2px';
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
    const weekHeaderCell = document.createElement('th');
    weekHeaderCell.innerHTML = 'Semanas:';
    weekHeaderCell.style.minWidth = '150px';
    weekHeaderCell.style.maxWidth = '200px';
    weekHeaderCell.style.fontSize = '0.7rem';
    headerRow.appendChild(weekHeaderCell);

    for (let i = 1; i <= weeks; i++) {
        const th = document.createElement('th');
        th.textContent = `${i}`;
        th.style.textAlign = 'center';
        th.style.fontSize = '0.6rem';
        th.style.minWidth = '20px';
        th.style.maxWidth = '25px';
        th.style.padding = '2px';
        th.style.writingMode = 'vertical-rl';
        th.style.textOrientation = 'mixed';
        headerRow.appendChild(th);
    }

    table.appendChild(headerRow);

    // Sesiones Empleabilidad before modules
    if (employability && employability.length > 0) {

        // Employability items
        employability.forEach((item) => {
            const itemRow = document.createElement('tr');
            const itemLabel = document.createElement('td');
            const itemUrl = item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" class="text-decoration-none">${escapeHtml(item.name)}</a>` : escapeHtml(item.name);
            itemLabel.innerHTML = `<small><strong>Sesiones Empleabilidad:</strong> ${itemUrl}</small>`;
            itemLabel.style.minWidth = '150px';
            itemLabel.style.maxWidth = '200px';
            itemLabel.style.fontSize = '0.65rem';
            itemLabel.style.padding = '4px';
            itemRow.appendChild(itemLabel);

            // Convert months to weeks: startMonth is 1-indexed
            const startWeek = (item.startMonth - 1) * 4;
            const endWeek = startWeek + (item.duration * 4);

            for (let i = 0; i < weeks; i++) {
                const cell = document.createElement('td');
                cell.style.textAlign = 'center';
                cell.style.height = '25px';
                cell.style.minWidth = '20px';
                cell.style.maxWidth = '25px';
                cell.style.padding = '1px';
                cell.style.fontSize = '0.7rem';

                if (i >= startWeek && i < endWeek) {
                    cell.style.backgroundColor = '#fff3cd';
                }
                itemRow.appendChild(cell);
            }
            table.appendChild(itemRow);
        });
    }

    // Create rows for modules (below Sesiones Empleabilidad)
    let weekCounter = 0;
    modules.forEach((module, index) => {
        const moduleId = `module-${index}`;
        
        // Main module row with dropdown toggle
        const row = document.createElement('tr');
        const nameCell = document.createElement('td');
        nameCell.innerHTML = `
            <div class="d-flex align-items-center">
                <button class="btn btn-link p-0 me-1" type="button" data-bs-toggle="collapse" data-bs-target="#${moduleId}" aria-expanded="false" style="font-size: 0.7rem;">
                    <i class="bi bi-chevron-right" id="chevron-${moduleId}"></i>
                </button>
                <strong style="font-size: 0.7rem;">M${index + 1}: ${escapeHtml(module.name)}</strong>
            </div>
        `;
        nameCell.style.minWidth = '150px';
        nameCell.style.maxWidth = '200px';
        nameCell.style.padding = '4px';
        row.appendChild(nameCell);

        for (let i = 0; i < weeks; i++) {
            const cell = document.createElement('td');
            cell.style.textAlign = 'center';
            cell.style.height = '30px';
            cell.style.minWidth = '20px';
            cell.style.maxWidth = '25px';
            cell.style.padding = '1px';
            cell.style.fontSize = '0.7rem';

            if (i >= weekCounter && i < weekCounter + module.duration) {
                cell.style.backgroundColor = '#667eea';
                cell.style.color = 'white'
            }

            row.appendChild(cell);
        }

        table.appendChild(row);

        // Create collapsible section for courses and projects
        const hasSubItems = (module.courses && module.courses.length > 0) || (module.projects && module.projects.length > 0);
        
        if (hasSubItems) {
            const collapseContainer = document.createElement('tbody');
            collapseContainer.className = 'collapse';
            collapseContainer.id = moduleId;
            
            // Create rows for courses
            if (module.courses && module.courses.length > 0) {
                module.courses.forEach(courseObj => {
                    const isObj = courseObj && typeof courseObj === 'object';
                    const courseName = isObj ? (courseObj.name || 'Unnamed') : String(courseObj);
                    const courseUrl = isObj ? (courseObj.url || '') : '';
                    const courseDur = isObj ? (Number(courseObj.duration) || 1) : 1;
                    const courseOff = isObj ? (Number(courseObj.startOffset) || 0) : 0;

                    const coursesRow = document.createElement('tr');
                    const coursesLabel = document.createElement('td');
                    const courseLink = courseUrl ? `<a href="${escapeHtml(courseUrl)}" target="_blank" class="text-decoration-none"> ${escapeHtml(courseName)}</a>` : ` ${escapeHtml(courseName)}`;
                    coursesLabel.innerHTML = `<small style="margin-left: 1.5rem; font-size: 0.6rem;">${courseLink}</small>`;
                    coursesLabel.style.minWidth = '150px';
                    coursesLabel.style.maxWidth = '200px';
                    coursesLabel.style.padding = '2px';
                    coursesRow.appendChild(coursesLabel);

                    const absoluteStart = weekCounter + courseOff;
                    const absoluteEnd = absoluteStart + courseDur;

                    for (let i = 0; i < weeks; i++) {
                        const cell = document.createElement('td');
                        cell.style.minWidth = '20px';
                        cell.style.maxWidth = '25px';
                        cell.style.padding = '1px';
                        cell.style.height = '20px';
                        cell.style.fontSize = '0.6rem';
                        if (i >= absoluteStart && i < absoluteEnd) {
                            cell.style.backgroundColor = '#d1e7dd';
    
                        }
                        coursesRow.appendChild(cell);
                    }
                    collapseContainer.appendChild(coursesRow);
                });
            }

            // Create rows for projects
            if (module.projects && module.projects.length > 0) {
                module.projects.forEach(projectObj => {
                    const isObj = projectObj && typeof projectObj === 'object';
                    const projectName = isObj ? (projectObj.name || 'Unnamed') : String(projectObj);
                    const projectUrl = isObj ? (projectObj.url || '') : '';
                    const projectDur = isObj ? (Number(projectObj.duration) || 1) : 1;
                    const projectOff = isObj ? (Number(projectObj.startOffset) || 0) : 0;

                    const projectsRow = document.createElement('tr');
                    const projectsLabel = document.createElement('td');
                    const projectLink = projectUrl ? `<a href="${escapeHtml(projectUrl)}" target="_blank" class="text-decoration-none">${escapeHtml(projectName)}</a>` : `${escapeHtml(projectName)}`;
                    projectsLabel.innerHTML = `<small style="margin-left: 1.5rem; font-size: 0.6rem;"> ${projectLink}</small>`;
                    projectsLabel.style.minWidth = '150px';
                    projectsLabel.style.maxWidth = '200px';
                    projectsLabel.style.padding = '2px';
                    projectsRow.appendChild(projectsLabel);

                    const absoluteStart = weekCounter + projectOff;
                    const absoluteEnd = absoluteStart + projectDur;

                    for (let i = 0; i < weeks; i++) {
                        const cell = document.createElement('td');
                        cell.style.minWidth = '20px';
                        cell.style.maxWidth = '25px';
                        cell.style.padding = '1px';
                        cell.style.height = '20px';
                        cell.style.fontSize = '0.6rem';
                        if (i >= absoluteStart && i < absoluteEnd) {
                            cell.style.backgroundColor = '#fce4e4';
    
                        }
                        projectsRow.appendChild(cell);
                    }
                    collapseContainer.appendChild(projectsRow);
                });
            }
            
            table.appendChild(collapseContainer);
            
            // Add event listener for chevron rotation
            const toggleButton = nameCell.querySelector(`[data-bs-target="#${moduleId}"]`);
            const chevron = document.getElementById(`chevron-${moduleId}`);
            
            toggleButton.addEventListener('click', function() {
                setTimeout(() => {
                    if (collapseContainer.classList.contains('show')) {
                        chevron.className = 'bi bi-chevron-down';
                    } else {
                        chevron.className = 'bi bi-chevron-right';
                    }
                }, 10);
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
        <li class="nav-item"><a class="nav-link" href="#roadmap"><i class="bi bi-map me-2"></i>Roadmap</a></li>
    `;

    sections.forEach(section => {
        const li = document.createElement('li');
        li.className = 'nav-item';
        li.innerHTML = `<a class="nav-link" href="#${section.id}"><i class="bi bi-file-text me-2"></i>${escapeHtml(section.title)}</a>`;
        nav.appendChild(li);
    });

    // Note: Program Info sections will be added by updateSidebarWithExtendedInfo()

    const li = document.createElement('li');
    li.className = 'nav-item';
    li.innerHTML = '<a class="nav-link" href="#quick-links"><i class="bi bi-lightning-charge me-2"></i>Quick Links</a>';
    nav.appendChild(li);
}

// Update sidebar with only the Program Info sections that have data
function updateSidebarWithExtendedInfo(info) {
    const nav = document.getElementById('sidebar-nav');
    if (!nav) {
        console.error('Sidebar navigation not found');
        return;
    }
    
    console.log('Updating sidebar with extended info:', info);
    
    // Find Quick Links item as reference point, or append at the end if not found
    const quickLinksAnchor = nav.querySelector('a[href="#quick-links"]');
    const quickLinksItem = quickLinksAnchor ? quickLinksAnchor.parentElement : null;
    
    console.log('Quick links item found:', !!quickLinksItem);
    
    // Add Program Info sections only if they have data
    if (info.schedule && hasScheduleData(info.schedule)) {
        console.log('Adding schedule section to sidebar');
        const li = document.createElement('li');
        li.className = 'nav-item';
        li.innerHTML = '<a class="nav-link" href="#horario"><i class="bi bi-clock me-2"></i>Horario</a>';
        
        if (quickLinksItem) {
            nav.insertBefore(li, quickLinksItem);
        } else {
            nav.appendChild(li);
        }
    }
    
    if (info.team && info.team.length > 0) {
        console.log('Adding team section to sidebar');
        const li = document.createElement('li');
        li.className = 'nav-item';
        li.innerHTML = '<a class="nav-link" href="#equipo"><i class="bi bi-people me-2"></i>Equipo</a>';
        
        if (quickLinksItem) {
            nav.insertBefore(li, quickLinksItem);
        } else {
            nav.appendChild(li);
        }
    }
    
    if (info.evaluation && info.evaluation.trim()) {
        console.log('Adding evaluation section to sidebar');
        const li = document.createElement('li');
        li.className = 'nav-item';
        li.innerHTML = '<a class="nav-link" href="#evaluacion"><i class="bi bi-clipboard-check me-2"></i>Evaluación</a>';
        
        if (quickLinksItem) {
            nav.insertBefore(li, quickLinksItem);
        } else {
            nav.appendChild(li);
        }
    }
    
    if (info.resources && info.resources.length > 0) {
        console.log('Adding resources section to sidebar');
        const li = document.createElement('li');
        li.className = 'nav-item';
        li.innerHTML = '<a class="nav-link" href="#resources"><i class="bi bi-tools me-2"></i>Recursos</a>';
        
        if (quickLinksItem) {
            nav.insertBefore(li, quickLinksItem);
        } else {
            nav.appendChild(li);
        }
    }

    if (Array.isArray(info.pildoras) && info.pildoras.length > 0) {
        console.log('Adding pildoras section to sidebar (legacy)');
        const li = document.createElement('li');
        li.className = 'nav-item';
        li.innerHTML = '<a class="nav-link" href="#pildoras"><i class="bi bi-lightbulb me-2"></i>Píldoras</a>';
        
        if (quickLinksItem) {
            nav.insertBefore(li, quickLinksItem);
        } else {
            nav.appendChild(li);
        }
    }

    // Check for new module-based píldoras structure
    if (Array.isArray(info.modulesPildoras) && info.modulesPildoras.length > 0) {
        // Check if any modules have píldoras
        const hasPildoras = info.modulesPildoras.some(mp => Array.isArray(mp.pildoras) && mp.pildoras.length > 0);
        if (hasPildoras) {
            console.log('Adding pildoras section to sidebar (modules)');
            const li = document.createElement('li');
            li.className = 'nav-item';
            li.innerHTML = '<a class="nav-link" href="#pildoras"><i class="bi bi-lightbulb me-2"></i>Píldoras</a>';
            
            if (quickLinksItem) {
                nav.insertBefore(li, quickLinksItem);
            } else {
                nav.appendChild(li);
            }
        }
    }
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

// Load Program Info (Extended Info) data
async function loadExtendedInfo() {
    try {
        console.log('Loading extended info for promotion:', promotionId);
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/extended-info`);

        if (response.ok) {
            const info = await response.json();
            console.log('Extended info loaded:', info);
            displayExtendedInfo(info);
        } else {
            console.log('No extended info found or error loading:', response.status);
        }
    } catch (error) {
        console.error('Error loading extended info:', error);
    }
}

// Display Program Info sections
function displayExtendedInfo(info) {
    const sectionsContainer = document.getElementById('sections-container');
    
    // Store extended info globally for píldoras navigation
    window.publicPromotionExtendedInfo = info;
    
    // Create Program Info sections and add them to the page
    const programInfoSections = createProgramInfoSections(info);
    programInfoSections.forEach(section => {
        sectionsContainer.appendChild(section);
    });
    
    // Update sidebar to include the new sections
    updateSidebarWithExtendedInfo(info);
    
    console.log('Extended info sections displayed:', programInfoSections.length);
}

// Create Program Info sections HTML
function createProgramInfoSections(info) {
    const sections = [];
    
    // Schedule Section
    if (info.schedule && hasScheduleData(info.schedule)) {
        const scheduleSection = document.createElement('div');
        scheduleSection.className = 'col-md-12';
        scheduleSection.id = 'horario';
        scheduleSection.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <h5 class="card-title section-title">
                        <i class="bi bi-clock me-2"></i>Horario
                    </h5>
                    ${generateScheduleHTML(info.schedule)}
                </div>
            </div>
        `;
        sections.push(scheduleSection);
    }
    
    // Team Section
    if (info.team && info.team.length > 0) {
        const teamSection = document.createElement('div');
        teamSection.className = 'col-md-12';
        teamSection.id = 'equipo';
        teamSection.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <h5 class="card-title section-title">
                        <i class="bi bi-people me-2"></i>Equipo
                    </h5>
                    ${generateTeamHTML(info.team)}
                </div>
            </div>
        `;
        sections.push(teamSection);
    }
    
    // Evaluation Section
    if (info.evaluation && info.evaluation.trim()) {
        const evaluationSection = document.createElement('div');
        evaluationSection.className = 'col-md-12';
        evaluationSection.id = 'evaluacion';
        evaluationSection.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <h5 class="card-title section-title">
                        <i class="bi bi-clipboard-check me-2"></i>Evaluación
                    </h5>
                    <div class="mt-3">
                        ${escapeHtml(info.evaluation).replace(/\n/g, '<br>')}
                    </div>
                </div>
            </div>
        `;
        sections.push(evaluationSection);
    }
    
    // Resources Section
    if (info.resources && info.resources.length > 0) {
        const resourcesSection = document.createElement('div');
        resourcesSection.className = 'col-md-12';
        resourcesSection.id = 'resources';
        resourcesSection.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <h5 class="card-title section-title">
                        <i class="bi bi-tools me-2"></i>Recursos
                    </h5>
                    ${generateResourcesHTML(info.resources)}
                </div>
            </div>
        `;
        sections.push(resourcesSection);
    }

    // Píldoras Section (Legacy format)
    if (Array.isArray(info.pildoras) && info.pildoras.length > 0) {
        const pildorasSection = document.createElement('div');
        pildorasSection.className = 'col-md-12';
        pildorasSection.id = 'pildoras';

        const rows = info.pildoras.map(p => {
            const mode = p.mode || '';
            const date = p.date || '';
            const title = p.title || '';
            const students = Array.isArray(p.students) ? p.students : [];
            const studentsText = students.length
                ? students.map(s => `${(s.name || '').trim()} ${(s.lastname || '').trim()}`.trim()).join(', ')
                : 'Desierta';
            const status = p.status || '';

            return `
                <tr>
                    <td>${escapeHtml(mode)}</td>
                    <td>${escapeHtml(date)}</td>
                    <td>${escapeHtml(title)}</td>
                    <td>${escapeHtml(studentsText)}</td>
                    <td>${escapeHtml(status)}</td>
                </tr>
            `;
        }).join('');

        pildorasSection.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <h5 class="card-title section-title">
                        <i class="bi bi-lightbulb me-2"></i>Píldoras
                    </h5>
                    <div class="table-responsive mt-3">
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>Presentación</th>
                                    <th>Fecha</th>
                                    <th>Píldora</th>
                                    <th>Coder</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        sections.push(pildorasSection);
    }

    // Píldoras Section (Module-based format)
    if (Array.isArray(info.modulesPildoras) && info.modulesPildoras.length > 0) {
        // Get promotion modules to match with module names
        const promotionModules = window.publicPromotionData?.modules || [];
        
        // Filter modules that have píldoras and enrich with promotion module data
        const modulesWithPildoras = info.modulesPildoras
            .filter(moduleData => Array.isArray(moduleData.pildoras) && moduleData.pildoras.length > 0)
            .map(moduleData => {
                // Find matching promotion module to get correct name
                const promotionModule = promotionModules.find(pm => pm.id === moduleData.moduleId);
                return {
                    ...moduleData,
                    moduleName: promotionModule?.name || moduleData.moduleName || 'Unknown Module'
                };
            });

        if (modulesWithPildoras.length > 0) {
            const pildorasSection = document.createElement('div');
            pildorasSection.className = 'col-md-12';
            pildorasSection.id = 'pildoras';

            // Initialize with first module
            let currentModuleIndex = 0;
            
            function renderPildorasTable() {
                const currentModule = modulesWithPildoras[currentModuleIndex];
                
                const rows = currentModule.pildoras.map(p => {
                    const mode = p.mode || '';
                    const date = p.date || '';
                    const title = p.title || '';
                    const students = Array.isArray(p.students) ? p.students : [];
                    const studentsText = students.length
                        ? students.map(s => `${(s.name || '').trim()} ${(s.lastname || '').trim()}`.trim()).join(', ')
                        : 'Desierta';
                    const status = p.status || '';

                    return `
                        <tr>
                            <td>${escapeHtml(mode)}</td>
                            <td>${escapeHtml(date)}</td>
                            <td>${escapeHtml(title)}</td>
                            <td>${escapeHtml(studentsText)}</td>
                            <td>${escapeHtml(status)}</td>
                        </tr>
                    `;
                }).join('');

                const tableContainer = pildorasSection.querySelector('.pildoras-table-container');
                if (tableContainer) {
                    tableContainer.innerHTML = `
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>Presentación</th>
                                    <th>Fecha</th>
                                    <th>Píldora</th>
                                    <th>Coder</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows}
                            </tbody>
                        </table>
                    `;
                }

                // Update navigation
                const moduleTitle = pildorasSection.querySelector('.current-module-name');
                const prevBtn = pildorasSection.querySelector('.prev-module-btn');
                const nextBtn = pildorasSection.querySelector('.next-module-btn');
                const countBadge = pildorasSection.querySelector('.module-pildoras-count');

                if (moduleTitle) moduleTitle.textContent = currentModule.moduleName;
                if (prevBtn) prevBtn.disabled = currentModuleIndex === 0;
                if (nextBtn) nextBtn.disabled = currentModuleIndex === modulesWithPildoras.length - 1;
                if (countBadge) countBadge.textContent = currentModule.pildoras.length;
            }

            pildorasSection.innerHTML = `
                <div class="card">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h5 class="card-title section-title mb-0">
                                <i class="bi bi-lightbulb me-2"></i>Píldoras
                            </h5>
                            <div class="d-flex align-items-center gap-3">
                                <!-- Module Navigation -->
                                <div class="d-flex align-items-center gap-2">
                                    <button class="btn btn-sm btn-outline-secondary prev-module-btn" onclick="navigatePildorasPrevious()">
                                        <i class="bi bi-chevron-left"></i>
                                    </button>
                                    <span class="fw-semibold text-primary current-module-name">Módulo I</span>
                                    <button class="btn btn-sm btn-outline-secondary next-module-btn" onclick="navigatePildorasNext()">
                                        <i class="bi bi-chevron-right"></i>
                                    </button>
                                </div>
                                <div class="badge bg-info text-dark">
                                    <span class="module-pildoras-count">0</span> píldoras
                                </div>
                            </div>
                        </div>
                        <div class="table-responsive pildoras-table-container">
                            <!-- Table will be populated here -->
                        </div>
                    </div>
                </div>
            `;

            // Add navigation functions to window object
            window.navigatePildorasPrevious = function() {
                if (currentModuleIndex > 0) {
                    currentModuleIndex--;
                    renderPildorasTable();
                }
            };

            window.navigatePildorasNext = function() {
                if (currentModuleIndex < modulesWithPildoras.length - 1) {
                    currentModuleIndex++;
                    renderPildorasTable();
                }
            };

            // Initial render
            renderPildorasTable();
            
            sections.push(pildorasSection);
        }
    }
    
    return sections;
}

// Helper function to check if schedule has data
function hasScheduleData(schedule) {
    if (!schedule) return false;
    
    const hasOnline = schedule.online && Object.values(schedule.online).some(v => v && v.trim());
    const hasPresential = schedule.presential && Object.values(schedule.presential).some(v => v && v.trim());
    const hasNotes = schedule.notes && schedule.notes.trim();
    
    return hasOnline || hasPresential || hasNotes;
}

// Generate Schedule HTML
function generateScheduleHTML(schedule) {
    let html = '';
    
    if (schedule.online && Object.values(schedule.online).some(v => v && v.trim())) {
        html += `
            <div class="mb-3">
                <h6 >Horario Clases Online:</h6>
                <ul>
                    ${schedule.online.entry ? `<li><strong>Inicio:</strong> ${escapeHtml(schedule.online.entry)}</li>` : ''}
                    ${schedule.online.start ? `<li><strong>Píldora:</strong> ${escapeHtml(schedule.online.start)}</li>` : ''}
                    ${schedule.online.break ? `<li><strong>Break:</strong> ${escapeHtml(schedule.online.break)}</li>` : ''}
                    ${schedule.online.lunch ? `<li><strong>Comida:</strong> ${escapeHtml(schedule.online.lunch)}</li>` : ''}
                    ${schedule.online.finish ? `<li><strong>Cierre:</strong> ${escapeHtml(schedule.online.finish)}</li>` : ''}
                </ul>
            </div>
        `;
    }
    
    if (schedule.presential && Object.values(schedule.presential).some(v => v && v.trim())) {
        html += `
            <div class="mb-3">
                <h6 >Horario Clases Presenciales:</h6>
                <ul>
                    ${schedule.presential.entry ? `<li><strong>Inicio:</strong> ${escapeHtml(schedule.presential.entry)}</li>` : ''}
                    ${schedule.presential.start ? `<li><strong>Píldora:</strong> ${escapeHtml(schedule.presential.start)}</li>` : ''}
                    ${schedule.presential.break ? `<li><strong>Break:</strong> ${escapeHtml(schedule.presential.break)}</li>` : ''}
                    ${schedule.presential.lunch ? `<li><strong>Comida:</strong> ${escapeHtml(schedule.presential.lunch)}</li>` : ''}
                    ${schedule.presential.finish ? `<li><strong>Cierre:</strong> ${escapeHtml(schedule.presential.finish)}</li>` : ''}
                </ul>
            </div>
        `;
    }
    
    if (schedule.notes && schedule.notes.trim()) {
        html += `<div class="alert alert-info"><strong>Notes:</strong> ${escapeHtml(schedule.notes)}</div>`;
    }
    
    return html;
}

// Generate Team HTML
function generateTeamHTML(team) {
    let html = '<div class="row">';
    
    team.forEach(member => {
        html += `
            <div class="col-md-6 mb-3">
                <div class="card">
                    <div class="card-body">
                        <h6 class="card-title">${escapeHtml(member.name || 'Unknown')}</h6>
                        ${member.role ? `<p class="card-text"><span><strong>${escapeHtml(member.role)}</strong></span></p>` : ''}
                        ${member.email ? `<p class="card-text"><i class="bi bi-envelope me-2"></i><a href="mailto:${escapeHtml(member.email)}">${escapeHtml(member.email)}</a></p>` : ''}
                        ${member.linkedin ? `<p class="card-text"><a href="${escapeHtml(member.linkedin)}" target="_blank" class="text-decoration-none"><i class="bi bi-linkedin me-2"></i>LinkedIn Profile</a></p>` : ''}
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

// Generate Resources HTML
function generateResourcesHTML(resources) {
    let html = '<div class="list-group">';
    
    resources.forEach(resource => {
        html += `
            <a href="${escapeHtml(resource.url || '#')}" target="_blank" class="list-group-item list-group-item-action">
                <div class="d-flex w-100 justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1">${escapeHtml(resource.title || 'Untitled Resource')}</h6>
                        ${resource.url ? `<small class="text-muted">${escapeHtml(resource.url)}</small>` : ''}
                    </div>
                    ${resource.category ? `<span class="badge bg-primary">${escapeHtml(resource.category)}</span>` : ''}
                </div>
            </a>
        `;
    });
    
    html += '</div>';
    return html;
}
