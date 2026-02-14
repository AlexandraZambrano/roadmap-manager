import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;
const JWT_SECRET = 'your-secret-key-change-this';
const DATA_DIR = join(__dirname, 'data');

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

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper functions for file operations
const getDataFilePath = (filename) => join(DATA_DIR, filename);

const readJsonFile = (filename, defaultValue = null) => {
  try {
    const filePath = getDataFilePath(filename);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`Error reading ${filename}:`, error);
  }
  return defaultValue;
};

const writeJsonFile = (filename, data) => {
  try {
    const filePath = getDataFilePath(filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error(`Error writing ${filename}:`, error);
    return false;
  }
};

// Initialize test teacher account
async function initializeTestAccount() {
  const teachers = readJsonFile('teachers.json', []);
  const testEmail = 'alex@gmail.com';

  // Check if test account already exists
  if (!teachers.find(t => t.email === testEmail)) {
    const hashedPassword = await bcrypt.hash('aA12345678910*', 10);
    const testTeacher = {
      id: uuidv4(),
      name: 'Alex (Test Account)',
      email: testEmail,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };
    teachers.push(testTeacher);
    writeJsonFile('teachers.json', teachers);
    console.log('Test teacher account created: alex@gmail.com / aA12345678910*');
  }
}

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

// Initialize test student account
async function initializeTestStudent() {
  const students = readJsonFile('students.json', []);
  const testEmail = 'student@test.com';

  // Check if test account already exists
  if (!students.find(s => s.email === testEmail)) {
    const hashedPassword = await bcrypt.hash('student123', 10);
    const testStudent = {
      id: uuidv4(),
      name: 'Test Student',
      email: testEmail,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };
    students.push(testStudent);
    writeJsonFile('students.json', students);
    console.log('Test student account created: student@test.com / student123');
  }
}

initializeTestStudent();

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
const canEditPromotion = (promotion, userId) => {
  if (!promotion) return false;
  // Can edit if owner or collaborator
  return promotion.teacherId === userId || (promotion.collaboratorIds && promotion.collaboratorIds.includes(userId));
};

// ==================== AUTHENTICATION ====================

// Register a new teacher
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    const teachers = readJsonFile('teachers.json', []);
    if (teachers.some(t => t.email === email)) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const teacher = {
      id: uuidv4(),
      name,
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };

    teachers.push(teacher);
    writeJsonFile('teachers.json', teachers);

    const token = jwt.sign({ id: teacher.id, email: teacher.email }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ message: 'Teacher registered successfully', token, teacher: { id: teacher.id, name: teacher.name, email: teacher.email } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login endpoint (supports both teachers and students)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    let user = null;
    let userType = role || 'teacher';

    // Try to login as teacher
    if (userType === 'teacher' || !role) {
      const teachers = readJsonFile('teachers.json', []);
      user = teachers.find(t => t.email === email);

      if (user && (await bcrypt.compare(password, user.password))) {
        const token = jwt.sign({ id: user.id, email: user.email, role: 'teacher' }, JWT_SECRET, { expiresIn: '7d' });
        return res.json({
          message: 'Login successful',
          token,
          user: { id: user.id, name: user.name, email: user.email, role: 'teacher' }
        });
      }
    }

    // Try to login as student
    if (userType === 'student' || !role) {
      const students = readJsonFile('students.json', []);
      user = students.find(s => s.email === email);

      if (user && (await bcrypt.compare(password, user.password))) {
        const token = jwt.sign({ id: user.id, email: user.email, role: 'student' }, JWT_SECRET, { expiresIn: '7d' });
        return res.json({
          message: 'Login successful',
          token,
          user: { id: user.id, name: user.name, email: user.email, role: 'student' }
        });
      }
    }

    return res.status(401).json({ error: 'Invalid email or password' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== STUDENT MANAGEMENT ====================

// Get all students for a teacher's promotions
app.get('/api/promotions/:promotionId/students', verifyToken, (req, res) => {
  try {
    const promotions = readJsonFile('promotions.json', []);
    const promotion = promotions.find(p => p.id === req.params.promotionId);

    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const students = readJsonFile(`students-${req.params.promotionId}.json`, []);
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a student to a promotion
app.post('/api/promotions/:promotionId/students', verifyToken, (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const promotions = readJsonFile('promotions.json', []);
    const promotion = promotions.find(p => p.id === req.params.promotionId);

    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';
    const hashedPassword = bcrypt.hashSync(tempPassword, 10);

    const student = {
      id: uuidv4(),
      email,
      name: name || email.split('@')[0],
      password: hashedPassword,
      promotionId: req.params.promotionId,
      tempPassword: true,
      createdAt: new Date().toISOString()
    };

    // Add to global students list
    const allStudents = readJsonFile('students.json', []);
    allStudents.push(student);
    writeJsonFile('students.json', allStudents);

    // Add to promotion-specific list
    const promotionStudents = readJsonFile(`students-${req.params.promotionId}.json`, []);
    promotionStudents.push(student);
    writeJsonFile(`students-${req.params.promotionId}.json`, promotionStudents);

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
app.delete('/api/promotions/:promotionId/students/:studentId', verifyToken, (req, res) => {
  try {
    const promotions = readJsonFile('promotions.json', []);
    const promotion = promotions.find(p => p.id === req.params.promotionId);

    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const students = readJsonFile(`students-${req.params.promotionId}.json`, []);
    const studentIndex = students.findIndex(s => s.id === req.params.studentId);

    if (studentIndex === -1) return res.status(404).json({ error: 'Student not found' });

    students.splice(studentIndex, 1);
    writeJsonFile(`students-${req.params.promotionId}.json`, students);

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

// Get all promotions (public, no auth required)
app.get('/api/promotions', (req, res) => {
  try {
    const promotions = readJsonFile('promotions.json', []);
    res.json(promotions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get student's enrolled promotions (authenticated)
app.get('/api/my-enrollments', verifyToken, (req, res) => {
  try {
    const userId = req.user.id;
    const promotions = readJsonFile('promotions.json', []);
    const enrolledPromotions = [];

    // Find promotions where student is enrolled
    for (const promotion of promotions) {
      const students = readJsonFile(`students-${promotion.id}.json`, []);
      // Match by ID primarily, fallback to email if ID not present (legacy support)
      if (students.some(s => s.id === userId || s.email === req.user.email)) {
        enrolledPromotions.push(promotion);
      }
    }

    res.json(enrolledPromotions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get teacher's own promotions (authenticated)
app.get('/api/my-promotions', verifyToken, (req, res) => {
  try {
    const promotions = readJsonFile('promotions.json', []);
    const teacherPromotions = promotions.filter(p => p.teacherId === req.user.id);
    res.json(teacherPromotions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
  try {
    const promotions = readJsonFile('promotions.json', []);
    const promotion = promotions.find(p => p.id === req.params.id);
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    res.json(promotion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new promotion
app.post('/api/promotions', verifyToken, (req, res) => {
  try {
    const { name, description, startDate, endDate, weeks, modules } = req.body;
    if (!name || !weeks) {
      return res.status(400).json({ error: 'Name and weeks are required' });
    }

    const promotion = {
      id: uuidv4(),
      name,
      description,
      startDate,
      endDate,
      weeks,
      modules: modules || [],
      teacherId: req.user.id,
      collaboratorIds: [req.user.id], // Owner is also a collaborator
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const promotions = readJsonFile('promotions.json', []);
    promotions.push(promotion);
    writeJsonFile('promotions.json', promotions);

    res.status(201).json(promotion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a promotion
app.put('/api/promotions/:id', verifyToken, (req, res) => {
  try {
    const promotions = readJsonFile('promotions.json', []);
    const promotionIndex = promotions.findIndex(p => p.id === req.params.id);

    if (promotionIndex === -1) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotions[promotionIndex], req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    promotions[promotionIndex] = { ...promotions[promotionIndex], ...req.body, updatedAt: new Date().toISOString() };
    writeJsonFile('promotions.json', promotions);

    res.json(promotions[promotionIndex]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a promotion
app.delete('/api/promotions/:id', verifyToken, (req, res) => {
  try {
    const promotions = readJsonFile('promotions.json', []);
    const promotionIndex = promotions.findIndex(p => p.id === req.params.id);

    if (promotionIndex === -1) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotions[promotionIndex], req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    promotions.splice(promotionIndex, 1);
    writeJsonFile('promotions.json', promotions);

    res.json({ message: 'Promotion deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== MODULES ====================

// Add a module to a promotion
app.post('/api/promotions/:promotionId/modules', verifyToken, (req, res) => {
  try {
    const { name, duration, courses, projects } = req.body;
    if (!name || !duration) {
      return res.status(400).json({ error: 'Name and duration are required' });
    }

    const promotions = readJsonFile('promotions.json', []);
    const promotion = promotions.find(p => p.id === req.params.promotionId);

    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const module = {
      id: uuidv4(),
      name,
      duration,
      courses: courses || [],
      projects: projects || [],
      createdAt: new Date().toISOString()
    };

    promotion.modules.push(module);
    writeJsonFile('promotions.json', promotions);

    res.status(201).json(module);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== QUICK LINKS ====================

// Get quick links for a promotion (public, no auth required)
app.get('/api/promotions/:promotionId/quick-links', (req, res) => {
  try {
    const quickLinks = readJsonFile(`quick-links-${req.params.promotionId}.json`, []);
    res.json(quickLinks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add quick link
app.post('/api/promotions/:promotionId/quick-links', verifyToken, (req, res) => {
  try {
    const { name, url } = req.body;
    if (!name || !url) {
      return res.status(400).json({ error: 'Name and URL are required' });
    }

    const promotions = readJsonFile('promotions.json', []);
    const promotion = promotions.find(p => p.id === req.params.promotionId);

    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const quickLink = {
      id: uuidv4(),
      name,
      url,
      createdAt: new Date().toISOString()
    };

    const quickLinks = readJsonFile(`quick-links-${req.params.promotionId}.json`, []);
    quickLinks.push(quickLink);
    writeJsonFile(`quick-links-${req.params.promotionId}.json`, quickLinks);

    res.status(201).json(quickLink);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete quick link
app.delete('/api/promotions/:promotionId/quick-links/:linkId', verifyToken, (req, res) => {
  try {
    const promotions = readJsonFile('promotions.json', []);
    const promotion = promotions.find(p => p.id === req.params.promotionId);

    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const quickLinks = readJsonFile(`quick-links-${req.params.promotionId}.json`, []);
    const linkIndex = quickLinks.findIndex(l => l.id === req.params.linkId);

    if (linkIndex === -1) return res.status(404).json({ error: 'Quick link not found' });

    quickLinks.splice(linkIndex, 1);
    writeJsonFile(`quick-links-${req.params.promotionId}.json`, quickLinks);

    res.json({ message: 'Quick link deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== SECTIONS ====================

// Get sections for a promotion (public, no auth required)
app.get('/api/promotions/:promotionId/sections', (req, res) => {
  try {
    const sections = readJsonFile(`sections-${req.params.promotionId}.json`, []);
    res.json(sections);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add section
app.post('/api/promotions/:promotionId/sections', verifyToken, (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const promotions = readJsonFile('promotions.json', []);
    const promotion = promotions.find(p => p.id === req.params.promotionId);

    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

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

    res.status(201).json(section);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update section
app.put('/api/promotions/:promotionId/sections/:sectionId', verifyToken, (req, res) => {
  try {
    const promotions = readJsonFile('promotions.json', []);
    const promotion = promotions.find(p => p.id === req.params.promotionId);

    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const sections = readJsonFile(`sections-${req.params.promotionId}.json`, []);
    const sectionIndex = sections.findIndex(s => s.id === req.params.sectionId);

    if (sectionIndex === -1) return res.status(404).json({ error: 'Section not found' });

    sections[sectionIndex] = { ...sections[sectionIndex], ...req.body, updatedAt: new Date().toISOString() };
    writeJsonFile(`sections-${req.params.promotionId}.json`, sections);

    res.json(sections[sectionIndex]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete section
app.delete('/api/promotions/:promotionId/sections/:sectionId', verifyToken, (req, res) => {
  try {
    const promotions = readJsonFile('promotions.json', []);
    const promotion = promotions.find(p => p.id === req.params.promotionId);

    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const sections = readJsonFile(`sections-${req.params.promotionId}.json`, []);
    const sectionIndex = sections.findIndex(s => s.id === req.params.sectionId);

    if (sectionIndex === -1) return res.status(404).json({ error: 'Section not found' });

    sections.splice(sectionIndex, 1);
    writeJsonFile(`sections-${req.params.promotionId}.json`, sections);

    res.json({ message: 'Section deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== CALENDAR ====================

// Get calendar for a promotion (public, no auth required)
app.get('/api/promotions/:promotionId/calendar', (req, res) => {
  try {
    const calendar = readJsonFile(`calendar-${req.params.promotionId}.json`, null);
    if (!calendar) return res.status(404).json({ error: 'Calendar not found' });
    res.json(calendar);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set calendar for a promotion
app.post('/api/promotions/:promotionId/calendar', verifyToken, (req, res) => {
  try {
    const { googleCalendarId } = req.body;
    if (!googleCalendarId) {
      return res.status(400).json({ error: 'Google Calendar ID is required' });
    }

    const promotions = readJsonFile('promotions.json', []);
    const promotion = promotions.find(p => p.id === req.params.promotionId);

    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const calendar = {
      promotionId: req.params.promotionId,
      googleCalendarId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    writeJsonFile(`calendar-${req.params.promotionId}.json`, calendar);
    res.json(calendar);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ==================== EXTENDED INFO (Schedule, Team, etc.) ====================

// Get extended info (public)
app.get('/api/promotions/:promotionId/extended-info', (req, res) => {
  try {
    const extendedInfo = readJsonFile(`extended-info-${req.params.promotionId}.json`, {
      schedule: {},
      team: [],
      resources: [],
      evaluation: ''
    });
    res.json(extendedInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update extended info (teacher only)
app.post('/api/promotions/:promotionId/extended-info', verifyToken, (req, res) => {
  try {
    const promotions = readJsonFile('promotions.json', []);
    const promotion = promotions.find(p => p.id === req.params.promotionId);

    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const { schedule, team, resources, evaluation } = req.body;

    // Validate slightly. Schedule and others can be objects/arrays.
    const newInfo = {
      schedule: schedule || {},
      team: team || [],
      resources: resources || [],
      evaluation: evaluation || ''
    };

    writeJsonFile(`extended-info-${req.params.promotionId}.json`, newInfo);
    res.json(newInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
