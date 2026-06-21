const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const auth = require('../middleware/auth');

// @route   POST api/auth/register
// @desc    Register a user
// @access  Public
router.post('/register', async (req, res) => {
  const { name, email, password, role, sport, age, gender, height, weight, district, state, specialization, experience } = req.body;

  if (!password || password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }

  try {
    // Check if user exists
    let user = await query.get('SELECT * FROM users WHERE email = ?', [email]);
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Encrypt password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user
    const userResult = await query.run(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, role]
    );
    const userId = userResult.lastID;

    // Create role-specific records
    if (role === 'athlete') {
      await query.run(
        'INSERT INTO athletes (user_id, sport, age, gender, height, weight, district, state) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, sport || 'Other', age || 18, gender || 'Other', height || null, weight || null, district || 'Other', state || 'Other']
      );
      // Create empty leaderboard records
      const athlete = await query.get('SELECT id, district, state FROM athletes WHERE user_id = ?', [userId]);
      await query.run(
        'INSERT INTO leaderboard (athlete_id, sport, district_rank, state_rank, national_rank, score) VALUES (?, ?, 0, 0, 0, 0)',
        [athlete.id, sport || 'Other']
      );
      await query.run(
        'INSERT INTO leaderboards (athlete_id, sport, district, state, speed_score, fitness_score, overall_score) VALUES (?, ?, ?, ?, 0, 0, 0)',
        [athlete.id, sport || 'Other', athlete.district || 'Other', athlete.state || 'Other']
      );
    } else if (role === 'coach') {
      await query.run(
        'INSERT INTO coaches (user_id, specialization, experience) VALUES (?, ?, ?)',
        [userId, specialization || 'General', experience || 0]
      );
    } else if (role === 'recruiter') {
      await query.run(
        'INSERT INTO recruiters (user_id, organization, sport_interest) VALUES (?, ?, ?)',
        [userId, name || 'General Academy', sport || 'All']
      );
    }

    // Send JWT
    const payload = {
      user: {
        id: userId,
        role: role
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET || 'supersecret_sports_ai_token_key_123!',
      { expiresIn: '30d' },
      (err, token) => {
        if (err) throw err;
        res.json({ token, user: { id: userId, name, email, role } });
      }
    );
  } catch (err) {
    console.error('Registration Error:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check user exists
    let user = await query.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Example of account disabled check if we had a status column
    if (user.status === 'disabled') {
      return res.status(403).json({ message: 'Account disabled' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    // Return JWT
    const payload = {
      user: {
        id: user.id,
        role: user.role
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET || 'supersecret_sports_ai_token_key_123!',
      { expiresIn: '30d' },
      (err, token) => {
        if (err) throw err;
        res.json({ 
          token, 
          user: { 
            id: user.id, 
            name: user.name, 
            email: user.email, 
            role: user.role 
          } 
        });
      }
    );
  } catch (err) {
    console.error('Login Error:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/auth/forgot-password
// @desc    Mock password recovery
// @access  Public
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    let user = await query.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(400).json({ message: 'User not found with this email' });
    }
    res.json({ message: 'Password recovery email sent to ' + email });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// @route   GET api/auth/me
// @desc    Get current user details
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await query.get('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let details = {};
    if (user.role === 'athlete') {
      details = await query.get('SELECT * FROM athletes WHERE user_id = ?', [user.id]);
    } else if (user.role === 'coach') {
      details = await query.get('SELECT * FROM coaches WHERE user_id = ?', [user.id]);
    } else if (user.role === 'recruiter') {
      details = await query.get('SELECT * FROM recruiters WHERE user_id = ?', [user.id]);
    }

    res.json({ ...user, details });
  } catch (err) {
    console.error('Auth Error:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/auth/password
// @desc    Change logged-in user password
// @access  Private
router.put('/password', auth, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await query.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);
    res.json({ message: 'Password updated successfully' });
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
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// @route   POST api/auth/profile-picture
// @desc    Upload profile picture
// @access  Private
router.post('/profile-picture', auth, upload.single('photo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Please upload an image file' });
  }
  try {
    const photoPath = `/uploads/${req.file.filename}`;
    await query.run('UPDATE users SET profile_photo = ? WHERE id = ?', [photoPath, req.user.id]);
    res.json({ message: 'Profile picture updated', profile_photo: photoPath });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

module.exports = router;
