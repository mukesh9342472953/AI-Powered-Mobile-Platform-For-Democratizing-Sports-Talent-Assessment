const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const auth = require('../middleware/auth');

// Helper middleware to restrict to Admins only
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied: Admin role required' });
  }
};

// Apply auth and admin check to all routes in this router
router.use(auth);
router.use(adminOnly);

// @route   GET api/admin/analytics
// @desc    Get counts and details of entities on the platform
// @access  Private (Admin only)
router.get('/analytics', async (req, res) => {
  try {
    const userCount = await query.get('SELECT COUNT(*) as count FROM users');
    const athleteCount = await query.get('SELECT COUNT(*) as count FROM athletes');
    const coachCount = await query.get('SELECT COUNT(*) as count FROM coaches');
    const recruiterCount = await query.get('SELECT COUNT(*) as count FROM recruiters');
    const videoCount = await query.get('SELECT COUNT(*) as count FROM videos');
    const assessmentCount = await query.get('SELECT COUNT(*) as count FROM assessments');
    const eventCount = await query.get('SELECT COUNT(*) as count FROM events');

    // Group users by role
    const rolesGroup = await query.all('SELECT role, COUNT(*) as count FROM users GROUP BY role');
    
    // Group assessments by sport
    const sportsGroup = await query.all('SELECT sport, COUNT(*) as count FROM videos GROUP BY sport');

    res.json({
      totalUsers: userCount.count,
      totalAthletes: athleteCount.count,
      totalCoaches: coachCount.count,
      totalRecruiters: recruiterCount.count,
      totalVideos: videoCount.count,
      totalAssessments: assessmentCount.count,
      totalEvents: eventCount.count,
      roles: rolesGroup,
      sportsDistribution: sportsGroup
    });
  } catch (err) {
    console.error('Admin Analytics Error:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/admin/users
// @desc    Get list of all users and their profile details
// @access  Private (Admin only)
router.get('/users', async (req, res) => {
  try {
    const users = await query.all('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC');
    
    const usersWithDetails = [];
    for (const u of users) {
      let details = {};
      if (u.role === 'athlete') {
        details = await query.get('SELECT * FROM athletes WHERE user_id = ?', [u.id]);
      } else if (u.role === 'coach') {
        details = await query.get('SELECT * FROM coaches WHERE user_id = ?', [u.id]);
      } else if (u.role === 'recruiter') {
        details = await query.get('SELECT * FROM recruiters WHERE user_id = ?', [u.id]);
      }
      usersWithDetails.push({ ...u, details });
    }

    res.json(usersWithDetails);
  } catch (err) {
    console.error('Admin Fetch Users Error:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/admin/users/:id
// @desc    Update a user and their role-specific profile details
// @access  Private (Admin only)
router.put('/users/:id', async (req, res) => {
  const userId = req.params.id;
  const { name, email, role, details } = req.body;

  try {
    // 1. Verify user exists
    const user = await query.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 2. Update users table basic fields
    await query.run(
      'UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), role = COALESCE(?, role) WHERE id = ?',
      [name, email, role, userId]
    );

    // 3. Update role details if provided
    if (details) {
      const activeRole = role || user.role;
      if (activeRole === 'athlete') {
        await query.run(
          `INSERT INTO athletes (user_id, sport, age, gender, height, weight, achievements, district, state)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET
             sport = COALESCE(excluded.sport, sport),
             age = COALESCE(excluded.age, age),
             gender = COALESCE(excluded.gender, gender),
             height = COALESCE(excluded.height, height),
             weight = COALESCE(excluded.weight, weight),
             achievements = COALESCE(excluded.achievements, achievements),
             district = COALESCE(excluded.district, district),
             state = COALESCE(excluded.state, state)`,
          [
            userId,
            details.sport || 'Other',
            details.age || 18,
            details.gender || 'Other',
            details.height || null,
            details.weight || null,
            details.achievements || '',
            details.district || 'Other',
            details.state || 'Other'
          ]
        );
      } else if (activeRole === 'coach') {
        await query.run(
          `INSERT INTO coaches (user_id, specialization, experience)
           VALUES (?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET
             specialization = COALESCE(excluded.specialization, specialization),
             experience = COALESCE(excluded.experience, experience)`,
          [userId, details.specialization || 'General', details.experience || 0]
        );
      } else if (activeRole === 'recruiter') {
        await query.run(
          `INSERT INTO recruiters (user_id, organization, sport_interest)
           VALUES (?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET
             organization = COALESCE(excluded.organization, organization),
             sport_interest = COALESCE(excluded.sport_interest, sport_interest)`,
          [userId, details.organization || 'General Academy', details.sport_interest || 'All']
        );
      }
    }

    res.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('Admin Update User Error:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/admin/users/:id
// @desc    Delete a user account and cascading profile rows
// @access  Private (Admin only)
router.delete('/users/:id', async (req, res) => {
  const userId = req.params.id;

  try {
    const user = await query.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Cascade deletes will happen if FOREIGN KEY support is active
    // But to be completely safe in SQLite, we do it manually or enable foreign keys
    await query.run('PRAGMA foreign_keys = ON');
    await query.run('DELETE FROM users WHERE id = ?', [userId]);

    res.json({ message: 'User and all associated data deleted successfully' });
  } catch (err) {
    console.error('Admin Delete User Error:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/admin/users/:id/status
// @desc    Toggle user status (active/disabled)
// @access  Private (Admin only)
router.put('/users/:id/status', async (req, res) => {
  const userId = req.params.id;
  const { status } = req.body;
  
  if (status !== 'active' && status !== 'disabled') {
    return res.status(400).json({ message: 'Invalid status value' });
  }

  try {
    const user = await query.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ message: 'User not found' });

    await query.run('UPDATE users SET status = ? WHERE id = ?', [status, userId]);
    res.json({ message: `User status updated to ${status}` });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/admin/users/:id/password
// @desc    Reset user password by admin
// @access  Private (Admin only)
router.put('/users/:id/password', async (req, res) => {
  const userId = req.params.id;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }

  try {
    const user = await query.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    await query.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
    res.json({ message: 'User password reset successfully' });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// @route   GET api/admin/events
// @desc    Get all events
// @access  Private (Admin only)
router.get('/events', async (req, res) => {
  try {
    const list = await query.all('SELECT * FROM events ORDER BY date DESC');
    res.json(list);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/admin/events/:id
// @desc    Delete an event
// @access  Private (Admin only)
router.delete('/events/:id', async (req, res) => {
  try {
    await query.run('DELETE FROM events WHERE id = ?', [req.params.id]);
    res.json({ message: 'Event deleted successfully' });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// @route   GET api/admin/assessments
// @desc    Get all assessments
// @access  Private (Admin only)
router.get('/assessments', async (req, res) => {
  try {
    const list = await query.all(`
      SELECT a.*, u.name as athlete_name, v.sport 
      FROM assessments a 
      JOIN athletes ath ON a.athlete_id = ath.id 
      JOIN users u ON ath.user_id = u.id 
      JOIN videos v ON a.video_id = v.id
      ORDER BY a.date DESC
    `);
    res.json(list);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/admin/assessments/:id
// @desc    Delete an assessment
// @access  Private (Admin only)
router.delete('/assessments/:id', async (req, res) => {
  try {
    await query.run('DELETE FROM assessments WHERE id = ?', [req.params.id]);
    res.json({ message: 'Assessment deleted successfully' });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

module.exports = router;
