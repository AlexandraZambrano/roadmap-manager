const API_URL = window.APP_CONFIG?.API_URL || window.location.origin;
let promotionId = null;
let moduleModal, quickLinkModal, sectionModal, studentModal, studentProgressModal, teamModal, resourceModal, collaboratorModal, projectAssignmentDetailModal;
const userRole = localStorage.getItem('role') || 'student';
let currentUser = {};
let promotionModules = []; // Store promotion modules
let currentModuleIndex = 0; // Track current module for píldoras navigation
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
    pildoras: []
};

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
    return text.toString().replace(/[&<>"']/g, function(m) { return map[m]; });
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    promotionId = new URLSearchParams(window.location.search).get('id');

    if (!promotionId) {
        window.location.href = 'dashboard.html';
        return;
    }

    // Set up student dashboard preview iframe in Overview
    const previewIframe = document.getElementById('student-preview-iframe');
    if (previewIframe) {
        const path = window.location.pathname;
        const directory = path.substring(0, path.lastIndexOf('/'));
        const baseUrl = window.location.origin + (directory === '/' ? '' : directory);
        previewIframe.src = `${baseUrl}/public-promotion.html?id=${promotionId}&preview=1`;
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

    const collaboratorModalEl = document.getElementById('collaboratorModal');
    if (collaboratorModalEl) collaboratorModal = new bootstrap.Modal(collaboratorModalEl);

    initEmployabilityModal();

    if (userRole === 'teacher') {
        loadStudents();
        loadExtendedInfo();
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
            
            // Load modules and display píldoras
            loadModulesPildoras();

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
            
            // Initialize modulesPildoras in extendedInfoData if not present
            if (!extendedInfoData.modulesPildoras) {
                extendedInfoData.modulesPildoras = data.modulesPildoras || [];
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

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <select class="form-select form-select-sm pildora-mode">
                    <option value="Virtual" ${modeValue === 'Virtual' ? 'selected' : ''}>Virtual</option>
                    <option value="Presencial" ${modeValue === 'Presencial' ? 'selected' : ''}>Presencial</option>
                    <option value="Otro" ${modeValue === 'Otro' ? 'selected' : ''}>Otro</option>
                </select>
            </td>
            <td>
                <input type="date" class="form-control form-control-sm pildora-date" value="${escapeHtml(p.date || '')}">
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
                <select class="form-select form-select-sm pildora-status">
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

    // Add event listeners for student checkboxes
    document.querySelectorAll('.pildora-student-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            updatePildoraStudentSelection(parseInt(this.dataset.pildoraIndex), this.value, this.checked);
        });
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

    // Add new píldora to current module
    modulePildoras.pildoras.push({
        mode: 'Virtual',
        date: '',
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
            button.textContent = `${student.name} ${student.lastname || ''}`.trim();
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

    // Update global object
    extendedInfoData.schedule = schedule;
    extendedInfoData.evaluation = evaluation;
    
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

function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
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

    // Load specific tab data if needed
    if (tabName === 'access-settings' && userRole === 'teacher') {
        loadAccessPassword();
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
            window.currentPromotion = promotion; // Store globally for editing
            document.getElementById('promotion-title').textContent = promotion.name;
            document.getElementById('promotion-desc').textContent = promotion.description || '';
            document.getElementById('promotion-weeks').textContent = promotion.weeks || '-';
            document.getElementById('promotion-start').textContent = promotion.startDate || '-';
            document.getElementById('promotion-end').textContent = promotion.endDate || '-';
            document.getElementById('modules-count').textContent = (promotion.modules || []).length;

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

        card.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <h5 class="card-title">Module ${index + 1}: ${escapeHtml(module.name)}</h5>
                    <p><strong>Duration:</strong> ${module.duration} weeks</p>
                    ${coursesText ? `<p><strong>Courses:</strong> ${escapeHtml(coursesText)}</p>` : ''}
                    ${projectsText ? `<p><strong>Projects:</strong> ${escapeHtml(projectsText)}</p>` : ''}
                    ${pildorasText ? `<p><strong>Píldoras:</strong> ${escapeHtml(pildorasText)}</p>` : ''}
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
    const employability = promotion.employability || [];

    if (modules.length === 0) {
        table.innerHTML = '<tr><td class="text-muted">No modules configured</td></tr>';
        return;
    }

    // Add wrapper styles for better readability
    const wrapper = table.parentElement;
    wrapper.style.overflowX = 'auto';

    // Helper function to get month for a week (1-indexed)
    function getMonthForWeek(weekNum) {
        return Math.ceil(weekNum / 4);
    }

    // 1. Month Row (Top)
    const monthRow = document.createElement('tr');
    monthRow.style.backgroundColor = '#e8f4f8';
    monthRow.style.position = 'sticky';
    monthRow.style.top = '0';
    monthRow.style.zIndex = '11';
    const monthHeaderCell = document.createElement('th');
    monthHeaderCell.innerHTML = '<strong>Months</strong>';
    monthHeaderCell.style.minWidth = '300px';
    monthHeaderCell.style.position = 'sticky';
    monthHeaderCell.style.left = '0';
    monthHeaderCell.style.borderBottom = '1px solid #dee2e6';
    monthHeaderCell.style.borderRight = '1px solid #dee2e6';
    monthHeaderCell.style.zIndex = '10';
    monthHeaderCell.style.backgroundColor = '#ffff';
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
            monthCell.style.fontSize = '0.85rem';
            monthCell.style.padding = '10px 4px';
            monthCell.style.fontWeight = 'bold';
            monthCell.style.borderRight = '1px solid #dee2e6';
            monthCell.style.borderBottom = '1px solid #dee2e6';
            monthCell.style.backgroundColor = '#ffff';
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

    // 2. Weeks Row (Below Months)
    const weekRow = document.createElement('tr');
    weekRow.style.backgroundColor = '#f8f9fa';
    weekRow.style.position = 'sticky';
    weekRow.style.top = '37px';
    weekRow.style.zIndex = '10';
    const weekHeaderCell = document.createElement('th');
    weekHeaderCell.innerHTML = '<strong>Weeks</strong>';
    weekHeaderCell.style.minWidth = '300px';
    weekHeaderCell.style.borderRight = '1px solid #dee2e6';
    weekHeaderCell.style.position = 'sticky';
    weekHeaderCell.style.left = '0';
    weekHeaderCell.style.zIndex = '10';
    weekHeaderCell.style.backgroundColor = '#ffff';
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

    // 3. Sesiones Empleabilidad Section (always visible on dashboard, before modules)
    const separatorRow = document.createElement('tr');
    separatorRow.style.height = '10px';
    const separatorCell = document.createElement('td');
    separatorCell.colSpan = weeks + 1;
    separatorCell.style.backgroundColor = '#fff';
    separatorRow.appendChild(separatorCell);
    table.appendChild(separatorRow);

    const headerRow = document.createElement('tr');
    const headerCell = document.createElement('td');
    headerCell.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: flex-start;">
            <strong style="color: #2c3e50;">💼 Sesiones Empleabilidad</strong>
        </div>
    `;
    headerCell.style.minWidth = '300px';
    headerCell.style.position = 'sticky';
    headerCell.style.left = '0';
    headerCell.style.backgroundColor = '#fef3e2';
    headerCell.style.zIndex = '5';
    headerCell.colSpan = weeks + 1;
    headerRow.appendChild(headerCell);
    table.appendChild(headerRow);

    // Employability sessions (defined by months, rendered on weekly axis)
    if (employability && employability.length > 0) {
        employability.forEach((item, index) => {
            const itemRow = document.createElement('tr');
            const itemCell = document.createElement('td');
            const editBtn = userRole === 'teacher' ? `<button class="btn btn-xs btn-sm btn-outline-warning ms-2" onclick="editEmployabilityItem(${index})"><i class="bi bi-pencil"></i></button>` : '';
            const delBtn = userRole === 'teacher' ? `<button class="btn btn-xs btn-sm btn-outline-danger" onclick="deleteEmployabilityItem(${index})"><i class="bi bi-trash"></i></button>` : '';
            const itemUrl = item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" class="text-decoration-none">${escapeHtml(item.name)} <i class="bi bi-box-arrow-up-right"></i></a>` : escapeHtml(item.name);

            itemCell.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <small style="color: #666;">${itemUrl}</small>
                    <div>${editBtn} ${delBtn}</div>
                </div>
            `;
            itemCell.style.minWidth = '300px';
            itemCell.style.fontSize = '0.85rem';
            itemCell.style.paddingLeft = '20px';
            itemCell.style.position = 'sticky';
            itemCell.style.left = '0';
            itemCell.style.backgroundColor = '#fff';
            itemCell.style.zIndex = '5';
            itemRow.appendChild(itemCell);

            // Convert months to weeks: startMonth is 1-indexed, week index is 0-based
            const startWeek = (item.startMonth - 1) * 4;
            const endWeek = startWeek + (item.duration * 4);

            for (let i = 0; i < weeks; i++) {
                const cell = document.createElement('td');
                cell.style.textAlign = 'center';
                cell.style.height = '30px';
                cell.style.padding = '2px';
                cell.style.borderRight = '1px solid #dee2e6';
                cell.style.minWidth = '50px';

                if (i >= startWeek && i < endWeek) {
                    cell.style.backgroundColor = '#fff3cd';
                    cell.style.borderRadius = '2px';
                }
                itemRow.appendChild(cell);
            }
            table.appendChild(itemRow);
        });
    }

    // 4. Modules Row (below Sesiones Empleabilidad)
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

        // Module bars
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
                const courseName = typeof courseObj === 'string' ? courseObj : (courseObj.name || 'Unnamed');
                const courseUrl = typeof courseObj === 'object' ? courseObj.url : '';
                const courseDur = typeof courseObj === 'object' ? (courseObj.duration || 1) : 1;
                const courseOff = typeof courseObj === 'object' ? (courseObj.startOffset || 0) : 0;

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

                // Use weekCounter as the base for the module's timeline
                const absoluteStart = weekCounter + courseOff;
                const absoluteEnd = absoluteStart + courseDur;

                for (let i = 0; i < weeks; i++) {
                    const cell = document.createElement('td');
                    cell.style.textAlign = 'center';
                    cell.style.height = '30px';
                    cell.style.padding = '2px';
                    cell.style.borderRight = '1px solid #dee2e6';
                    cell.style.minWidth = '50px';

                    if (i >= absoluteStart && i < absoluteEnd) {
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
                const projectName = typeof projectObj === 'string' ? projectObj : (projectObj.name || 'Unnamed');
                const projectUrl = typeof projectObj === 'object' ? projectObj.url : '';
                const projectDur = typeof projectObj === 'object' ? (projectObj.duration || 1) : 1;
                const projectOff = typeof projectObj === 'object' ? (projectObj.startOffset || 0) : 0;

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

                const absoluteStart = weekCounter + projectOff;
                const absoluteEnd = absoluteStart + projectDur;

                for (let i = 0; i < weeks; i++) {
                    const cell = document.createElement('td');
                    cell.style.textAlign = 'center';
                    cell.style.height = '30px';
                    cell.style.padding = '2px';
                    cell.style.borderRight = '1px solid #dee2e6';
                    cell.style.minWidth = '50px';

                    if (i >= absoluteStart && i < absoluteEnd) {
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
                    addProjectField(projectName, projectUrl, projectDur, projectOff);
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

function addProjectField(projectName = '', projectUrl = '', projectDuration = 1, projectOffset = 0) {
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
    `;
    container.appendChild(projectItem);
}

function removeProjectField(button) {
    button.closest('.project-item').remove();
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

            if (projectName) {
                projects.push({ name: projectName, url: projectUrl, duration: Number(duration), startOffset: Number(startOffset) });
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
        const age = document.getElementById('student-age').value;
        const nationality = document.getElementById('student-nationality').value;
        const profession = document.getElementById('student-profession').value;
        const address = document.getElementById('student-address').value;
        
        // Check if we're editing an existing student
        const editingStudentId = document.getElementById('student-form').dataset.editingStudentId;
        
        const token = localStorage.getItem('token');

        const studentData = {
            name,
            lastname,
            email,
            age: age ? parseInt(age) : null,
            nationality,
            profession,
            address
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
async function loadStudents() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/students`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const students = await response.json();
        console.log('Loaded students:', students);
        
        // Store students data globally for multi-select operations
        // Backend already normalizes the ID field, so we can use it directly
        window.currentStudents = students;
        displayStudents(window.currentStudents);
    } catch (error) {
        console.error('Error loading students:', error);
        alert(`Error loading students: ${error.message}`);
    }
}

// Display students with checkboxes for multi-select
function displayStudents(students) {
    const studentsContainer = document.getElementById('students-list');
    if (!studentsContainer) {
        console.warn('Students container not found');
        return;
    }
    
    if (!students || students.length === 0) {
        studentsContainer.innerHTML = '<p class="text-muted">No students registered yet.</p>';
        return;
    }
    
    studentsContainer.innerHTML = students.map((student, index) => `
        <div class="card mb-3">
            <div class="card-body">
                <div class="d-flex align-items-center mb-2">
                    <input type="checkbox" class="form-check-input me-3 student-checkbox" 
                           data-student-id="${student.id}" 
                           onchange="updateSelectionState()">
                    <h6 class="card-title mb-0">${student.name || 'N/A'} ${student.lastname || ''}</h6>
                </div>
                <div class="row">
                    <div class="col-md-6">
                        <p class="card-text mb-1"><strong>Email:</strong> ${student.email || 'N/A'}</p>
                        <p class="card-text mb-1"><strong>Age:</strong> ${student.age || 'N/A'}</p>
                        <p class="card-text mb-1"><strong>Nationality:</strong> ${student.nationality || 'N/A'}</p>
                    </div>
                    <div class="col-md-6">
                        <p class="card-text mb-1"><strong>Profession:</strong> ${student.profession || 'N/A'}</p>
                        <p class="card-text mb-1"><strong>Address:</strong> ${student.address || 'N/A'}</p>
                    </div>
                </div>
                <div class="mt-2">
                    <button class="btn btn-sm btn-primary me-2" onclick="editStudent('${student.id}')">
                        <i class="bi bi-pencil"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-info me-2" onclick="trackStudentProgress('${student.id}', '${student.name} ${student.lastname || ''}')">
                        <i class="bi bi-graph-up"></i> Track Progress
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteStudent('${student.id}', '${student.email}')">
                        <i class="bi bi-trash"></i> Delete
                    </button>
                </div>
            </div>
        </div>
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
    document.getElementById('student-age').value = student.age || '';
    document.getElementById('student-nationality').value = student.nationality || '';
    document.getElementById('student-profession').value = student.profession || '';
    document.getElementById('student-address').value = student.address || '';
    
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
    // Header - removed Entry Type and Last Accessed
    rows.push(['Name', 'Last Name', 'Email', 'Age', 'Nationality', 'Profession', 'Address'].join(','));

    students.forEach(student => {
        const name = (student.name || '').replace(/"/g, '""');
        const lastname = (student.lastname || '').replace(/"/g, '""');
        const email = (student.email || '').replace(/"/g, '""');
        const age = student.age || '';
        const nationality = (student.nationality || '').replace(/"/g, '""');
        const profession = (student.profession || '').replace(/"/g, '""');
        const address = (student.address || '').replace(/"/g, '""');

        rows.push([
            `"${name}"`,
            `"${lastname}"`,
            `"${email}"`,
            `"${age}"`,
            `"${nationality}"`,
            `"${profession}"`,
            `"${address}"`
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
            displayCollaborators(collaborators);
        }
    } catch (error) {
        console.error('Error loading collaborators:', error);
    }
}

async function displayCollaborators(collaborators) {
    const token = localStorage.getItem('token');
    const tbody = document.getElementById('collaborators-list-body');
    const listGroup = document.getElementById('collaborators-list'); // For the list-group view

    if (!tbody && !listGroup) return;

    // Need to get promotion to see who is the owner
    const promoResponse = await fetch(`${API_URL}/api/promotions/${promotionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    let isOwner = false;
    if (promoResponse.ok) {
        const promotion = await promoResponse.json();
        isOwner = promotion.teacherId === currentUser.id;
    }

    // Update table view if it exists
    if (tbody) {
        tbody.innerHTML = '';
        if (collaborators.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No collaborators added yet</td></tr>';
        } else {
            collaborators.forEach(collab => {
                const tr = document.createElement('tr');
                const actions = isOwner ? `
                    <button class="btn btn-sm btn-outline-danger" onclick="removeCollaborator('${collab.id}')" title="Remove as collaborator">
                        <i class="bi bi-person-dash"></i> Remove
                    </button>` : '<span class="text-muted small">Only owner can manage</span>';

                tr.innerHTML = `
                    <td>${escapeHtml(collab.name)}</td>
                    <td>${escapeHtml(collab.email)}</td>
                    <td>${actions}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    }

    // Update list-group view if it exists
    if (listGroup) {
        listGroup.innerHTML = '';
        if (collaborators.length === 0) {
            listGroup.innerHTML = '<p class="text-muted p-3">No collaborators yet</p>';
        } else {
            collaborators.forEach(teacher => {
                const div = document.createElement('div');
                div.className = 'list-group-item d-flex justify-content-between align-items-center';
                const ownerBadge = teacher.isOwner ? '<span class="badge bg-primary ms-2">Owner</span>' : '';
                const deleteBtn = isOwner && !teacher.isOwner ? `<button class="btn btn-sm btn-outline-danger" onclick="removeCollaborator('${teacher.id}')"><i class="bi bi-trash"></i> Remove</button>` : '';

                div.innerHTML = `
                    <div>
                        <h6 class="mb-1">${escapeHtml(teacher.name)} ${ownerBadge}</h6>
                        <p class="mb-0 text-muted small">${escapeHtml(teacher.email)}</p>
                    </div>
                    ${deleteBtn}
                `;
                listGroup.appendChild(div);
            });
        }
    }
}

async function openCollaboratorModal() {
    const select = document.getElementById('collaborator-select');
    if (!select) return;

    select.innerHTML = '<option value="">Loading teachers...</option>';
    collaboratorModal.show();

    const token = localStorage.getItem('token');
    try {
        // Get all teachers
        const response = await fetch(`${API_URL}/api/teachers`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        // Get current collaborators to exclude them
        const collabResponse = await fetch(`${API_URL}/api/promotions/${promotionId}/collaborators`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok && collabResponse.ok) {
            const allTeachers = await response.json();
            const currentCollaborators = await collabResponse.json();
            const collaboratorIds = currentCollaborators.map(c => c.id);

            // Get promotion owner to exclude
            const promoResponse = await fetch(`${API_URL}/api/promotions/${promotionId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            let ownerId = null;
            if (promoResponse.ok) {
                const promo = await promoResponse.json();
                ownerId = promo.teacherId;
            }

            const availableTeachers = allTeachers.filter(t =>
                t.id !== currentUser.id &&
                t.id !== ownerId &&
                !collaboratorIds.includes(t.id)
            );

            if (availableTeachers.length === 0) {
                select.innerHTML = '<option value="">No other teachers available</option>';
            } else {
                select.innerHTML = '<option value="">Select a teacher...</option>';
                availableTeachers.forEach(t => {
                    const opt = document.createElement('option');
                    opt.value = t.id;
                    opt.textContent = `${t.name} (${t.email})`;
                    select.appendChild(opt);
                });
            }
        }
    } catch (error) {
        console.error('Error loading teachers:', error);
        if (select) select.innerHTML = '<option value="">Error loading teachers</option>';
    }
}

async function addCollaboratorById() {
    const teacherId = document.getElementById('collaborator-select').value;
    if (!teacherId) {
        alert('Please select a teacher');
        return;
    }

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/collaborators`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ teacherId })
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

// ==================== STUDENT PROGRESS TRACKING ====================

let currentStudentForProgress = null;

// Track student progress - show modal with student progress data
async function trackStudentProgress(studentId, studentName) {
    try {
        const token = localStorage.getItem('token');
        
        // Get student details including progress
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/students/${studentId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const student = await response.json();
        console.log('Student progress data:', student);
        
        currentStudentForProgress = student;
        
        // Populate the progress modal
        await displayStudentProgress(student, studentName);
        
        // Show the modal
        studentProgressModal.show();
        
    } catch (error) {
        console.error('Error loading student progress:', error);
        alert(`Error loading student progress: ${error.message}`);
    }
}

// Display student progress in the modal
async function displayStudentProgress(student, studentName) {
    // Update modal title
    document.getElementById('progressModalTitle').textContent = `Progress Tracking - ${studentName}`;
    
    // Update basic info
    document.getElementById('progress-student-name').textContent = student.name || 'N/A';
    document.getElementById('progress-student-lastname').textContent = student.lastname || 'N/A';
    document.getElementById('progress-student-email').textContent = student.email || 'N/A';
    
    // Get promotion data to calculate total modules and sections
    let totalModules = 0;
    let totalSections = 0;
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const promotion = await response.json();
            totalModules = promotion.modules ? promotion.modules.length : 0;
            totalSections = promotion.sections ? promotion.sections.length : 0;
        }
    } catch (error) {
        console.error('Error loading promotion data:', error);
    }
    
    // Update progress info with calculations
    const progress = student.progress || {};
    const modulesCompleted = progress.modulesCompleted || 0;
    const modulesViewedCount = (progress.modulesViewed || []).length;
    const sectionsCompletedCount = (progress.sectionsCompleted || []).length;
    
    // Calculate percentages
    const moduleCompletionPercentage = totalModules > 0 ? Math.round((modulesCompleted / totalModules) * 100) : 0;
    const moduleViewedPercentage = totalModules > 0 ? Math.round((modulesViewedCount / totalModules) * 100) : 0;
    const sectionCompletionPercentage = totalSections > 0 ? Math.round((sectionsCompletedCount / totalSections) * 100) : 0;
    
    // Display modules completed with percentage
    document.getElementById('progress-modules-completed').innerHTML = `
        ${modulesCompleted}<span class="fs-6 text-muted">/${totalModules}</span>
        <small class="d-block text-muted">${moduleCompletionPercentage}%</small>
    `;
    
    // Display modules viewed with percentage
    document.getElementById('progress-modules-viewed-count').innerHTML = `
        ${modulesViewedCount}<span class="fs-6 text-muted">/${totalModules}</span>
        <small class="d-block text-muted">${moduleViewedPercentage}%</small>
    `;
    
    // Display sections completed with percentage
    document.getElementById('progress-sections-completed-count').innerHTML = `
        ${sectionsCompletedCount}<span class="fs-6 text-muted">/${totalSections}</span>
        <small class="d-block text-muted">${sectionCompletionPercentage}%</small>
    `;
    
    // Update notes
    document.getElementById('progress-student-notes').value = student.notes || '';
    
    // Display modules viewed
    const modulesViewedContainer = document.getElementById('progress-modules-viewed');
    const modulesViewed = progress.modulesViewed || [];
    if (modulesViewed.length === 0) {
        modulesViewedContainer.innerHTML = '<p class="text-muted mb-0">No modules viewed yet</p>';
    } else {
        modulesViewedContainer.innerHTML = modulesViewed.map(moduleId => 
            `<span class="badge bg-primary me-1 mb-1">${escapeHtml(moduleId)}</span>`
        ).join('');
    }
    
    // Display sections completed
    const sectionsCompletedContainer = document.getElementById('progress-sections-completed');
    const sectionsCompleted = progress.sectionsCompleted || [];
    if (sectionsCompleted.length === 0) {
        sectionsCompletedContainer.innerHTML = '<p class="text-muted mb-0">No sections completed yet</p>';
    } else {
        sectionsCompletedContainer.innerHTML = sectionsCompleted.map(sectionId => 
            `<span class="badge bg-success me-1 mb-1">${escapeHtml(sectionId)}</span>`
        ).join('');
    }
    
    // Display last accessed if available
    const lastAccessed = progress.lastAccessed;
    const lastAccessedElement = document.getElementById('progress-last-accessed');
    if (lastAccessed) {
        const date = new Date(lastAccessed);
        lastAccessedElement.textContent = date.toLocaleString();
    } else {
        lastAccessedElement.textContent = 'Never';
    }

    // Render project assignments
    renderStudentProjects(student);
}

// Save student notes
async function saveStudentNotes() {
    if (!currentStudentForProgress) {
        alert('No student selected');
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const notes = document.getElementById('progress-student-notes').value;
        
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/students/${currentStudentForProgress.id}/notes`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ notes })
        });
        
        if (response.ok) {
            alert('Notes saved successfully!');
            // Update the current student data
            currentStudentForProgress.notes = notes;
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save notes');
        }
        
    } catch (error) {
        console.error('Error saving notes:', error);
        alert(`Error saving notes: ${error.message}`);
    }
}

// Render student's project assignments with controls
function renderStudentProjects(student) {
    const container = document.getElementById('progress-student-projects');
    const assignments = student.projectsAssignments || [];
    if (!container) return;

    if (assignments.length === 0) {
        container.innerHTML = '<p class="text-muted mb-0">No project assignments yet</p>';
        return;
    }

    const modulesById = {};
    const promotion = window.currentPromotion || {};
    (promotion.modules || []).forEach(m => { modulesById[m.id] = m; });

    const rows = assignments.map(a => {
        const moduleName = modulesById[a.moduleId]?.name || a.moduleId;
        return `
            <div class="row align-items-center py-2 border-bottom">
                <div class="col-md-4">
                    <strong>${escapeHtml(a.projectName)}</strong>
                    <div class="text-muted small">Módulo: ${escapeHtml(moduleName)}</div>
                </div>
                <div class="col-md-4">
                    <input type="text" class="form-control form-control-sm" 
                           value="${escapeHtml(a.groupName || '')}" 
                           data-assignment-id="${escapeHtml(a.id)}" 
                           onblur="updateProjectGroup('${escapeHtml(student.id)}', '${escapeHtml(a.id)}', this.value)" 
                           placeholder="Group name" />
                </div>
                <div class="col-md-2">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="chk-${escapeHtml(a.id)}" ${a.done ? 'checked' : ''} 
                               onchange="updateProjectDone('${escapeHtml(student.id)}', '${escapeHtml(a.id)}', this.checked)" />
                        <label class="form-check-label" for="chk-${escapeHtml(a.id)}">Done</label>
                    </div>
                </div>
                <div class="col-md-2 text-end">
                    <span class="badge bg-secondary mb-1">Teammates: ${(a.teammates || []).length}</span>
                    <button type="button" class="btn btn-sm btn-outline-secondary d-block mt-1" onclick="openProjectAssignmentDetail('${escapeHtml(a.id)}')">
                        View
                    </button>
                </div>
            </div>
        `;
    }).join('');
    container.innerHTML = rows;
}

let currentProjectAssignmentDetail = null;

function openProjectAssignmentDetail(assignmentId) {
    if (!currentStudentForProgress) return;
    const assignments = currentStudentForProgress.projectsAssignments || [];
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) return;

    currentProjectAssignmentDetail = assignment;

    const promotion = window.currentPromotion || {};
    const modules = promotion.modules || [];
    const moduleObj = modules.find(m => m.id === assignment.moduleId);

    const nameEl = document.getElementById('projectAssignment-detail-name');
    const moduleEl = document.getElementById('projectAssignment-detail-module');
    const groupInput = document.getElementById('projectAssignment-detail-group');
    const doneCheckbox = document.getElementById('projectAssignment-detail-done');
    const teammatesList = document.getElementById('projectAssignment-detail-teammates');

    if (nameEl) nameEl.textContent = assignment.projectName || '';
    if (moduleEl) moduleEl.textContent = moduleObj ? moduleObj.name : assignment.moduleId;
    if (groupInput) groupInput.value = assignment.groupName || '';
    if (doneCheckbox) doneCheckbox.checked = !!assignment.done;

    if (teammatesList) {
        teammatesList.innerHTML = '';
        const students = window.currentStudents || [];
        const teammates = assignment.teammates || [];
        teammates.forEach(id => {
            const li = document.createElement('li');
            const student = students.find(s => s.id === id);
            const label = student ? `${student.name || ''} ${student.lastname || ''}`.trim() || id : id;
            li.textContent = label;
            teammatesList.appendChild(li);
        });
        if (teammates.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No teammates';
            teammatesList.appendChild(li);
        }
    }

    if (projectAssignmentDetailModal) {
        projectAssignmentDetailModal.show();
    }
}

async function saveProjectAssignmentDetail() {
    if (!currentStudentForProgress || !currentProjectAssignmentDetail) return;

    const groupInput = document.getElementById('projectAssignment-detail-group');
    const doneCheckbox = document.getElementById('projectAssignment-detail-done');

    const groupName = groupInput ? groupInput.value : '';
    const done = doneCheckbox ? doneCheckbox.checked : false;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/students/${currentStudentForProgress.id}/projects/${currentProjectAssignmentDetail.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ groupName, done })
        });

        if (!response.ok) {
            let errorMessage = `Failed to update assignment (HTTP ${response.status})`;
            try {
                const text = await response.text();
                try {
                    const errJson = JSON.parse(text);
                    errorMessage = errJson.error || errorMessage;
                } catch {
                    if (text) errorMessage = text;
                }
            } catch {
            }
            throw new Error(errorMessage);
        }

        const updated = await fetch(`${API_URL}/api/promotions/${promotionId}/students/${currentStudentForProgress.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (updated.ok) {
            currentStudentForProgress = await updated.json();
            renderStudentProjects(currentStudentForProgress);
        }

        if (projectAssignmentDetailModal) {
            projectAssignmentDetailModal.hide();
        }
    } catch (e) {
        alert(`Error updating assignment: ${e.message}`);
    }
}
// Update assignment: done toggle
async function updateProjectDone(studentId, assignmentId, done) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/students/${studentId}/projects/${assignmentId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ done })
        });
        if (!response.ok) throw new Error('Failed to update assignment');
    } catch (e) {
        alert(`Error updating assignment: ${e.message}`);
    }
}

// Update assignment: group name edit
async function updateProjectGroup(studentId, assignmentId, groupName) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/students/${studentId}/projects/${assignmentId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ groupName })
        });
        if (!response.ok) throw new Error('Failed to update assignment');
    } catch (e) {
        alert(`Error updating assignment: ${e.message}`);
    }
}

// Assign project modal handling
let assignProjectModal;
function openAssignProjectModal() {
    const el = document.getElementById('assignProjectModal');
    assignProjectModal = assignProjectModal || (el ? new bootstrap.Modal(el) : null);
    if (!assignProjectModal) return;

    // Populate module select
    const moduleSelect = document.getElementById('assign-module-select');
    const projectSelect = document.getElementById('assign-project-select');
    moduleSelect.innerHTML = '';
    projectSelect.innerHTML = '';
    const promotion = window.currentPromotion || {};
    (promotion.modules || []).forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        moduleSelect.appendChild(opt);
    });
    // Populate projects for first module by default
    populateProjectSelect(moduleSelect.value);

    // Change handler
    moduleSelect.onchange = () => populateProjectSelect(moduleSelect.value);

    // Populate teammates (checkbox list, scrollable)
    const teammatesList = document.getElementById('assign-teammates-list');
    teammatesList.innerHTML = '';
    const currentId = currentStudentForProgress?.id;
    (window.currentStudents || []).forEach(s => {
        if (s.id === currentId) return;
        const div = document.createElement('div');
        div.className = 'form-check';
        div.innerHTML = `
            <input class="form-check-input" type="checkbox" value="${escapeHtml(s.id)}" id="tm-${escapeHtml(s.id)}">
            <label class="form-check-label" for="tm-${escapeHtml(s.id)}">${escapeHtml((s.name || '') + ' ' + (s.lastname || ''))}</label>
        `;
        teammatesList.appendChild(div);
    });

    // Reset fields
    document.getElementById('assign-group-name').value = '';
    document.getElementById('assign-mark-done').checked = false;

    assignProjectModal.show();
}

function populateProjectSelect(moduleId) {
    const projectSelect = document.getElementById('assign-project-select');
    projectSelect.innerHTML = '';
    const promotion = window.currentPromotion || {};
    const mod = (promotion.modules || []).find(m => m.id === moduleId);
    (mod?.projects || []).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name || '';
        opt.textContent = p.name || '';
        projectSelect.appendChild(opt);
    });
}

// Assign project form submit
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('assign-project-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const moduleId = document.getElementById('assign-module-select').value;
                const projectName = document.getElementById('assign-project-select').value;
                const groupName = document.getElementById('assign-group-name').value;
                const done = document.getElementById('assign-mark-done').checked;
                const teammateIds = Array.from(document.querySelectorAll('#assign-teammates-list .form-check-input:checked')).map(el => el.value);
                const studentIds = [currentStudentForProgress.id, ...teammateIds];

                const token = localStorage.getItem('token');
                const response = await fetch(`${API_URL}/api/promotions/${promotionId}/projects/assign`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ moduleId, projectName, groupName, studentIds, done })
                });
                if (!response.ok) {
                    let errorMessage = `Failed to assign project (HTTP ${response.status})`;
                    try {
                        const text = await response.text();
                        try {
                            const errJson = JSON.parse(text);
                            errorMessage = errJson.error || errorMessage;
                        } catch {
                            if (text && text.trim().startsWith('<!DOCTYPE')) {
                                errorMessage = 'Backend returned HTML (likely 404). Please ensure the server is restarted with the latest code.';
                            } else if (text) {
                                errorMessage = text;
                            }
                        }
                    } catch {
                        // ignore parse errors
                    }
                    throw new Error(errorMessage);
                }
                // Refresh student data
                const updated = await fetch(`${API_URL}/api/promotions/${promotionId}/students/${currentStudentForProgress.id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (updated.ok) {
                    currentStudentForProgress = await updated.json();
                    renderStudentProjects(currentStudentForProgress);
                }
                assignProjectModal.hide();
                alert('Project assigned successfully');
            } catch (err) {
                alert(`Error assigning project: ${err.message}`);
            }
        });
    }
});
// Update student progress (modules completed, etc.)
async function updateStudentProgress() {
    if (!currentStudentForProgress) {
        alert('No student selected');
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const modulesCompleted = parseInt(document.getElementById('update-modules-completed').value) || 0;
        
        console.log('=== FRONTEND UPDATE PROGRESS ===');
        console.log('Student ID:', currentStudentForProgress.id);
        console.log('Modules completed from input:', document.getElementById('update-modules-completed').value);
        console.log('Parsed modules completed:', modulesCompleted);
        console.log('Request URL:', `${API_URL}/api/promotions/${promotionId}/students/${currentStudentForProgress.id}/progress`);
        
        const requestBody = { 
            modulesCompleted,
            lastAccessed: new Date().toISOString()
        };
        
        console.log('Request body:', requestBody);
        
        const response = await fetch(`${API_URL}/api/promotions/${promotionId}/students/${currentStudentForProgress.id}/progress`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);
        
        if (response.ok) {
            const updatedStudent = await response.json();
            
            console.log('Updated student response:', updatedStudent);
            
            // Update the current student data with the response
            currentStudentForProgress = updatedStudent;
            
            alert('Progress updated successfully!');
            
            // Reload the progress data to show updated metrics
            await displayStudentProgress(updatedStudent, `${updatedStudent.name} ${updatedStudent.lastname || ''}`);
        } else {
            const errorData = await response.json();
            console.error('Error response:', errorData);
            throw new Error(errorData.error || 'Failed to update progress');
        }
        
    } catch (error) {
        console.error('Error updating progress:', error);
        alert(`Error updating progress: ${error.message}`);
    }
}

// ==================== STUDENT MULTI-SELECT FUNCTIONALITY ====================

// Toggle all students selection
window.toggleAllStudents = function() {
    const selectAllCheckbox = document.getElementById('select-all-students');
    const studentCheckboxes = document.querySelectorAll('.student-checkbox');
    
    studentCheckboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });
    
    updateSelectionState();
};

// Update selection state and show/hide bulk action buttons
window.updateSelectionState = function() {
    const studentCheckboxes = document.querySelectorAll('.student-checkbox');
    const selectAllCheckbox = document.getElementById('select-all-students');
    const selectedCount = document.querySelectorAll('.student-checkbox:checked').length;
    const totalCount = studentCheckboxes.length;
    
    // Update select all checkbox state
    if (selectedCount === 0) {
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        }
    } else if (selectedCount === totalCount) {
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        }
    } else {
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    }
    
    // Update selected count display
    const selectedCountElement = document.getElementById('selected-count');
    if (selectedCountElement) {
        selectedCountElement.textContent = `${selectedCount} selected`;
    }
    
    // Show/hide bulk action buttons
    const exportSelectedBtn = document.getElementById('export-selected-btn');
    const deleteSelectedBtn = document.getElementById('delete-selected-btn');
    
    if (selectedCount > 0) {
        if (exportSelectedBtn) exportSelectedBtn.style.display = 'inline-block';
        if (deleteSelectedBtn) deleteSelectedBtn.style.display = 'inline-block';
    } else {
        if (exportSelectedBtn) exportSelectedBtn.style.display = 'none';
        if (deleteSelectedBtn) deleteSelectedBtn.style.display = 'none';
    }
};

// Get selected students data
function getSelectedStudents() {
    const selectedCheckboxes = document.querySelectorAll('.student-checkbox:checked');
    const selectedIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.studentId);
    
    // Get current students data
    const currentStudents = window.currentStudents || [];
    return currentStudents.filter(student => selectedIds.includes(student.id));
}

// Export selected students as CSV
window.exportSelectedStudentsCsv = function() {
    const selectedStudents = getSelectedStudents();
    
    if (selectedStudents.length === 0) {
        alert('No students selected.');
        return;
    }
    
    exportStudentsToCSV(selectedStudents, `selected-students-promotion-${promotionId}.csv`);
};

// Delete selected students
window.deleteSelectedStudents = async function() {
    const selectedStudents = getSelectedStudents();
    
    if (selectedStudents.length === 0) {
        alert('No students selected.');
        return;
    }
    
    const confirmMessage = `Are you sure you want to delete ${selectedStudents.length} selected student(s)? This action cannot be undone.`;
    if (!confirm(confirmMessage)) return;
    
    const token = localStorage.getItem('token');
    let successCount = 0;
    let errorCount = 0;
    
    // Delete students one by one
    for (const student of selectedStudents) {
        try {
            const response = await fetch(`${API_URL}/api/promotions/${promotionId}/students/${student.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                successCount++;
            } else {
                errorCount++;
            }
        } catch (error) {
            errorCount++;
        }
    }
    
    // Show results
    if (errorCount === 0) {
        alert(`Successfully deleted ${successCount} student(s).`);
    } else {
        alert(`Deleted ${successCount} student(s). Failed to delete ${errorCount} student(s).`);
    }
    
    // Reload students list
    loadStudents();
};
