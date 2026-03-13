/**
 * EJEMPLO DE USO - BLOC DE NOTAS
 * ===============================
 * 
 * Este archivo muestra ejemplos de cómo usar el módulo NotesManager y NotesUI
 * tanto programáticamente como a través de la interfaz.
 * 
 * Notas: El módulo se inicializa automáticamente en promotion-detail.js,
 * pero estos ejemplos pueden ejecutarse en la consola del navegador.
 */

// ================================================================================
// EJEMPLO 1: USO BÁSICO DEL NOTESMANAGER
// ================================================================================

// Obtener referencia al gestor de notas (ya inicializado)
const mgr = window.notesManager;
const ui = window.notesUI;

// Crear una nueva nota
const nuevaNota = mgr.createNote('Recordatorio: Revisar tareas del módulo 3', 'reminder');
console.log('Nota creada:', nuevaNota);
// → { id: "1710345600000", text: "Recordatorio: Revisar tareas del módulo 3", category: "reminder", ... }

// Obtener todas las notas
const todasLasNotas = mgr.getAllNotes();
console.log('Total de notas:', todasLasNotas.length);

// Obtener solo recordatorios
const recordatorios = mgr.getNotesByCategory('reminder');
console.log('Recordatorios:', recordatorios);

// Obtener solo notas
const notas = mgr.getNotesByCategory('note');
console.log('Notas:', notas);


// ================================================================================
// EJEMPLO 2: EDITAR Y ELIMINAR NOTAS
// ================================================================================

// Obtener una nota por ID
const primeraNotaId = todasLasNotas[0]?.id;
if (primeraNotaId) {
    // Obtener nota específica
    const nota = mgr.getNoteById(primeraNotaId);
    console.log('Nota encontrada:', nota);

    // Actualizar la nota
    const notaActualizada = mgr.updateNote(primeraNotaId, 'Nuevo texto de la nota', 'note');
    console.log('Nota actualizada:', notaActualizada);

    // Renderizar cambios
    ui.render();
}

// Eliminar la primera nota
if (primeraNotaId) {
    const eliminada = mgr.deleteNote(primeraNotaId);
    console.log('¿Nota eliminada?', eliminada); // → true/false
    ui.render();
}


// ================================================================================
// EJEMPLO 3: CREAR MÚLTIPLES NOTAS
// ================================================================================

// Crear varias notas de ejemplo
mgr.createNote('Estudiante X tiene dudas sobre JavaScript', 'note');
mgr.createNote('Enviar feedback del proyecto al equipo', 'reminder');
mgr.createNote('Preparar presentación del módulo 4', 'reminder');
mgr.createNote('Los recursos están listos en Asana', 'note');

// Renderizar la UI
ui.render();

console.log('Se han añadido 4 notas de ejemplo');


// ================================================================================
// EJEMPLO 4: EXPORTAR E IMPORTAR NOTAS
// ================================================================================

// Exportar todas las notas a JSON
const jsonExportado = mgr.exportNotesAsJSON();
console.log('Notas exportadas (JSON):');
console.log(jsonExportado);

// Guardar en variable para luego importar (simular backup)
window.backup = jsonExportado;

// Más tarde, importar desde JSON
// mgr.importNotesFromJSON(window.backup);


// ================================================================================
// EJEMPLO 5: FILTRAR NOTAS
// ================================================================================

// Cambiar filtro a "reminder" en la UI
function mostrarSoloRecordatorios() {
    ui.currentCategory = 'reminder';
    ui.render();
    console.log('Mostrando solo recordatorios');
}

// Cambiar filtro a "note"
function mostrarSoloNotas() {
    ui.currentCategory = 'note';
    ui.render();
    console.log('Mostrando solo notas');
}

// Mostrar todas
function mostrarTodas() {
    ui.currentCategory = 'all';
    ui.render();
    console.log('Mostrando todas las notas');
}


// ================================================================================
// EJEMPLO 6: ESTADÍSTICAS Y ANÁLISIS
// ================================================================================

function mostrarEstadísticas() {
    const todas = mgr.getAllNotes();
    const recordatorios = mgr.getNotesByCategory('reminder');
    const notas = mgr.getNotesByCategory('note');

    console.log('=== ESTADÍSTICAS ===');
    console.log(`Total de notas: ${todas.length}`);
    console.log(`Recordatorios: ${recordatorios.length}`);
    console.log(`Notas: ${notas.length}`);
    console.log(`Porcentaje recordatorios: ${((recordatorios.length / todas.length) * 100).toFixed(1)}%`);
    
    // Notas más antiguas
    if (todas.length > 0) {
        const masAntigua = todas.reduce((a, b) => 
            new Date(a.createdAt) < new Date(b.createdAt) ? a : b
        );
        console.log(`Nota más antigua: ${masAntigua.text} (hace ${new Date(masAntigua.createdAt).toLocaleDateString('es-ES')})`);
    }
}

// Ejecutar estadísticas
// mostrarEstadísticas();


// ================================================================================
// EJEMPLO 7: LIMPIAR TODAS LAS NOTAS
// ================================================================================

function limpiarTodas() {
    if (confirm('¿Estás seguro de que quieres eliminar TODAS las notas?')) {
        mgr.clearAllNotes();
        ui.render();
        console.log('Todas las notas han sido eliminadas');
    }
}

// limpiarTodas(); // Descomenta para usar


// ================================================================================
// EJEMPLO 8: MANEJO DE LocalStorage
// ================================================================================

// Ver qué se guarda en LocalStorage
function verLocalStorage() {
    const key = `promotionNotes_${window.promotionId}`;
    const valor = localStorage.getItem(key);
    console.log(`LocalStorage key: ${key}`);
    console.log('Valor guardado:', valor);
    return valor;
}

// Borrar manualmente del localStorage
function borrarDelLocalStorage() {
    const key = `promotionNotes_${window.promotionId}`;
    localStorage.removeItem(key);
    console.log(`Eliminado: ${key}`);
    mgr.notes = []; // Limpiar también en memoria
}

// Restaurar desde localStorage
function restaurarDelLocalStorage() {
    mgr.notes = mgr.loadNotes();
    ui.render();
    console.log('Notas restauradas desde LocalStorage');
}


// ================================================================================
// EJEMPLO 9: BÚSQUEDA EN NOTAS
// ================================================================================

function buscarNotas(termino) {
    const todasLasNotas = mgr.getAllNotes();
    const resultados = todasLasNotas.filter(nota => 
        nota.text.toLowerCase().includes(termino.toLowerCase())
    );
    console.log(`Se encontraron ${resultados.length} notas con "${termino}":`);
    resultados.forEach(nota => {
        console.log(`- [${nota.category}] ${nota.text}`);
    });
    return resultados;
}

// Buscar
// buscarNotas('módulo');


// ================================================================================
// EJEMPLO 10: RE-RENDERIZAR LA UI
// ================================================================================

function refrescar() {
    ui.render();
    console.log('UI re-renderizada');
}

// Esto es útil si haces cambios programáticamente y quieres que se vean en la UI


// ================================================================================
// EJEMPLOS DE PRUEBA RÁPIDA (copy-paste en consola)
// ================================================================================

/**
 * Copiar y pegar esto en la consola del navegador para una prueba rápida:
 * 
   window.notesManager.createNote('Prueba 1: Esta es una nota de prueba', 'note');
   window.notesManager.createNote('Prueba 2: Este es un recordatorio de prueba', 'reminder');
   window.notesUI.render();
   
 * Luego puedes ver las notas en el bloc de notas en el Overview.
 */


// ================================================================================
// CASOS DE USO REALES EN LA APLICACIÓN
// ================================================================================

/**
 * CASO 1: Docente entra a la plataforma
 * ------------------------------------
 * 1. Se carga promotion-detail.html
 * 2. En DOMContentLoaded se inicializa NotesManager con el promotionId
 * 3. Se carga el JSON de notas del localStorage
 * 4. NotesUI renderiza las notas en el contenedor
 * 5. Docente ve sus notas previas
 * 
 * CASO 2: Docente añade una nota
 * --------------------------------
 * 1. Escribe en el input "Revisar proyecto del módulo 2"
 * 2. Selecciona categoría "reminder"
 * 3. Click en "Añadir"
 * 4. handleAddNote() crea la nota en NotesManager
 * 5. Se guarda automáticamente en localStorage
 * 6. UI se re-renderiza y muestra la nueva nota
 * 
 * CASO 3: Docente edita una nota
 * --------------------------------
 * 1. Pasa el ratón sobre una nota
 * 2. Aparece el botón de editar (lápiz)
 * 3. Click en editar
 * 4. Aparece prompt con el texto actual
 * 5. Cambiar texto y aceptar
 * 6. updateNote() guarda cambios
 * 7. localStorage se actualiza automáticamente
 * 8. UI se re-renderiza con la nota actualizada
 * 
 * CASO 4: Docente elimina una nota
 * ----------------------------------
 * 1. Pasa el ratón sobre una nota
 * 2. Aparece el botón de eliminar (papelera)
 * 3. Click en eliminar
 * 4. Confirmación: "¿Estás seguro...?"
 * 5. deleteNote() elimina de NotesManager
 * 6. localStorage se actualiza automáticamente
 * 7. UI se re-renderiza sin la nota
 * 
 * CASO 5: Docente cambia de promoción
 * --------------------------------------
 * 1. En la URL, el promotionId es diferente
 * 2. DOMContentLoaded se ejecuta de nuevo
 * 3. Se crea una nueva instancia de NotesManager con el nuevo promotionId
 * 4. localStorage usa clave diferente (ej: promotionNotes_promo-2)
 * 5. Se cargan las notas de esa promoción (diferentes a la anterior)
 */

console.log('Ejemplos de uso del Bloc de Notas cargados.');
console.log('Usa las funciones definidas arriba para interactuar con el módulo.');
