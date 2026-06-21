const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const auth = require('../middleware/auth');

// @route   GET api/recruitment/search
// @desc    Search and filter athletes for recruitment
// @access  Private (Recruiter, Coach or Admin)
router.get('/search', auth, async (req, res) => {
  const { sport, minScore, maxAge, state, district } = req.query;

  try {
    let recruiterId = null;
    if (req.user.role === 'recruiter') {
      const recruiter = await query.get('SELECT id FROM recruiters WHERE user_id = ?', [req.user.id]);
      if (recruiter) recruiterId = recruiter.id;
    }

    let sql = `
      SELECT a.*, u.name, u.email, r.score as best_score, r.district_rank, r.state_rank, r.national_rank
      ${recruiterId ? ', CASE WHEN rf.id IS NOT NULL THEN 1 ELSE 0 END as is_favorite' : ''}
      FROM athletes a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN leaderboard r ON a.id = r.athlete_id
      ${recruiterId ? `LEFT JOIN recruiter_favorites rf ON rf.athlete_id = a.id AND rf.recruiter_id = ${recruiterId}` : ''}
      WHERE 1=1
    `;
    const params = [];

    if (sport && sport !== 'all') {
      sql += ' AND LOWER(a.sport) = LOWER(?)';
      params.push(sport);
    }
    
    if (minScore) {
      sql += ' AND r.score >= ?';
      params.push(parseInt(minScore));
    }

    if (maxAge) {
      sql += ' AND a.age <= ?';
      params.push(parseInt(maxAge));
    }

    if (state && state !== 'all') {
      sql += ' AND LOWER(a.state) = LOWER(?)';
      params.push(state);
    }

    if (district && district !== 'all') {
      sql += ' AND LOWER(a.district) = LOWER(?)';
      params.push(district);
    }

    sql += ' ORDER BY r.score DESC';

    const results = await query.all(sql, params);
    res.json(results);
  } catch (err) {
    console.error('Scouting Search Error:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/recruitment/contact
// @desc    Send contact interest from recruiter to athlete
// @access  Private (Recruiter only)
router.post('/contact', auth, async (req, res) => {
  if (req.user.role !== 'recruiter') {
    return res.status(403).json({ message: 'Only academies or scouts can initiate contact requests' });
  }

  const { athlete_id, message } = req.body;
  if (!athlete_id || !message) {
    return res.status(400).json({ message: 'Please specify athlete_id and details of contact interest' });
  }

  try {
    const recruiterUser = await query.get('SELECT name, email FROM users WHERE id = ?', [req.user.id]);
    const recruiter = await query.get('SELECT id FROM recruiters WHERE user_id = ?', [req.user.id]);
    if (!recruiter) {
      return res.status(404).json({ message: 'Recruiter profile not found' });
    }

    const targetAthlete = await query.get('SELECT user_id, id FROM athletes WHERE id = ?', [athlete_id]);
    if (!targetAthlete) {
      return res.status(404).json({ message: 'Athlete not found' });
    }

    // Save message to database
    await query.run(
      'INSERT INTO recruitment_messages (recruiter_id, athlete_id, message) VALUES (?, ?, ?)',
      [recruiter.id, athlete_id, message]
    );

    // Add alert notification for athlete
    const contactNotice = `Recruiter "${recruiterUser.name}" is interested in recruiting you! Message: "${message}". Contact them at: ${recruiterUser.email}`;
    await query.run(
      'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
      [targetAthlete.user_id, contactNotice]
    );

    res.json({
      message: 'Recruitment contact request sent successfully',
      sentDetails: {
        to_athlete_id: athlete_id,
        recruiter_name: recruiterUser.name,
        email_sent: recruiterUser.email
      }
    });
  } catch (err) {
    console.error('Scouting Contact Request Error:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/recruitment/messages
// @desc    Get recruitment messages for recruiter (sent) or athlete (received)
// @access  Private
router.get('/messages', auth, async (req, res) => {
  try {
    if (req.user.role === 'recruiter') {
      const recruiter = await query.get('SELECT id FROM recruiters WHERE user_id = ?', [req.user.id]);
      if (!recruiter) return res.status(404).json({ message: 'Recruiter profile not found' });
      const messages = await query.all(
        `SELECT rm.*, u.name as athlete_name, a.sport 
         FROM recruitment_messages rm
         JOIN athletes a ON rm.athlete_id = a.id
         JOIN users u ON a.user_id = u.id
         WHERE rm.recruiter_id = ?
         ORDER BY rm.date DESC`,
        [recruiter.id]
      );
      res.json(messages);
    } else if (req.user.role === 'athlete') {
      const athlete = await query.get('SELECT id FROM athletes WHERE user_id = ?', [req.user.id]);
      if (!athlete) return res.status(404).json({ message: 'Athlete profile not found' });
      const messages = await query.all(
        `SELECT rm.*, u.name as recruiter_name, r.organization
         FROM recruitment_messages rm
         JOIN recruiters r ON rm.recruiter_id = r.id
         JOIN users u ON r.user_id = u.id
         WHERE rm.athlete_id = ?
         ORDER BY rm.date DESC`,
        [athlete.id]
      );
      res.json(messages);
    } else {
      res.status(403).json({ message: 'Authorization denied' });
    }
  } catch (err) {
    console.error('Fetch Recruitment Messages Error:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/recruitment/me
// @desc    Update recruiter profile
// @access  Private (Recruiter only)
router.put('/me', auth, async (req, res) => {
  if (req.user.role !== 'recruiter') {
    return res.status(403).json({ message: 'Only recruiters can modify this profile' });
  }

  const { organization, sport_interest } = req.body;
  try {
    const recruiter = await query.get('SELECT id FROM recruiters WHERE user_id = ?', [req.user.id]);
    if (!recruiter) {
      return res.status(404).json({ message: 'Recruiter profile not found' });
    }

    await query.run(
      'UPDATE recruiters SET organization = COALESCE(?, organization), sport_interest = COALESCE(?, sport_interest) WHERE id = ?',
      [organization, sport_interest, recruiter.id]
    );

    const updated = await query.get('SELECT * FROM recruiters WHERE id = ?', [recruiter.id]);
    res.json(updated);
  } catch (err) {
    console.error('Update Recruiter Error:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/recruitment/favorites
// @desc    Toggle favorite athlete for recruiter
// @access  Private (Recruiter only)
router.post('/favorites', auth, async (req, res) => {
  if (req.user.role !== 'recruiter') {
    return res.status(403).json({ message: 'Only recruiters can save favorites' });
  }

  const { athlete_id } = req.body;
  if (!athlete_id) return res.status(400).json({ message: 'athlete_id is required' });

  try {
    const recruiter = await query.get('SELECT id FROM recruiters WHERE user_id = ?', [req.user.id]);
    if (!recruiter) return res.status(404).json({ message: 'Recruiter profile not found' });

    const existing = await query.get('SELECT id FROM recruiter_favorites WHERE recruiter_id = ? AND athlete_id = ?', [recruiter.id, athlete_id]);
    
    if (existing) {
      await query.run('DELETE FROM recruiter_favorites WHERE id = ?', [existing.id]);
      res.json({ message: 'Removed from favorites', is_favorite: false });
    } else {
      await query.run('INSERT INTO recruiter_favorites (recruiter_id, athlete_id) VALUES (?, ?)', [recruiter.id, athlete_id]);
      res.json({ message: 'Added to favorites', is_favorite: true });
    }
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// @route   GET api/recruitment/favorites
// @desc    Get favorite athletes for recruiter
// @access  Private (Recruiter only)
router.get('/favorites', auth, async (req, res) => {
  if (req.user.role !== 'recruiter') {
    return res.status(403).json({ message: 'Only recruiters can view favorites' });
  }

  try {
    const recruiter = await query.get('SELECT id FROM recruiters WHERE user_id = ?', [req.user.id]);
    if (!recruiter) return res.status(404).json({ message: 'Recruiter profile not found' });

    const favorites = await query.all(
      `SELECT a.*, u.name, u.email, r.score as best_score, 1 as is_favorite
       FROM recruiter_favorites rf
       JOIN athletes a ON rf.athlete_id = a.id
       JOIN users u ON a.user_id = u.id
       LEFT JOIN leaderboard r ON a.id = r.athlete_id
       WHERE rf.recruiter_id = ?
       ORDER BY rf.created_at DESC`,
      [recruiter.id]
    );
    res.json(favorites);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

module.exports = router;
