# Agent Memory — Roadmap Manager

## Overview
Automated educational roadmap management system for Factoría F5. Designed for internal staff (teachers/coordinators) to manage cohorts and for students to view their progress.

## Technology Stack
- **Frontend:** Vanilla JavaScript, Bootstrap 5, Bi-icons.
- **Backend:** Node.js, Express.js (Monolithic architecture).
- **Database:** MongoDB with Mongoose ODM.
- **Auth:** Dual system (Internal email/pass + External JWT RS256 integration).
- **Key Libraries:** 
  - `jspdf` & `html2canvas`: Client-side PDF generation.
  - `jszip`: Bulk report compression.
  - `xlsx`: Excel import/export.
  - `nodemailer`: Automated notifications.

## Project Structure & File Roles

### Frontend (`public/`)
- **`promotion-detail.html`**: Core management view for a specific cohort. Loads all management scripts.
- **`js/reports.js`**: 
  - **Function:** Handles all PDF generation logic.
  - **Key Logic:** Uses a hidden iframe technique to render HTML content, captures it via `html2canvas`, and slices it into A4 pages via `jsPDF`.
  - **Important:** Implements "Smart Page Breaking" by tracking bottom coordinates of elements (`tr`, `.section-box`, `.card`, `h2`, `h3`) and ensuring they aren't split between pages using `break-inside: avoid`.
  - **API:** Exposes `window.Reports` object.
- **`js/student-tracking.js`**:
  - **Function:** Manages the individual student tracking sheet (Ficha de Seguimiento).
  - **Logic:** Handles CRUD for teacher notes, team assignments, and competence evaluations.
  - **API:** Exposes `window.StudentTracking`.
- **`js/promotion-detail.js`**:
  - **Function:** Orchestrator for the cohort view. Handles student lists, selection states, and triggers for bulk PDF reports.
  - **Note:** Populates bulk report dropdowns dynamically.
- **`js/config.js`**: Centralized API URL configuration.
- **`js/notes.js`**: Persistent notepad for teachers at the promotion level.
- **`js/program-competences.js`**: Visualizes the competence roadmap for the bootcamp.

### Backend (`backend/`)
- **`server.js`**: Main entry point. Contains API routes for promotions, students, attendance, and file uploads.
- **`models/`**:
  - `Promotion.js`: Cohort configuration (modules, projects, dates).
  - `Student.js`: Personal data + `technicalTracking` (notes, teams, modules) + `transversalTracking`.
  - `ExtendedInfo.js`: Extra metadata for cohorts (schedules, trainers, funders).
- **`utils/email.js`**: Helper for sending system emails.

## Technical Conventions & Lessons Learned

### PDF Generation
- **Library Order:** Scripts must be loaded in this order: `html2canvas` -> `jspdf` -> `reports.js`.
- **Visibility:** The rendering iframe must be technically "visible" (even if off-screen at `left: -2000px`) for some browsers to trigger full layout rendering.
- **Consistency:** Always use `window.Reports` check before calling report functions to avoid `ReferenceError` if libraries fail to load from CDN.

### State Management
- Most frontend state is managed via global variables within IIFEs (e.g., `_currentStudentId` in `student-tracking.js`).
- Dynamic UI elements (like modal contents) are often generated via template strings in JS.

### Authentication
- Internal auth uses `bcryptjs`.
- External auth (from `users.coderf5.es`) uses public key verification (`backend/Keys/public.pem`).

## Maintenance Notes
- **Context Window Optimization:** When working on UI, focus on `promotion-detail.js` for list logic and `reports.js` for output logic. 
- **Migrations:** Schema changes in `backend/models/` usually require checking `backend/migrate.js` or related scripts to prevent data loss.
- **Styling:** PDF styles are isolated in `reports.js` (`_baseCss()`) to ensure consistent print output regardless of the app's main CSS.
