const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const auth = require('../middleware/auth');

// @route   GET api/coaches/athletes
// @desc    Get all athletes with their profiles (for coaches and recruiters)
// @access  Private (Coach or Recruiter only)
router.get('/athletes', auth, async (req, res) => {
  if (req.user.role !== 'coach' && req.user.role !== 'recruiter' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Authorization denied' });
  }

  try {
    const list = await query.all(
      `SELECT a.*, u.name, u.email, r.score as best_score, r.district_rank, r.state_rank, r.national_rank
       FROM athletes a
       JOIN users u ON a.user_id = u.id
       LEFT JOIN leaderboard r ON a.id = r.athlete_id
       ORDER BY r.score DESC`
    );
    res.json(list);
  } catch (err) {
    console.error('Coaches Fetch Athletes Error:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/coaches/feedback
// @desc    Submit coach feedback for an athlete
// @access  Private (Coach only)
router.post('/feedback', auth, async (req, res) => {
  if (req.user.role !== 'coach') {
    return res.status(403).json({ message: 'Only coaches can submit performance reviews' });
  }

  const { athlete_id, feedback, rating } = req.body;
  if (!athlete_id || !feedback || rating === undefined) {
    return res.status(400).json({ message: 'Please provide athlete_id, feedback, and rating' });
  }

  try {
    const coach = await query.get('SELECT id FROM coaches WHERE user_id = ?', [req.user.id]);
    if (!coach) {
      return res.status(404).json({ message: 'Coach profile not found' });
    }

    // Insert into coach_feedback table
    const feedbackResult = await query.run(
      `INSERT INTO coach_feedback (coach_id, athlete_id, feedback, rating)
       VALUES (?, ?, ?, ?)`,
      [coach.id, athlete_id, feedback, parseFloat(rating)]
    );

    // Notify Athlete
    const targetAthlete = await query.get('SELECT user_id FROM athletes WHERE id = ?', [athlete_id]);
    if (targetAthlete) {
      const coachUser = await query.get('SELECT name FROM users WHERE id = ?', [req.user.id]);
      await query.run(
        'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
        [targetAthlete.user_id, `Coach ${coachUser.name} left feedback on your profile.`]
      );
    }

    res.json({
      message: 'Feedback submitted successfully',
      feedbackId: feedbackResult.lastID
    });
  } catch (err) {
    console.error('Submit Feedback Error:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/coaches/feedback/:athleteId
// @desc    Get feedback records for an athlete
// @access  Private
router.get('/feedback/:athleteId', auth, async (req, res) => {
  try {
    const feedback = await query.all(
      `SELECT f.*, u.name as coach_name, c.specialization, a.score as assessment_score, v.sport
       FROM feedback f
       JOIN coaches c ON f.coach_id = c.id
       JOIN users u ON c.user_id = u.id
       JOIN assessments a ON f.assessment_id = a.id
       JOIN videos v ON a.video_id = v.id
       WHERE f.athlete_id = ?
       ORDER BY f.date DESC`,
      [req.params.athleteId]
    );
    res.json(feedback);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/coaches/me
// @desc    Update coach profile
// @access  Private (Coach only)
router.put('/me', auth, async (req, res) => {
  if (req.user.role !== 'coach') {
    return res.status(403).json({ message: 'Only coaches can modify this profile' });
  }

  const { specialization, experience } = req.body;
  try {
    const coach = await query.get('SELECT id FROM coaches WHERE user_id = ?', [req.user.id]);
    if (!coach) {
      return res.status(404).json({ message: 'Coach profile not found' });
    }

    await query.run(
      'UPDATE coaches SET specialization = COALESCE(?, specialization), experience = COALESCE(?, experience) WHERE id = ?',
      [specialization, experience, coach.id]
    );

    const updated = await query.get('SELECT * FROM coaches WHERE id = ?', [coach.id]);
    res.json(updated);
  } catch (err) {
    console.error('Update Coach Error:', err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
