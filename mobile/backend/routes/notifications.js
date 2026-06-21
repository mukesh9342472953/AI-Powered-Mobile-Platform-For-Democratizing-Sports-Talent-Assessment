const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const auth = require('../middleware/auth');

// @route   GET api/notifications
// @desc    Get all notifications for logged-in user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const list = await query.all(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY date DESC',
      [req.user.id]
    );
    res.json(list);
  } catch (err) {
    console.error('Fetch Notifications Error:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/notifications/mark-read
// @desc    Mark all user notifications as read
// @access  Private
router.put('/mark-read', auth, async (req, res) => {
  try {
    await query.run(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
      [req.user.id]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/notifications/:id/read
// @desc    Mark single notification as read
// @access  Private
router.put('/:id/read', auth, async (req, res) => {
  try {
    await query.run(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/notifications/:id
// @desc    Delete a notification
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    await query.run(
      'DELETE FROM notifications WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

module.exports = router;
