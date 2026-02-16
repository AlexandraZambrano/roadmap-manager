import mongoose from 'mongoose';

const QuickLinkSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    promotionId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    url: { type: String, required: true },
    platform: { type: String },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('QuickLink', QuickLinkSchema);
