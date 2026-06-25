require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Initialize Express App
const app = express();

// Set up Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Serve uploaded video files statically
app.use('/uploads', express.static(uploadDir));

// Initialize Database connection on server spin-up
const { db } = require('./config/db');

// Import Route Handlers
const authRoutes = require('./routes/auth');
const athleteRoutes = require('./routes/athletes');
const videoRoutes = require('./routes/videos');
const assessmentRoutes = require('./routes/assessments');
const coachRoutes = require('./routes/coaches');
const recruitmentRoutes = require('./routes/recruitment');
const eventRoutes = require('./routes/events');
const notificationRoutes = require('./routes/notifications');
const chatbotRoutes = require('./routes/chatbot');
const reportRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');
const leaderboardRoutes = require('./routes/leaderboard');
const dashboardRoutes = require('./routes/dashboard');
const profileRoutes = require('./routes/profile');
const sportsRoutes = require('./routes/sports');

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/athletes', athleteRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/coaches', coachRoutes);
app.use('/api/recruitment', recruitmentRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/sports', sportsRoutes);

// Base Route to check status
app.get('/api/health', (req, res) => {
  res.json({
    status: 'running'
  });
});

// Default root response
app.get('/', (req, res) => {
  res.send('AI Sports Talent Assessment API is running.');
});

// Configure PORT and Start Listening
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server started running on port ${PORT}`);
});
