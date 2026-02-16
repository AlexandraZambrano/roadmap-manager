import 'dotenv/config';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Models
import Teacher from './models/Teacher.js';
import Admin from './models/Admin.js';
import Student from './models/Student.js';
import Promotion from './models/Promotion.js';
import QuickLink from './models/QuickLink.js';
import Section from './models/Section.js';
import ExtendedInfo from './models/ExtendedInfo.js';
import Calendar from './models/Calendar.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/bootcamp-manager';

const readJsonFile = (filename, defaultValue = []) => {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) return defaultValue;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        console.error(`Error reading ${filename}:`, error);
        return defaultValue;
    }
};

async function migrate() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected.');

        // 1. Teachers
        console.log('Migrating Teachers...');
        const teachers = readJsonFile('teachers.json');
        for (const t of teachers) {
            await Teacher.findOneAndUpdate({ id: t.id }, t, { upsert: true });
        }

        // 2. Admins
        console.log('Migrating Admins...');
        const admins = readJsonFile('admins.json');
        for (const a of admins) {
            await Admin.findOneAndUpdate({ id: a.id }, a, { upsert: true });
        }

        // 3. Students (Global)
        console.log('Migrating Global Students...');
        const globalStudents = readJsonFile('students.json');
        for (const s of globalStudents) {
            await Student.findOneAndUpdate({ id: s.id }, s, { upsert: true });
        }

        // 4. Promotions and their associated data
        console.log('Migrating Promotions...');
        const promotions = readJsonFile('promotions.json');
        for (const p of promotions) {
            await Promotion.findOneAndUpdate({ id: p.id }, p, { upsert: true });

            // Migration of students specific to this promotion
            const promoStudents = readJsonFile(`students-${p.id}.json`);
            for (const s of promoStudents) {
                await Student.findOneAndUpdate({ id: s.id }, { ...s, promotionId: p.id }, { upsert: true });
            }

            // Quick links
            const quickLinks = readJsonFile(`quick-links-${p.id}.json`);
            for (const q of quickLinks) {
                await QuickLink.findOneAndUpdate({ id: q.id }, { ...q, promotionId: p.id }, { upsert: true });
            }

            // Sections
            const sections = readJsonFile(`sections-${p.id}.json`);
            for (const s of sections) {
                await Section.findOneAndUpdate({ id: s.id }, { ...s, promotionId: p.id }, { upsert: true });
            }

            // Extended Info
            const extendedInfo = readJsonFile(`extended-info-${p.id}.json`, null);
            if (extendedInfo) {
                await ExtendedInfo.findOneAndUpdate({ promotionId: p.id }, extendedInfo, { upsert: true });
            }

            // Calendar
            const calendar = readJsonFile(`calendar-${p.id}.json`, null);
            if (calendar && calendar.googleCalendarId) {
                await Calendar.findOneAndUpdate({ promotionId: p.id }, calendar, { upsert: true });
            }
        }

        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
