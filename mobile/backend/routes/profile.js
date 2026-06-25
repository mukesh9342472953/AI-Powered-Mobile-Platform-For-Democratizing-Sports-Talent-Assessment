const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const auth = require('../middleware/auth');

const sports = [
  "Cricket",
  "Football",
  "Tennis",
  "Badminton",
  "Athletics",
  "Basketball",
  "Volleyball",
  "Hockey",
  "Table Tennis",
  "Kabaddi",
  "Swimming",
  "Boxing",
  "Wrestling",
  "Archery",
  "Shooting",
  "Chess",
  "Rugby",
  "Handball",
  "Cycling",
  "Gymnastics",
  "Weightlifting",
  "Taekwondo",
  "Karate",
  "Judo",
  "Fencing",
  "Skating",
  "Surfing",
  "Baseball",
  "Softball",
  "Golf"
];
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');

// Configure multer for profile picture uploads
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

// @route   GET api/profile
// @desc    Get unified profile details (user + role specific)
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const user = await query.get('SELECT id, name, email, role, profile_photo, created_at FROM users WHERE id = ?', [req.user.id]);
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

    res.json({ success: true, user: { ...user, details } });
  } catch (err) {
    console.error('Profile Fetch Error:', err.message);
    res.status(500).json({ success: false, message: 'Server Error loading profile' });
  }
});

// @route   PUT api/profile
// @desc    Update unified profile details
// @access  Private
router.put('/', auth, async (req, res) => {
  const { name, email, sport, age, gender, height, weight, district, state, achievements, specialization, experience, organization, sport_interest } = req.body;

  if (!name || !email) {
    return res.status(400).json({ message: 'Name and Email are required.' });
  }

  try {
    const user = await query.get('SELECT role FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.role === 'athlete' && sport && !sports.includes(sport)) {
      return res.status(400).json({ message: 'Invalid sport selected' });
    }
    if (user.role === 'recruiter' && sport_interest && sport_interest !== 'All' && !sports.includes(sport_interest)) {
      return res.status(400).json({ message: 'Invalid sport interest selected' });
    }

    // Ensure email is not taken by someone else
    const existing = await query.get('SELECT id FROM users WHERE email = ? AND id != ?', [email, req.user.id]);
    if (existing) {
        return res.status(400).json({ message: 'Email is already in use by another account' });
    }

    // Update base user
    await query.run('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, req.user.id]);

    // Update role specific data
    if (user.role === 'athlete') {
      await query.run(
        'UPDATE athletes SET sport = ?, age = ?, gender = ?, height = ?, weight = ?, district = ?, state = ?, achievements = ? WHERE user_id = ?',
        [sport, age, gender, height, weight, district, state, achievements, req.user.id]
      );
      
      // Keep leaderboard sport in sync
      if (sport) {
          await query.run('UPDATE leaderboards SET sport = ? WHERE athlete_id = (SELECT id FROM athletes WHERE user_id = ?)', [sport, req.user.id]);
      }
    } else if (user.role === 'coach') {
      await query.run(
        'UPDATE coaches SET specialization = ?, experience = ? WHERE user_id = ?',
        [specialization, experience, req.user.id]
      );
    } else if (user.role === 'recruiter') {
      await query.run(
        'UPDATE recruiters SET organization = ?, sport_interest = ? WHERE user_id = ?',
        [organization, sport_interest, req.user.id]
      );
    }

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (err) {
    console.error('Profile Update Error:', err.message);
    res.status(500).json({ success: false, message: 'Server Error updating profile' });
  }
});

// @route   POST api/profile/image
// @desc    Upload profile picture
// @access  Private
router.post('/image', auth, upload.single('photo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Please upload an image file' });
  }
  try {
    const photoPath = `/uploads/${req.file.filename}`;
    await query.run('UPDATE users SET profile_photo = ? WHERE id = ?', [photoPath, req.user.id]);
    res.json({ success: true, message: 'Profile picture updated', profile_photo: photoPath });
  } catch (err) {
    console.error('Profile Image Upload Error:', err.message);
    res.status(500).json({ success: false, message: 'Server Error uploading image' });
  }
});

// @route   PUT api/profile/password
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
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('Password Update Error:', err.message);
    res.status(500).json({ success: false, message: 'Server Error updating password' });
  }
});

module.exports = router;
