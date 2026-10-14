const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { sendStatusEmail } = require('../services/emailService');

// GET /api/worker/tasks — includes Pending Review and active tasks
router.get('/tasks', authenticate, authorize('worker'), (req, res) => {
  const tasks = db.prepare(`
    SELECT c.*, u.name as citizen_name
    FROM complaints c
    LEFT JOIN users u ON u.id = c.citizen_id
    WHERE c.assigned_worker_id = ? AND c.status NOT IN ('Resolved','Rejected')
    ORDER BY c.priority_score DESC
  `).all(req.user.id);
  res.json(tasks);
});

// GET /api/worker/completed
router.get('/completed', authenticate, authorize('worker'), (req, res) => {
  const tasks = db.prepare(`
    SELECT c.*, u.name as citizen_name, r.stars, r.comment as rating_comment
    FROM complaints c
    LEFT JOIN users u ON u.id = c.citizen_id
    LEFT JOIN ratings r ON r.complaint_id = c.id
    WHERE c.assigned_worker_id = ? AND c.status IN ('Resolved','Rejected')
    ORDER BY c.resolved_at DESC
  `).all(req.user.id);
  res.json(tasks);
});

// PATCH /api/worker/tasks/:id/review — accept or reject a Pending Review task
router.patch('/tasks/:id/review', authenticate, authorize('worker'), (req, res) => {
  const { action, reason } = req.body;
  if (!['accept', 'reject'].includes(action))
    return res.status(400).json({ error: 'action must be "accept" or "reject"' });

  const c = db.prepare('SELECT * FROM complaints WHERE id = ? AND assigned_worker_id = ?')
    .get(req.params.id, req.user.id);
  if (!c) return res.status(404).json({ error: 'Task not found' });
  if (c.status !== 'Pending Review')
    return res.status(400).json({ error: 'Task is not pending review' });

  const now = new Date().toISOString();
  const newStatus = action === 'accept' ? 'Assigned' : 'Rejected';

  db.prepare(`UPDATE complaints SET status=?, reject_reason=?, updated_at=? WHERE id=?`)
    .run(newStatus, action === 'reject' ? (reason || 'Rejected by worker') : null, now, req.params.id);

  db.prepare('INSERT INTO status_history (id,complaint_id,status,changed_by,note) VALUES (?,?,?,?,?)')
    .run(uuidv4(), req.params.id, newStatus, req.user.id, reason || null);

  // notify citizen
  const citizen = db.prepare('SELECT email FROM users WHERE id = ?').get(c.citizen_id);
  const citizenMsg = action === 'accept'
    ? `Your complaint #${req.params.id.slice(0,8)} has been accepted by a field worker.`
    : `Your complaint #${req.params.id.slice(0,8)} was rejected. Reason: ${reason || 'Not specified'}`;
  db.prepare('INSERT INTO notifications (id,user_id,message) VALUES (?,?,?)')
    .run(uuidv4(), c.citizen_id, citizenMsg);
  if (citizen) sendStatusEmail(citizen.email, req.params.id, newStatus);

  res.json({ success: true, status: newStatus });
});

// PATCH /api/worker/tasks/:id — update status + optional after photo
router.patch('/tasks/:id', authenticate, authorize('worker'), upload.single('after_photo'), (req, res) => {
  const { status, note } = req.body;
  const allowed = ['In Progress', 'Resolved'];
  if (!allowed.includes(status))
    return res.status(400).json({ error: 'Status must be "In Progress" or "Resolved"' });

  const c = db.prepare('SELECT * FROM complaints WHERE id = ? AND assigned_worker_id = ?')
    .get(req.params.id, req.user.id);
  if (!c) return res.status(404).json({ error: 'Task not found' });
  if (c.status === 'Pending Review')
    return res.status(400).json({ error: 'Please accept the task before updating status' });

  const afterPhotoUrl = req.file ? `/uploads/${req.file.filename}` : c.after_photo_url;
  const now = new Date().toISOString();
  const resolvedAt = status === 'Resolved' ? now : c.resolved_at;

  db.prepare(`
    UPDATE complaints SET status=?, after_photo_url=?, worker_note=?, updated_at=?, resolved_at=?
    WHERE id=?
  `).run(status, afterPhotoUrl, note || c.worker_note, now, resolvedAt, req.params.id);

  db.prepare('INSERT INTO status_history (id,complaint_id,status,changed_by,note) VALUES (?,?,?,?,?)')
    .run(uuidv4(), req.params.id, status, req.user.id, note || null);

  // notify citizen
  const citizen = db.prepare('SELECT email FROM users WHERE id = ?').get(c.citizen_id);
  db.prepare('INSERT INTO notifications (id,user_id,message) VALUES (?,?,?)')
    .run(uuidv4(), c.citizen_id, `Complaint #${req.params.id.slice(0,8)} is now: ${status}`);
  if (citizen) sendStatusEmail(citizen.email, req.params.id, status);

  res.json({ success: true });
});

module.exports = router;

