const express = require('express');
const router = express.Router();
const { query } = require('../config/db');

// @route   GET api/sports
// @desc    Get all sports from sports_master table
// @access  Public
router.get('/', async (req, res) => {
  try {
    const sportsList = await query.all('SELECT * FROM sports_master ORDER BY sport_name ASC');
    res.json(sportsList);
  } catch (err) {
    console.error('Fetch Sports Error:', err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
