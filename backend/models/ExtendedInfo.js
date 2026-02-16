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
    evaluation: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.model('ExtendedInfo', ExtendedInfoSchema);
