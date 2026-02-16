import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import 'dotenv/config';

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
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const DATA_DIR = join(__dirname, 'data');
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/bootcamp-manager';

// MongoDB Connection
mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(__dirname));

// SPA Routes - serve HTML files without extension
app.get('/login', (req, res) => {
  res.sendFile(join(__dirname, 'login.html'));
});

app.get('/auth', (req, res) => {
  res.sendFile(join(__dirname, 'login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(join(__dirname, 'dashboard.html'));
});

app.get('/student-dashboard', (req, res) => {
  res.sendFile(join(__dirname, 'student-dashboard.html'));
});

app.get('/promotion-detail', (req, res) => {
  res.sendFile(join(__dirname, 'promotion-detail.html'));
});

app.get('/public-promotion', (req, res) => {
  res.sendFile(join(__dirname, 'public-promotion.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(join(__dirname, 'admin.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Initialize test teacher account
async function initializeTestAccount() {
  const testEmail = 'alex@gmail.com';
  const existingTeacher = await Teacher.findOne({ email: testEmail });

  if (!existingTeacher) {
    const hashedPassword = await bcrypt.hash('aA12345678910*', 10);
    await Teacher.create({
      id: uuidv4(),
      name: 'Alex (Test Account)',
      email: testEmail,
      password: hashedPassword
    });
    console.log('Test teacher account created: alex@gmail.com / aA12345678910*');
  }
}

<<<<<<< HEAD
=======
initializeTestAccount();

// Initialize test teacher account for Celia
async function initializeTestTeacherCelia() {
  const teachers = readJsonFile('teachers.json', []);
  const celiaEmail = 'celia@gmail.com';

  // Check if Celia's account already exists
  if (!teachers.find(t => t.email === celiaEmail)) {
    const hashedPassword = await bcrypt.hash('celia123456', 10);
    const celiaTeacher = {
      id: uuidv4(),
      name: 'Celia (Test Account)',
      email: celiaEmail,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };
    teachers.push(celiaTeacher);
    writeJsonFile('teachers.json', teachers);
    console.log('Test teacher account created: celia@gmail.com / celia123456');
  }
}

initializeTestTeacherCelia();

>>>>>>> ad1cef6c4dccacbc9c4da3f36f308b1a26ae5eee
// Initialize test student account
async function initializeTestStudent() {
  const testEmail = 'student@test.com';
  const existingStudent = await Student.findOne({ email: testEmail });

  if (!existingStudent) {
    const hashedPassword = await bcrypt.hash('student123', 10);
    await Student.create({
      id: uuidv4(),
      name: 'Test Student',
      email: testEmail,
      password: hashedPassword
    });
    console.log('Test student account created: student@test.com / student123');
  }
}

// Initialize test admin account
async function initializeTestAdmin() {
  const testEmail = 'admin@test.com';
  const existingAdmin = await Admin.findOne({ email: testEmail });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await Admin.create({
      id: uuidv4(),
      name: 'System Admin',
      email: testEmail,
      password: hashedPassword
    });
    console.log('Test admin account created: admin@test.com / admin123');
  }
}

// Ensure database is initialized before starting
const initDb = async () => {
  try {
    await initializeTestAccount();
    await initializeTestStudent();
    await initializeTestAdmin();
  } catch (err) {
    console.error('Error initializing database:', err);
  }
};

initDb();

// Helper functions for file operations
// Helpers moved to top

// Middleware to verify JWT token
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

// Helper function to check if a teacher can edit a promotion
<<<<<<< HEAD
const canEditPromotion = (promotion, teacherId) => {
  if (promotion.teacherId === teacherId) return true;
  if (promotion.collaborators && promotion.collaborators.includes(teacherId)) return true;
  return false;
=======
const canEditPromotion = (promotion, userId) => {
  if (!promotion) return false;
  // Can edit if owner or collaborator
  return promotion.teacherId === userId || (promotion.collaboratorIds && promotion.collaboratorIds.includes(userId));
>>>>>>> ad1cef6c4dccacbc9c4da3f36f308b1a26ae5eee
};

// ==================== AUTHENTICATION ====================

// Register a new teacher
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    const existingTeacher = await Teacher.findOne({ email });
    if (existingTeacher) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const teacher = await Teacher.create({
      id: uuidv4(),
      name,
      email,
      password: hashedPassword
    });

    const token = jwt.sign({ id: teacher.id, email: teacher.email, role: 'teacher' }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      message: 'Teacher registered successfully',
      token,
      user: { id: teacher.id, name: teacher.name, email: teacher.email, role: 'teacher' }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login endpoint (supports teachers, students, and admins)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    let user = null;
    let userRole = role;

    // Try to login based on role or search across roles
    if (userRole === 'teacher' || !role) {
      user = await Teacher.findOne({ email });
      if (user && (await bcrypt.compare(password, user.password))) {
        userRole = 'teacher';
      } else {
        user = null;
      }
    }

    if (!user && (userRole === 'student' || !role)) {
      user = await Student.findOne({ email });
      if (user && (await bcrypt.compare(password, user.password))) {
        userRole = 'student';
      } else {
        user = null;
      }
    }

    if (!user && (userRole === 'admin' || !role)) {
      user = await Admin.findOne({ email });
      if (user && (await bcrypt.compare(password, user.password))) {
        userRole = 'admin';
      } else {
        user = null;
      }
    }

    if (user) {
      const token = jwt.sign({ id: user.id, email: user.email, role: userRole }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({
        message: 'Login successful',
        token,
        user: { id: user.id, name: user.name, email: user.email, role: userRole }
      });
    }

    return res.status(401).json({ error: 'Invalid email or password' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== STUDENT MANAGEMENT ====================

// Get all students for a teacher's promotions
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

// Add a student to a promotion
app.post('/api/promotions/:promotionId/students', verifyToken, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });
<<<<<<< HEAD

    const { email, name } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
=======
>>>>>>> ad1cef6c4dccacbc9c4da3f36f308b1a26ae5eee

    // Generate temporary password
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

    res.status(201).json({
      message: 'Student added successfully',
      student: { id: student.id, email: student.email, name: student.name },
      tempPassword: tempPassword
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a student
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

// ==================== TEACHER MANAGEMENT (Collaborators) ====================

// Get all teachers for a promotion (with their details)
app.get('/api/promotions/:promotionId/teachers', verifyToken, (req, res) => {
  try {
    const promotions = readJsonFile('promotions.json', []);
    const promotion = promotions.find(p => p.id === req.params.promotionId);

    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const teachers = readJsonFile('teachers.json', []);
    const promotionTeachers = teachers.filter(t => promotion.collaboratorIds.includes(t.id));

    // Return only safe data (no passwords)
    const safeTeachers = promotionTeachers.map(t => ({
      id: t.id,
      name: t.name,
      email: t.email,
      isOwner: t.id === promotion.teacherId
    }));

    res.json(safeTeachers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a teacher to a promotion as collaborator
app.post('/api/promotions/:promotionId/teachers', verifyToken, (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const promotions = readJsonFile('promotions.json', []);
    const promotion = promotions.find(p => p.id === req.params.promotionId);

    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const teachers = readJsonFile('teachers.json', []);
    const teacher = teachers.find(t => t.email === email);

    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });

    // Check if teacher is already a collaborator
    if (promotion.collaboratorIds.includes(teacher.id)) {
      return res.status(400).json({ error: 'Teacher is already a collaborator' });
    }

    // Add teacher to collaborators
    promotion.collaboratorIds.push(teacher.id);
    promotion.updatedAt = new Date().toISOString();
    writeJsonFile('promotions.json', promotions);

    res.status(201).json({
      message: 'Teacher added successfully',
      teacher: { id: teacher.id, name: teacher.name, email: teacher.email, isOwner: false }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove a teacher from a promotion
app.delete('/api/promotions/:promotionId/teachers/:teacherId', verifyToken, (req, res) => {
  try {
    const promotions = readJsonFile('promotions.json', []);
    const promotion = promotions.find(p => p.id === req.params.promotionId);

    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    // Check if trying to remove the owner
    if (req.params.teacherId === promotion.teacherId) {
      return res.status(400).json({ error: 'Cannot remove the program owner' });
    }

    const index = promotion.collaboratorIds.indexOf(req.params.teacherId);
    if (index === -1) {
      return res.status(404).json({ error: 'Teacher not found in promotion' });
    }

    promotion.collaboratorIds.splice(index, 1);
    promotion.updatedAt = new Date().toISOString();
    writeJsonFile('promotions.json', promotions);

    res.json({ message: 'Teacher removed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all available teachers (for adding to a promotion)
app.get('/api/available-teachers', verifyToken, (req, res) => {
  try {
    const teachers = readJsonFile('teachers.json', []);
    // Return all teachers except current user
    const availableTeachers = teachers
      .filter(t => t.id !== req.user.id)
      .map(t => ({ id: t.id, name: t.name, email: t.email }));
    res.json(availableTeachers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== PROMOTIONS ====================

// Get all promotions (public)
app.get('/api/promotions', async (req, res) => {
  try {
    const promotions = await Promotion.find({});
    res.json(promotions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get student's enrolled promotions
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

// Get teacher's own promotions
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

<<<<<<< HEAD
// Get a single promotion
app.get('/api/promotions/:id', async (req, res) => {
=======
// Get all promotions a teacher has access to (owned or as collaborator)
app.get('/api/my-promotions-all', verifyToken, (req, res) => {
  try {
    const promotions = readJsonFile('promotions.json', []);
    const accessiblePromotions = promotions.filter(p =>
      p.teacherId === req.user.id || (p.collaboratorIds && p.collaboratorIds.includes(req.user.id))
    );
    res.json(accessiblePromotions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a single promotion (public, no auth required)
app.get('/api/promotions/:id', (req, res) => {
>>>>>>> ad1cef6c4dccacbc9c4da3f36f308b1a26ae5eee
  try {
    const promotion = await Promotion.findOne({ id: req.params.id });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    res.json(promotion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new promotion
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
<<<<<<< HEAD
      teacherId: req.user.id
    });
=======
      teacherId: req.user.id,
      collaboratorIds: [req.user.id], // Owner is also a collaborator
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const promotions = readJsonFile('promotions.json', []);
    promotions.push(promotion);
    writeJsonFile('promotions.json', promotions);

>>>>>>> ad1cef6c4dccacbc9c4da3f36f308b1a26ae5eee
    res.status(201).json(promotion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a promotion
app.put('/api/promotions/:id', verifyToken, async (req, res) => {
  try {
<<<<<<< HEAD
    const promotion = await Promotion.findOneAndUpdate(
      { id: req.params.id },
      { ...req.body },
      { new: true }
    );
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });
    res.json(promotion);
=======
    const promotions = readJsonFile('promotions.json', []);
    const promotionIndex = promotions.findIndex(p => p.id === req.params.id);

    if (promotionIndex === -1) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotions[promotionIndex], req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    promotions[promotionIndex] = { ...promotions[promotionIndex], ...req.body, updatedAt: new Date().toISOString() };
    writeJsonFile('promotions.json', promotions);

    res.json(promotions[promotionIndex]);
>>>>>>> ad1cef6c4dccacbc9c4da3f36f308b1a26ae5eee
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a promotion
app.delete('/api/promotions/:id', verifyToken, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.id });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

<<<<<<< HEAD
    await Promotion.deleteOne({ id: req.params.id });
    await Student.deleteMany({ promotionId: req.params.id });
    await QuickLink.deleteMany({ promotionId: req.params.id });
    await Section.deleteMany({ promotionId: req.params.id });
    await ExtendedInfo.deleteOne({ promotionId: req.params.id });
    await Calendar.deleteOne({ promotionId: req.params.id });
=======
    if (promotionIndex === -1) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotions[promotionIndex], req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    promotions.splice(promotionIndex, 1);
    writeJsonFile('promotions.json', promotions);
>>>>>>> ad1cef6c4dccacbc9c4da3f36f308b1a26ae5eee

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
<<<<<<< HEAD
=======

    const module = {
      id: uuidv4(),
      name,
      duration,
      courses: courses || [],
      projects: projects || [],
      createdAt: new Date().toISOString()
    };
>>>>>>> ad1cef6c4dccacbc9c4da3f36f308b1a26ae5eee

    const module = { id: uuidv4(), name, duration, courses: courses || [], projects: projects || [] };
    promotion.modules.push(module);
    await promotion.save();
    res.status(201).json(module);
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
<<<<<<< HEAD
=======

    const quickLink = {
      id: uuidv4(),
      name,
      url,
      createdAt: new Date().toISOString()
    };

    const quickLinks = readJsonFile(`quick-links-${req.params.promotionId}.json`, []);
    quickLinks.push(quickLink);
    writeJsonFile(`quick-links-${req.params.promotionId}.json`, quickLinks);
>>>>>>> ad1cef6c4dccacbc9c4da3f36f308b1a26ae5eee

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
<<<<<<< HEAD
=======

    const quickLinks = readJsonFile(`quick-links-${req.params.promotionId}.json`, []);
    const linkIndex = quickLinks.findIndex(l => l.id === req.params.linkId);

    if (linkIndex === -1) return res.status(404).json({ error: 'Quick link not found' });

    quickLinks.splice(linkIndex, 1);
    writeJsonFile(`quick-links-${req.params.promotionId}.json`, quickLinks);
>>>>>>> ad1cef6c4dccacbc9c4da3f36f308b1a26ae5eee

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
<<<<<<< HEAD
=======

    const section = {
      id: uuidv4(),
      title,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const sections = readJsonFile(`sections-${req.params.promotionId}.json`, []);
    sections.push(section);
    writeJsonFile(`sections-${req.params.promotionId}.json`, sections);
>>>>>>> ad1cef6c4dccacbc9c4da3f36f308b1a26ae5eee

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
<<<<<<< HEAD
=======

    const sections = readJsonFile(`sections-${req.params.promotionId}.json`, []);
    const sectionIndex = sections.findIndex(s => s.id === req.params.sectionId);

    if (sectionIndex === -1) return res.status(404).json({ error: 'Section not found' });

    sections.splice(sectionIndex, 1);
    writeJsonFile(`sections-${req.params.promotionId}.json`, sections);
>>>>>>> ad1cef6c4dccacbc9c4da3f36f308b1a26ae5eee

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
