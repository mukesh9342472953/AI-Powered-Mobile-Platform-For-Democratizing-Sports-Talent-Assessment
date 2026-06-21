const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const auth = require('../middleware/auth');

// @route   GET api/athletes/profile
// @desc    Get current athlete's profile exactly as specified
// @access  Private (Athlete only)
router.get('/profile', auth, async (req, res) => {
  if (req.user.role !== 'athlete') return res.status(403).json({ message: 'Access denied' });
  try {
    const athlete = await query.get('SELECT * FROM athletes WHERE user_id = ?', [req.user.id]);
    if (!athlete) return res.status(404).json({ message: 'Profile not found' });
    res.json(athlete);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// @route   POST api/athletes/profile
// @desc    Create athlete profile
// @access  Private (Athlete only)
router.post('/profile', auth, async (req, res) => {
  if (req.user.role !== 'athlete') return res.status(403).json({ message: 'Access denied' });
  const { sport, age, gender, district, state, achievements } = req.body;
  try {
    const existing = await query.get('SELECT id FROM athletes WHERE user_id = ?', [req.user.id]);
    if (existing) return res.status(400).json({ message: 'Profile already exists' });

    await query.run(
      'INSERT INTO athletes (user_id, sport, age, gender, district, state, achievements) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, sport, age, gender, district, state, achievements]
    );
    res.json({ message: 'Profile created' });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/athletes/profile
// @desc    Update athlete profile exactly as specified
// @access  Private (Athlete only)
router.put('/profile', auth, async (req, res) => {
  if (req.user.role !== 'athlete') return res.status(403).json({ message: 'Access denied' });
  const { sport, age, gender, district, state, achievements } = req.body;
  try {
    const existing = await query.get('SELECT id FROM athletes WHERE user_id = ?', [req.user.id]);
    if (!existing) {
      // Fallback to create
      await query.run(
        'INSERT INTO athletes (user_id, sport, age, gender, district, state, achievements) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [req.user.id, sport, age, gender, district, state, achievements]
      );
      return res.json({ message: 'Profile created' });
    }

    await query.run(
      `UPDATE athletes SET sport = COALESCE(?, sport), age = COALESCE(?, age), gender = COALESCE(?, gender), 
       district = COALESCE(?, district), state = COALESCE(?, state), achievements = COALESCE(?, achievements) 
       WHERE user_id = ?`,
      [sport, age, gender, district, state, achievements, req.user.id]
    );
    res.json({ message: 'Profile updated' });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

const multer = require('multer');
const path = require('path');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: function (req, file, cb) {
    cb(null, 'athlete-profile-' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// @route   POST api/athletes/profile/image
// @desc    Upload profile_image for athlete
// @access  Private (Athlete only)
router.post('/profile/image', auth, upload.single('photo'), async (req, res) => {
  if (req.user.role !== 'athlete') return res.status(403).json({ message: 'Access denied' });
  if (!req.file) return res.status(400).json({ message: 'Please upload an image file' });
  try {
    const photoPath = `/uploads/${req.file.filename}`;
    await query.run('UPDATE athletes SET profile_image = ? WHERE user_id = ?', [photoPath, req.user.id]);
    res.json({ message: 'Profile picture updated', profile_image: photoPath });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/athletes/me
// @desc    Update current athlete profile details
// @access  Private (Athlete only)
router.put('/me', auth, async (req, res) => {
  if (req.user.role !== 'athlete') {
    return res.status(403).json({ message: 'Only athletes can modify this profile' });
  }

  const { sport, age, gender, height, weight, achievements, district, state } = req.body;

  try {
    const athlete = await query.get('SELECT id FROM athletes WHERE user_id = ?', [req.user.id]);
    if (!athlete) {
      return res.status(404).json({ message: 'Athlete profile not found' });
    }

    await query.run(
      `UPDATE athletes 
       SET sport = COALESCE(?, sport),
           age = COALESCE(?, age),
           gender = COALESCE(?, gender),
           height = COALESCE(?, height),
           weight = COALESCE(?, weight),
           achievements = COALESCE(?, achievements),
           district = COALESCE(?, district),
           state = COALESCE(?, state)
       WHERE id = ?`,
      [sport, age, gender, height, weight, achievements, district, state, athlete.id]
    );

    // Update leaderboard table sport if it changed
    if (sport) {
      await query.run('UPDATE leaderboard SET sport = ? WHERE athlete_id = ?', [sport, athlete.id]);
    }

    const updatedAthlete = await query.get('SELECT * FROM athletes WHERE id = ?', [athlete.id]);
    res.json(updatedAthlete);
  } catch (err) {
    console.error('Update Athlete Error:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/athletes/profile/:id
// @desc    Get public athlete profile by Athlete ID
// @access  Private
router.get('/profile/:id', auth, async (req, res) => {
  try {
    const athlete = await query.get(
      `SELECT a.*, u.name, u.email 
       FROM athletes a 
       JOIN users u ON a.user_id = u.id 
       WHERE a.id = ?`,
      [req.params.id]
    );
    if (!athlete) {
      return res.status(404).json({ message: 'Athlete not found' });
    }

    const assessments = await query.all('SELECT * FROM assessments WHERE athlete_id = ? ORDER BY date DESC', [athlete.id]);
    const rankings = await query.get('SELECT * FROM leaderboard WHERE athlete_id = ?', [athlete.id]);
    const feedback = await query.all(
      `SELECT f.*, u.name as coach_name 
       FROM feedback f
       JOIN coaches c ON f.coach_id = c.id
       JOIN users u ON c.user_id = u.id
       WHERE f.athlete_id = ? 
       ORDER BY f.date DESC`,
      [athlete.id]
    );

    res.json({ athlete, assessments, rankings, feedback });
  } catch (err) {
    console.error('Get Athlete Profile Error:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/athletes/dashboard
// @desc    Get dashboard summary data for logged-in athlete
// @access  Private (Athlete only)
router.get('/dashboard', auth, async (req, res) => {
  try {
    const athlete = await query.get('SELECT * FROM athletes WHERE user_id = ?', [req.user.id]);
    if (!athlete) {
      return res.status(404).json({ message: 'Athlete profile not found' });
    }

    const assessments = await query.all('SELECT * FROM assessments WHERE athlete_id = ? ORDER BY date DESC', [athlete.id]);
    const rankings = await query.get('SELECT * FROM leaderboard WHERE athlete_id = ?', [athlete.id]);
    
    const fitnessLogs = await query.all('SELECT * FROM fitness_logs WHERE athlete_id = ? ORDER BY date DESC LIMIT 7', [athlete.id]);
    const fitnessGoals = await query.all('SELECT * FROM fitness_goals WHERE athlete_id = ? ORDER BY start_date DESC', [athlete.id]);
    const gpsLogs = await query.all('SELECT * FROM gps_logs WHERE athlete_id = ? ORDER BY date DESC LIMIT 7', [athlete.id]);
    const injuries = await query.all('SELECT * FROM injuries WHERE athlete_id = ? ORDER BY date DESC', [athlete.id]);

    const latestFeedback = await query.all(
      `SELECT f.*, u.name as coach_name 
       FROM feedback f 
       JOIN coaches c ON f.coach_id = c.id
       JOIN users u ON c.user_id = u.id
       WHERE f.athlete_id = ? 
       ORDER BY f.date DESC LIMIT 3`,
      [athlete.id]
    );

    res.json({
      athlete,
      assessments,
      rankings,
      fitnessLogs,
      fitnessGoals,
      gpsLogs,
      injuries,
      latestFeedback
    });
  } catch (err) {
    console.error('Athlete Dashboard Error:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/athletes/fitness
// @desc    Log a fitness activity (calorie & BMI calculations)
// @access  Private (Athlete only)
router.post('/fitness', auth, async (req, res) => {
  const { activity, duration_mins, weight_kg, height_cm } = req.body;
  if (!activity || !duration_mins) {
    return res.status(400).json({ message: 'Activity and duration are required' });
  }

  try {
    const athlete = await query.get('SELECT * FROM athletes WHERE user_id = ?', [req.user.id]);
    if (!athlete) {
      return res.status(404).json({ message: 'Athlete profile not found' });
    }

    // Dynamic calculations
    // Burn multiplier estimates (calories per minute)
    let met = 6.0; // Moderate exercise default
    if (activity.toLowerCase().includes('run')) met = 10.0;
    else if (activity.toLowerCase().includes('cricket')) met = 5.0;
    else if (activity.toLowerCase().includes('football')) met = 8.0;
    else if (activity.toLowerCase().includes('shoot') || activity.toLowerCase().includes('basketball')) met = 6.5;

    const actualWeight = weight_kg || athlete.weight || 70;
    const actualHeight = height_cm || athlete.height || 175;

    // Calories = MET * 3.5 * weight_kg / 200 * duration
    const caloriesBurned = Math.round(met * 3.5 * actualWeight / 200 * duration_mins);
    
    // BMI = weight_kg / (height_m^2)
    const heightM = actualHeight / 100;
    const bmi = parseFloat((actualWeight / (heightM * heightM)).toFixed(2));

    await query.run(
      'INSERT INTO fitness_logs (athlete_id, activity, duration_mins, calories_burned, bmi) VALUES (?, ?, ?, ?, ?)',
      [athlete.id, activity, duration_mins, caloriesBurned, bmi]
    );

    // Update active fitness goals
    const activeGoals = await query.all('SELECT * FROM fitness_goals WHERE athlete_id = ? AND status = "active"', [athlete.id]);
    for (const goal of activeGoals) {
      let progress = 0;
      if (goal.goal_type === 'duration') {
        progress = duration_mins;
      } else if (goal.goal_type === 'calories') {
        progress = caloriesBurned;
      }
      
      const newValue = goal.current_value + progress;
      if (newValue >= goal.target_value) {
        await query.run('UPDATE fitness_goals SET current_value = ?, status = "completed" WHERE id = ?', [newValue, goal.id]);
        await query.run(
          'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
          [req.user.id, `Goal Achieved! You completed your fitness goal to reach ${goal.target_value} ${goal.goal_type === 'duration' ? 'minutes of exercise' : 'calories burned'}.`]
        );
      } else {
        await query.run('UPDATE fitness_goals SET current_value = ? WHERE id = ?', [newValue, goal.id]);
      }
    }

    res.json({ message: 'Fitness activity logged', caloriesBurned, bmi });
  } catch (err) {
    console.error('Log Fitness Error:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/athletes/fitness
// @desc    Get fitness logs
// @access  Private (Athlete only)
router.get('/fitness', auth, async (req, res) => {
  try {
    const athlete = await query.get('SELECT id FROM athletes WHERE user_id = ?', [req.user.id]);
    const logs = await query.all('SELECT * FROM fitness_logs WHERE athlete_id = ? ORDER BY date DESC', [athlete.id]);
    res.json(logs);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// @route   POST api/athletes/gps
// @desc    Log a running/speed session using GPS tracking
// @access  Private (Athlete only)
router.post('/gps', auth, async (req, res) => {
  const { distance_km, speed_avg, route_history } = req.body; // route_history can be array of lat/long

  try {
    const athlete = await query.get('SELECT id FROM athletes WHERE user_id = ?', [req.user.id]);
    await query.run(
      'INSERT INTO gps_logs (athlete_id, distance_km, speed_avg, route_history) VALUES (?, ?, ?, ?)',
      [athlete.id, distance_km, speed_avg, JSON.stringify(route_history || [])]
    );
    res.json({ message: 'GPS tracking log saved successfully' });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// @route   GET api/athletes/gps
// @desc    Get GPS route history logs
// @access  Private
router.get('/gps', auth, async (req, res) => {
  try {
    const athlete = await query.get('SELECT id FROM athletes WHERE user_id = ?', [req.user.id]);
    const logs = await query.all('SELECT * FROM gps_logs WHERE athlete_id = ? ORDER BY date DESC', [athlete.id]);
    res.json(logs.map(log => ({ ...log, route_history: JSON.parse(log.route_history || '[]') })));
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// @route   POST api/athletes/injury
// @desc    Log a new injury / recovery record
// @access  Private
router.post('/injury', auth, async (req, res) => {
  const { injury_type, recovery_plan } = req.body;

  try {
    const athlete = await query.get('SELECT id FROM athletes WHERE user_id = ?', [req.user.id]);
    await query.run(
      'INSERT INTO injuries (athlete_id, injury_type, recovery_plan, status) VALUES (?, ?, ?, "active")',
      [athlete.id, injury_type, recovery_plan]
    );
    res.json({ message: 'Injury record logged successfully' });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/athletes/injury/:id
// @desc    Update injury status (e.g. mark recovered)
// @access  Private
router.put('/injury/:id', auth, async (req, res) => {
  const { status, recovery_plan } = req.body;

  try {
    await query.run(
      'UPDATE injuries SET status = COALESCE(?, status), recovery_plan = COALESCE(?, recovery_plan) WHERE id = ?',
      [status, recovery_plan, req.params.id]
    );
    res.json({ message: 'Injury record updated successfully' });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// @route   GET api/athletes/goals
// @desc    Get fitness goals
// @access  Private (Athlete only)
router.get('/goals', auth, async (req, res) => {
  try {
    const athlete = await query.get('SELECT id FROM athletes WHERE user_id = ?', [req.user.id]);
    if (!athlete) {
      return res.status(404).json({ message: 'Athlete profile not found' });
    }
    const goals = await query.all('SELECT * FROM fitness_goals WHERE athlete_id = ? ORDER BY start_date DESC', [athlete.id]);
    res.json(goals);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// @route   POST api/athletes/goals
// @desc    Create a fitness goal
// @access  Private (Athlete only)
router.post('/goals', auth, async (req, res) => {
  const { goal_type, target_value, end_date } = req.body;
  if (!goal_type || !target_value) {
    return res.status(400).json({ message: 'goal_type and target_value are required' });
  }

  try {
    const athlete = await query.get('SELECT id FROM athletes WHERE user_id = ?', [req.user.id]);
    if (!athlete) {
      return res.status(404).json({ message: 'Athlete profile not found' });
    }

    await query.run(
      'INSERT INTO fitness_goals (athlete_id, goal_type, target_value, end_date) VALUES (?, ?, ?, ?)',
      [athlete.id, goal_type, parseFloat(target_value), end_date || null]
    );

    res.json({ message: 'Fitness goal created successfully' });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

module.exports = router;
