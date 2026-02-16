import mongoose from 'mongoose';

const ModuleSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    duration: { type: Number, required: true },
    courses: [{
        name: { type: String },
        url: { type: String }
    }],
    projects: [{
        name: { type: String },
        url: { type: String }
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
    teacherId: { type: String, required: true },
    collaborators: [{ type: String }],
    accessPassword: { type: String }, // Password for students to access promotion
    passwordChangeHistory: [{
        oldPassword: String,
        newPassword: String,
        changedAt: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('Promotion', PromotionSchema);
