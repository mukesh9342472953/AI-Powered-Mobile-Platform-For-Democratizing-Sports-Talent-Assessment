const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const { query } = require('../config/db');
const auth = require('../middleware/auth');

// @route   GET api/reports/download/:athleteId
// @desc    Generate and download athlete talent report as PDF
// @access  Private
router.get('/download/:athleteId', auth, async (req, res) => {
  const { athleteId } = req.params;

  try {
    // 1. Fetch data
    const athlete = await query.get(
      `SELECT a.*, u.name, u.email 
       FROM athletes a 
       JOIN users u ON a.user_id = u.id 
       WHERE a.id = ?`,
      [athleteId]
    );

    if (!athlete) {
      return res.status(404).json({ message: 'Athlete not found' });
    }

    const assessment = await query.get(
      `SELECT * FROM assessments 
       WHERE athlete_id = ? 
       ORDER BY date DESC LIMIT 1`,
      [athleteId]
    );

    const ranking = await query.get(
      `SELECT * FROM leaderboard 
       WHERE athlete_id = ?`,
      [athleteId]
    );

    const feedbackList = await query.all(
      `SELECT f.*, u.name as coach_name 
       FROM feedback f
       JOIN coaches c ON f.coach_id = c.id
       JOIN users u ON c.user_id = u.id
       WHERE f.athlete_id = ? 
       ORDER BY f.date DESC LIMIT 2`,
      [athleteId]
    );

    // 2. Initialize PDF Document
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    // Set Response Headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Performance_Report_${athlete.name.replace(/\s+/g, '_')}.pdf`);

    // Stream PDF directly to client response
    doc.pipe(res);

    // Header Design
    doc.rect(0, 0, 595, 120).fill('#0f172a'); // Deep slate dark background
    doc.fillColor('#10b981').fontSize(24).text('ATHLETE PERFORMANCE REPORT', 50, 40, { bold: true });
    doc.fillColor('#94a3b8').fontSize(11).text('AI-POWERED SPORTS TALENT ASSESSMENT PLATFORM', 50, 70);
    doc.fillColor('#ffffff').fontSize(10).text(`Generated: ${new Date().toLocaleDateString()}`, 450, 45);

    doc.moveDown(5);
    doc.fillColor('#000000');

    // Athlete Details Table
    doc.fontSize(14).fillColor('#1e293b').text('Athlete Profile Details', 50, 140, { underline: true });
    doc.fontSize(10).fillColor('#334155');
    
    const startY = 165;
    const col1 = 50;
    const col2 = 300;

    doc.text(`Full Name: ${athlete.name}`, col1, startY);
    doc.text(`Sport Discipline: ${athlete.sport}`, col1, startY + 20);
    doc.text(`Age: ${athlete.age} years`, col1, startY + 40);
    doc.text(`Gender: ${athlete.gender}`, col1, startY + 60);

    doc.text(`Height: ${athlete.height ? athlete.height + ' cm' : 'N/A'}`, col2, startY);
    doc.text(`Weight: ${athlete.weight ? athlete.weight + ' kg' : 'N/A'}`, col2, startY + 20);
    doc.text(`Location: ${athlete.district || 'N/A'}, ${athlete.state || 'N/A'}`, col2, startY + 40);
    doc.text(`Contact: ${athlete.email}`, col2, startY + 60);

    doc.rect(45, 130, 500, 105).stroke('#e2e8f0');

    // AI Talent Assessment Summary
    doc.fontSize(14).fillColor('#1e293b').text('AI Assessment Metrics', 50, 260, { underline: true });

    if (assessment) {
      doc.rect(45, 280, 500, 150).fill('#f8fafc');

      // Overall Score circle/box
      doc.rect(60, 295, 120, 120).fill('#0f172a');
      doc.fillColor('#10b981').fontSize(36).text(`${assessment.score}%`, 80, 330, { align: 'center', width: 80 });
      doc.fillColor('#94a3b8').fontSize(9).text('OVERALL AI SCORE', 60, 380, { align: 'center', width: 120 });

      // Stat bars
      const barX = 210;
      const barY = 305;
      const barWidth = 300;

      const stats = [
        { label: 'Speed Detection', score: assessment.speed },
        { label: 'Agility Control', score: assessment.agility },
        { label: 'Fitness & Stamina', score: assessment.fitness },
        { label: 'Balance & Posture', score: assessment.balance },
        { label: 'Endurance Index', score: assessment.endurance }
      ];

      doc.fontSize(9).fillColor('#1e293b');
      stats.forEach((stat, idx) => {
        const currentY = barY + (idx * 28);
        doc.text(`${stat.label}: ${stat.score}/100`, barX, currentY);
        // Draw stat background bar
        doc.rect(barX, currentY + 12, barWidth, 6).fill('#e2e8f0');
        // Draw filled stat progress bar
        doc.rect(barX, currentY + 12, barWidth * (stat.score / 100), 6).fill('#10b981');
      });
    } else {
      doc.fontSize(10).fillColor('#ef4444').text('No AI assessment has been processed for this athlete yet.', 50, 290);
    }

    // Rankings Section
    doc.fontSize(14).fillColor('#1e293b').text('Talent Rankings', 50, 450, { underline: true });
    doc.rect(45, 470, 500, 50).stroke('#e2e8f0');

    if (ranking && ranking.score > 0) {
      doc.fontSize(10).fillColor('#334155');
      doc.text(`District Rank: #${ranking.district_rank || 'N/A'}`, 70, 490);
      doc.text(`State Rank: #${ranking.state_rank || 'N/A'}`, 230, 490);
      doc.text(`National Rank: #${ranking.national_rank || 'N/A'}`, 390, 490);
    } else {
      doc.fontSize(10).fillColor('#475569').text('Rankings will be calculated once an assessment is compiled.', 70, 490);
    }

    // Coach Feedback Section
    doc.fontSize(14).fillColor('#1e293b').text('Coach Technical Review', 50, 540, { underline: true });
    
    if (feedbackList && feedbackList.length > 0) {
      let currentFeedbackY = 565;
      feedbackList.forEach((fb, idx) => {
        doc.fontSize(10).fillColor('#0f172a').text(`Review by: ${fb.coach_name} (${fb.date.substring(0, 10)})`, 50, currentFeedbackY, { bold: true });
        doc.fontSize(9).fillColor('#334155').text(`Comments: ${fb.comments}`, 50, currentFeedbackY + 15, { width: 490 });
        doc.fontSize(9).fillColor('#059669').text(`Recommendations: ${fb.training_recommendations}`, 50, doc.y + 5, { width: 490 });
        
        currentFeedbackY = doc.y + 15;
      });
    } else {
      doc.fontSize(10).fillColor('#475569').text('No official coach comments have been registered for this athlete yet.', 50, 565);
    }

    // Footer
    doc.rect(0, 780, 595, 62).fill('#0f172a');
    doc.fillColor('#94a3b8').fontSize(8).text('This report is generated automatically by the AI Sports Talent Engine based on motion analysis video feeds.', 50, 795, { align: 'center', width: 495 });
    doc.text('Equal Opportunity Talent Discovery Platform - 2026', 50, 810, { align: 'center', width: 495 });

    // End Document
    doc.end();

  } catch (err) {
    console.error('Report Generation Error:', err.message);
    if (!res.headersSent) {
      res.status(500).send('Server Error');
    }
  }
});

module.exports = router;
