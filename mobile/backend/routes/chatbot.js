const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

const CHATBOT_RESPONSES = [
  {
    keywords: ['run', 'speed', 'fast', 'sprint'],
    reply: "To increase sprint speed, focus on plyometric exercises (box jumps, bounds) and high-intensity interval training (HIIT). Ensure your knees drive up high, arms swing at 90-degree angles, and push off with maximum force from the balls of your feet. Try running 10x 40-meter sprints with full recovery."
  },
  {
    keywords: ['bat', 'cricket', 'shot', 'drive', 'spin'],
    reply: "In cricket batting, ensure your stance is balanced and head is kept steady directly over the line of the ball. For cover drives, lead with your shoulder, bend your front knee toward the pitch, and swing high-to-low with a vertical bat face. Check out the 'Coach Feedback' panel for personalized critiques!"
  },
  {
    keywords: ['dribble', 'soccer', 'football', 'ball control'],
    reply: "For football dribbling, practice using all parts of your foot (inside, outside, sole, laces). Keep the ball close, lower your center of gravity, and practice change of pace drills. Setup 5 cones in a straight line spaced 1 meter apart and dribble through them daily."
  },
  {
    keywords: ['diet', 'food', 'calorie', 'nutrition', 'eat'],
    reply: "As an athlete, aim for a balanced diet comprising 55% complex carbohydrates (oatmeal, brown rice) for clean energy, 25% lean proteins (chicken, fish, eggs, lentils) for muscle recovery, and 20% healthy fats (avocados, nuts). Stay hydrated by drinking at least 3-4 liters of water daily."
  },
  {
    keywords: ['injury', 'pain', 'sprain', 'recover', 'hurt'],
    reply: "For acute minor injuries, use the R.I.C.E protocol: Rest (stop training immediately), Ice (apply cold packs for 15 mins), Compression (wrap with a light bandage), and Elevation (keep the injured limb above heart level). If pain persists beyond 48 hours, seek professional medical guidance."
  },
  {
    keywords: ['shoot', 'basketball', 'hoop', 'jump shot'],
    reply: "For basketball shooting, follow the B.E.E.F principle: Balance (feet shoulder-width apart), Elbow (tucked in at 90 degrees), Eyes (focused on the rim), and Follow-through (flick the wrist like reaching into a high cookie jar). Keep your release high."
  },
  {
    keywords: ['hello', 'hi', 'hey', 'help'],
    reply: "Hello! I am your AI Sports Assistant. Ask me anything about speed training, sports technique drills, nutrition plans, calorie monitoring, or injury recovery! How can I help your athletic progress today?"
  }
];

// @route   POST api/chatbot/ask
// @desc    Get fitness and training suggestions from the AI chatbot
// @access  Private
router.post('/ask', auth, (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ message: 'Please enter a message' });
  }

  const cleanMessage = message.toLowerCase();
  let selectedReply = "That's an interesting question! To give you the best advice, try asking specifically about 'speed training', 'cricket batting tips', 'football dribbling', 'diet and nutrition', or 'injury recovery'. I can also guide you on general exercise routines.";

  for (const item of CHATBOT_RESPONSES) {
    const matches = item.keywords.some(keyword => cleanMessage.includes(keyword));
    if (matches) {
      selectedReply = item.reply;
      break;
    }
  }

  res.json({
    reply: selectedReply,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
