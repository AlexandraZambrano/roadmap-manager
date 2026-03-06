import mongoose from 'mongoose';

const ExtendedInfoSchema = new mongoose.Schema({
    promotionId: { type: String, required: true, unique: true, index: true },
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
    team: [{
        name: String,
        role: String,
        email: String,
        linkedin: String
    }],
    resources: [{
        title: String,
        category: String,
        url: String
    }],
    evaluation: { type: String, default: '' },
    pildoras: [{
        mode: String,
        date: String,
        title: String,
        students: [{
            id: String,
            name: String,
            lastname: String
        }],
        status: String,
        moduleId: String // Add module association
    }],
    // New structure for organizing píldoras by modules
    modulesPildoras: [{
        moduleId: String,
        moduleName: String,
        pildoras: [{
            mode: String,
            date: String,
            title: String,
            students: [{
                id: String,
                name: String,
                lastname: String
            }],
            status: String
        }]
    }],
    pildorasAssignmentOpen: { type: Boolean, default: false },
    // Acta de Inicio specific fields
    school: { type: String, default: '' },
    projectType: { type: String, default: '' },
    positiveExitStart: { type: String, default: '' },
    positiveExitEnd: { type: String, default: '' },
    totalHours: { type: String, default: '' },
    modality: { type: String, default: '' },
    presentialDays: { type: String, default: '' },
    materials: { type: String, default: '' },
    internships: { type: Boolean, default: null },
    funders: { type: String, default: '' },
    funderDeadlines: { type: String, default: '' },
    okrKpis: { type: String, default: '' },
    funderKpis: { type: String, default: '' },
    trainerDayOff: { type: String, default: '' },
    cotrainerDayOff: { type: String, default: '' },
    projectMeetings: { type: String, default: '' },
    teamMeetings: { type: String, default: '' },
    approvalName: { type: String, default: '' },
    approvalRole: { type: String, default: '' },
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
    }]
}, { timestamps: true });

export default mongoose.model('ExtendedInfo', ExtendedInfoSchema);
