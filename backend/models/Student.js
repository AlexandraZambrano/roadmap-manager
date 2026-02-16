import mongoose from 'mongoose';

const StudentSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String },
    email: { type: String, required: true },
    promotionId: { type: String },
    notes: { type: String, default: '' }, // Teacher notes about the student
    progress: {
        modulesCompleted: { type: Number, default: 0 },
        modulesViewed: [{ type: String }], // IDs of modules viewed
        sectionsCompleted: [{ type: String }], // IDs of sections completed
        lastAccessed: { type: Date }
    },
    isManuallyAdded: { type: Boolean, default: false }, // True if teacher added manually, false if auto-tracked
    accessLog: [{
        accessedAt: { type: Date, default: Date.now },
        ipAddress: { type: String },
        userAgent: { type: String }
    }],
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Student', StudentSchema);
