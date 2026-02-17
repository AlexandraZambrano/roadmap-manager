import mongoose from 'mongoose';

const ModuleTemplateSchema = new mongoose.Schema({
    name: { type: String, required: true },
    duration: { type: Number, required: true },
    courses: [{
        name: { type: String },
        url: { type: String }
    }],
    projects: [{
        name: { type: String },
        url: { type: String }
    }]
});

const BootcampTemplateSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    weeks: { type: Number, required: true },
    hours: { type: Number }, // Total hours for the bootcamp
    hoursPerWeek: { type: Number }, // Average hours per week
    modules: [ModuleTemplateSchema],
    isCustom: { type: Boolean, default: false }, // True if created by user, False if system default
    createdBy: { type: String }, // User ID who created it (null for system templates)
    evaluation: { type: String, default: '' }, // Default evaluation text
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
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('BootcampTemplate', BootcampTemplateSchema);
