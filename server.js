import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import 'dotenv/config';

// Models
import Teacher from './backend/models/Teacher.js';
import Admin from './backend/models/Admin.js';
import Student from './backend/models/Student.js';
import Promotion from './backend/models/Promotion.js';
import QuickLink from './backend/models/QuickLink.js';
import Section from './backend/models/Section.js';
import ExtendedInfo from './backend/models/ExtendedInfo.js';
import Calendar from './backend/models/Calendar.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/bootcamp-manager';

// MongoDB Connection
mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(bodyParser.json());

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'https://alexandrazambrano.github.io'
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      var msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.static(join(__dirname, 'public')));

// Simple file serving (SPA-like)
app.get('/login', (req, res) => res.sendFile(join(__dirname, 'public', 'login.html')));
app.get('/auth', (req, res) => res.sendFile(join(__dirname, 'public', 'login.html')));
app.get('/dashboard', (req, res) => res.sendFile(join(__dirname, 'public', 'dashboard.html')));
app.get('/student-dashboard', (req, res) => res.sendFile(join(__dirname, 'public', 'student-dashboard.html')));
app.get('/promotion-detail', (req, res) => res.sendFile(join(__dirname, 'public', 'promotion-detail.html')));
app.get('/public-promotion', (req, res) => res.sendFile(join(__dirname, 'public', 'public-promotion.html')));
app.get('/admin', (req, res) => res.sendFile(join(__dirname, 'public', 'admin.html')));
app.get('/', (req, res) => res.sendFile(join(__dirname, 'public', 'index.html')));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// --- Initialization ---

async function initializeTestAccounts() {
  const accounts = [
    { name: 'Alex', email: 'alex@gmail.com', password: 'aA12345678910*', role: 'teacher' },
    { name: 'Celia', email: 'celia@gmail.com', password: 'celia123456', role: 'teacher' },
    { name: 'Test Student', email: 'student@test.com', password: 'student123', role: 'student' },
    { name: 'System Admin', email: 'admin@test.com', password: 'admin123', role: 'admin' }
  ];

  for (const acc of accounts) {
    let Model;
    if (acc.role === 'teacher') Model = Teacher;
    else if (acc.role === 'student') Model = Student;
    else if (acc.role === 'admin') Model = Admin;

    const existing = await Model.findOne({ email: acc.email });
    if (!existing) {
      const hashedPassword = await bcrypt.hash(acc.password, 10);
      await Model.create({
        id: uuidv4(),
        name: acc.name,
        email: acc.email,
        password: hashedPassword
      });
      console.log(`Test ${acc.role} account created: ${acc.email}`);
    }
  }
}

initializeTestAccounts();

// --- Auth Middleware ---

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const canEditPromotion = (promotion, userId) => {
  if (!promotion) return false;
  return promotion.teacherId === userId || (promotion.collaborators && promotion.collaborators.includes(userId));
};

// ==================== AUTHENTICATION ====================

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Email, password, and name are required' });

    const existing = await Teacher.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const teacher = await Teacher.create({ id: uuidv4(), name, email, password: hashedPassword });
    const token = jwt.sign({ id: teacher.id, email: teacher.email, role: 'teacher' }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ message: 'Teacher registered successfully', token, user: { id: teacher.id, name: teacher.name, email: teacher.email, role: 'teacher' } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    let user = null;
    let userRole = role;

    if (userRole === 'teacher' || !role) {
      user = await Teacher.findOne({ email });
      if (user && (await bcrypt.compare(password, user.password))) userRole = 'teacher';
      else user = null;
    }

    if (!user && (userRole === 'student' || !role)) {
      user = await Student.findOne({ email });
      if (user && (await bcrypt.compare(password, user.password))) userRole = 'student';
      else user = null;
    }

    if (!user && (userRole === 'admin' || !role)) {
      user = await Admin.findOne({ email });
      if (user && (await bcrypt.compare(password, user.password))) userRole = 'admin';
      else user = null;
    }

    if (user) {
      const token = jwt.sign({ id: user.id, email: user.email, role: userRole }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ message: 'Login successful', token, user: { id: user.id, name: user.name, email: user.email, role: userRole } });
    }

    return res.status(401).json({ error: 'Invalid email or password' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== STUDENT MANAGEMENT ====================

app.get('/api/promotions/:promotionId/students', verifyToken, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const students = await Student.find({ promotionId: req.params.promotionId });
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/promotions/:promotionId/students', verifyToken, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const { email, name } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const student = await Student.create({
      id: uuidv4(),
      email,
      name: name || email.split('@')[0],
      password: hashedPassword,
      promotionId: req.params.promotionId,
      tempPassword: true
    });

    res.status(201).json({ message: 'Student added successfully', student: { id: student.id, email: student.email, name: student.name }, tempPassword });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/promotions/:promotionId/students/:studentId', verifyToken, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const result = await Student.deleteOne({ id: req.params.studentId, promotionId: req.params.promotionId });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Student not found' });
    res.json({ message: 'Student deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== PROMOTIONS ====================

app.get('/api/promotions', async (req, res) => {
  try {
    const promotions = await Promotion.find({});
    res.json(promotions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/my-enrollments', verifyToken, async (req, res) => {
  try {
    const enrollments = await Student.find({ $or: [{ id: req.user.id }, { email: req.user.email }] });
    const promotionIds = enrollments.map(e => e.promotionId).filter(id => id);
    const enrolledPromotions = await Promotion.find({ id: { $in: promotionIds } });
    res.json(enrolledPromotions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/my-promotions', verifyToken, async (req, res) => {
  try {
    const teacherPromotions = await Promotion.find({
      $or: [{ teacherId: req.user.id }, { collaborators: req.user.id }]
    });
    res.json(teacherPromotions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/my-promotions-all', verifyToken, async (req, res) => {
  try {
    const teacherPromotions = await Promotion.find({
      $or: [{ teacherId: req.user.id }, { collaborators: req.user.id }]
    });
    res.json(teacherPromotions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/promotions/:id', async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.id });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    res.json(promotion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/promotions', verifyToken, async (req, res) => {
  try {
    const { name, description, startDate, endDate, weeks, modules } = req.body;
    if (!name || !weeks) return res.status(400).json({ error: 'Name and weeks are required' });

    const promotion = await Promotion.create({
      id: uuidv4(),
      name,
      description,
      startDate,
      endDate,
      weeks,
      modules: modules || [],
      teacherId: req.user.id,
      collaborators: []
    });
    res.status(201).json(promotion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/promotions/:id', verifyToken, async (req, res) => {
  try {
    const promotion = await Promotion.findOneAndUpdate(
      { id: req.params.id },
      { ...req.body },
      { new: true }
    );
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });
    res.json(promotion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/promotions/:id', verifyToken, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.id });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    await Promotion.deleteOne({ id: req.params.id });
    await Student.deleteMany({ promotionId: req.params.id });
    await QuickLink.deleteMany({ promotionId: req.params.id });
    await Section.deleteMany({ promotionId: req.params.id });
    await ExtendedInfo.deleteOne({ promotionId: req.params.id });
    await Calendar.deleteOne({ promotionId: req.params.id });

    res.json({ message: 'Promotion deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== MODULES ====================

app.post('/api/promotions/:promotionId/modules', verifyToken, async (req, res) => {
  try {
    const { name, duration, courses, projects } = req.body;
    if (!name || !duration) return res.status(400).json({ error: 'Name and duration are required' });

    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const module = { id: uuidv4(), name, duration, courses: courses || [], projects: projects || [] };
    promotion.modules.push(module);
    await promotion.save();
    res.status(201).json(module);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== QUICK LINKS ====================

app.get('/api/promotions/:promotionId/quick-links', async (req, res) => {
  try {
    const quickLinks = await QuickLink.find({ promotionId: req.params.promotionId });
    res.json(quickLinks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/promotions/:promotionId/quick-links', verifyToken, async (req, res) => {
  try {
    const { name, url } = req.body;
    if (!name || !url) return res.status(400).json({ error: 'Name and URL are required' });

    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const quickLink = await QuickLink.create({ id: uuidv4(), promotionId: req.params.promotionId, name, url });
    res.status(201).json(quickLink);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/promotions/:promotionId/quick-links/:linkId', verifyToken, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const result = await QuickLink.deleteOne({ id: req.params.linkId, promotionId: req.params.promotionId });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Quick link not found' });
    res.json({ message: 'Quick link deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== SECTIONS ====================

app.get('/api/promotions/:promotionId/sections', async (req, res) => {
  try {
    const sections = await Section.find({ promotionId: req.params.promotionId });
    res.json(sections);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/promotions/:promotionId/sections', verifyToken, async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const section = await Section.create({ id: uuidv4(), promotionId: req.params.promotionId, title, content });
    res.status(201).json(section);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/promotions/:promotionId/sections/:sectionId', verifyToken, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const section = await Section.findOneAndUpdate(
      { id: req.params.sectionId, promotionId: req.params.promotionId },
      { ...req.body },
      { new: true }
    );
    if (!section) return res.status(404).json({ error: 'Section not found' });
    res.json(section);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/promotions/:promotionId/sections/:sectionId', verifyToken, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const result = await Section.deleteOne({ id: req.params.sectionId, promotionId: req.params.promotionId });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Section not found' });
    res.json({ message: 'Section deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== CALENDAR ====================

app.get('/api/promotions/:promotionId/calendar', async (req, res) => {
  try {
    const calendar = await Calendar.findOne({ promotionId: req.params.promotionId });
    if (!calendar) return res.status(404).json({ error: 'Calendar not found' });
    res.json(calendar);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/promotions/:promotionId/calendar', verifyToken, async (req, res) => {
  try {
    const { googleCalendarId } = req.body;
    if (!googleCalendarId) return res.status(400).json({ error: 'Google Calendar ID is required' });

    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const calendar = await Calendar.findOneAndUpdate(
      { promotionId: req.params.promotionId },
      { googleCalendarId },
      { upsert: true, new: true }
    );
    res.json(calendar);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== EXTENDED INFO ====================

app.get('/api/promotions/:promotionId/extended-info', async (req, res) => {
  try {
    const extendedInfo = await ExtendedInfo.findOne({ promotionId: req.params.promotionId });
    if (!extendedInfo) {
      return res.json({ schedule: {}, team: [], resources: [], evaluation: '' });
    }
    res.json(extendedInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/promotions/:promotionId/extended-info', verifyToken, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const { schedule, team, resources, evaluation } = req.body;
    const newInfo = await ExtendedInfo.findOneAndUpdate(
      { promotionId: req.params.promotionId },
      { schedule: schedule || {}, team: team || [], resources: resources || [], evaluation: evaluation || '' },
      { upsert: true, new: true }
    );
    res.json(newInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== TEACHERS & COLLABORATORS ====================

app.get('/api/teachers', verifyToken, async (req, res) => {
  try {
    const teachers = await Teacher.find({}, 'id name email');
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/promotions/:promotionId/collaborators', verifyToken, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    const collaboratorIds = promotion.collaborators || [];
    const collaborators = await Teacher.find({ id: { $in: collaboratorIds } }, 'id name email');
    res.json(collaborators);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/promotions/:promotionId/collaborators', verifyToken, async (req, res) => {
  try {
    const { teacherId } = req.body;
    if (!teacherId) return res.status(400).json({ error: 'Teacher ID is required' });

    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });

    if (promotion.teacherId !== req.user.id) return res.status(403).json({ error: 'Only owner can add collaborators' });
    if (teacherId === promotion.teacherId) return res.status(400).json({ error: 'Cannot add owner as collaborator' });

    if (!promotion.collaborators) promotion.collaborators = [];
    if (promotion.collaborators.includes(teacherId)) return res.status(400).json({ error: 'Teacher already a collaborator' });

    promotion.collaborators.push(teacherId);
    await promotion.save();

    const teacher = await Teacher.findOne({ id: teacherId }, 'id name email');
    res.status(201).json({ message: 'Collaborator added', collaborator: teacher });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/promotions/:promotionId/collaborators/:teacherId', verifyToken, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });

    if (promotion.teacherId !== req.user.id) return res.status(403).json({ error: 'Only owner can remove collaborators' });

    promotion.collaborators = (promotion.collaborators || []).filter(id => id !== req.params.teacherId);
    await promotion.save();
    res.json({ message: 'Collaborator removed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ADMIN ====================

const verifyAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') next();
  else res.status(403).json({ error: 'Admin role required' });
};

app.get('/api/admin/teachers', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const teachers = await Teacher.find({}, '-password');
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/teachers', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email || !name) return res.status(400).json({ error: 'Email and name are required' });

    const existing = await Teacher.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const provisionalPassword = Math.random().toString(36).slice(-10) + 'A1!';
    const hashedPassword = await bcrypt.hash(provisionalPassword, 10);

    const teacher = await Teacher.create({ id: uuidv4(), name, email, password: hashedPassword, provisional: true });
    res.status(201).json({ message: 'Teacher created', teacher: { id: teacher.id, name: teacher.name, email: teacher.email }, provisionalPassword });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/teachers/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const teacher = await Teacher.findOneAndUpdate({ id: req.params.id }, { ...req.body }, { new: true });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
    res.json(teacher);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/teachers/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await Teacher.deleteOne({ id: req.params.id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Teacher not found' });
    res.json({ message: 'Teacher deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
