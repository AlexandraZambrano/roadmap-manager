import mongoose from 'mongoose';

const CalendarSchema = new mongoose.Schema({
    promotionId: { type: String, required: true, unique: true, index: true },
    googleCalendarId: { type: String, required: true }
});

export default mongoose.model('Calendar', CalendarSchema);
