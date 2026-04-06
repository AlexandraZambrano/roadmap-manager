import mongoose from 'mongoose';

const ModuleSchema = new mongoose.Schema({
    id: { type: String, required: true },
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
        startOffset: { type: Number, default: 0 },
        competenceIds: [{ type: mongoose.Schema.Types.Mixed }]
    }],
    pildoras: [{
        id: { type: String, required: true },
        title: { type: String, required: true },
        type: { type: String, enum: ['individual', 'couple'], default: 'individual' },
        assignedStudentIds: [{ type: String }]
    }],
    createdAt: { type: Date, default: Date.now }
});

const PromotionSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    startDate: { type: String },
    endDate: { type: String },
    weeks: { type: Number },
    modules: [ModuleSchema],
    employability: [{
        name: { type: String },
        url: { type: String },
        startMonth: { type: Number, default: 1 },
        duration: { type: Number, default: 1 }
    }],
    teacherId: { type: String, required: true },
    ownerModules: [{ type: String }],
    collaborators: [{ type: String }],
    collaboratorModules: [{ teacherId: { type: String }, moduleIds: [{ type: String }] }],
    accessPassword: { type: String }, // Password for students to access promotion
    passwordChangeHistory: [{
        oldPassword: String,
        newPassword: String,
        changedAt: { type: Date, default: Date.now }
    }],
    teachingContentUrl: { type: String }, // URL to teaching content (for "Contenido Docente" button)
    asanaWorkspaceUrl: { type: String }, // URL to Asana workspace (for "Asana" access link)
    holidays: [{ type: String }], // Array of YYYY-MM-DD strings marking non-working days (festivos)
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('Promotion', PromotionSchema);
