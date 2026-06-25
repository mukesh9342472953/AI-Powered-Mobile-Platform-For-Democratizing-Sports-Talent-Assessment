const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const auth = require('../middleware/auth');
const SportDetectionService = require('../services/sportDetection');

// Helper to generate realistic feedback and scores based on the sport
function simulateAIScoring(sport) {
  const min = 60;
  const max = 98;
  const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

  const speed = rand(min, max);
  const agility = rand(min, max);
  const fitness = rand(min, max);
  const balance = rand(min, max);
  const endurance = rand(min, max);
  
  const overall = Math.round((speed + agility + fitness + balance + endurance) / 5);

  let feedback = '';
  sport = (sport || 'General').toLowerCase();
  
  if (sport.includes('cricket')) {
    feedback = `Solid core balance (${balance}%). Speed (${speed}%) reflects quick movements. Agility could be improved for fielding. Fitness is good.`;
  } else if (sport.includes('foot') || sport.includes('soccer')) {
    feedback = `Excellent endurance (${endurance}%) during sustained runs. Agility (${agility}%) is decent. Balance is strong when striking the ball. Focus on sprint speed.`;
  } else if (sport.includes('basket')) {
    feedback = `Great jump balance and agility (${agility}%). Speed on fast breaks is impressive. Ensure cardiovascular fitness (${fitness}%) is maintained for 4 quarters.`;
  } else if (sport.includes('run') || sport.includes('track')) {
    feedback = `Outstanding sprint mechanics. Calculated top velocity correlates with speed score (${speed}%). Endurance is well-maintained. Focus on agility drills to protect joints.`;
  } else {
    feedback = `Assessment completed. Overall athletic index is ${overall}%. Showed high athletic agility and balance. Work on cardiovascular fitness and speed acceleration.`;
  }

  return { speed, agility, fitness, balance, endurance, overall, feedback };
}

// @route   POST api/assessments/analyze/:videoId
// @desc    Trigger AI analysis on an uploaded video (Simulated)
// @access  Private (Athlete only)
router.post('/analyze/:videoId', auth, async (req, res) => {
  const { videoId } = req.params;

  try {
    const athlete = await query.get('SELECT id, sport FROM athletes WHERE user_id = ?', [req.user.id]);
    if (!athlete) {
      return res.status(404).json({ message: 'Athlete profile not found. Please create your profile first.' });
    }

    // Now video belongs to user_id, not athlete_id
    const video = await query.get('SELECT * FROM videos WHERE id = ? AND user_id = ?', [videoId, req.user.id]);
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Check if assessment already exists for this video
    const existing = await query.get('SELECT id FROM assessments WHERE video_id = ?', [videoId]);
    if (existing) {
      return res.status(400).json({ message: 'This video has already been analyzed' });
    }

    // Sport Validation Layer
    const detectedSportInfo = SportDetectionService.detectSport(video, athlete.sport);
    const detectedSport = detectedSportInfo ? detectedSportInfo.sport : 'Unknown';
    const isMatch = SportDetectionService.validateSport(athlete.sport, detectedSportInfo);

    if (!isMatch) {
      await query.run(
        'INSERT INTO video_validation_logs (user_id, selected_sport, detected_sport, status) VALUES (?, ?, ?, ?)',
        [req.user.id, athlete.sport, detectedSport, 'Rejected']
      );

      return res.status(400).json({
        success: false,
        status: 'Rejected',
        message: `Invalid Video. Uploaded video belongs to ${detectedSport}. Please upload a ${athlete.sport} video.`,
        selectedSport: athlete.sport,
        detectedSport: detectedSport
      });
    }

    // Log successful validation
    await query.run(
      'INSERT INTO video_validation_logs (user_id, selected_sport, detected_sport, status) VALUES (?, ?, ?, ?)',
      [req.user.id, athlete.sport, detectedSport, 'Approved']
    );

    // Run simulated AI assessment
    const assessmentDetails = simulateAIScoring(athlete.sport);

    // Insert Assessment results
    const result = await query.run(
      `INSERT INTO assessments (video_id, athlete_id, score, speed, agility, fitness, balance, endurance, feedback)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        videoId, 
        athlete.id, 
        assessmentDetails.overall, 
        assessmentDetails.speed, 
        assessmentDetails.agility, 
        assessmentDetails.fitness, 
        assessmentDetails.balance, 
        assessmentDetails.endurance,
        assessmentDetails.feedback
      ]
    );

    // Update Rankings Table dynamically
    const allAthleteAssessments = await query.all('SELECT score FROM assessments WHERE athlete_id = ?', [athlete.id]);
    const maxScore = Math.max(...allAthleteAssessments.map(a => a.score), 0);

    const districtRank = Math.max(1, 100 - maxScore + Math.floor(Math.random() * 5));
    const stateRank = Math.max(1, districtRank * 3 + Math.floor(Math.random() * 10));
    const nationalRank = Math.max(1, stateRank * 8 + Math.floor(Math.random() * 50));

    await query.run(
      `UPDATE leaderboards 
       SET overall_score = ?,
           speed_score = ?,
           fitness_score = ?
       WHERE athlete_id = ?`,
      [maxScore, assessmentDetails.speed, assessmentDetails.fitness, athlete.id]
    );

    await query.run(
      `UPDATE leaderboard 
       SET score = ?,
           district_rank = ?,
           state_rank = ?,
           national_rank = ?
       WHERE athlete_id = ?`,
      [maxScore, districtRank, stateRank, nationalRank, athlete.id]
    );

    // Add Notification
    await query.run(
      'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
      [req.user.id, `AI Assessment completed! You scored ${assessmentDetails.overall}% overall. Check dashboard.`]
    );

    res.json({
      message: 'AI Assessment finished processing',
      assessment: {
        id: result.lastID,
        video_id: videoId,
        score: assessmentDetails.overall,
        ...assessmentDetails
      }
    });
  } catch (err) {
    console.error('Trigger Assessment Error:', err.message);
    res.status(500).json({ message: 'Server Error analyzing video.' });
  }
});

// @route   GET api/assessments/history
// @desc    Get assessment history for logged-in athlete
// @access  Private (Athlete only)
router.get('/history', auth, async (req, res) => {
  try {
    const athlete = await query.get('SELECT id FROM athletes WHERE user_id = ?', [req.user.id]);
    if (!athlete) return res.json([]);
    
    const history = await query.all(
      `SELECT a.*, v.filepath as video_path, v.original_name
       FROM assessments a
       JOIN videos v ON a.video_id = v.id 
       WHERE a.athlete_id = ? 
       ORDER BY a.date DESC`,
      [athlete.id]
    );
    res.json(history || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error loading history' });
  }
});

module.exports = router;
