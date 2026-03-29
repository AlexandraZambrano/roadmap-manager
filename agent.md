# Agent Memory — Roadmap Manager

> **Instrucción para el agente:** Leer SIEMPRE este archivo al inicio de cada conversación. Actualizar SIEMPRE después de cada cambio relevante al proyecto.
> Última actualización: 2026-03-27 (fix: cálculo de nivel de competencia en evaluación)

---

## Overview
Sistema de gestión de roadmaps educativos para Factoría F5. Diseñado para que el personal interno (profesores/coordinadores) gestione cohortes y los alumnos vean su progreso.

---

## Technology Stack
- **Frontend:** Vanilla JavaScript, Bootstrap 5, Bootstrap Icons (bi-icons).
- **Backend:** Node.js + Express.js (arquitectura monolítica — todo en `server.js`).
- **Database:** MongoDB con Mongoose ODM.
- **Auth:** Sistema dual:
  - Interno: email/contraseña con `bcryptjs`.
  - Externo: JWT RS256 desde `users.coderf5.es` verificado con `backend/keys/public.pem`.
- **Librerías clave:**
  - `jspdf` + `html2canvas`: Generación de PDFs en cliente.
  - `jszip`: Compresión de reportes en bulk.
  - `xlsx`: Importación/exportación de Excel.
  - `nodemailer`: Notificaciones automáticas por email.

---

## Project Structure & File Roles

### Raíz del proyecto
- **`server.js`** (~182KB): Punto de entrada principal. Contiene TODAS las rutas API (promotions, students, attendance, extended info, competences, templates, admin, etc.). Arquitectura monolítica.
- **`package.json`**: Dependencias del proyecto.
- **`Dockerfile`** + **`.dockerignore`**: Configuración de despliegue en contenedor.
- **`DOCUMENTATION_INDEX.md`**: Índice de documentación general.
- **Scripts de diagnóstico/migración en raíz** (no son parte del runtime):
  - `check-database.js`, `check-students.js`, `debug-db.js`, `debug-student-data.js`
  - `find-all-students.js`, `find-database.js`
  - `fix-migration.js`, `force-migration-final.js`
  - `create-test-data.js`, `check-ext-info.mjs`
  - `EJEMPLOS_BLOC_DE_NOTAS.js` (ejemplos de notepad)

### Frontend (`public/`)

#### HTML Pages
- **`index.html`**: Redirección raíz / landing mínima.
- **`login.html`**: Página de inicio de sesión.
- **`auth.html`**: Gestión de autenticación externa (JWT redirect).
- **`dashboard.html`**: Dashboard principal del profesor/coordinador.
- **`admin.html`**: Panel de administración (gestión de usuarios, templates, etc.).
- **`promotion-detail.html`** (~175KB): Vista core de gestión de una cohorte. Carga todos los scripts de gestión. Es la página más compleja del sistema.
- **`public-promotion.html`**: Vista pública del roadmap de una cohorte (sin auth).
- **`student-dashboard.html`**: Dashboard del alumno (vista de su propio progreso).

#### JS (`public/js/`)
- **`config.js`**: Configuración centralizada de URLs de API.
- **`shared.js`**: Utilidades compartidas mínimas.
- **`translations.js`**: Sistema de internacionalización (i18n).
- **`auth.js`**: Lógica de autenticación frontend (login, token, redirect).
- **`login.js`**: UI y lógica específica del formulario de login.
- **`landing.js`**: Lógica de la página de aterrizaje.
- **`dashboard.js`** (~18KB): Dashboard del profesor. Lista de cohortes, navegación.
- **`admin.js`** (~18KB): Panel de administración. Gestión de usuarios y plantillas.
- **`notes.js`** (~15KB): Bloc de notas persistente por cohorte para profesores.
- **`program-competences.js`** (~37KB): Visualización del roadmap de competencias del bootcamp.
- **`promotion-detail.js`** (~532KB — archivo principal): Orquestador de la vista de cohorte. Gestiona:
  - Lista de alumnos y estados de selección.
  - Triggers para reportes PDF en bulk.
  - Gestión de módulos, proyectos, asistencia, etc.
  - Popula dropdowns de reportes dinámicamente.
- **`reports.js`** (~109KB): Toda la lógica de generación de PDF.
  - Usa iframe oculto para renderizar HTML.
  - Captura con `html2canvas` y divide en páginas A4 con `jsPDF`.
  - **Smart Page Breaking**: Rastrea coordenadas inferiores de `tr`, `.section-box`, `.card`, `h2`, `h3` para evitar cortes con `break-inside: avoid`.
  - Expone `window.Reports`.
- **`student-tracking.js`** (~123KB): Ficha de seguimiento individual del alumno.
  - CRUD de notas del profesor, asignaciones de equipo, evaluaciones de competencias.
  - Expone `window.StudentTracking`.
- **`public-promotion.js`** (~90KB): Vista pública del Gantt del roadmap.
  - Renderiza módulos, proyectos, cursos en línea de tiempo.
  - Fix aplicado: lógica de `weekCounter` corregida para alineación correcta.
- **`student-dashboard.js`** (~32KB): Dashboard del alumno con su progreso y vista del Gantt.
- **`sidebar-desktop-toggle.js`** (~2KB): Toggle del sidebar en desktop.

#### CSS (`public/css/`)
- **`style.css`** (~6.6KB): Estilos globales de la aplicación.
- **`promotion-detail.css`** (~52KB): Estilos específicos de la vista de cohorte (la más compleja).
- **`dashboard.css`** (~11KB): Estilos del dashboard del profesor.

### Backend (`backend/`)

#### Models (`backend/models/`)
- **`Promotion.js`**: Configuración de cohorte (módulos, proyectos, fechas, calendario).
- **`Student.js`**: Datos personales + `technicalTracking` (notas, equipos, módulos) + `transversalTracking`.
- **`ExtendedInfo.js`**: Metadatos extra de la cohorte (horarios, formadores, financiadores, recursos, equipo docente, criterios de evaluación).
- **`Teacher.js`**: Perfil del profesor (nombre, email, rol, LinkedIn, collaborators).
- **`Admin.js`**: Usuarios administradores internos.
- **`Attendance.js`**: Registro de asistencia diaria por alumno (con comentarios por día).
- **`BootcampTemplate.js`**: Plantillas reutilizables de bootcamp (módulos, proyectos).
- **`Calendar.js`**: Calendarios de eventos de cohorte.
- **`Area.js`**, **`Competence.js`**, **`CompetenceArea.js`**: Estructura de áreas de competencia.
- **`CompetenceIndicator.js`**, **`Indicator.js`**: Indicadores de evaluación de competencias.
- **`CompetenceResource.js`**, **`Resource.js`**, **`ResourceType.js`**: Recursos de aprendizaje vinculados a competencias.
- **`CompetenceTool.js`**, **`Tool.js`**: Herramientas asociadas a competencias.
- **`Level.js`**: Niveles de competencia.
- **`QuickLink.js`**: Links rápidos de la cohorte.
- **`Referent.js`**: Referentes/tutores de alumnos.
- **`Section.js`**: Secciones del programa.

#### Utils (`backend/utils/`)
- **`email.js`**: Helper para envío de emails del sistema con `nodemailer`.

#### Migrations (`backend/`)
- **`migrate.js`**, **`migrate-students.js`**, **`quick-migration.js`**, **`rollback-migration.js`**: Scripts de migración de esquema.
- **`MIGRATION_GUIDE.md`**: Guía de migraciones.

---

## Technical Conventions & Lessons Learned

### PDF Generation
- **Orden de scripts:** `html2canvas` → `jspdf` → `reports.js`.
- **Visibilidad del iframe:** Debe ser técnicamente "visible" (aunque off-screen en `left: -2000px`) para que los navegadores hagan el layout completo.
- **Seguridad:** Siempre verificar `window.Reports` antes de llamar funciones para evitar `ReferenceError` si CDN falla.

### Gantt Chart (public-promotion.js / student-dashboard.js)
- **Fix aplicado:** La lógica de `weekCounter` fue corregida para evitar que cursos y proyectos aparezcan desplazados tras sus módulos.
- Renderizado consistente entre vistas: teacher, student y public.

### Evaluación de Competencias (promotion-detail.js)
- **Niveles de competencia (0–3):** El nivel final de una competencia se calcula **SOLO** a partir de los `competenceIndicators` (indicadores de nivel: `initial`, `medio`, `advance`). Las claves son `comp-{id}`.
- **Indicadores de herramienta (`tool-{toolId}-{indId}`):** Se guardan en `checkedIndicators` y se persisten para los informes de seguimiento técnico, pero **NO deben sumarse al nivel de la competencia**.
- **Bug corregido (2026-03-27):** El bug del nivel a `0` existía en múltiples lugares:
  1. `updateEvalIndicator`: (cálculo en tiempo real).
  2. `buildSubModalCompetencesHtml`: (render al recargar panel individual).
  3. `_buildEvalTargetHtml` y `buildGroupEvalTablesHtml`: (renders alternativos y grupales).
  - **Ambas lógicas (realtime y render):** usaban `hasToolIndicators` incorrectamente. Fue eliminado. El cálculo usa **estrictamente** `hasCompIndicators`.
- **UX Mejora:** Añadidos estados de carga (spinners y botones deshabilitados) en las funciones `saveIndividualStudentEval` y `saveProjectEvaluation` para prevenir doble envío y notificar al usuario.
- **Lógica de nivel:** Nivel 1 si todos los indicadores de nivel 1 están marcados; Nivel 2 si además todos los de nivel 2; Nivel 3 si además todos los de nivel 3.
- **Badge en DOM:** El span `[data-auto-level-badge]` y los contadores `[data-lvl-count="N"]` se actualizan en tiempo real sin re-renderizar la tarjeta.

### Asistencia (Attendance)
- Los comentarios se guardan **por día, por alumno** (granularidad diaria).
- La descarga Excel de asistencia mensual genera tabs separados por mes con estadísticas.
- **Exportación a PDF Semanal:** Se ha añadido una descarga en PDF (`window.Reports.printWeeklyAttendance`) que renderiza la asistencia completa de inicio a fin del bootcamp, separada en tablas semanales de L-V. Incluye cómputos totales (Presente/Ausente/Retraso) y lista textualmente los **comentarios diarios** del estudiante por semana.
- El selector de mes en el frontend está limitado a los meses dentro del rango de inicio/fin del programa.

### State Management
- La mayoría del estado frontend se gestiona con variables globales dentro de IIFEs (ej: `_currentStudentId` en `student-tracking.js`).
- Los elementos UI dinámicos (contenidos de modal) se generan con template strings en JS.

### Authentication
- Auth interna: `bcryptjs`.
- Auth externa (desde `users.coderf5.es`): verificación con clave pública RSA (`backend/keys/public.pem`).

### Collaborators (Teachers)
- Los profesores pueden tener colaboradores (otros profes) asignados a una cohorte.
- El dropdown de selección de colaboradores muestra todos los profesores existentes.

### ExtendedInfo (Información Extendida de Cohorte)
- Almacena: horarios detallados (entrada/salida/descanso/comida para días online y presencial), notas, recursos de estudio, equipo docente (nombre, rol, LinkedIn, email) y criterios de evaluación.
- Editable por el profesor, visible para el alumno.

---

## Maintenance Notes
- **Arquitectura monolítica:** Todas las rutas API están en `server.js`. Para cambios en el backend, buscar en ese único archivo.
- **Migraciones:** Los cambios de esquema en `backend/models/` deben revisarse en los scripts de migración para evitar pérdida de datos.
- **Estilos PDF:** Los estilos para PDF están aislados en `reports.js` (método `_baseCss()`) para garantizar output consistente independientemente del CSS principal de la app.
- **Context Window:** Para trabajo en UI, focalizar en `promotion-detail.js` (lógica de listas) y `reports.js` (lógica de output). Son archivos muy grandes; buscar secciones específicas con grep antes de leer.
- **Archivo más grande:** `promotion-detail.js` (~532KB) — usar búsquedas específicas, nunca leer completo.
