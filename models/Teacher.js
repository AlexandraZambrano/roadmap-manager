import mongoose from 'mongoose';

const TeacherSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true }, // Keeping UUID for compatibility
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    provisional: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Teacher', TeacherSchema);
