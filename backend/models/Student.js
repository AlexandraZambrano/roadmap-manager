import mongoose from 'mongoose';

const StudentSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    lastname: { type: String, required: false, default: '' }, // Changed to not required for existing students
    email: { type: String, required: true },
    phone: { type: String, default: '' },
    age: { type: Number, default: null },
    administrativeSituation: { type: String, default: '' },
    nationality: { type: String, default: '' },
    identificationDocument: { type: String, default: '' },
    gender: { type: String, default: '' },
    englishLevel: { type: String, default: '' },
    educationLevel: { type: String, default: '' },
    profession: { type: String, default: '' }, // Current profession/background
    community: { type: String, default: '' },
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
    isWithdrawn: { type: Boolean, default: false },
    withdrawal: {
        date: { type: String, default: null },
        reason: { type: String, default: '' },
        representative: { type: String, default: '' },
        processedAt: { type: String, default: null }
    },
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
            studentComment: String,
            members: [{ id: String, name: String }],
            competences: [{
                competenceId: mongoose.Schema.Types.Mixed,
                competenceName: String,
                level: Number,
                toolsUsed: [String],
                achievedIndicators: [{
                    toolName: String,
                    indicatorName: String,
                    indicatorId: String,
                    levelId: Number
                }]
            }]
        }],
        competences: [{
            competenceId: mongoose.Schema.Types.Mixed,
            competenceName: String,
            level: Number,
            toolsUsed: [String],
            achievedIndicators: [{
                toolName: String,
                indicatorName: String,
                indicatorId: String,
                levelId: Number
            }],
            evaluatedDate: String,
            notes: String
        }],
        completedModules: [{
            moduleId: String,
            moduleName: String,
            completionDate: String,
            finalGrade: String,
            grade: String,
            notes: String,
            progressPercent: Number,
            completedCourses: [String]
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
