import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import multer from 'multer';
import xlsx from 'xlsx';
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
import BootcampTemplate from './backend/models/BootcampTemplate.js';
import { sendPasswordEmail } from './backend/utils/email.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/bootcamp-manager';

// MongoDB Connection
mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    // Initialize default templates
    await initializeDefaultTemplates();
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(bodyParser.json());

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only Excel files
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
        file.mimetype === 'application/vnd.ms-excel' ||
        file.originalname.match(/\.(xlsx|xls)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed!'), false);
    }
  }
});

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'https://alexandrazambrano.github.io',
  'https://roadmap-manager-latest.onrender.com'
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      console.log('CORS Blocked Origin:', origin);
      var msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Serve static files from public directory
app.use(express.static(join(__dirname, 'public')));

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

// ==================== PROMOTION PASSWORD ACCESS ====================

// Set or change promotion access password (teacher only)
app.post('/api/promotions/:promotionId/access-password', verifyToken, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password is required' });

    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    // Store old password in history
    if (promotion.accessPassword) {
      if (!promotion.passwordChangeHistory) promotion.passwordChangeHistory = [];
      promotion.passwordChangeHistory.push({
        oldPassword: promotion.accessPassword,
        newPassword: password,
        changedAt: new Date()
      });
    }

    promotion.accessPassword = password;
    await promotion.save();

    res.json({ message: 'Access password updated', accessPassword: password });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Access promotion with password (session-based, no authentication required)
app.post('/api/promotions/:promotionId/verify-password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password is required' });

    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });

    if (promotion.accessPassword !== password) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Create a session token (valid only for this promotion access)
    const accessToken = jwt.sign(
      { promotionId: req.params.promotionId, accessType: 'promotion-guest' },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ message: 'Password verified', accessToken, promotion: { id: promotion.id, name: promotion.name } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get promotion access password (teacher only)
app.get('/api/promotions/:promotionId/access-password', verifyToken, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    res.json({ accessPassword: promotion.accessPassword || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== BOOTCAMP TEMPLATES ====================

// Initialize default templates if they don't exist
async function initializeDefaultTemplates() {
  const defaultTemplates = [
    {
      id: 'ia-bootcamp',
      name: 'IA School Bootcamp',
      description: 'Artificial Intelligence and Machine Learning bootcamp',
      weeks: 39,
      hours: 520,
      hoursPerWeek: 35,
      isCustom: false,
      modules: []
    },
    {
      id: 'fullstack-bootcamp',
      name: 'Full Stack Bootcamp',
      description: 'Full stack web development bootcamp',
      weeks: 24,
      hours: 320,
      hoursPerWeek: 35,
      isCustom: false,
      modules: []
    },
    {
      id: 'cybersecurity-bootcamp',
      name: 'Cyber Security Bootcamp',
      description: 'Cyber Security and Ethical Hacking bootcamp',
      weeks: 20,
      hours: 280,
      hoursPerWeek: 35,
      isCustom: false,
      modules: []
    },
    {
      id: 'datascience-bootcamp',
      name: 'Data Science Bootcamp',
      description: 'Data Science and Analytics bootcamp',
      weeks: 30,
      hours: 420,
      hoursPerWeek: 35,
      isCustom: false,
      modules: []
    },
    {
      id: 'frontend-bootcamp',
      name: 'Frontend Bootcamp',
      description: 'Frontend development with React, Vue, or Angular',
      weeks: 16,
      hours: 224,
      hoursPerWeek: 35,
      isCustom: false,
      modules: []
    },
    {
      id: 'backend-bootcamp',
      name: 'Backend Bootcamp',
      description: 'Backend development with Node.js, Python, or Java',
      weeks: 20,
      hours: 280,
      hoursPerWeek: 35,
      isCustom: false,
      modules: []
    }
  ];

  for (const template of defaultTemplates) {
    const exists = await BootcampTemplate.findOne({ id: template.id });
    if (!exists) {
      await BootcampTemplate.create(template);
    }
  }
}

// Get all templates (system + custom)
app.get('/api/bootcamp-templates', verifyToken, async (req, res) => {
  try {
    const templates = await BootcampTemplate.find({});
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create custom template
app.post('/api/bootcamp-templates', verifyToken, async (req, res) => {
  try {
    const { name, description, weeks, hours, hoursPerWeek, modules, evaluation, schedule } = req.body;

    if (!name || !weeks) {
      return res.status(400).json({ error: 'Name and weeks are required' });
    }

    const template = await BootcampTemplate.create({
      id: `custom-${uuidv4()}`,
      name,
      description,
      weeks,
      hours: hours || weeks * (hoursPerWeek || 35),
      hoursPerWeek: hoursPerWeek || 35,
      modules: modules || [],
      evaluation: evaluation || '',
      schedule: schedule || {},
      isCustom: true,
      createdBy: req.user.id
    });

    res.status(201).json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get template by ID
app.get('/api/bootcamp-templates/:templateId', verifyToken, async (req, res) => {
  try {
    const template = await BootcampTemplate.findOne({ id: req.params.templateId });
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete custom template
app.delete('/api/bootcamp-templates/:templateId', verifyToken, async (req, res) => {
  try {
    const template = await BootcampTemplate.findOne({ id: req.params.templateId });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (!template.isCustom) {
      return res.status(403).json({ error: 'Cannot delete system templates' });
    }

    if (template.createdBy !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await BootcampTemplate.deleteOne({ id: req.params.templateId });
    res.json({ message: 'Template deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    let user = null;
    let userRole = null;

    // Try Admin first
    user = await Admin.findOne({ email });
    if (user && (await bcrypt.compare(password, user.password))) {
      userRole = 'admin';
    }

    // Try Teacher
    if (!user) {
      user = await Teacher.findOne({ email });
      if (user && (await bcrypt.compare(password, user.password))) {
        userRole = 'teacher';
      }
    }

    // Try Student (for reference, though students typically don't login)
    if (!user) {
      user = await Student.findOne({ email });
      if (user && (await bcrypt.compare(password, user.password))) {
        userRole = 'student';
      }
    }

    if (user && userRole) {
      const token = jwt.sign({ id: user.id, email: user.email, role: userRole }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ message: 'Login successful', token, user: { id: user.id, name: user.name, email: user.email, role: userRole } });
    }

    return res.status(401).json({ error: 'Invalid email or password' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== PROFILE MANAGEMENT ====================

// Get current user profile
app.get('/api/profile', verifyToken, async (req, res) => {
  try {
    let user = null;
    const { role } = req.user;

    if (role === 'teacher') {
      user = await Teacher.findOne({ id: req.user.id });
    } else if (role === 'admin') {
      user = await Admin.findOne({ id: req.user.id });
    } else if (role === 'student') {
      user = await Student.findOne({ id: req.user.id });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return profile without password
    const profile = {
      id: user.id,
      name: user.name,
      lastName: user.lastName || '',
      email: user.email,
      location: user.location || '',
      role: role,
      createdAt: user.createdAt
    };

    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user profile
app.put('/api/profile', verifyToken, async (req, res) => {
  try {
    const { name, lastName, location } = req.body;
    const { role } = req.user;

    let user = null;

    if (role === 'teacher') {
      user = await Teacher.findOneAndUpdate(
        { id: req.user.id },
        {
          name: name || undefined,
          lastName: lastName || undefined,
          location: location || undefined
        },
        { returnDocument: 'after' }
      );
    } else if (role === 'admin') {
      user = await Admin.findOneAndUpdate(
        { id: req.user.id },
        {
          name: name || undefined,
          lastName: lastName || undefined,
          location: location || undefined
        },
        { returnDocument: 'after' }
      );
    } else if (role === 'student') {
      user = await Student.findOneAndUpdate(
        { id: req.user.id },
        {
          name: name || undefined,
          lastName: lastName || undefined
        },
        { returnDocument: 'after' }
      );
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const profile = {
      id: user.id,
      name: user.name,
      lastName: user.lastName || '',
      email: user.email,
      location: user.location || '',
      role: role,
      createdAt: user.createdAt
    };

    res.json({ message: 'Profile updated successfully', profile });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Change password
app.post('/api/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const { role } = req.user;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    let user = null;

    if (role === 'teacher') {
      user = await Teacher.findOne({ id: req.user.id });
    } else if (role === 'admin') {
      user = await Admin.findOne({ id: req.user.id });
    } else if (role === 'student') {
      user = await Student.findOne({ id: req.user.id });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    if (role === 'teacher') {
      user = await Teacher.findOneAndUpdate(
        { id: req.user.id },
        {
          password: hashedPassword,
          passwordChangedAt: new Date()
        },
        { returnDocument: 'after' }
      );
    } else if (role === 'admin') {
      user = await Admin.findOneAndUpdate(
        { id: req.user.id },
        {
          password: hashedPassword,
          passwordChangedAt: new Date()
        },
        { returnDocument: 'after' }
      );
    } else if (role === 'student') {
      user = await Student.findOneAndUpdate(
        { id: req.user.id },
        {
          password: hashedPassword
        },
        { returnDocument: 'after' }
      );
    }

    res.json({ message: 'Password changed successfully' });
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
    console.log('Found students:', students.map(s => ({ customId: s.id, mongoId: s._id, name: s.name, lastname: s.lastname, email: s.email })));
    
    // Normalize the response to ensure consistent ID field
    const normalizedStudents = students.map(student => ({
      id: student.id || student._id.toString(), // Prefer custom id, fallback to string version of _id
      _id: student._id, // Keep _id for internal operations
      name: student.name,
      lastname: student.lastname,
      email: student.email,
      age: student.age,
      nationality: student.nationality,
      profession: student.profession,
      address: student.address,
      promotionId: student.promotionId
    }));
    
    res.json(normalizedStudents);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: error.message });
  }
});// Add student manually (teacher adds student for tracking)
app.post('/api/promotions/:promotionId/students', verifyToken, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const { name, lastname, email, age, nationality, profession, address } = req.body;
    
    if (!email || !name || !lastname) return res.status(400).json({ error: 'Email, name, and lastname are required' });

    // Check if student already exists
    const existing = await Student.findOne({ email, promotionId: req.params.promotionId });
    if (existing) return res.status(400).json({ error: 'Student already added to this promotion' });

    const student = await Student.create({
      id: uuidv4(),
      name,
      lastname, 
      email,
      age: age || null,
      nationality: nationality || '',
      profession: profession || '',
      address: address || '',
      promotionId: req.params.promotionId,
      isManuallyAdded: true,
      notes: ''
    });

    res.status(201).json({ 
      message: 'Student added successfully', 
      student: { 
        id: student.id, 
        name: student.name, 
        lastname: student.lastname,
        email: student.email,
        age: student.age,
        nationality: student.nationality,
        profession: student.profession,
        address: student.address
      } 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update student information
app.put('/api/promotions/:promotionId/students/:studentId', verifyToken, async (req, res) => {
  try {
    console.log('=== PUT STUDENT UPDATE REQUEST ===');
    console.log('Request URL:', req.originalUrl);
    console.log('Request method:', req.method);
    console.log('Update student request - studentId:', req.params.studentId);
    console.log('Update student request - promotionId:', req.params.promotionId);
    console.log('Request body:', req.body);
    
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) {
      console.log('Promotion not found with ID:', req.params.promotionId);
      return res.status(404).json({ error: 'Promotion not found' });
    }
    if (!canEditPromotion(promotion, req.user.id)) {
      console.log('User unauthorized for promotion:', req.user.id);
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { name, lastname, email, age, nationality, profession, address } = req.body;
    console.log('Updating student with data:', { name, lastname, email, age, nationality, profession, address });
    
    if (!email || !name || !lastname) return res.status(400).json({ error: 'Email, name, and lastname are required' });

    // First, let's find the student to see what we're working with
    let existingStudent = await Student.findOne({ id: req.params.studentId, promotionId: req.params.promotionId });
    
    if (!existingStudent) {
      // Try by MongoDB _id
      try {
        existingStudent = await Student.findOne({ _id: req.params.studentId, promotionId: req.params.promotionId });
      } catch (mongoError) {
        console.log('Invalid MongoDB ObjectId format:', req.params.studentId);
      }
    }
    
    if (!existingStudent) {
      console.log('Student not found with ID:', req.params.studentId);
      console.log('Available students in promotion:', await Student.find({ promotionId: req.params.promotionId }, 'id _id email name lastname'));
      return res.status(404).json({ error: 'Student not found' });
    }
    
    console.log('Found existing student:', { 
      customId: existingStudent.id, 
      mongoId: existingStudent._id, 
      email: existingStudent.email 
    });

    // Check if email is being changed and if it conflicts with another student
    const emailConflict = await Student.findOne({ 
      email, 
      promotionId: req.params.promotionId, 
      $and: [
        { _id: { $ne: existingStudent._id } }
      ]
    });
    
    if (emailConflict) {
      return res.status(400).json({ error: 'Email already exists for another student in this promotion' });
    }

    // Update the student using the _id (which is always available)
    const student = await Student.findByIdAndUpdate(
      existingStudent._id,
      {
        name,
        lastname,
        email,
        age: age || null,
        nationality: nationality || '',
        profession: profession || '',
        address: address || ''
      },
      { returnDocument: 'after' }
    );

    if (!student) return res.status(404).json({ error: 'Failed to update student' });

    res.json({ 
      message: 'Student updated successfully', 
      student: {
        id: student.id || student._id,
        name: student.name,
        lastname: student.lastname,
        email: student.email,
        age: student.age,
        nationality: student.nationality,
        profession: student.profession,
        address: student.address
      }
    });
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({ error: error.message });
  }
});

// Auto-track student when they access promotion with password
app.post('/api/promotions/:promotionId/track-student', async (req, res) => {
  try {
    const { email } = req.body;
    // Email is optional for first access
    const tempEmail = email || `guest-${uuidv4()}@promotion.local`;

    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });

    // Check if student already exists
    let student = await Student.findOne({ email: tempEmail, promotionId: req.params.promotionId });

    if (!student) {
      // Create new tracked student
      student = await Student.create({
        id: uuidv4(),
        email: tempEmail,
        promotionId: req.params.promotionId,
        isManuallyAdded: false
      });
    }

    // Update last accessed and access log
    student.progress.lastAccessed = new Date();
    if (!student.accessLog) student.accessLog = [];

    student.accessLog.push({
      accessedAt: new Date(),
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    await student.save();

    res.json({ message: 'Student tracked', student: { id: student.id, email: student.email, name: student.name } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add or update student notes
app.put('/api/promotions/:promotionId/students/:studentId/notes', verifyToken, async (req, res) => {
  try {
    const { notes } = req.body;

    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const student = await Student.findOneAndUpdate(
      { id: req.params.studentId, promotionId: req.params.promotionId },
      { notes: notes || '' },
      { returnDocument: 'after' }
    );

    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json({ message: 'Student notes updated', student });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update student progress
app.put('/api/promotions/:promotionId/students/:studentId/progress', verifyToken, async (req, res) => {
  try {
    console.log('=== UPDATE PROGRESS REQUEST ===');
    console.log('Request URL:', req.originalUrl);
    console.log('Student ID:', req.params.studentId);
    console.log('Promotion ID:', req.params.promotionId);
    console.log('Request body:', req.body);
    
    const { modulesViewed, sectionsCompleted, modulesCompleted, lastAccessed } = req.body;

    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const student = await Student.findOne({ id: req.params.studentId, promotionId: req.params.promotionId });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    console.log('Student before update:', {
      id: student.id,
      progress: student.progress
    });

    // Update modules completed if provided
    if (modulesCompleted !== undefined) {
      console.log('Updating modulesCompleted from', student.progress.modulesCompleted, 'to', modulesCompleted);
      student.progress.modulesCompleted = Math.max(0, parseInt(modulesCompleted) || 0);
    }

    // Add new modules viewed (avoid duplicates)
    if (modulesViewed && Array.isArray(modulesViewed)) {
      student.progress.modulesViewed = [...new Set([...(student.progress.modulesViewed || []), ...modulesViewed])];
    }

    // Add new sections completed (avoid duplicates)
    if (sectionsCompleted && Array.isArray(sectionsCompleted)) {
      student.progress.sectionsCompleted = [...new Set([...(student.progress.sectionsCompleted || []), ...sectionsCompleted])];
    }

    // Update last accessed time
    student.progress.lastAccessed = lastAccessed ? new Date(lastAccessed) : new Date();
    
    console.log('Student after update before save:', {
      id: student.id,
      progress: student.progress
    });
    
    await student.save();

    console.log('Student after save:', {
      id: student.id,
      progress: student.progress
    });

    res.json({ 
      id: student.id,
      name: student.name,
      lastname: student.lastname,
      email: student.email,
      age: student.age,
      nationality: student.nationality,
      profession: student.profession,
      address: student.address,
      notes: student.notes,
      progress: student.progress,
      promotionId: student.promotionId,
      isManuallyAdded: student.isManuallyAdded
    });
  } catch (error) {
    console.error('Error updating student progress:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== PROJECT ASSIGNMENTS ====================
// Assign one or more students to a project (individual or group)
app.post('/api/promotions/:promotionId/projects/assign', verifyToken, async (req, res) => {
  try {
    const { moduleId, projectName, groupName, studentIds, done } = req.body;
    if (!moduleId || !projectName || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: 'moduleId, projectName and studentIds are required' });
    }

    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const moduleExists = (promotion.modules || []).some(m => m.id === moduleId);
    if (!moduleExists) return res.status(404).json({ error: 'Module not found in promotion' });

    const assignmentId = uuidv4();
    const assignment = {
      id: assignmentId,
      moduleId,
      projectName,
      groupName: groupName || '',
      teammates: studentIds.filter(id => !!id),
      done: !!done,
      assignedAt: new Date()
    };

    // For each student, add the assignment (including teammates minus self)
    const results = [];
    for (const studentId of studentIds) {
      const student = await Student.findOne({ id: studentId, promotionId: req.params.promotionId });
      if (!student) {
        results.push({ studentId, ok: false, error: 'Student not found' });
        continue;
      }
      // teammates should include other ids excluding current
      const teammates = studentIds.filter(id => id !== studentId);
      const studentAssignment = { ...assignment, teammates };
      student.projectsAssignments = student.projectsAssignments || [];
      student.projectsAssignments.push(studentAssignment);
      await student.save();
      results.push({ studentId, ok: true });
    }

    res.status(201).json({ message: 'Project assignment created', assignmentId, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List student project assignments
app.get('/api/promotions/:promotionId/students/:studentId/projects', verifyToken, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const student = await Student.findOne({ id: req.params.studentId, promotionId: req.params.promotionId });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    res.json(student.projectsAssignments || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update specific student project assignment (mark done, change group)
app.put('/api/promotions/:promotionId/students/:studentId/projects/:assignmentId', verifyToken, async (req, res) => {
  try {
    const { done, groupName } = req.body;

    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const student = await Student.findOne({ id: req.params.studentId, promotionId: req.params.promotionId });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    student.projectsAssignments = student.projectsAssignments || [];
    const idx = student.projectsAssignments.findIndex(a => a.id === req.params.assignmentId);
    if (idx === -1) return res.status(404).json({ error: 'Assignment not found' });

    if (typeof done === 'boolean') student.projectsAssignments[idx].done = done;
    if (typeof groupName === 'string') student.projectsAssignments[idx].groupName = groupName;

    await student.save();
    res.json(student.projectsAssignments[idx]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== PÍLDORAS MANAGEMENT ====================
// Upload Excel file for píldoras to a specific module
app.post('/api/promotions/:promotionId/modules/:moduleId/pildoras/upload-excel', verifyToken, upload.single('excelFile'), async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const module = promotion.modules.find(m => m.id === req.params.moduleId);
    if (!module) return res.status(404).json({ error: 'Module not found' });

    if (!req.file) {
      return res.status(400).json({ error: 'No Excel file provided' });
    }

    // Parse Excel file
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      return res.status(400).json({ error: 'Excel file is empty' });
    }

    // Get current students for validation
    const students = await Student.find({ promotionId: req.params.promotionId });
    const studentMap = new Map();
    students.forEach(student => {
      const fullName = `${student.name || ''} ${student.lastname || ''}`.trim().toLowerCase();
      studentMap.set(fullName, student);
    });

    const pildoras = [];
    
    for (const row of data) {
      // Handle different column name variations
      const mode = row['Presentación'] || row['Presentacion'] || row['presentación'] || row['presentacion'] || 'Virtual';
      const dateText = row['Fecha'] || row['fecha'] || '';
      const title = row['Píldora'] || row['Pildora'] || row['píldora'] || row['pildora'] || '';
      const studentText = row['Student'] || row['student'] || row['Coders'] || row['coders'] || '';
      const status = row['Estado'] || row['estado'] || '';

      // Process assigned students
      const assignedStudents = [];
      if (studentText && studentText.toLowerCase() !== 'desierta') {
        const studentNames = studentText.split(',').map(name => name.trim().toLowerCase());
        
        for (const name of studentNames) {
          const student = studentMap.get(name);
          if (student) {
            assignedStudents.push({
              id: student.id,
              name: student.name,
              lastname: student.lastname
            });
          }
        }
      }

      // Process date
      let isoDate = '';
      if (dateText) {
        try {
          const date = new Date(dateText);
          if (!isNaN(date.getTime())) {
            isoDate = date.toISOString().split('T')[0];
          }
        } catch (e) {
          console.warn('Invalid date format:', dateText);
        }
      }

      if (title) { // Only add if title is provided
        pildoras.push({
          mode: mode || 'Virtual',
          date: isoDate,
          title,
          students: assignedStudents,
          status: status || ''
        });
      }
    }

    // Get current extended info and update píldoras for this module
    let extendedInfo = await ExtendedInfo.findOne({ promotionId: req.params.promotionId });
    if (!extendedInfo) {
      extendedInfo = await ExtendedInfo.create({
        promotionId: req.params.promotionId,
        schedule: {},
        team: [],
        resources: [],
        evaluation: '',
        pildoras: [],
        modulesPildoras: []
      });
    }

    // Initialize modulesPildoras if it doesn't exist
    if (!extendedInfo.modulesPildoras) {
      extendedInfo.modulesPildoras = [];
    }

    // Find or create module píldoras entry
    let modulePildoras = extendedInfo.modulesPildoras.find(mp => mp.moduleId === req.params.moduleId);
    if (!modulePildoras) {
      modulePildoras = {
        moduleId: req.params.moduleId,
        moduleName: module.name,
        pildoras: []
      };
      extendedInfo.modulesPildoras.push(modulePildoras);
    }

    // Add imported píldoras to the module (append to existing ones)
    modulePildoras.pildoras.push(...pildoras);

    await extendedInfo.save();

    res.json({
      message: `Successfully imported ${pildoras.length} píldoras to module "${module.name}"`,
      pildoras: pildoras,
      module: {
        id: module.id,
        name: module.name
      },
      totalPildoras: modulePildoras.pildoras.length
    });

  } catch (error) {
    console.error('Error uploading Excel file to module:', error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Upload Excel file for píldoras (legacy endpoint - will add to first module)
app.post('/api/promotions/:promotionId/pildoras/upload-excel', verifyToken, upload.single('excelFile'), async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    if (!req.file) {
      return res.status(400).json({ error: 'No Excel file provided' });
    }

    // Parse Excel file
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      return res.status(400).json({ error: 'Excel file is empty' });
    }

    // Get current students for validation
    const students = await Student.find({ promotionId: req.params.promotionId });
    const studentMap = new Map();
    students.forEach(student => {
      const fullName = `${student.name || ''} ${student.lastname || ''}`.trim().toLowerCase();
      studentMap.set(fullName, student);
    });

    const pildoras = [];
    
    for (const row of data) {
      // Handle different column name variations
      const mode = row['Presentación'] || row['Presentacion'] || row['presentación'] || row['presentacion'] || 'Virtual';
      const dateText = row['Fecha'] || row['fecha'] || '';
      const title = row['Píldora'] || row['Pildora'] || row['píldora'] || row['pildora'] || '';
      const studentText = row['Student'] || row['student'] || row['Coders'] || row['coders'] || '';
      const status = row['Estado'] || row['estado'] || '';

      // Process assigned students
      const assignedStudents = [];
      if (studentText && studentText.toLowerCase() !== 'desierta') {
        const studentNames = studentText.split(',').map(name => name.trim().toLowerCase());
        
        for (const name of studentNames) {
          const student = studentMap.get(name);
          if (student) {
            assignedStudents.push({
              id: student.id,
              name: student.name,
              lastname: student.lastname
            });
          }
        }
      }

      // Process date
      let isoDate = '';
      if (dateText) {
        try {
          const date = new Date(dateText);
          if (!isNaN(date.getTime())) {
            isoDate = date.toISOString().split('T')[0];
          }
        } catch (e) {
          console.warn('Invalid date format:', dateText);
        }
      }

      if (title) { // Only add if title is provided
        pildoras.push({
          mode: mode || 'Virtual',
          date: isoDate,
          title,
          students: assignedStudents,
          status: status || ''
        });
      }
    }

    // Get current extended info and update píldoras
    let extendedInfo = await ExtendedInfo.findOne({ promotionId: req.params.promotionId });
    if (!extendedInfo) {
      extendedInfo = await ExtendedInfo.create({
        promotionId: req.params.promotionId,
        schedule: {},
        team: [],
        resources: [],
        evaluation: '',
        pildoras: pildoras
      });
    } else {
      extendedInfo.pildoras = pildoras;
      await extendedInfo.save();
    }

    res.json({
      message: `Successfully imported ${pildoras.length} píldoras from Excel file`,
      pildoras: pildoras,
      studentsNotFound: data.length - pildoras.length
    });

  } catch (error) {
    console.error('Error uploading Excel file:', error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Get module-based píldoras for a promotion
app.get('/api/promotions/:promotionId/modules-pildoras', verifyToken, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    let extendedInfo = await ExtendedInfo.findOne({ promotionId: req.params.promotionId });
    if (!extendedInfo) {
      extendedInfo = await ExtendedInfo.create({
        promotionId: req.params.promotionId,
        schedule: {},
        team: [],
        resources: [],
        evaluation: '',
        pildoras: [],
        modulesPildoras: []
      });
    }

    // If modulesPildoras is empty but pildoras exists, migrate data
    if (!extendedInfo.modulesPildoras || extendedInfo.modulesPildoras.length === 0) {
      if (extendedInfo.pildoras && extendedInfo.pildoras.length > 0) {
        // Migrate existing píldoras to first module
        const firstModule = promotion.modules && promotion.modules.length > 0 ? promotion.modules[0] : null;
        if (firstModule) {
          extendedInfo.modulesPildoras = [{
            moduleId: firstModule.id,
            moduleName: firstModule.name,
            pildoras: extendedInfo.pildoras
          }];
          await extendedInfo.save();
        }
      }
    }

    // Ensure all modules have entries in modulesPildoras
    if (promotion.modules) {
      for (const module of promotion.modules) {
        const existingModulePildoras = extendedInfo.modulesPildoras.find(mp => mp.moduleId === module.id);
        if (!existingModulePildoras) {
          extendedInfo.modulesPildoras.push({
            moduleId: module.id,
            moduleName: module.name,
            pildoras: []
          });
        } else {
          // Update module name in case it changed
          existingModulePildoras.moduleName = module.name;
        }
      }
      await extendedInfo.save();
    }

    res.json({
      modules: promotion.modules || [],
      modulesPildoras: extendedInfo.modulesPildoras || []
    });
  } catch (error) {
    console.error('Error fetching modules píldoras:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update píldoras for a specific module
app.put('/api/promotions/:promotionId/modules/:moduleId/pildoras', verifyToken, async (req, res) => {
  try {
    const { pildoras } = req.body;
    if (!Array.isArray(pildoras)) {
      return res.status(400).json({ error: 'pildoras array is required' });
    }

    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const module = promotion.modules.find(m => m.id === req.params.moduleId);
    if (!module) return res.status(404).json({ error: 'Module not found' });

    let extendedInfo = await ExtendedInfo.findOne({ promotionId: req.params.promotionId });
    if (!extendedInfo) {
      extendedInfo = await ExtendedInfo.create({
        promotionId: req.params.promotionId,
        schedule: {},
        team: [],
        resources: [],
        evaluation: '',
        pildoras: [],
        modulesPildoras: []
      });
    }

    // Find or create module píldoras entry
    let modulePildoras = extendedInfo.modulesPildoras.find(mp => mp.moduleId === req.params.moduleId);
    if (!modulePildoras) {
      modulePildoras = {
        moduleId: req.params.moduleId,
        moduleName: module.name,
        pildoras: []
      };
      extendedInfo.modulesPildoras.push(modulePildoras);
    }

    // Update píldoras for this module
    modulePildoras.pildoras = pildoras.map(p => ({
      mode: p.mode || 'Virtual',
      date: p.date || '',
      title: p.title || '',
      students: Array.isArray(p.students) ? p.students : [],
      status: p.status || ''
    }));

    await extendedInfo.save();

    res.json({ 
      message: 'Module píldoras updated successfully',
      modulePildoras: modulePildoras
    });
  } catch (error) {
    console.error('Error updating module píldoras:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get pildoras for a module
app.get('/api/promotions/:promotionId/modules/:moduleId/pildoras', verifyToken, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const mod = (promotion.modules || []).find(m => m.id === req.params.moduleId);
    if (!mod) return res.status(404).json({ error: 'Module not found' });
    res.json(mod.pildoras || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



// Assign students to a specific pildora entry
app.post('/api/promotions/:promotionId/modules/:moduleId/pildoras/:pildoraId/assign', verifyToken, async (req, res) => {
  try {
    const { studentIds } = req.body;
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: 'studentIds array is required' });
    }

    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const mod = (promotion.modules || []).find(m => m.id === req.params.moduleId);
    if (!mod) return res.status(404).json({ error: 'Module not found' });
    const pIndex = (mod.pildoras || []).findIndex(p => p.id === req.params.pildoraId);
    if (pIndex === -1) return res.status(404).json({ error: 'Pildora not found' });

    const currentAssigned = new Set(mod.pildoras[pIndex].assignedStudentIds || []);
    studentIds.forEach(id => currentAssigned.add(id));
    mod.pildoras[pIndex].assignedStudentIds = Array.from(currentAssigned);
    await promotion.save();
    res.json(mod.pildoras[pIndex]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Get student details
app.get('/api/promotions/:promotionId/students/:studentId', verifyToken, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const student = await Student.findOne({ id: req.params.studentId, promotionId: req.params.promotionId });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    res.json(student);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update student detailed information
app.put('/api/promotions/:promotionId/students/:studentId/profile', verifyToken, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) {
      return res.status(404).json({ error: 'Promotion not found' });
    }
    if (!canEditPromotion(promotion, req.user.id)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Support both old and new field names for compatibility
    const { 
      name, 
      lastName, lastname,  // Support both lastName and lastname
      age, 
      nationality, 
      profession,          // New field
      address,            // New field
      paperStatus, 
      description, 
      workBackground, 
      email 
    } = req.body;

    // Use lastname if provided, otherwise use lastName for backward compatibility
    const finalLastname = lastname || lastName;

    // First try to find by custom id
    let student = await Student.findOne({ id: req.params.studentId, promotionId: req.params.promotionId });
    
    if (!student) {
      // Try by MongoDB _id
      try {
        student = await Student.findOne({ _id: req.params.studentId, promotionId: req.params.promotionId });
      } catch (mongoError) {
        // Invalid ObjectId format
      }
    }
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Update the student using findByIdAndUpdate for reliability
    const updatedStudent = await Student.findByIdAndUpdate(
      student._id,
      {
        name: name || student.name,
        lastname: finalLastname || student.lastname || '',  // Provide default if field doesn't exist
        age: age !== undefined ? age : (student.age || null),
        nationality: nationality !== undefined ? nationality : (student.nationality || ''),
        profession: profession !== undefined ? profession : (student.profession || ''),     // New field
        address: address !== undefined ? address : (student.address || ''),             // New field
        paperStatus: paperStatus || student.paperStatus,
        description: description || student.description,
        workBackground: workBackground || student.workBackground,
        email: email || student.email
      },
      { returnDocument: 'after' }
    );

    res.json({ 
      message: 'Student profile updated', 
      student: {
        id: updatedStudent.id || updatedStudent._id,
        name: updatedStudent.name,
        lastname: updatedStudent.lastname,
        email: updatedStudent.email,
        age: updatedStudent.age,
        nationality: updatedStudent.nationality,
        profession: updatedStudent.profession,
        address: updatedStudent.address
      }
    });
  } catch (error) {
    console.error('Error updating student profile:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/promotions/:promotionId/students/:studentId', verifyToken, async (req, res) => {
  try {
    console.log('Delete student request - studentId:', req.params.studentId);
    console.log('Delete student request - promotionId:', req.params.promotionId);
    
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    // First, let's find the student to see what we're working with
    let existingStudent = await Student.findOne({ id: req.params.studentId, promotionId: req.params.promotionId });
    
    if (!existingStudent) {
      // Try by MongoDB _id
      try {
        existingStudent = await Student.findOne({ _id: req.params.studentId, promotionId: req.params.promotionId });
      } catch (mongoError) {
        console.log('Invalid MongoDB ObjectId format:', req.params.studentId);
      }
    }
    
    if (!existingStudent) {
      console.log('Student not found for deletion with ID:', req.params.studentId);
      console.log('Available students in promotion:', await Student.find({ promotionId: req.params.promotionId }, 'id _id email name lastname'));
      return res.status(404).json({ error: 'Student not found' });
    }
    
    console.log('Found student to delete:', { 
      customId: existingStudent.id, 
      mongoId: existingStudent._id, 
      email: existingStudent.email 
    });

    // Delete the student using the _id (which is always available)
    const student = await Student.findByIdAndDelete(existingStudent._id);
    
    if (!student) return res.status(404).json({ error: 'Failed to delete student' });

    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Error deleting student:', error);
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
      { returnDocument: 'after' }
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
      { returnDocument: 'after' }
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
      { upsert: true, returnDocument: 'after' }
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
      return res.json({ schedule: {}, team: [], resources: [], evaluation: '', pildoras: [] });
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

    const { schedule, team, resources, evaluation, pildoras } = req.body;
    const normalizedPildoras = Array.isArray(pildoras) ? pildoras : [];
    const newInfo = await ExtendedInfo.findOneAndUpdate(
      { promotionId: req.params.promotionId },
      {
        schedule: schedule || {},
        team: team || [],
        resources: resources || [],
        evaluation: evaluation || '',
        pildoras: normalizedPildoras
      },
      { upsert: true, returnDocument: 'after' }
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

    // Send password to email
    const emailSent = await sendPasswordEmail(email, name, provisionalPassword);

    if (emailSent) {
      res.status(201).json({
        message: 'Teacher created successfully. Password has been sent to their email address.',
        teacher: { id: teacher.id, name: teacher.name, email: teacher.email }
      });
    } else {
      // Still create teacher but alert admin
      res.status(201).json({
        message: 'Teacher created, but password email could not be sent. Please notify the teacher manually.',
        teacher: { id: teacher.id, name: teacher.name, email: teacher.email },
        warning: 'Email not sent'
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/teachers/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const teacher = await Teacher.findOneAndUpdate({ id: req.params.id }, { ...req.body }, { returnDocument: 'after' });
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
