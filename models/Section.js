import mongoose from 'mongoose';

const SectionSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    promotionId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Section', SectionSchema);
