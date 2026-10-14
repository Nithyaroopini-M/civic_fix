const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { detectCategory, calcPriorityScore } = require('../services/aiService');
const { sendStatusEmail } = require('../services/emailService');

// Category → Department mapping
const CATEGORY_DEPT = {
  'Pothole':        'Roads Department',
  'Cracks':         'Roads Department',
  'Street Light':   'Roads Department',
  'Garbage':        'Sanitation Department',
  'Open Manhole':   'Drainage Department',
  'Water Overflow': 'Drainage Department',
  'Other':          'Roads Department', // fallback to most common dept
};

// Find the worker in the right department with fewest open tasks
function autoAssignWorker(category) {
  const dept = CATEGORY_DEPT[category] || 'Roads Department';
  const worker = db.prepare(`
    SELECT u.id,
      COUNT(c.id) as open_tasks
    FROM users u
    LEFT JOIN complaints c ON c.assigned_worker_id = u.id
      AND c.status NOT IN ('Resolved','Rejected')
    WHERE u.role = 'worker' AND u.ward = ?
    GROUP BY u.id
    ORDER BY open_tasks ASC
    LIMIT 1
  `).get(dept);
  return worker ? worker.id : null;
}

// POST /api/complaints/preview
router.post('/preview', authenticate, authorize('user'), upload.single('photo'), async (req, res) => {
  const { description = '', folder_hint = '' } = req.body;
  const photoPath     = req.file ? req.file.path : null;
  const photoFilename = req.file ? req.file.originalname : '';
  const hintedFilename = folder_hint ? `${folder_hint}__${photoFilename}` : photoFilename;
  const ai = await detectCategory(description, photoPath, hintedFilename, folder_hint);
  if (photoPath) { const fs = require('fs'); try { fs.unlinkSync(photoPath) } catch {} }
  res.json({ ai_category: ai.category, ai_confidence: ai.confidence });
});

// POST /api/complaints — submit and auto-assign
router.post('/', authenticate, authorize('user'), upload.single('photo'), async (req, res) => {
  const { description, latitude, longitude, address, folder_hint = '' } = req.body;
  if (!description) return res.status(400).json({ error: 'Description required' });

  const photoUrl      = req.file ? `/uploads/${req.file.filename}` : null;
  const photoPath     = req.file ? req.file.path : null;
  const photoFilename = req.file ? req.file.originalname : '';

  let ai;
  try {
    ai = await detectCategory(description, photoPath, photoFilename, folder_hint);
  } catch (err) {
    console.error('AI detection error:', err);
    ai = { category: 'Other', confidence: 0.5 };
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  const priority = calcPriorityScore(ai.category, now, description);

  // Auto-assign to best available worker
  let workerId = null;
  try {
    workerId = autoAssignWorker(ai.category);
  } catch (err) {
    console.error('Auto-assign error:', err);
  }
  const status = workerId ? 'Pending Review' : 'Submitted';

  try {
    db.prepare(`
      INSERT INTO complaints
        (id,citizen_id,description,latitude,longitude,address,photo_url,
         ai_category,ai_confidence,category,priority_score,
         assigned_worker_id,status,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, req.user.id, description,
      latitude ? parseFloat(latitude) : null,
      longitude ? parseFloat(longitude) : null,
      address || null, photoUrl,
      ai.category, ai.confidence, ai.category, priority,
      workerId, status, now, now
    );
  } catch (err) {
    console.error('DB insert error:', err);
    return res.status(500).json({ error: 'Failed to save complaint: ' + err.message });
  }

  // Status history
  db.prepare('INSERT INTO status_history (id,complaint_id,status,changed_by) VALUES (?,?,?,?)')
    .run(uuidv4(), id, status, req.user.id);

  // Notify user
  const userMsg = workerId
    ? `Your complaint has been submitted and assigned for review. ID: ${id.slice(0,8)}`
    : `Your complaint has been submitted. ID: ${id.slice(0,8)}`;
  db.prepare('INSERT INTO notifications (id,user_id,message) VALUES (?,?,?)')
    .run(uuidv4(), req.user.id, userMsg);

  // Notify worker
  if (workerId) {
    db.prepare('INSERT INTO notifications (id,user_id,message) VALUES (?,?,?)')
      .run(uuidv4(), workerId, `New task for review: ${ai.category} complaint #${id.slice(0,8)}`);
    const worker = db.prepare('SELECT email FROM users WHERE id = ?').get(workerId);
    if (worker) sendStatusEmail(worker.email, id, 'Pending Review');
  }

  res.status(201).json({ id, ai_category: ai.category, ai_confidence: ai.confidence, status, assigned_worker_id: workerId });
});

// GET /api/complaints/mine
router.get('/mine', authenticate, authorize('user'), (req, res) => {
  const complaints = db.prepare(`
    SELECT c.*,
      (SELECT json_group_array(json_object('status',s.status,'created_at',s.created_at,'note',s.note))
       FROM status_history s WHERE s.complaint_id = c.id ORDER BY s.created_at) as timeline,
      r.stars, r.comment as rating_comment,
      w.name as worker_name
    FROM complaints c
    LEFT JOIN ratings r ON r.complaint_id = c.id
    LEFT JOIN users w ON w.id = c.assigned_worker_id
    WHERE c.citizen_id = ?
    ORDER BY c.created_at DESC
  `).all(req.user.id);
  res.json(complaints.map(c => ({ ...c, timeline: JSON.parse(c.timeline || '[]') })));
});

// GET /api/complaints/:id
router.get('/:id', authenticate, (req, res) => {
  const c = db.prepare('SELECT * FROM complaints WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'user' && c.citizen_id !== req.user.id)
    return res.status(403).json({ error: 'Forbidden' });
  const timeline = db.prepare(
    'SELECT * FROM status_history WHERE complaint_id = ? ORDER BY created_at'
  ).all(req.params.id);
  res.json({ ...c, timeline });
});

// POST /api/complaints/:id/rate
router.post('/:id/rate', authenticate, authorize('user'), (req, res) => {
  const { stars, comment } = req.body;
  if (!stars || stars < 1 || stars > 5)
    return res.status(400).json({ error: 'Stars must be 1-5' });
  const c = db.prepare('SELECT * FROM complaints WHERE id = ? AND citizen_id = ?')
    .get(req.params.id, req.user.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  if (c.status !== 'Resolved') return res.status(400).json({ error: 'Can only rate resolved complaints' });
  db.prepare('INSERT OR REPLACE INTO ratings (id,complaint_id,citizen_id,stars,comment) VALUES (?,?,?,?,?)')
    .run(uuidv4(), req.params.id, req.user.id, parseInt(stars), comment || null);
  res.json({ success: true });
});

module.exports = router;
