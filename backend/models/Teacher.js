import mongoose from 'mongoose';

const TeacherSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    externalId: { type: String, default: null }, // numeric userId from external auth API (/infouser)
    name: { type: String, required: true },
    lastName: { type: String, default: '' },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    location: { type: String, default: '' },
    provisional: { type: Boolean, default: false },
    userRole: { type: String, enum: ['Formador/a', 'CoFormador/a', 'Coordinador/a'], default: 'Formador/a' },
    passwordChangedAt: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', TeacherSchema, 'teachers');
