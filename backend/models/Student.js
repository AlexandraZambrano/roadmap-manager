import mongoose from 'mongoose';

const StudentSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String },
    email: { type: String, required: true },
    password: { type: String, required: true },
    promotionId: { type: String },
    tempPassword: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Student', StudentSchema);
