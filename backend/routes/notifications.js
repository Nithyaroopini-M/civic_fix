const router = require('express').Router();
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');

// GET /api/notifications
router.get('/', authenticate, (req, res) => {
  const notes = db.prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(req.user.id);
  res.json(notes);
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', authenticate, (req, res) => {
  db.prepare('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?')
    .run(req.params.id, req.user.id);
  res.json({ success: true });
});

// PATCH /api/notifications/read-all
router.patch('/read-all', authenticate, (req, res) => {
  db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(req.user.id);
  res.json({ success: true });
});

module.exports = router;
