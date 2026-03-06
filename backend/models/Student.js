import mongoose from 'mongoose';

const StudentSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    lastname: { type: String, required: false, default: '' }, // Changed to not required for existing students
    email: { type: String, required: true },
    age: { type: Number, default: null },
    nationality: { type: String, default: '' },
    profession: { type: String, default: '' }, // Current profession/background
    address: { type: String, default: '' }, // Full address
    promotionId: { type: String },
    notes: { type: String, default: '' }, // Teacher notes about the student
    progress: {
        modulesCompleted: { type: Number, default: 0 },
        modulesViewed: [{ type: String }], // IDs of modules viewed
        sectionsCompleted: [{ type: String }], // IDs of sections completed
        lastAccessed: { type: Date }
    },
    projectsAssignments: [{
        id: { type: String, required: true },
        moduleId: { type: String, required: true },
        projectName: { type: String, required: true },
        groupName: { type: String, default: '' },
        teammates: [{ type: String }], // other student ids in the group
        done: { type: Boolean, default: false },
        assignedAt: { type: Date, default: Date.now }
    }],
    isManuallyAdded: { type: Boolean, default: true }, // Changed default to true since we removed auto-tracking
    accessLog: [{
        accessedAt: { type: Date, default: Date.now },
        ipAddress: { type: String },
        userAgent: { type: String }
    }],
    createdAt: { type: Date, default: Date.now },

    // ── Ficha de Seguimiento Técnico ──────────────────────────────────────────
    technicalTracking: {
        teacherNotes: [{
            date: String,
            text: String,
            author: String
        }],
        teams: [{
            teamName: String,
            projectType: { type: String, enum: ['individual', 'grupal'], default: 'grupal' },
            role: String,
            moduleName: String,
            moduleId: String,
            assignedDate: String,
            teacherNote: String,
            members: [{ id: String, name: String }],
            competences: [{
                competenceId: mongoose.Schema.Types.Mixed,
                competenceName: String,
                level: Number,
                toolsUsed: [String]
            }]
        }],
        competences: [{
            competenceId: mongoose.Schema.Types.Mixed,
            competenceName: String,
            level: Number,
            toolsUsed: [String],
            evaluatedDate: String,
            notes: String
        }],
        completedModules: [{
            moduleId: String,
            moduleName: String,
            completionDate: String,
            grade: String,
            notes: String
        }],
        completedPildoras: [{
            pildoraTitle: String,
            moduleId: String,
            moduleName: String,
            date: String
        }]
    },

    // ── Ficha de Seguimiento Transversal ──────────────────────────────────────
    transversalTracking: {
        employabilitySessions: [{
            date: String,
            topic: String,
            notes: String
        }],
        individualSessions: [{
            date: String,
            topic: String,
            notes: String
        }],
        incidents: [{
            date: String,
            type: String,
            description: String,
            resolved: { type: Boolean, default: false }
        }]
    },
    extendedInfo: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

export default mongoose.model('Student', StudentSchema);
