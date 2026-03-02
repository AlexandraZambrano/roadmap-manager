import mongoose from 'mongoose';

const PildoraTemplateSchema = new mongoose.Schema({
    title: { type: String },
    mode: { type: String, default: 'Virtual' }
});

const ModulePildorasTemplateSchema = new mongoose.Schema({
    moduleName: { type: String },
    pildoras: [PildoraTemplateSchema]
});

const ModuleTemplateSchema = new mongoose.Schema({
    name: { type: String, required: true },
    duration: { type: Number, required: true },
    courses: [{
        name: { type: String },
        url: { type: String },
        duration: { type: Number, default: 1 },
        startOffset: { type: Number, default: 0 }
    }],
    projects: [{
        name: { type: String },
        url: { type: String },
        duration: { type: Number, default: 1 },
        startOffset: { type: Number, default: 0 }
    }]
});

const BootcampTemplateSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    weeks: { type: Number, required: true },
    hours: { type: Number },
    hoursPerWeek: { type: Number },
    modules: [ModuleTemplateSchema],
    isCustom: { type: Boolean, default: false },
    createdBy: { type: String },
    // ── Acta de Inicio fields ──────────────────────────────────────────────
    school: { type: String, default: '' },
    projectType: { type: String, default: '' },
    totalHours: { type: String, default: '' },
    modality: { type: String, default: '' },
    materials: { type: String, default: '' },
    internships: { type: Boolean, default: null },
    funders: { type: String, default: '' },
    funderDeadlines: { type: String, default: '' },
    okrKpis: { type: String, default: '' },
    funderKpis: { type: String, default: '' },
    projectMeetings: { type: String, default: '' },
    teamMeetings: { type: String, default: '' },
    trainerDayOff: { type: String, default: '' },
    cotrainerDayOff: { type: String, default: '' },
    // ── Contenido del Programa fields ──────────────────────────────────────
    evaluation: { type: String, default: '' },
    resources: [{
        title: String,
        category: String,
        url: String
    }],
    employability: [{
        name: { type: String },
        url: { type: String },
        startMonth: { type: Number, default: 1 },
        duration: { type: Number, default: 1 }
    }],
    competences: [{
        id: String,
        area: String,
        name: String,
        description: String,
        levels: [{
            level: Number,
            description: String,
            indicators: [String]
        }],
        allTools: [String],
        selectedTools: [String],
        startModule: {
            id: String,
            name: String
        }
    }],
    // ── Schedule ───────────────────────────────────────────────────────────
    schedule: {
        online: {
            entry: String,
            start: String,
            break: String,
            lunch: String,
            finish: String
        },
        presential: {
            entry: String,
            start: String,
            break: String,
            lunch: String,
            finish: String
        },
        notes: String
    },
    // ── Píldoras per module ────────────────────────────────────────────────
    modulesPildoras: [ModulePildorasTemplateSchema],
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('BootcampTemplate', BootcampTemplateSchema);
