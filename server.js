import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
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
import Attendance from './backend/models/Attendance.js';
import BootcampTemplate from './backend/models/BootcampTemplate.js';
import Competence from './backend/models/Competence.js';
import Indicator from './backend/models/Indicator.js';
import Tool from './backend/models/Tool.js';
import Area from './backend/models/Area.js';
import Level from './backend/models/Level.js';
import Resource from './backend/models/Resource.js';
import Referent from './backend/models/Referent.js';
import ResourceType from './backend/models/ResourceType.js';
import CompetenceIndicator from './backend/models/CompetenceIndicator.js';
import CompetenceTool from './backend/models/CompetenceTool.js';
import CompetenceArea from './backend/models/CompetenceArea.js';
import CompetenceResource from './backend/models/CompetenceResource.js';
import { sendPasswordEmail } from './backend/utils/email.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const EXTERNAL_PUBLIC_KEY = readFileSync(join(__dirname, 'backend/keys/public.pem'), 'utf8');
const EXTERNAL_AUTH_URL = process.env.EXTERNAL_AUTH_URL || 'https://users.coderf5.es/v1';
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
  'http://localhost:3000',
  'http://127.0.0.1:3000',
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

// Explicit routes for main pages to ensure they're properly served
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.get('/public-promotion.html', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'public-promotion.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard.html', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'dashboard.html'));
});

app.get('/promotion-detail.html', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'promotion-detail.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'admin.html'));
});

app.get('/student-dashboard.html', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'student-dashboard.html'));
});

app.get('/auth.html', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'auth.html'));
});

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

  // Always decode without verification first to inspect claims (for logging)
  let rawDecoded = null;
  try {
    rawDecoded = jwt.decode(token);
    console.log('[verifyToken] raw claims:', JSON.stringify(rawDecoded));
  } catch(e) {}

  try {
    // Try RS256 first (external auth API token from users.coderf5.es)
    const decoded = jwt.verify(token, EXTERNAL_PUBLIC_KEY, { algorithms: ['RS256'] });
    const extRoles = Array.isArray(decoded.roles) ? decoded.roles : [];
    let extRole = 'teacher';
    if (extRoles.includes('ROLE_SUPER_ADMIN') || extRoles.includes('ROLE_SUPERADMIN')) extRole = 'admin';
    else if (extRoles.includes('ROLE_USER') && extRoles.includes('ROLE_ADMIN')) extRole = 'admin';
    else if (extRoles.includes('ROLE_ADMIN')) extRole = 'teacher';
    // JWT from external API uses 'username' (email) as identifier; userId may not be in the token
    const extId = decoded.username || decoded.email || decoded.sub || decoded.userId || decoded.id || null;
    if (!extId) {
      console.error('[verifyToken] RS256 ok but no user identifier claim. Claims:', Object.keys(decoded));
      return res.status(401).json({ error: 'Token missing user identifier', claims: Object.keys(decoded) });
    }
    req.user = { id: String(extId), email: decoded.username || decoded.email || decoded.sub, role: extRole };
    console.log('[verifyToken] RS256 ok, user:', req.user.id, req.user.role);
    next();
  } catch (rsErr) {
    console.warn('[verifyToken] RS256 failed:', rsErr.message);
    try {
      // Fallback: HS256 legacy local token
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      console.log('[verifyToken] HS256 ok, user:', req.user.id || req.user.email);
      next();
    } catch (error) {
      console.error('[verifyToken] Both RS256 and HS256 failed. Raw claims:', rawDecoded ? Object.keys(rawDecoded) : 'none');
      res.status(401).json({ error: 'Invalid token', hint: rsErr.message });
    }
  }
};

const canEditPromotion = (promotion, userId) => {
  if (!promotion) return false;
  return promotion.teacherId === userId || (promotion.collaborators && promotion.collaborators.includes(userId));
};

// ==================== COMPETENCES CATALOG ====================

// Get all areas from DB
app.get('/api/areas', verifyToken, async (req, res) => {
  try {
    const areas = await Area.find({}).sort({ id: 1 }).lean();
    console.log(`[GET /api/areas] Found ${areas.length} areas:`, areas.map(a => `${a.id}:${a.name}`));
    res.json(areas);
  } catch (error) {
    console.error('[GET /api/areas] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all competences enriched with areas, indicators (grouped by level) and tools
app.get('/api/competences', verifyToken, async (req, res) => {
  try {
    // Fetch all reference data in parallel
    const [
      competences,
      indicators,
      tools,
      areas,
      levels,
      compIndicators,
      compTools,
      compAreas
    ] = await Promise.all([
      Competence.find({}).sort({ id: 1 }).lean(),
      Indicator.find({}).lean(),
      Tool.find({}).lean(),
      Area.find({}).lean(),
      Level.find({}).lean(),
      CompetenceIndicator.find({}).lean(),
      CompetenceTool.find({}).lean(),
      CompetenceArea.find({}).lean()
    ]);

    console.log(`[GET /api/competences] Raw counts — competences:${competences.length} indicators:${indicators.length} tools:${tools.length} areas:${areas.length} levels:${levels.length} compIndicators:${compIndicators.length} compTools:${compTools.length} compAreas:${compAreas.length}`);
    console.log('[GET /api/competences] Areas in DB:', areas.map(a => `${a.id}:${a.name}`));
    console.log('[GET /api/competences] First 5 compAreas docs:', compAreas.slice(0, 5));
    console.log('[GET /api/competences] First 5 compIndicators docs:', compIndicators.slice(0, 5));
    console.log('[GET /api/competences] First 5 compTools docs:', compTools.slice(0, 5));

    // Build lookup maps
    const indicatorMap = Object.fromEntries(indicators.map(i => [i.id, i]));
    const toolMap     = Object.fromEntries(tools.map(t => [t.id, t]));
    const areaMap     = Object.fromEntries(areas.map(a => [a.id, a]));
    const levelMap    = Object.fromEntries(levels.map(l => [l.id, l]));

    // Group relations by id_competence (DB field names use snake_case)
    const indsByComp  = {};
    compIndicators.forEach(ci => {
      if (!indsByComp[ci.id_competence]) indsByComp[ci.id_competence] = [];
      indsByComp[ci.id_competence].push(ci.id_indicator);
    });
    const toolsByComp = {};
    compTools.forEach(ct => {
      if (!toolsByComp[ct.id_competence]) toolsByComp[ct.id_competence] = [];
      toolsByComp[ct.id_competence].push(ct.id_tool);
    });
    const areasByComp = {};
    compAreas.forEach(ca => {
      if (!areasByComp[ca.id_competence]) areasByComp[ca.id_competence] = [];
      areasByComp[ca.id_competence].push(ca.id_area);
    });

    console.log('[GET /api/competences] areasByComp (competenceId → areaIds):', JSON.stringify(areasByComp));
    console.log('[GET /api/competences] areaMap keys:', Object.keys(areaMap));

    // Build enriched competences
    const enriched = competences.map(comp => {
      // Areas
      const compAreasList = (areasByComp[comp.id] || [])
        .map(aId => areaMap[aId])
        .filter(Boolean)
        .map(a => ({ id: a.id, name: a.name, icon: a.icon }));

      // Indicators grouped by level
      const rawIndicators = (indsByComp[comp.id] || [])
        .map(iId => indicatorMap[iId])
        .filter(Boolean);

      const indicatorsByLevel = {};
      rawIndicators.forEach(ind => {
        const lvl = ind.levelId || 0;
        if (!indicatorsByLevel[lvl]) {
          indicatorsByLevel[lvl] = {
            levelId: lvl,
            levelName: levelMap[lvl]?.name || `Nivel ${lvl}`,
            levelDescription: levelMap[lvl]?.description || '',
            indicators: []
          };
        }
        indicatorsByLevel[lvl].indicators.push({ id: ind.id, name: ind.name, description: ind.description });
      });
      const levels_grouped = Object.values(indicatorsByLevel).sort((a, b) => a.levelId - b.levelId);

      // Tools
      const compToolsList = (toolsByComp[comp.id] || [])
        .map(tId => toolMap[tId])
        .filter(Boolean)
        .map(t => ({ id: t.id, name: t.name, description: t.description }));

      return {
        id: comp.id,
        name: comp.name,
        description: comp.description,
        areas: compAreasList,
        levels: levels_grouped,
        tools: compToolsList
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error('[GET /api/competences] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== PROMOTION PASSWORD ACCESS ====================

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

// Verify promotion access password (public, no authentication required)
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

// Remove promotion access password (teacher only)
app.delete('/api/promotions/:promotionId/access-password', verifyToken, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    // Store in history before removing
    if (promotion.accessPassword) {
      if (!promotion.passwordChangeHistory) promotion.passwordChangeHistory = [];
      promotion.passwordChangeHistory.push({
        oldPassword: promotion.accessPassword,
        newPassword: null,
        changedAt: new Date()
      });
    }

    promotion.accessPassword = undefined;
    await promotion.save();

    res.json({ message: 'Access password removed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== TEACHING CONTENT ENDPOINTS ====================

// Get teaching content URL (teacher only)
app.get('/api/promotions/:promotionId/teaching-content', verifyToken, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    res.json({ teachingContentUrl: promotion.teachingContentUrl || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set teaching content URL (teacher only)
app.post('/api/promotions/:promotionId/teaching-content', verifyToken, async (req, res) => {
  try {
    const { teachingContentUrl } = req.body;
    if (!teachingContentUrl) return res.status(400).json({ error: 'Teaching content URL is required' });

    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    promotion.teachingContentUrl = teachingContentUrl;
    await promotion.save();

    res.json({ message: 'Teaching content URL updated', teachingContentUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove teaching content URL (teacher only)
app.delete('/api/promotions/:promotionId/teaching-content', verifyToken, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    promotion.teachingContentUrl = undefined;
    await promotion.save();

    res.json({ message: 'Teaching content URL removed' });
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
      description: 'Inteligencia Artificial y Machine Learning — bootcamp completo de 36 semanas',
      weeks: 36,
      hours: 1250,
      hoursPerWeek: Math.round(1250 / 36),
      isCustom: false,
      // ── Acta de Inicio ─────────────────────────────────────────────────────
      school: 'Madrid',
      projectType: 'Bootcamp',
      totalHours: '1.250 horas',
      modality: 'Híbrido (Presencial + Online)',
      materials: 'No son necesarios recursos adicionales.',
      internships: false,
      funders: 'SAGE.\nJP Morgan.\nEn colaboración con Microsoft y Somos F5.',
      funderDeadlines: '',
      okrKpis: 'PIPO3.R1 Satisfacción 4,2/5 de coders sobre la excelencia del equipo formativo de la formación\nISEC2.R1 Jornadas de selección con un 40% de personas participantes con el proceso 100% finalizado.\nISEC3.R2 Resultado 78% salida positiva.\nISECR2 Finalizar cada programa con un máximo de bajas de 10%.',
      funderKpis: 'SAGE.: 50% mujeres\n30% jóvenes menores de 30 años\n15% inmigrantes o refugiados\n5% personas con discapacidad.',
      projectMeetings: 'Ver el calendario de reuniones en Asana.',
      teamMeetings: 'Semanal - jueves (14:30-15:00)',
      trainerDayOff: '',
      cotrainerDayOff: '',
      // ── Schedule ───────────────────────────────────────────────────────────
      schedule: {
        online: {
          entry: '08:15',
          start: '08:25',
          break: '11:00',
          lunch: 'No tomamos almuerzo',
          finish: '15:45'
        },
        presential: {
          entry: '09:59',
          start: '09:25',
          break: '11:00',
          lunch: '13:30',
          finish: '16:30'
        },
        notes: ''
      },
      // ── Evaluation ─────────────────────────────────────────────────────────
      evaluation: `Evaluación del Proyecto\n\nSe brindará retroalimentación oral el mismo día de la presentación del proyecto, mientras que la autoevaluación (en proyectos individuales) y evaluación grupal (en proyectos grupales) se realizará al día siguiente y posteriormente, el equipo formativo compartirá las impresiones finales. Todo ello deberá almacenarse en Google Classroom.\n\nSe tendrán en cuenta los siguientes aspectos:\n\n• Análisis de los commits realizados por los coders, valorando tanto la cantidad como la calidad\n• Participación individual en la presentación del proyecto\n• Capacidad de responder preguntas específicas de manera clara y fundamentada\n• Desarrollo y demostración de las competencias adquiridas durante el proyecto\n\nEvaluación de las Píldoras\n\nLas píldoras se asignarán la primera semana, se apuntarán en el calendario y se valorarán los siguientes aspectos:\n• Que tenga un poco de inglés (hablado, no solo en la presentación)\n• Que tenga parte teórica y parte práctica. Énfasis en la práctica\n• Tiempo mínimo 1 hora\n• Crear un repositorio en Github y/o publicar un artículo en Medium\n\nEvaluación Global al Final del Bootcamp\n\n• Valoración de los proyectos entregados\n• Valoración de los cursos realizados\n• Valoración de las píldoras realizadas\n• Valoración de competencias transversales`,
      // ── Resources ──────────────────────────────────────────────────────────
      resources: [
        { title: 'CodigoMaquina', category: 'Youtube', url: 'https://www.youtube.com/@CodigoMaquina' },
        { title: '3blue1brown', category: 'Youtube', url: 'https://www.youtube.com/c/3blue1brown' },
        { title: 'Practical AI', category: 'Podcast', url: 'https://practicalai.fm/' },
        { title: '180 proyectos de data science y machine learning con python', category: 'Technical', url: 'https://noeliagorod.com/2022/02/09/180-proyectos-de-data-science-y-machine-learning-con-python-2/' },
        { title: 'Khan Academy', category: 'Technical', url: 'https://www.khanacademy.org/' }
      ],
      // ── Employability ──────────────────────────────────────────────────────
      employability: [
        { name: 'Sesión 1: Introducción a la búsqueda de trabajo', url: '', startMonth: 2, duration: 1 },
        { name: 'Sesión 2: Introducción a LinkedIn', url: '', startMonth: 3, duration: 1 },
        { name: 'Sesión 3: Autoconocimiento (DAFO/Elevator/Objetivo profesional)', url: '', startMonth: 4, duration: 1 },
        { name: 'Sesión 4: Autoconocimiento (Perfil profesional)', url: '', startMonth: 5, duration: 1 }
      ],
      // ── Modules (Roadmap) ──────────────────────────────────────────────────
      modules: [
        {
          name: 'Bases del desarrollo web',
          duration: 7,
          courses: [
            { name: 'Python Essentials - Cisco', url: 'https://www.netacad.com/courses/python-essentials-1?courseLang=en-US', duration: 7, startOffset: 0 }
          ],
          projects: [
            { name: 'App con Python', url: '', duration: 2, startOffset: 0 },
            { name: 'CRUD con Python', url: '', duration: 3, startOffset: 2 },
            { name: 'Web Scraping', url: '', duration: 2, startOffset: 5 }
          ]
        },
        {
          name: 'Machine Learning',
          duration: 8,
          courses: [
            { name: 'Data Science Fundamentals - Saturdays AI', url: 'https://ti.to/saturdaysai/data-science-fundamentals/', duration: 8, startOffset: 0 }
          ],
          projects: [
            { name: 'Exploratory Data Analisys', url: '', duration: 1, startOffset: 0 },
            { name: 'Problema de Regresión', url: '', duration: 2, startOffset: 1 },
            { name: 'Problema de clasificación', url: '', duration: 2, startOffset: 3 },
            { name: 'Problema de clasificación multiclase con Modelos Ensemble', url: '', duration: 2, startOffset: 5 },
            { name: 'Aprendizaje no supervizado', url: '', duration: 1, startOffset: 7 }
          ]
        },
        {
          name: 'Deep Learning',
          duration: 17,
          courses: [
            { name: 'Ingeniero Asociado de IA de Azure', url: 'https://learn.microsoft.com/es-es/credentials/certifications/azure-ai-engineer/?practice-assessment-type=certification', duration: 13, startOffset: 0 }
          ],
          projects: [
            { name: 'Tiempo Flexible', url: '', duration: 4, startOffset: 0 },
            { name: 'Tracks: Data Engineer (Spark, Redis, Kafka, etc.), Data Analyst (Power BI, Tableau, Dash, etc.), AI Developer (Keras, MLops, etc.)', url: '', duration: 4, startOffset: 4 },
            { name: 'Natural Language Procesing', url: '', duration: 3, startOffset: 8 },
            { name: 'LLM (Rag + agentes)', url: '', duration: 3, startOffset: 11 },
            { name: 'Computer Vision', url: '', duration: 3, startOffset: 14 }
          ]
        },
        {
          name: 'Proyectos finales',
          duration: 4,
          courses: [],
          projects: []
        }
      ],
      // ── Competences ────────────────────────────────────────────────────────
      competences: [
        {
          id: '1',
          area: 'web',
          name: 'DEMO: Configurar el entorno de trabajo',
          description: 'Montar y mantener un entorno de desarrollo completo, incluyendo herramientas, frameworks y sistemas de control de versiones.',
          levels: [
            {
              level: 1,
              description: 'initial',
              indicators: [
                'Organiza directorios de proyecto',
                'Busca información técnica',
                'Consulta documentación en inglés',
                'Instala aplicaciones y extensiones'
              ]
            },
            {
              level: 2,
              description: 'medio',
              indicators: [
                'Usa líneas de comandos básicas',
                'Declara funciones y variables en el entorno',
                'Integra control de versiones'
              ]
            },
            {
              level: 3,
              description: 'advance',
              indicators: [
                'Establece un flujo de trabajo profesional',
                'Utiliza herramientas de contenización',
                'Automatiza el entorno con scripts'
              ]
            }
          ],
          allTools: ['Docker', 'Git', 'GitHub', 'IDE', 'Terminal (CLI)', 'devcontainer'],
          selectedTools: ['Docker', 'Git', 'GitHub', 'IDE', 'Terminal (CLI)'],
          startModule: { id: '', name: 'Bases del desarrollo web' }
        }
      ],
      // ── Píldoras por módulo ────────────────────────────────────────────────
      modulesPildoras: [
        {
          moduleName: 'Bases del desarrollo web',
          pildoras: [
            { title: 'Píldora: Clean code', mode: 'Virtual' },
            { title: 'Píldora: Streamlit', mode: 'Presencial' },
            { title: 'Píldora: Hilos en python', mode: 'Presencial' },
            { title: 'Píldora: Protocolos de comunicación (http, IP)', mode: 'Virtual' },
            { title: 'Píldora: API Rest y CRUD', mode: 'Virtual' },
            { title: 'Píldora: Fastapi', mode: 'Virtual' },
            { title: 'Píldora: Django', mode: 'Presencial' },
            { title: 'Píldora: Bases de datos relacionales', mode: 'Presencial' },
            { title: 'Píldora: Bases de datos no relacionales', mode: 'Virtual' },
            { title: 'Píldora: Test de unitarios y de integración', mode: 'Virtual' },
            { title: 'Píldora: TDD con Python', mode: 'Virtual' },
            { title: 'Píldora: Versionado de APIs y gestión de endpoints', mode: 'Virtual' },
            { title: 'Píldora: Docker (Contenedores, imágenes y volúmenes)', mode: 'Presencial' },
            { title: 'Píldora: SOLID', mode: 'Presencial' },
            { title: 'Píldora: Docker compose y microservicios', mode: 'Virtual' },
            { title: 'Píldora: HTML & JS', mode: 'Virtual' },
            { title: 'Píldora: Beautifulsoup', mode: 'Virtual' },
            { title: 'Píldora: Scrapy', mode: 'Presencial' },
            { title: 'Píldora: Selenium', mode: 'Presencial' },
            { title: 'Píldora: Cronjob', mode: 'Virtual' },
            { title: 'Píldora: Creación de Macros para la documentación de un proyecto', mode: 'Virtual' },
            { title: 'Píldora Crea una documentación atractiva en github', mode: 'Virtual' },
            { title: 'Píldora: Temas legales y seguridad IT', mode: 'Presencial' }
          ]
        },
        {
          moduleName: 'Machine Learning',
          pildoras: [
            { title: 'Gestores de paquetes (uv, pipenv, poetry)', mode: 'Virtual' },
            { title: 'Data cleaning con Python', mode: 'Virtual' },
            { title: 'Story telling con Datos', mode: 'Virtual' },
            { title: 'Etapas de Un proyecto de Machine Learning', mode: 'Presencial' },
            { title: 'ML Supervisado: Algoritmos de Regresión', mode: 'Presencial' },
            { title: 'Evaluación de modelos y métricas de rendimiento', mode: 'Presencial' },
            { title: 'División de datos: entrenamiento, validación y prueba', mode: 'Virtual' },
            { title: 'Overfitting, Underfitting y técnicas de regularización', mode: 'Virtual' },
            { title: 'Pipeline básico de Machine Learning y uso de pickle (conexión de un  modelo de ML con tu aplicación web)', mode: 'Presencial' },
            { title: 'ML Supervisado: Algoritmos de Clasificación', mode: 'Virtual' },
            { title: 'Ingenieria de Caracteristicas', mode: 'Virtual' },
            { title: 'Manejo de datos desbalanceados en clasificación', mode: 'Presencial' },
            { title: 'Modelos Ensemble', mode: 'Virtual' },
            { title: 'Selección de modelos y comparación de algoritmos', mode: 'Presencial' },
            { title: 'Reducción de la Dimensionalidad', mode: 'Presencial' },
            { title: 'ML No Supervisado: Algoritmos Clustering', mode: 'Presencial' },
            { title: 'Detección de data leakage en proyectos de Machine Learning', mode: 'Virtual' },
            { title: 'Herramientas de Business Intelligence (Power BI, Tableau, etc.)', mode: 'Virtual' },
            { title: 'ETLs, Extracción, transformación y carga de datos para procesos de ML', mode: 'Presencial' },
            { title: 'Analisis de Series temporales', mode: 'Virtual' }
          ]
        },
        {
          moduleName: 'Deep Learning',
          pildoras: []
        },
        {
          moduleName: 'Proyectos finales',
          pildoras: []
        }
      ]
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
    const result = await BootcampTemplate.findOneAndUpdate(
      { id: template.id },
      { $set: template },
      { upsert: true, strict: false, runValidators: false, returnDocument: 'after' }
    );
    console.log(`[initTemplates] ${template.id}: modules=${result?.modules?.length || 0}, competences=${result?.competences?.length || 0}`);
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

// Update custom template
app.put('/api/bootcamp-templates/:templateId', verifyToken, async (req, res) => {
  try {
    const template = await BootcampTemplate.findOne({ id: req.params.templateId });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (!template.isCustom) {
      return res.status(403).json({ error: 'Cannot edit system templates' });
    }

    if (template.createdBy !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { name, description, weeks, hours, hoursPerWeek, modules, evaluation, schedule,
            resources, employability, competences, school, projectType, totalHours, modality,
            materials, internships, funders, funderDeadlines, okrKpis, funderKpis,
            projectMeetings, teamMeetings, trainerDayOff, cotrainerDayOff } = req.body;

    const updated = await BootcampTemplate.findOneAndUpdate(
      { id: req.params.templateId },
      { $set: { name, description, weeks, hours, hoursPerWeek, modules, evaluation, schedule,
                resources, employability, competences, school, projectType, totalHours, modality,
                materials, internships, funders, funderDeadlines, okrKpis, funderKpis,
                projectMeetings, teamMeetings, trainerDayOff, cotrainerDayOff } },
      { returnDocument: 'after' }
    );

    res.json(updated);
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
      // Include userRole (Formador/a, CoFormador/a, Coordinador/a) for teacher accounts
      const userData = { id: user.id, name: user.name, email: user.email, role: userRole };
      if (userRole === 'teacher' && user.userRole) userData.userRole = user.userRole;
      return res.json({ message: 'Login successful', token, user: userData });
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
      userRole: role === 'teacher' ? (user.userRole || 'Formador/a') : undefined,
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
});

// Get attendance for a specific month
app.get('/api/promotions/:promotionId/attendance', verifyToken, async (req, res) => {
  try {
    const { month } = req.query; // Format: YYYY-MM
    console.log('Attendance request - promotionId:', req.params.promotionId, 'month:', month);
    if (!month) return res.status(400).json({ error: 'Month is required (YYYY-MM)' });

    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    console.log('Promotion found:', promotion ? promotion.id : 'NOT FOUND');
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    // Fetch all attendance for this promotion in the given month using regex
    const attendance = await Attendance.find({
      promotionId: req.params.promotionId,
      date: { $regex: new RegExp(`^${month}-`) }
    });

    res.json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update or create attendance record
app.put('/api/promotions/:promotionId/attendance', verifyToken, async (req, res) => {
  try {
    const { studentId, date, status, note } = req.body;
    if (!studentId || !date) return res.status(400).json({ error: 'studentId and date are required' });

    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    console.log('UPDATING ATTENDANCE - payload:', { studentId, date, status, note });

    const updateData = { status };
    if (note !== undefined && note !== null) updateData.note = note;

    const attendance = await Attendance.findOneAndUpdate(
      { promotionId: req.params.promotionId, studentId, date },
      updateData,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log('UPDATED RECORD IN DB:', attendance);
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export attendance for entire promotion period as Excel
app.get('/api/promotions/:promotionId/attendance/export', verifyToken, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const startDate = promotion.startDate;
    const endDate = promotion.endDate;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'La promoción debe tener fechas de inicio y fin válidas' });
    }

    console.log(`Exporting attendance for promotion ${req.params.promotionId} from ${startDate} to ${endDate}`);

    // Get all students for this promotion
    const students = await Student.find({ promotionId: req.params.promotionId }).sort({ name: 1, lastname: 1 });
    
    if (students.length === 0) {
      return res.status(400).json({ error: 'No se encontraron estudiantes en esta promoción' });
    }

    // Get all attendance records for the entire promotion period
    const attendance = await Attendance.find({
      promotionId: req.params.promotionId,
      date: {
        $gte: startDate,
        $lte: endDate
      }
    }).sort({ date: 1 });

    console.log(`Found ${students.length} students and ${attendance.length} attendance records`);

    // Generate all dates between start and end date
    const allDates = [];
    const currentDate = new Date(startDate);
    const endDateTime = new Date(endDate);
    
    while (currentDate <= endDateTime) {
      // Only include weekdays (Monday to Friday)
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        allDates.push(currentDate.toISOString().split('T')[0]);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`Generated ${allDates.length} school days between ${startDate} and ${endDate}`);

    // Group dates by month
    const datesByMonth = {};
    allDates.forEach(date => {
      const monthKey = date.substring(0, 7); // YYYY-MM format
      if (!datesByMonth[monthKey]) {
        datesByMonth[monthKey] = [];
      }
      datesByMonth[monthKey].push(date);
    });

    // Create workbook
    const workbook = xlsx.utils.book_new();

    // Create a worksheet for each month
    Object.keys(datesByMonth).sort().forEach(monthKey => {
      const monthDates = datesByMonth[monthKey];
      const monthName = new Date(monthKey + '-01').toLocaleDateString('es-ES', { 
        year: 'numeric', 
        month: 'long' 
      });
      const shortMonthName = new Date(monthKey + '-01').toLocaleDateString('es-ES', { 
        year: '2-digit', 
        month: 'short' 
      }).replace('.', '');

      // Create worksheet data for this month
      const worksheetData = [];
      
      // Header row with dates
      const headerRow = ['Estudiante', ...monthDates.map(date => {
        const d = new Date(date);
        return d.getDate().toString().padStart(2, '0');
      })];
      worksheetData.push(headerRow);

      // Data rows for each student
      students.forEach(student => {
        const studentName = `${student.name || ''} ${student.lastname || ''}`.trim();
        const row = [studentName];
        
        monthDates.forEach(date => {
          const attendanceRecord = attendance.find(a => 
            a.studentId === student.id && a.date === date
          );
          
          let status = '';
          if (attendanceRecord) {
            switch (attendanceRecord.status) {
              case 'Presente': status = 'P'; break;
              case 'Ausente': status = 'A'; break;
              case 'Con retraso': status = 'T'; break;
              case 'Justificado': status = 'J'; break;
              case 'Sale antes': status = 'S'; break;
              default: status = '';
            }
          }
          row.push(status);
        });
        
        worksheetData.push(row);
      });

      // Add empty row before legend
      worksheetData.push([]);
      
      // Add legend at the bottom of each month
      worksheetData.push(['Leyenda:']);
      worksheetData.push(['P = Presente']);
      worksheetData.push(['A = Ausente']);
      worksheetData.push(['T = Con retraso']);
      worksheetData.push(['J = Justificado']);
      worksheetData.push(['S = Sale antes']);

      // Create worksheet
      const worksheet = xlsx.utils.aoa_to_sheet(worksheetData);
      
      // Set column widths
      const colWidths = [{ width: 25 }]; // Student name column
      monthDates.forEach(() => colWidths.push({ width: 6 })); // Date columns (smaller for day numbers)
      worksheet['!cols'] = colWidths;

      // Add worksheet to workbook with month name as tab
      xlsx.utils.book_append_sheet(workbook, worksheet, shortMonthName);
    });

    // If no months found, create a summary sheet
    if (Object.keys(datesByMonth).length === 0) {
      const summaryData = [
        ['No hay registros de asistencia para exportar'],
        [''],
        ['Período consultado:'],
        [`Desde: ${startDate}`],
        [`Hasta: ${endDate}`],
        [`Estudiantes: ${students.length}`]
      ];
      
      const summarySheet = xlsx.utils.aoa_to_sheet(summaryData);
      xlsx.utils.book_append_sheet(workbook, summarySheet, 'Resumen');
    }

    // Generate Excel file
    const excelBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Create safe filename using promotion name
    const safeName = promotion.name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const filename = `${safeName}_asistencia.xlsx`;

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    console.log(`Sending Excel file: ${filename}`);
    res.send(excelBuffer);
  } catch (error) {
    console.error('Error exporting attendance:', error);
    res.status(500).json({ error: `Error al exportar asistencia: ${error.message}` });
  }
});

// ── Holidays (festivos) for a promotion ──────────────────────────────────────
// GET — return the holiday list for the promotion
app.get('/api/promotions/:promotionId/holidays', verifyToken, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    res.json({ holidays: promotion.holidays || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT — replace the full holiday list for the promotion
app.put('/api/promotions/:promotionId/holidays', verifyToken, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });
    const { holidays } = req.body; // array of YYYY-MM-DD strings
    if (!Array.isArray(holidays)) return res.status(400).json({ error: 'holidays must be an array' });
    await Promotion.findOneAndUpdate({ id: req.params.promotionId }, { holidays });
    res.json({ holidays });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add student manually (teacher adds student for tracking)
app.post('/api/promotions/:promotionId/students', verifyToken, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const {
      name, lastname, email, phone, age, administrativeSituation,
      nationality, identificationDocument, gender, englishLevel, educationLevel,
      profession, community
    } = req.body;

    if (!email || !name || !lastname) return res.status(400).json({ error: 'Email, name, and lastname are required' });

    // Check if student already exists
    const existing = await Student.findOne({ email, promotionId: req.params.promotionId });
    if (existing) return res.status(400).json({ error: 'Student already added to this promotion' });

    const student = await Student.create({
      id: uuidv4(),
      name,
      lastname,
      email,
      phone: phone || '',
      age: age || null,
      administrativeSituation: administrativeSituation || '',
      nationality: nationality || '',
      identificationDocument: identificationDocument || '',
      gender: gender || '',
      englishLevel: englishLevel || '',
      educationLevel: educationLevel || '',
      profession: profession || '',
      community: community || '',
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
        phone: student.phone,
        age: student.age,
        administrativeSituation: student.administrativeSituation,
        nationality: student.nationality,
        identificationDocument: student.identificationDocument,
        gender: student.gender,
        englishLevel: student.englishLevel,
        educationLevel: student.educationLevel,
        profession: student.profession,
        community: student.community
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Import students from Excel
// Expected columns (Spanish headers matching the student form):
//   Nombre*, Apellidos*, Email*, Teléfono*, Edad*, Situación Administrativa*,
//   Nacionalidad, Documento (DNI/NIE/Pasaporte), Sexo,
//   Nivel Inglés, Nivel Educativo, Profesión, Comunidad
// (* = required)
app.post('/api/promotions/:promotionId/students/upload-excel', verifyToken, upload.single('excelFile'), async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    if (!req.file) return res.status(400).json({ error: 'No Excel file provided' });

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { defval: '' });

    if (data.length === 0) return res.status(400).json({ error: 'El archivo Excel está vacío' });

    // Column name aliases (Spanish headers as defined in the template)
    const col = (row, ...keys) => {
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== '') return String(row[k]).trim();
      }
      return '';
    };

    const ADMIN_SITUATIONS = ['nacional', 'solicitante_asilo', 'ciudadano_europeo', 'permiso_trabajo', 'no_permiso_trabajo', 'otro'];
    const GENDER_VALUES    = ['mujer', 'hombre', 'no_binario', 'no_especifica'];
    const ENGLISH_LEVELS   = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const EDUCATION_LEVELS = ['sin_estudios', 'eso', 'bachillerato', 'fp_medio', 'fp_superior', 'grado', 'postgrado', 'doctorado'];

    const created = [], skipped = [], errors = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // 1-based + header row

      const name     = col(row, 'Nombre');
      const lastname = col(row, 'Apellidos');
      const email    = col(row, 'Email');
      const phone    = col(row, 'Teléfono', 'Telefono');
      const ageRaw   = col(row, 'Edad');
      const adminSit = col(row, 'Situación Administrativa', 'Situacion Administrativa');
      const nationality         = col(row, 'Nacionalidad');
      const identificationDocument = col(row, 'Documento', 'DNI/NIE/Pasaporte');
      const gender              = col(row, 'Sexo');
      const englishLevel        = col(row, 'Nivel Inglés', 'Nivel Ingles');
      const educationLevel      = col(row, 'Nivel Educativo');
      const profession          = col(row, 'Profesión', 'Profesion');
      const community           = col(row, 'Comunidad');

      // Required field validation
      if (!name || !lastname || !email) {
        errors.push(`Fila ${rowNum}: Nombre, Apellidos y Email son obligatorios`);
        continue;
      }

      // Duplicate check
      const existing = await Student.findOne({ email, promotionId: req.params.promotionId });
      if (existing) {
        skipped.push(`Fila ${rowNum}: ${email} ya existe en esta promoción`);
        continue;
      }

      const age = ageRaw ? parseInt(ageRaw) || null : null;

      // Normalise enum values (case-insensitive)
      const normalise = (val, allowed) => {
        const v = val.toLowerCase().replace(/\s+/g, '_');
        return allowed.find(a => a === v) || val || '';
      };

      try {
        const student = await Student.create({
          id: uuidv4(),
          name,
          lastname,
          email,
          phone,
          age,
          administrativeSituation: normalise(adminSit, ADMIN_SITUATIONS),
          nationality,
          identificationDocument,
          gender:       normalise(gender, GENDER_VALUES),
          englishLevel: ENGLISH_LEVELS.includes(englishLevel) ? englishLevel : (englishLevel || ''),
          educationLevel: normalise(educationLevel, EDUCATION_LEVELS),
          profession,
          community,
          promotionId: req.params.promotionId,
          isManuallyAdded: true,
          notes: ''
        });
        created.push({ id: student.id, name: student.name, lastname: student.lastname, email: student.email });
      } catch (e) {
        errors.push(`Fila ${rowNum}: ${e.message}`);
      }
    }

    const parts = [];
    if (created.length) parts.push(`${created.length} estudiante(s) importado(s)`);
    if (skipped.length) parts.push(`${skipped.length} omitido(s) (ya existían)`);
    if (errors.length)  parts.push(`${errors.length} error(es)`);

    res.json({
      message: parts.join(', '),
      created,
      skipped,
      errors
    });
  } catch (error) {
    console.error('Error importing students from Excel:', error);
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

    const { name, lastname, email, phone, age, administrativeSituation,
            nationality, identificationDocument, gender, englishLevel, educationLevel,
            profession, community } = req.body;
    console.log('Updating student with data:', { name, lastname, email, phone, age, administrativeSituation, nationality, profession });

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
        phone: phone || '',
        age: age || null,
        administrativeSituation: administrativeSituation || '',
        nationality: nationality || '',
        identificationDocument: identificationDocument || '',
        gender: gender || '',
        englishLevel: englishLevel || '',
        educationLevel: educationLevel || '',
        profession: profession || '',
        community: community || ''
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
        phone: student.phone,
        age: student.age,
        administrativeSituation: student.administrativeSituation,
        nationality: student.nationality,
        identificationDocument: student.identificationDocument,
        gender: student.gender,
        englishLevel: student.englishLevel,
        educationLevel: student.educationLevel,
        profession: student.profession,
        community: student.community
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
// Helper to convert Excel date to JS Date
function excelDateToJSDate(serial) {
  if (typeof serial === 'string') return serial; // Already a string format
  if (!serial || serial <= 0) return null; // Handle 0 or invalid serials
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);

  const fractional_day = serial - Math.floor(serial) + 0.0000001;
  let total_seconds = Math.floor(86400 * fractional_day);

  const seconds = total_seconds % 60;
  total_seconds -= seconds;
  const minutes = Math.floor(total_seconds / 60) % 60;
  total_seconds -= minutes * 60;
  const hours = Math.floor(total_seconds / (60 * 60));

  return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds);
}

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
    const data = xlsx.utils.sheet_to_json(worksheet, { cellDates: true });

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
          // Check if it's a number (Excel serial date)
          let date;
          if (typeof dateText === 'number' && dateText < 100000) { // Likely Excel serial date
            date = excelDateToJSDate(dateText);
          } else {
            date = new Date(dateText);
          }

          if (date && !isNaN(date.getTime())) {
            isoDate = date.toISOString().split('T')[0];
          } else {
            isoDate = new Date().toISOString().split('T')[0];
          }
        } catch (e) {
          console.warn('Invalid date format:', dateText);
          isoDate = new Date().toISOString().split('T')[0];
        }
      } else {
        isoDate = new Date().toISOString().split('T')[0];
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
    const data = xlsx.utils.sheet_to_json(worksheet, { cellDates: true });

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
          let date;
          if (typeof dateText === 'number' && dateText < 100000) {
            date = excelDateToJSDate(dateText);
          } else {
            date = new Date(dateText);
          }

          if (date && !isNaN(date.getTime())) {
            isoDate = date.toISOString().split('T')[0];
          } else {
            isoDate = new Date().toISOString().split('T')[0];
          }
        } catch (e) {
          console.warn('Invalid date format:', dateText);
          isoDate = new Date().toISOString().split('T')[0];
        }
      } else {
        isoDate = new Date().toISOString().split('T')[0];
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

    // Improved Migration: If modulesPildoras is effectively empty but legacy pildoras exists, migrate data
    const hasAnyModulePildoras = extendedInfo.modulesPildoras &&
      extendedInfo.modulesPildoras.some(mp => mp.pildoras && mp.pildoras.length > 0);

    if (!hasAnyModulePildoras && extendedInfo.pildoras && extendedInfo.pildoras.length > 0) {
      console.log('Migrating legacy píldoras to modules for promotion:', req.params.promotionId);

      // Group legacy pildoras by moduleId if present, otherwise put in first module
      const firstModule = promotion.modules && promotion.modules.length > 0 ? promotion.modules[0] : null;

      if (firstModule) {
        const modulesMap = new Map();
        // Initialize map with all current modules
        promotion.modules.forEach(m => modulesMap.set(m.id, []));

        extendedInfo.pildoras.forEach(p => {
          const targetModuleId = p.moduleId || firstModule.id;
          if (modulesMap.has(targetModuleId)) {
            modulesMap.get(targetModuleId).push(p);
          } else {
            modulesMap.get(firstModule.id).push(p);
          }
        });

        extendedInfo.modulesPildoras = Array.from(modulesMap.entries()).map(([mId, pList]) => {
          const m = promotion.modules.find(pm => pm.id === mId);
          return {
            moduleId: mId,
            moduleName: m ? m.name : 'Unknown Module',
            pildoras: pList
          };
        });

        await extendedInfo.save();
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

    // Sync flattened píldoras array for backward compatibility
    const allPildoras = [];
    extendedInfo.modulesPildoras.forEach(mp => {
      if (mp.pildoras) {
        allPildoras.push(...mp.pildoras);
      }
    });
    extendedInfo.pildoras = allPildoras;

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

// ─── Fichas de Seguimiento del Coder ──────────────────────────────────────────

// Helper: buscar estudiante por id custom o _id
async function findStudentByIdOrObjectId(studentId, promotionId) {
  let student = await Student.findOne({ id: studentId, promotionId });
  if (!student) {
    try { student = await Student.findOne({ _id: studentId, promotionId }); } catch (_) {}
  }
  return student;
}

// PUT /api/promotions/:promotionId/students/:studentId/ficha/personal
app.put('/api/promotions/:promotionId/students/:studentId/ficha/personal', verifyToken, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const student = await findStudentByIdOrObjectId(req.params.studentId, req.params.promotionId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const {
      name, lastname, email, phone, age, administrativeSituation,
      nationality, identificationDocument, gender, englishLevel,
      educationLevel, profession, community,
      isWithdrawn, withdrawal
    } = req.body;

    // Withdrawal-only update (no personal fields sent)
    if ((isWithdrawn !== undefined || withdrawal !== undefined) && !name) {
      const updated = await Student.findByIdAndUpdate(
        student._id,
        { $set: { isWithdrawn: !!isWithdrawn, withdrawal: withdrawal || null } },
        { new: true }
      );
      return res.json({ message: 'Estado de baja actualizado', student: updated });
    }

    // Validar obligatorios (solo nombre, apellido y email son imprescindibles)
    if (!name || !lastname || !email) {
      return res.status(400).json({ error: 'Faltan campos obligatorios: nombre, apellido y email' });
    }

    const updated = await Student.findByIdAndUpdate(
      student._id,
      { $set: {
        name, lastname, email,
        phone: phone || '',
        age: (age && !isNaN(Number(age))) ? Number(age) : null,
        administrativeSituation: administrativeSituation || '',
        nationality: nationality || '',
        identificationDocument: identificationDocument || '',
        gender: gender || '',
        englishLevel: englishLevel || '',
        educationLevel: educationLevel || '',
        profession: profession || '',
        community: community || '',
        ...(isWithdrawn !== undefined ? { isWithdrawn: !!isWithdrawn } : {}),
        ...(withdrawal !== undefined ? { withdrawal } : {})
      }},
      { new: true, runValidators: false }
    );

    res.json({ message: 'Datos personales actualizados', student: updated });
  } catch (error) {
    console.error('Error PUT ficha/personal:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/promotions/:promotionId/students/:studentId/ficha/technical
app.put('/api/promotions/:promotionId/students/:studentId/ficha/technical', verifyToken, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const student = await findStudentByIdOrObjectId(req.params.studentId, req.params.promotionId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const { teacherNotes, teams, competences, completedModules, completedPildoras } = req.body;

    const updated = await Student.findByIdAndUpdate(
      student._id,
      {
        'technicalTracking.teacherNotes': Array.isArray(teacherNotes) ? teacherNotes : student.technicalTracking?.teacherNotes || [],
        'technicalTracking.teams': Array.isArray(teams) ? teams : student.technicalTracking?.teams || [],
        'technicalTracking.competences': Array.isArray(competences) ? competences : student.technicalTracking?.competences || [],
        'technicalTracking.completedModules': Array.isArray(completedModules) ? completedModules : student.technicalTracking?.completedModules || [],
        'technicalTracking.completedPildoras': Array.isArray(completedPildoras) ? completedPildoras : student.technicalTracking?.completedPildoras || [],
      },
      { new: true }
    );

    res.json({ message: 'Seguimiento técnico actualizado', student: updated });
  } catch (error) {
    console.error('Error PUT ficha/technical:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/promotions/:promotionId/teams — Adds a team entry and propagates to all member students
app.post('/api/promotions/:promotionId/teams', verifyToken, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const { teamEntry, memberStudentIds } = req.body;
    // teamEntry: { teamName, projectType, role, moduleName, moduleId, assignedDate, members:[{id,name}] }
    // memberStudentIds: [studentId, ...] — all students to receive this entry (includes the current one)

    if (!teamEntry || !Array.isArray(memberStudentIds) || memberStudentIds.length === 0) {
      return res.status(400).json({ error: 'teamEntry and memberStudentIds are required' });
    }

    const results = [];
    for (const studentId of memberStudentIds) {
      const student = await findStudentByIdOrObjectId(studentId, req.params.promotionId);
      if (!student) continue;

      // Build the entry for this student: members = all teammates except themselves
      const entryForThisStudent = {
        ...teamEntry,
        members: (teamEntry.members || []).filter(m => m.id !== studentId)
      };

      // Avoid duplicate: same project in same module
      const existingTeams = student.technicalTracking?.teams || [];
      const alreadyExists = existingTeams.some(
        t => t.teamName === teamEntry.teamName && t.moduleId === teamEntry.moduleId
      );
      if (!alreadyExists) {
        existingTeams.push(entryForThisStudent);
        await Student.findByIdAndUpdate(student._id, {
          'technicalTracking.teams': existingTeams
        });
        results.push({ studentId, status: 'updated' });
      } else {
        results.push({ studentId, status: 'already_exists' });
      }
    }

    res.json({ message: 'Equipo propagado', results });
  } catch (error) {
    console.error('Error POST /teams:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/promotions/:promotionId/students/:studentId/ficha/transversal
app.put('/api/promotions/:promotionId/students/:studentId/ficha/transversal', verifyToken, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (!canEditPromotion(promotion, req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    const student = await findStudentByIdOrObjectId(req.params.studentId, req.params.promotionId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const { employabilitySessions, individualSessions, incidents } = req.body;

    const updated = await Student.findByIdAndUpdate(
      student._id,
      {
        'transversalTracking.employabilitySessions': Array.isArray(employabilitySessions) ? employabilitySessions : student.transversalTracking?.employabilitySessions || [],
        'transversalTracking.individualSessions': Array.isArray(individualSessions) ? individualSessions : student.transversalTracking?.individualSessions || [],
        'transversalTracking.incidents': Array.isArray(incidents) ? incidents : student.transversalTracking?.incidents || [],
      },
      { new: true }
    );

    res.json({ message: 'Seguimiento transversal actualizado', student: updated });
  } catch (error) {
    console.error('Error PUT ficha/transversal:', error);
    res.status(500).json({ error: error.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────

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
    const userId = req.user.id;
    if (!userId) return res.json([]);
    const teacherPromotions = await Promotion.find({
      $or: [{ teacherId: userId }, { collaborators: userId }]
    });
    res.json(teacherPromotions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/my-promotions-all', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    if (!userId) return res.json([]);
    const teacherPromotions = await Promotion.find({
      $or: [{ teacherId: userId }, { collaborators: userId }]
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
    const { name, description, startDate, endDate, weeks, modules, templateId } = req.body;
    if (!name || !weeks) return res.status(400).json({ error: 'Name and weeks are required' });

    // Build modules list: from body or from template
    let promotionModules = modules || [];
    let template = null;

    if (templateId) {
      // Use lean() to get plain JS objects — no Mongoose _id complications
      template = await BootcampTemplate.findOne({ id: templateId }).lean();
      console.log(`[POST /promotions] template found: ${template?.id}, modules: ${template?.modules?.length || 0}, competences: ${template?.competences?.length || 0}`);
      if (template && template.modules && template.modules.length > 0 && promotionModules.length === 0) {
        promotionModules = template.modules.map(m => ({
          id: uuidv4(),
          name: m.name,
          duration: m.duration,
          courses: (m.courses || []).map(({ name, url, duration, startOffset }) => ({ name, url, duration: duration || 1, startOffset: startOffset || 0 })),
          projects: (m.projects || []).map(({ name, url, duration, startOffset }) => ({ name, url, duration: duration || 1, startOffset: startOffset || 0 })),
          pildoras: []
        }));
      }
    }

    const promotion = await Promotion.create({
      id: uuidv4(),
      name,
      description,
      startDate,
      endDate,
      weeks,
      modules: promotionModules,
      employability: template ? (template.employability || []).map(({ name, url, startMonth, duration }) => ({ name, url, startMonth, duration })) : [],
      teacherId: req.user.id,
      collaborators: []
    });

    // If a template was selected, pre-populate ExtendedInfo from it
    if (template) {
      // Map module names → fresh IDs so competence startModule.id resolves correctly
      const moduleNameToId = {};
      promotionModules.forEach(m => { moduleNameToId[m.name] = m.id; });

      const mappedCompetences = (template.competences || []).map(c => ({
        id: c.id,
        area: c.area,
        name: c.name,
        description: c.description,
        levels: (c.levels || []).map(l => ({
          level: l.level,
          description: l.description,
          indicators: l.indicators || []
        })),
        allTools: c.allTools || [],
        selectedTools: c.selectedTools || [],
        startModule: c.startModule ? {
          id: moduleNameToId[c.startModule.name] || '',
          name: c.startModule.name || ''
        } : { id: '', name: '' }
      }));

      const mappedResources = (template.resources || []).map(({ title, category, url }) => ({ title, category, url }));

      const schedule = template.schedule || {};

      // Map template modulesPildoras: replace moduleName with fresh module IDs
      const mappedModulesPildoras = (template.modulesPildoras || []).map(mp => {
        const freshModuleId = moduleNameToId[mp.moduleName] || '';
        return {
          moduleId: freshModuleId,
          moduleName: mp.moduleName,
          pildoras: (mp.pildoras || []).map(p => ({
            title: p.title,
            mode: p.mode || 'Virtual',
            date: '',
            students: [],
            status: ''
          }))
        };
      });

      await ExtendedInfo.findOneAndUpdate(
        { promotionId: promotion.id },
        {
          $set: {
            schedule,
            evaluation: template.evaluation || '',
            resources: mappedResources,
            competences: mappedCompetences,
            school: template.school || '',
            projectType: template.projectType || '',
            totalHours: template.totalHours || '',
            modality: template.modality || '',
            materials: template.materials || '',
            internships: template.internships !== undefined && template.internships !== null ? template.internships : null,
            funders: template.funders || '',
            funderDeadlines: template.funderDeadlines || '',
            okrKpis: template.okrKpis || '',
            funderKpis: template.funderKpis || '',
            projectMeetings: template.projectMeetings || '',
            teamMeetings: template.teamMeetings || '',
            trainerDayOff: template.trainerDayOff || '',
            cotrainerDayOff: template.cotrainerDayOff || '',
            team: [],
            pildoras: [],
            modulesPildoras: mappedModulesPildoras.length > 0 ? mappedModulesPildoras : []
          }
        },
        { upsert: true, strict: false }
      );
    }

    res.status(201).json(promotion);
  } catch (error) {
    console.error('[POST /api/promotions] error:', error);
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
      return res.json({ schedule: {}, team: [], resources: [], evaluation: '', pildoras: [], pildorasAssignmentOpen: false });
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

    console.log('UPDATING EXTENDED INFO for promotion:', req.params.promotionId);
    console.log('ModulesPildoras present in request:', !!req.body.modulesPildoras);
    if (req.body.modulesPildoras) {
      console.log('ModulesPildoras count:', req.body.modulesPildoras.length);
    }

    const { schedule, team, resources, evaluation, pildoras, modulesPildoras, pildorasAssignmentOpen, competences,
            school, projectType, positiveExitStart, positiveExitEnd, totalHours,
            modality, presentialDays, materials, internships, funders, funderDeadlines,
            okrKpis, funderKpis, trainerDayOff, cotrainerDayOff, projectMeetings, teamMeetings,
            approvalName, approvalRole, projectEvaluations } = req.body;
    const normalizedPildoras = Array.isArray(pildoras) ? pildoras : [];
    const normalizedModulesPildoras = Array.isArray(modulesPildoras) ? modulesPildoras : [];
    const normalizedCompetences = Array.isArray(competences) ? competences : [];
    const normalizedProjectEvaluations = Array.isArray(projectEvaluations) ? projectEvaluations : undefined;
    console.log('[extended-info POST] competences to save:', JSON.stringify(normalizedCompetences.map(c => ({ name: c.name, startModule: c.startModule }))));
    const newInfo = await ExtendedInfo.findOneAndUpdate(
      { promotionId: req.params.promotionId },
      {
        $set: {
          schedule: schedule || {},
          team: team || [],
          resources: resources || [],
          evaluation: evaluation || '',
          pildoras: normalizedPildoras,
          modulesPildoras: normalizedModulesPildoras,
          pildorasAssignmentOpen: !!pildorasAssignmentOpen,
          competences: normalizedCompetences,
          school: school || '',
          projectType: projectType || '',
          positiveExitStart: positiveExitStart || '',
          positiveExitEnd: positiveExitEnd || '',
          totalHours: totalHours || '',
          modality: modality || '',
          presentialDays: presentialDays || '',
          materials: materials || '',
          internships: internships !== undefined ? internships : null,
          funders: funders || '',
          funderDeadlines: funderDeadlines || '',
          okrKpis: okrKpis || '',
          funderKpis: funderKpis || '',
          trainerDayOff: trainerDayOff || '',
          cotrainerDayOff: cotrainerDayOff || '',
          projectMeetings: projectMeetings || '',
          teamMeetings: teamMeetings || '',
          approvalName: approvalName || '',
          approvalRole: approvalRole || '',
          ...(normalizedProjectEvaluations !== undefined ? { projectEvaluations: normalizedProjectEvaluations } : {})
        }
      },
      { upsert: true, returnDocument: 'after', strict: false }
    );
    res.json(newInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== PUBLIC STUDENT ASSIGNMENT ====================

// Public students list (minimal info for dropdowns)
app.get('/api/promotions/:promotionId/public-students', async (req, res) => {
  try {
    const students = await Student.find({ promotionId: req.params.promotionId }, 'id name lastname');
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Public píldora self-assignment
app.put('/api/promotions/:promotionId/pildoras-self-assign', async (req, res) => {
  try {
    const { moduleId, pildoraIndex, studentId, action, isLegacy } = req.body; // action: 'add' or 'remove'
    if (pildoraIndex === undefined || !studentId) {
      return res.status(400).json({ error: 'pildoraIndex and studentId are required' });
    }

    const extendedInfo = await ExtendedInfo.findOne({ promotionId: req.params.promotionId });
    if (!extendedInfo || !extendedInfo.pildorasAssignmentOpen) {
      return res.status(403).json({ error: 'Self-assignment is currently closed by the teacher' });
    }

    const student = await Student.findOne({ id: studentId, promotionId: req.params.promotionId });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    let pildora;
    if (isLegacy) {
      if (!extendedInfo.pildoras || !extendedInfo.pildoras[pildoraIndex]) {
        return res.status(404).json({ error: 'Legacy píldora not found' });
      }
      pildora = extendedInfo.pildoras[pildoraIndex];
    } else {
      if (!moduleId) return res.status(400).json({ error: 'moduleId is required for module-based píldoras' });
      const modulePildoras = extendedInfo.modulesPildoras.find(m => m.moduleId === moduleId);
      if (!modulePildoras || !modulePildoras.pildoras[pildoraIndex]) {
        return res.status(404).json({ error: 'Píldora not found' });
      }
      pildora = modulePildoras.pildoras[pildoraIndex];
    }

    if (action === 'add') {
      // Avoid duplicates
      if (!pildora.students.some(s => s.id === studentId)) {
        pildora.students.push({
          id: student.id,
          name: student.name,
          lastname: student.lastname
        });
      }
    } else if (action === 'remove') {
      pildora.students = pildora.students.filter(s => s.id !== studentId);
    }

    await extendedInfo.save();
    res.json({ message: 'Assignment updated successfully', pildora });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== TEACHERS & COLLABORATORS ====================

app.get('/api/teachers', verifyToken, async (req, res) => {
  try {
    const teachers = await Teacher.find({}, 'id name email userRole');
    const result = teachers.map(t => ({
      id: t.id,
      name: t.name,
      email: t.email,
      userRole: t.userRole || 'Formador/a'
    }));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/promotions/:promotionId/collaborators', verifyToken, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });

    const collaboratorIds = promotion.collaborators || [];
    const collaborators = await Teacher.find({ id: { $in: collaboratorIds } }, 'id name email userRole');
    const owner = await Teacher.findOne({ id: promotion.teacherId }, 'id name email userRole');

    const result = [];
    if (owner) {
      result.push({
        id: owner.id, name: owner.name, email: owner.email,
        userRole: owner.userRole || 'Formador/a',
        isOwner: true,
        moduleIds: promotion.ownerModules || []
      });
    }
    collaborators.forEach(c => {
      const entry = (promotion.collaboratorModules || []).find(m => m.teacherId === c.id);
      result.push({
        id: c.id, name: c.name, email: c.email,
        userRole: c.userRole || 'Formador/a',
        isOwner: false,
        moduleIds: entry ? entry.moduleIds : []
      });
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/promotions/:promotionId/collaborators', verifyToken, async (req, res) => {
  try {
    const { teacherId, moduleIds } = req.body;
    console.log('[POST collaborators] teacherId:', teacherId, 'moduleIds:', moduleIds);
    if (!teacherId) return res.status(400).json({ error: 'Teacher ID is required' });

    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });

    if (promotion.teacherId !== req.user.id) return res.status(403).json({ error: 'Only owner can add collaborators' });
    if (teacherId === promotion.teacherId) return res.status(400).json({ error: 'Cannot add owner as collaborator' });

    if (!promotion.collaborators) promotion.collaborators = [];
    if (promotion.collaborators.includes(teacherId)) return res.status(400).json({ error: 'Teacher already a collaborator' });

    promotion.collaborators.push(teacherId);

    if (!promotion.collaboratorModules) promotion.collaboratorModules = [];
    const resolvedModuleIds = Array.isArray(moduleIds) ? moduleIds : [];
    promotion.collaboratorModules.push({ teacherId, moduleIds: resolvedModuleIds });
    promotion.markModified('collaborators');
    promotion.markModified('collaboratorModules');

    console.log('[POST collaborators] saving collaboratorModules:', JSON.stringify(promotion.collaboratorModules));
    await promotion.save();
    console.log('[POST collaborators] saved OK');
    const teacher = await Teacher.findOne({ id: teacherId }, 'id name email userRole');
    res.status(201).json({ message: 'Collaborator added', collaborator: teacher });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update module assignments for a collaborator or the owner
app.put('/api/promotions/:promotionId/collaborators/:teacherId/modules', verifyToken, async (req, res) => {
  try {
    const { moduleIds } = req.body;
    if (!Array.isArray(moduleIds)) return res.status(400).json({ error: 'moduleIds must be an array' });

    const promotion = await Promotion.findOne({ id: req.params.promotionId });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    if (promotion.teacherId !== req.user.id) return res.status(403).json({ error: 'Only owner can manage module assignments' });

    if (req.params.teacherId === promotion.teacherId) {
      promotion.ownerModules = moduleIds;
      promotion.markModified('ownerModules');
    } else {
      if (!promotion.collaboratorModules) promotion.collaboratorModules = [];
      const entry = promotion.collaboratorModules.find(m => m.teacherId === req.params.teacherId);
      if (entry) {
        entry.moduleIds = moduleIds;
      } else {
        promotion.collaboratorModules.push({ teacherId: req.params.teacherId, moduleIds });
      }
      promotion.markModified('collaboratorModules');
    }
    await promotion.save();
    res.json({ message: 'Module assignments updated' });
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
    promotion.collaboratorModules = (promotion.collaboratorModules || []).filter(m => m.teacherId !== req.params.teacherId);
    promotion.markModified('collaborators');
    promotion.markModified('collaboratorModules');
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

// Create a template from an existing promotion
app.post('/api/admin/templates-from-promotion', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { promotionId, templateName, templateDescription } = req.body;
    if (!promotionId || !templateName) {
      return res.status(400).json({ error: 'promotionId and templateName are required' });
    }

    const promotion = await Promotion.findOne({ id: promotionId }).lean();
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });

    const extInfo = await ExtendedInfo.findOne({ promotionId }).lean();

    const templateId = `custom-${uuidv4()}`;

    const templateData = {
      id: templateId,
      name: templateName,
      description: templateDescription || promotion.description || '',
      weeks: promotion.weeks || 36,
      hours: promotion.hours || 1250,
      hoursPerWeek: promotion.hoursPerWeek || Math.round((promotion.hours || 1250) / (promotion.weeks || 36)),
      isCustom: true,
      createdBy: req.user.id,
      // Modules from promotion (strip student-specific data, keep structure)
      modules: (promotion.modules || []).map(m => ({
        name: m.name,
        duration: m.duration,
        courses: (m.courses || []).map(({ name, url, duration, startOffset }) => ({ name, url: url || '', duration: duration || 1, startOffset: startOffset || 0 })),
        projects: (m.projects || []).map(({ name, url, duration, startOffset }) => ({ name, url: url || '', duration: duration || 1, startOffset: startOffset || 0 }))
      })),
      // Employability from promotion
      employability: (promotion.employability || []).map(({ name, url, startMonth, duration }) => ({ name, url: url || '', startMonth: startMonth || 1, duration: duration || 1 })),
      // All ExtendedInfo fields
      evaluation: extInfo?.evaluation || '',
      resources: (extInfo?.resources || []).map(({ title, category, url }) => ({ title, category, url })),
      competences: (extInfo?.competences || []).map(c => ({
        id: c.id,
        area: c.area,
        name: c.name,
        description: c.description,
        levels: (c.levels || []).map(l => ({ level: l.level, description: l.description, indicators: l.indicators || [] })),
        allTools: c.allTools || [],
        selectedTools: c.selectedTools || [],
        startModule: c.startModule ? { id: '', name: c.startModule.name || '' } : { id: '', name: '' }
      })),
      schedule: extInfo?.schedule || {},
      modulesPildoras: (extInfo?.modulesPildoras || []).map(mp => ({
        moduleName: mp.moduleName,
        pildoras: (mp.pildoras || []).map(p => ({ title: p.title, mode: p.mode || 'Virtual' }))
      })),
      school: extInfo?.school || '',
      projectType: extInfo?.projectType || '',
      totalHours: extInfo?.totalHours || String(promotion.hours || ''),
      modality: extInfo?.modality || '',
      materials: extInfo?.materials || '',
      internships: extInfo?.internships !== undefined ? extInfo.internships : null,
      funders: extInfo?.funders || '',
      funderDeadlines: extInfo?.funderDeadlines || '',
      okrKpis: extInfo?.okrKpis || '',
      funderKpis: extInfo?.funderKpis || '',
      projectMeetings: extInfo?.projectMeetings || '',
      teamMeetings: extInfo?.teamMeetings || '',
      trainerDayOff: extInfo?.trainerDayOff || '',
      cotrainerDayOff: extInfo?.cotrainerDayOff || ''
    };

    const template = await BootcampTemplate.findOneAndUpdate(
      { id: templateId },
      { $set: templateData },
      { upsert: true, strict: false, runValidators: false, returnDocument: 'after' }
    );

    res.status(201).json(template);
  } catch (error) {
    console.error('[POST /api/admin/templates-from-promotion]', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all promotions (admin view, with names)
app.get('/api/admin/all-promotions', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const promotions = await Promotion.find({}, 'id name weeks hours description teacherId').lean();
    res.json(promotions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
    const { email, name, userRole, externalUserId, provisionalPassword: clientPassword } = req.body;
    if (!email || !name) return res.status(400).json({ error: 'Email and name are required' });
    const existing = await Teacher.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered' });
    const provisionalPassword = clientPassword || (Math.random().toString(36).slice(-10) + 'A1!');
    const validUserRoles = ['Formador/a', 'CoFormador/a', 'Coordinador/a'];
    const resolvedUserRole = validUserRoles.includes(userRole) ? userRole : 'Formador/a';

    // Use Teacher.id = email (matches decoded.username from JWT = req.user.id on all requests)
    const localId = email;
    console.log('[POST /api/admin/teachers] Saving teacher:', email, 'id:', localId, 'externalNumericId:', externalUserId);

    const hashedPassword = await bcrypt.hash(provisionalPassword, 10);
    const teacher = await Teacher.create({ id: localId, name, email, password: hashedPassword, provisional: true, userRole: resolvedUserRole });

    // Send password email
    const emailSent = await sendPasswordEmail(email, name, provisionalPassword);
    const emailWarning = emailSent ? undefined : 'No se pudo enviar el correo con las credenciales.';

    res.status(201).json({
      message: 'Teacher created successfully.',
      teacher: { id: teacher.id, name: teacher.name, email: teacher.email },
      ...(emailWarning && { emailWarning }),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



app.put('/api/admin/teachers/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const validUserRoles = ['Formador/a', 'CoFormador/a', 'Coordinador/a'];
    const { name, email, userRole } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (userRole && validUserRoles.includes(userRole)) updates.userRole = userRole;
    const teacher = await Teacher.findOneAndUpdate(
      { id: req.params.id },
      { $set: updates },
      { new: true, runValidators: true }
    );
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