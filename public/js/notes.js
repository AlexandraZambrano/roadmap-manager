/**
 * ================================================================================
 * MÓDULO DE BLOC DE NOTAS
 * ================================================================================
 * Gestiona notas persistentes del docente con almacenamiento en LocalStorage.
 * 
 * Características:
 * - Crear, editar y eliminar notas
 * - Persistencia automática entre sesiones
 * - Renderizado dinámico de notas
 * - Interfaz modular y reutilizable
 * ================================================================================
 */

class NotesManager {
    /**
     * Constructor del NotesManager
     * @param {string} storageKey - Clave para LocalStorage (default: 'promotionNotes')
     * @param {string} promotionId - ID de la promoción para aislamiento de datos
     */
    constructor(storageKey = 'promotionNotes', promotionId = null) {
        this.storageKey = promotionId ? `${storageKey}_${promotionId}` : storageKey;
        this.notes = this.loadNotes();
        this.editingNoteId = null;
    }

    /**
     * Carga las notas desde LocalStorage
     * @returns {Array} Array de objetos nota
     */
    loadNotes() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error loading notes from LocalStorage:', error);
            return [];
        }
    }

    /**
     * Guarda las notas en LocalStorage
     */
    saveNotesToStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.notes));
            console.log(`Notes saved: ${this.notes.length} notes stored.`);
        } catch (error) {
            console.error('Error saving notes to LocalStorage:', error);
        }
    }

    /**
     * Crea una nueva nota
     * @param {string} text - Contenido de la nota
     * @param {string} category - Categoría: 'reminder' o 'note' (default: 'note')
     * @returns {Object} La nota creada
     */
    createNote(text, category = 'note') {
        if (!text || text.trim().length === 0) {
            console.warn('Cannot create empty note');
            return null;
        }

        const note = {
            id: Date.now().toString(),
            text: text.trim(),
            category: category,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.notes.push(note);
        this.saveNotesToStorage();
        return note;
    }

    /**
     * Actualiza una nota existente
     * @param {string} noteId - ID de la nota
     * @param {string} text - Nuevo contenido
     * @param {string} category - Nueva categoría (opcional)
     * @returns {Object|null} La nota actualizada o null si no existe
     */
    updateNote(noteId, text, category = null) {
        const note = this.notes.find(n => n.id === noteId);
        if (!note) {
            console.warn(`Note with id ${noteId} not found`);
            return null;
        }

        if (text && text.trim().length > 0) {
            note.text = text.trim();
        }
        if (category) {
            note.category = category;
        }
        note.updatedAt = new Date().toISOString();

        this.saveNotesToStorage();
        return note;
    }

    /**
     * Elimina una nota
     * @param {string} noteId - ID de la nota a eliminar
     * @returns {boolean} true si se eliminó, false si no existe
     */
    deleteNote(noteId) {
        const index = this.notes.findIndex(n => n.id === noteId);
        if (index === -1) {
            console.warn(`Note with id ${noteId} not found`);
            return false;
        }

        this.notes.splice(index, 1);
        this.saveNotesToStorage();
        return true;
    }

    /**
     * Obtiene todas las notas
     * @returns {Array} Array de notas
     */
    getAllNotes() {
        return [...this.notes];
    }

    /**
     * Obtiene notas por categoría
     * @param {string} category - Categoría a filtrar
     * @returns {Array} Array de notas de esa categoría
     */
    getNotesByCategory(category) {
        return this.notes.filter(n => n.category === category);
    }

    /**
     * Obtiene una nota por ID
     * @param {string} noteId - ID de la nota
     * @returns {Object|null} La nota o null si no existe
     */
    getNoteById(noteId) {
        return this.notes.find(n => n.id === noteId) || null;
    }

    /**
     * Limpia todas las notas
     */
    clearAllNotes() {
        this.notes = [];
        this.saveNotesToStorage();
    }

    /**
     * Exporta las notas como JSON
     * @returns {string} JSON string de las notas
     */
    exportNotesAsJSON() {
        return JSON.stringify(this.notes, null, 2);
    }

    /**
     * Importa notas desde JSON
     * @param {string} jsonString - JSON string con las notas
     * @returns {boolean} true si se importó correctamente
     */
    importNotesFromJSON(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            if (Array.isArray(imported)) {
                this.notes = imported;
                this.saveNotesToStorage();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error importing notes:', error);
            return false;
        }
    }
}

/**
 * ================================================================================
 * INTERFAZ DE USUARIO DEL BLOC DE NOTAS
 * ================================================================================
 */

class NotesUI {
    /**
     * Constructor de la interfaz
     * @param {NotesManager} notesManager - Instancia del gestor de notas
     * @param {string} containerId - ID del contenedor HTML
     */
    constructor(notesManager, containerId = 'notes-container') {
        this.notesManager = notesManager;
        this.containerId = containerId;
    }

    /**
     * Renderiza el bloc de notas completo
     */
    render() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error(`Container with id ${this.containerId} not found`);
            return;
        }

        const notes = this.notesManager.getAllNotes();

        container.innerHTML = `
            <div class="notes-wrapper">
                <!-- Controles del bloc de notas -->
                <div class="notes-controls mb-3">
                    <div class="d-flex gap-2 flex-wrap align-items-center">
                        <input 
                            type="text" 
                            class="form-control notes-input" 
                            id="notes-input" 
                            placeholder="Añade una anotación..."
                            style="flex: 1; min-width: 200px;"
                        />
                        <div class="btn-group" role="group">
                            <select class="form-select notes-category" id="notes-category" style="min-width: 130px;">
                                <option value="note">📝 Nota</option>
                                <option value="reminder">⏰ Recordatorio</option>
                            </select>
                        </div>
                        <button class="btn btn-sm btn-primary" id="notes-add-btn" title="Añadir nota">
                            <i class="bi bi-plus-lg"></i> Añadir
                        </button>
                    </div>
                </div>

                <!-- Lista de notas -->
                <div class="notes-list" id="notes-list">
                    ${this.renderNotesList(notes)}
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    /**
     * Renderiza el HTML de la lista de notas
     * @param {Array} notes - Array de notas a renderizar
     * @returns {string} HTML string
     */
    renderNotesList(notes) {
        if (notes.length === 0) {
            return `
                <div class="notes-empty-state">
                    <div class="text-center py-4 text-muted">
                        <i class="bi bi-sticky display-6 mb-2 d-block opacity-50"></i>
                        <p class="mb-0">Sin notas por el momento. ¡Añade la primera!</p>
                    </div>
                </div>
            `;
        }

        return notes.map(note => this.renderSingleNote(note)).join('');
    }

    /**
     * Renderiza una nota individual
     * @param {Object} note - Objeto nota
     * @returns {string} HTML string de la nota
     */
    renderSingleNote(note) {
        const categoryIcon = note.category === 'reminder' ? '⏰' : '📝';
        const categoryLabel = note.category === 'reminder' ? 'Recordatorio' : 'Nota';
        const createdDate = new Date(note.createdAt).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <div class="note-card" data-note-id="${note.id}">
                <div class="note-header">
                    <div class="note-category">
                        <span class="note-category-badge">${categoryIcon} ${categoryLabel}</span>
                    </div>
                    <div class="note-actions">
                        <button 
                            class="note-action-btn note-edit-btn" 
                            title="Editar nota"
                            data-note-id="${note.id}"
                        >
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button 
                            class="note-action-btn note-delete-btn" 
                            title="Eliminar nota"
                            data-note-id="${note.id}"
                        >
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="note-content">
                    <p class="note-text">${this.escapeHtml(note.text)}</p>
                </div>
                <div class="note-footer">
                    <small class="note-date" title="Creada el ${createdDate}">
                        <i class="bi bi-clock-history me-1"></i>${this.formatDateRelative(note.createdAt)}
                    </small>
                </div>
            </div>
        `;
    }

    /**
     * Adjunta event listeners a los elementos de la interfaz
     */
    attachEventListeners() {
        // Botón de añadir nota
        const addBtn = document.getElementById('notes-add-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.handleAddNote());
        }

        // Input de nota (Enter key)
        const input = document.getElementById('notes-input');
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleAddNote();
                }
            });
        }

        // Botones de editar
        document.querySelectorAll('.note-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const noteId = e.currentTarget.dataset.noteId;
                this.handleEditNote(noteId);
            });
        });

        // Botones de eliminar
        document.querySelectorAll('.note-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const noteId = e.currentTarget.dataset.noteId;
                this.handleDeleteNote(noteId);
            });
        });
    }

    /**
     * Maneja el evento de añadir nota
     */
    handleAddNote() {
        const input = document.getElementById('notes-input');
        const categorySelect = document.getElementById('notes-category');
        
        if (!input || !categorySelect) return;

        const text = input.value.trim();
        const category = categorySelect.value;

        if (!text) {
            this.showToast('Por favor, escribe algo', 'warning');
            return;
        }

        const note = this.notesManager.createNote(text, category);
        if (note) {
            input.value = '';
            categorySelect.value = 'note';
            this.render();
            this.showToast('Nota añadida correctamente', 'success');
        }
    }

    /**
     * Maneja el evento de editar nota
     * @param {string} noteId - ID de la nota a editar
     */
    handleEditNote(noteId) {
        const note = this.notesManager.getNoteById(noteId);
        if (!note) return;

        const newText = prompt('Editar nota:', note.text);
        if (newText && newText.trim().length > 0) {
            this.notesManager.updateNote(noteId, newText);
            this.render();
            this.showToast('Nota actualizada', 'success');
        }
    }

    /**
     * Maneja el evento de eliminar nota
     * @param {string} noteId - ID de la nota a eliminar
     */
    handleDeleteNote(noteId) {
        if (confirm('¿Estás seguro de que quieres eliminar esta nota?')) {
            if (this.notesManager.deleteNote(noteId)) {
                this.render();
                this.showToast('Nota eliminada', 'info');
            }
        }
    }

    /**
     * Escapa caracteres HTML para prevenir XSS
     * @param {string} text - Texto a escapar
     * @returns {string} Texto escapado
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Formatea la fecha en formato relativo (ej: "hace 2 horas")
     * @param {string} dateString - String ISO de la fecha
     * @returns {string} Formato relativo
     */
    formatDateRelative(dateString) {
        const now = new Date();
        const date = new Date(dateString);
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Justo ahora';
        if (diffMins < 60) return `hace ${diffMins}m`;
        if (diffHours < 24) return `hace ${diffHours}h`;
        if (diffDays < 7) return `hace ${diffDays}d`;
        
        return date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
    }

    /**
     * Muestra un toast de notificación
     * @param {string} message - Mensaje a mostrar
     * @param {string} type - Tipo: 'success', 'error', 'warning', 'info'
     */
    showToast(message, type = 'info') {
        // Usa el sistema de toasts existente si está disponible
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            // Fallback a alert simple
            alert(message);
        }
    }
}

// Exportar para uso global
window.NotesManager = NotesManager;
window.NotesUI = NotesUI;
