const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const auth = require('../middleware/auth');

// @route   GET api/dashboard
// @desc    Get comprehensive dashboard data for user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 1. Fetch user basics
    const user = await query.get('SELECT name, role FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    let dashboardData = {
      user: { name: user.name, role: user.role },
      notifications_count: 0,
      upcoming_events: []
    };

    // 2. Fetch Unread Notifications Count
    const notifResult = await query.get('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0', [userId]);
    dashboardData.notifications_count = notifResult ? notifResult.count : 0;

    // 3. Fetch Upcoming Events the user joined
    const upcomingEvents = await query.all(`
      SELECT e.id, e.title, e.date 
      FROM events e
      JOIN event_registrations er ON e.id = er.event_id
      WHERE er.user_id = ? AND e.date >= CURRENT_TIMESTAMP
      ORDER BY e.date ASC
      LIMIT 3
    `, [userId]);
    dashboardData.upcoming_events = upcomingEvents || [];

    // 4. Role-Specific Data (Athlete)
    if (user.role === 'athlete') {
      const athlete = await query.get('SELECT id FROM athletes WHERE user_id = ?', [userId]);
      
      if (athlete) {
        // Total Assessments
        const totalAssessments = await query.get('SELECT COUNT(*) as total FROM assessments WHERE athlete_id = ?', [athlete.id]);
        
        // Latest Assessment Score
        const latestAssessment = await query.get('SELECT * FROM assessments WHERE athlete_id = ? ORDER BY date DESC LIMIT 1', [athlete.id]);
        
        // Fitness Goals
        const fitnessGoals = await query.all('SELECT * FROM fitness_goals WHERE athlete_id = ? AND status = "active"', [athlete.id]);

        dashboardData.athlete_data = {
          total_assessments: totalAssessments ? totalAssessments.total : 0,
          latest_assessment: latestAssessment || null,
          fitness_goals: fitnessGoals || []
        };
      }
    }

    res.json(dashboardData);
  } catch (err) {
    console.error('Dashboard API Error:', err.message);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

module.exports = router;
