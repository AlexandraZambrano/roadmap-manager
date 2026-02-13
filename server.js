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
app.get('/auth', (req, res) => {
  res.sendFile(join(__dirname, 'auth.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(join(__dirname, 'dashboard.html'));
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

// Login a teacher
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const teachers = readJsonFile('teachers.json', []);
    const teacher = teachers.find(t => t.email === email);

    if (!teacher || !(await bcrypt.compare(password, teacher.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: teacher.id, email: teacher.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: 'Login successful', token, teacher: { id: teacher.id, name: teacher.name, email: teacher.email } });
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
    if (promotions[promotionIndex].teacherId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

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
    if (promotions[promotionIndex].teacherId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

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
    if (promotion.teacherId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

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
    if (promotion.teacherId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

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
    if (promotion.teacherId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

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
    if (promotion.teacherId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

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
    if (promotion.teacherId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

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
    if (promotion.teacherId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

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
    if (promotion.teacherId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
