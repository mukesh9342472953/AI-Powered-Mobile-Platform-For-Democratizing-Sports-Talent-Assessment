const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const auth = require('../middleware/auth');

// @route   GET api/leaderboard
// @desc    Get leaderboard rankings dynamically sorted, filtered, paginated
// @access  Private
router.get('/', auth, async (req, res) => {
  const { sport, level, sortBy, age, search, page = 1, limit = 20 } = req.query; // level: 'district', 'state', 'national'
  
  if (!sport) return res.status(400).json({ message: 'Sport is required' });

  try {
    const user = await query.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Default geo variables
    let userDistrict = 'Unknown';
    let userState = 'Unknown';

    if (user.role === 'athlete') {
        const athleteProfile = await query.get('SELECT district, state FROM athletes WHERE user_id = ?', [req.user.id]);
        if (athleteProfile) {
            userDistrict = athleteProfile.district;
            userState = athleteProfile.state;
        }
    }

    let sql = `
      SELECT r.*, u.name as athlete_name, u.profile_photo, a.age
      FROM leaderboards r
      JOIN athletes a ON r.athlete_id = a.id
      JOIN users u ON a.user_id = u.id
      WHERE LOWER(r.sport) = LOWER(?)
    `;
    const params = [sport];

    // Geo Filters
    if (level === 'district') {
      sql += ' AND LOWER(r.district) = LOWER(?)';
      params.push(userDistrict);
    } else if (level === 'state') {
      sql += ' AND LOWER(r.state) = LOWER(?)';
      params.push(userState);
    }
    // if 'national', no geo filter

    // Search Filter
    if (search && search.trim().length > 0) {
      sql += ' AND LOWER(u.name) LIKE ?';
      params.push(`%${search.trim().toLowerCase()}%`);
    }

    // Age Filter (U-15, U-18, U-21, Adult)
    if (age && age !== 'all') {
      if (age === 'u15') {
        sql += ' AND a.age <= 15';
      } else if (age === 'u18') {
        sql += ' AND a.age <= 18';
      } else if (age === 'u21') {
        sql += ' AND a.age <= 21';
      } else if (age === 'adult') {
        sql += ' AND a.age > 21';
      }
    }

    // Dynamic sorting
    let sortColumn = 'overall_score';
    if (sortBy === 'speed') sortColumn = 'speed_score';
    if (sortBy === 'fitness') sortColumn = 'fitness_score';

    sql += ` ORDER BY r.${sortColumn} DESC`;

    // Pagination
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;
    
    sql += ' LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    const list = await query.all(sql, params);
    
    // Calculate accurate active rank globally (since pagination breaks simple idx)
    // Actually, dynamic ranks shouldn't break across pages if we want them globally consistent, 
    // but calculating global rank in SQLite easily is hard. For now, we will trust the client to render the continuous number or pass back the offset.
    const formattedList = list.map((item, idx) => ({
      ...item,
      active_rank: offset + idx + 1
    }));

    res.json({
        success: true,
        page: pageNum,
        limit: limitNum,
        rankings: formattedList,
        hasMore: formattedList.length === limitNum
    });
  } catch (err) {
    console.error('Leaderboard Fetch Error:', err.message);
    res.status(500).json({ success: false, message: 'Server Error loading leaderboard' });
  }
});

module.exports = router;
