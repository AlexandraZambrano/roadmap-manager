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
    }]
}, { timestamps: true });

export default mongoose.model('ExtendedInfo', ExtendedInfoSchema);
