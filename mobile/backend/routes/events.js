const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const auth = require('../middleware/auth');

// @route   GET api/events
// @desc    Get all events with capacity and search filter
// @access  Private
router.get('/', auth, async (req, res) => {
  const { search } = req.query;
  
  try {
    let sql = `
      SELECT e.*, 
             (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id) as reg_count 
      FROM events e 
      WHERE e.status != 'completed'
    `;
    const params = [];
    
    if (search && search.trim().length > 0) {
      sql += ' AND LOWER(e.title) LIKE ?';
      params.push(`%${search.trim().toLowerCase()}%`);
    }

    sql += ' ORDER BY e.date ASC';
    
    const list = await query.all(sql, params);
    res.json({ success: true, events: list });
  } catch (err) {
    console.error('Fetch Events Error:', err.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// @route   POST api/events
// @desc    Create an event
// @access  Private
router.post('/', auth, async (req, res) => {
  const { title, description, venue, date, organizer, capacity } = req.body;
  if (!title || !venue || !date || !organizer) {
    return res.status(400).json({ message: 'Please provide title, venue, date, and organizer' });
  }

  const eventCapacity = capacity ? parseInt(capacity, 10) : 100;

  try {
    const result = await query.run(
      'INSERT INTO events (title, description, venue, date, organizer, capacity, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [title, description || '', venue, date, organizer, eventCapacity, 'upcoming']
    );

    res.json({
      message: 'Event created successfully',
      eventId: result.lastID
    });
  } catch (err) {
    console.error('Create Event Error:', err.message);
    res.status(500).json({ message: 'Server Error creating event' });
  }
});

// @route   POST api/events/join
// @desc    Register to join an event (enforces capacity)
// @access  Private
router.post('/join', auth, async (req, res) => {
  const { eventId } = req.body;
  if (!eventId) return res.status(400).json({ message: 'Event ID required' });

  try {
    const event = await query.get('SELECT * FROM events WHERE id = ?', [eventId]);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    if (event.status === 'completed') {
        return res.status(400).json({ message: 'Event is already completed.' });
    }

    const regCountObj = await query.get('SELECT COUNT(*) as count FROM event_registrations WHERE event_id = ?', [eventId]);
    const currentRegs = regCountObj.count;

    if (currentRegs >= event.capacity) {
        return res.status(400).json({ message: 'Event is at full capacity.' });
    }

    await query.run(
      'INSERT INTO event_registrations (event_id, user_id) VALUES (?, ?)',
      [eventId, req.user.id]
    );

    res.json({ message: 'Joined event successfully' });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ message: 'You have already joined this event' });
    }
    console.error('Join Event Error:', err.message);
    res.status(500).json({ message: 'Server Error joining event' });
  }
});

// @route   POST api/events/cancel
// @desc    Cancel event registration
// @access  Private
router.post('/cancel', auth, async (req, res) => {
  const { eventId } = req.body;
  if (!eventId) return res.status(400).json({ message: 'Event ID required' });

  try {
    const result = await query.run(
      'DELETE FROM event_registrations WHERE event_id = ? AND user_id = ?',
      [eventId, req.user.id]
    );
    
    if (result.changes === 0) {
       return res.status(400).json({ message: 'You are not registered for this event' });
    }

    res.json({ message: 'Registration cancelled successfully' });
  } catch (err) {
    console.error('Cancel Event Error:', err.message);
    res.status(500).json({ message: 'Server Error cancelling registration' });
  }
});

// @route   GET api/events/registrations
// @desc    Get user's registered event IDs
// @access  Private
router.get('/registrations', auth, async (req, res) => {
  try {
    const list = await query.all('SELECT event_id FROM event_registrations WHERE user_id = ?', [req.user.id]);
    res.json(list.map(item => item.event_id));
  } catch (err) {
    console.error('Get Registrations Error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
