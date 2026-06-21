const fs = require('fs');
const path = require('path');

const PORT = 5000;
const BASE_URL = `http://127.0.0.1:${PORT}/api`;

async function runTests() {
  console.log('\n=======================================');
  console.log('  STARTING BACKEND API INTEGRATION TEST  ');
  console.log('=======================================\n');

  let tokens = { athlete: '', coach: '', recruiter: '' };
  let ids = { athleteUser: null, athleteProfile: null, coachUser: null, coachProfile: null, video: null, assessment: null };

  try {
    // 1. Health check
    console.log('Step 1: Running API health check...');
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    console.log('✔ Health Check Response:', healthData);

    if (healthData.status !== 'running') {
      throw new Error('API Health check failed');
    }

    // Generate unique emails for tests
    const timestamp = Date.now();
    const athleteEmail = `athlete_${timestamp}@test.com`;
    const coachEmail = `coach_${timestamp}@test.com`;
    const recruiterEmail = `recruiter_${timestamp}@test.com`;

    // 2. Register Athlete
    console.log('\nStep 2: Registering Athlete account...');
    const regAthleteRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Rahul Dravid U19',
        email: athleteEmail,
        password: 'password123',
        role: 'athlete',
        sport: 'Cricket',
        age: 18,
        gender: 'Male',
        height: 180,
        weight: 75,
        district: 'Bengaluru',
        state: 'Karnataka'
      })
    });
    const regAthleteData = await regAthleteRes.json();
    if (!regAthleteRes.ok) throw new Error(`Reg Athlete Failed: ${JSON.stringify(regAthleteData)}`);
    console.log('✔ Athlete Registered.');
    tokens.athlete = regAthleteData.token;
    ids.athleteUser = regAthleteData.user.id;

    // 3. Register Coach
    console.log('\nStep 3: Registering Coach account...');
    const regCoachRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Greg Chappell',
        email: coachEmail,
        password: 'password123',
        role: 'coach',
        specialization: 'Batting Technique',
        experience: 15
      })
    });
    const regCoachData = await regCoachRes.json();
    if (!regCoachRes.ok) throw new Error(`Reg Coach Failed: ${JSON.stringify(regCoachData)}`);
    console.log('✔ Coach Registered.');
    tokens.coach = regCoachData.token;
    ids.coachUser = regCoachData.user.id;

    // 4. Register Recruiter
    console.log('\nStep 4: Registering Recruiter account...');
    const regScoutRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Karnataka Cricket Academy',
        email: recruiterEmail,
        password: 'password123',
        role: 'recruiter'
      })
    });
    const regScoutData = await regScoutRes.json();
    if (!regScoutRes.ok) throw new Error(`Reg Recruiter Failed: ${JSON.stringify(regScoutData)}`);
    console.log('✔ Recruiter Registered.');
    tokens.recruiter = regScoutData.token;

    // 5. Get current athlete profile context
    console.log('\nStep 5: Retrieving profile details...');
    const profileRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${tokens.athlete}` }
    });
    const profileData = await profileRes.json();
    ids.athleteProfile = profileData.details.id;
    console.log(`✔ Retrieved Athlete Profile ID: ${ids.athleteProfile}`);

    // 6. Update Athlete Profile
    console.log('\nStep 6: Updating Athlete profile bio...');
    const updateRes = await fetch(`${BASE_URL}/athletes/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens.athlete}`
      },
      body: JSON.stringify({
        achievements: 'Selected for State Zone Trials 2026',
        weight: 76.5
      })
    });
    const updateData = await updateRes.json();
    console.log('✔ Updated profile weight and bio:', updateData.achievements, `${updateData.weight}kg`);

    // 7. Log Fitness Activity
    console.log('\nStep 7: Logging a running exercise session...');
    const fitRes = await fetch(`${BASE_URL}/athletes/fitness`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens.athlete}`
      },
      body: JSON.stringify({
        activity: 'Running and sprints',
        duration_mins: 45,
        weight_kg: 76.5,
        height_cm: 180
      })
    });
    const fitData = await fitRes.json();
    console.log('✔ Fitness exercise saved. Calculated calories burned:', fitData.caloriesBurned, 'BMI:', fitData.bmi);

    // 8. Setup a dummy video upload path in database
    console.log('\nStep 8: Creating mock video record in database...');
    // We insert a video path directly via db since E2E files need multipart boundary forms
    // But we want to simulate the process, so let's write to SQLite directly or mock upload
    const { query } = require('./config/db');
    const vResult = await query.run(
      'INSERT INTO videos (user_id, filename, original_name, filepath, filesize) VALUES (?, ?, ?, ?, ?)',
      [ids.athleteUser, 'dummy-cricket.mp4', 'dummy-cricket.mp4', '/uploads/dummy-cricket.mp4', 1024]
    );
    ids.video = vResult.lastID;
    console.log(`✔ Created video ID: ${ids.video} (status: pending)`);

    // 9. Execute AI Talent Assessment
    console.log('\nStep 9: Running AI Assessment motion analysis on video...');
    const analyzeRes = await fetch(`${BASE_URL}/assessments/analyze/${ids.video}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokens.athlete}` }
    });
    const analyzeData = await analyzeRes.json();
    if (!analyzeRes.ok) throw new Error(`Assessment Trigger Failed: ${JSON.stringify(analyzeData)}`);
    console.log('✔ AI Assessment completed. Generated Scores:');
    console.log(`   - Overall Score: ${analyzeData.assessment.score}%`);
    console.log(`   - Speed Score: ${analyzeData.assessment.speed}/100`);
    console.log(`   - Posture Score: ${analyzeData.assessment.posture}/100`);
    console.log(`   - Accuracy Score: ${analyzeData.assessment.accuracy}/100`);
    ids.assessment = analyzeData.assessment.id;

    // 10. Get Coach Profile
    const coachMeRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${tokens.coach}` }
    });
    const coachMeData = await coachMeRes.json();
    ids.coachProfile = coachMeData.details.id;

    // 11. Submit Coach Feedback
    console.log('\nStep 10: Submitting technical review feedback as Coach...');
    const feedRes = await fetch(`${BASE_URL}/coaches/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens.coach}`
      },
      body: JSON.stringify({
        athlete_id: ids.athleteProfile,
        feedback: 'Excellent hand-eye coordination. Forward press is solid, but back foot needs to be grounded during cut shots.',
        rating: 4.5
      })
    });
    const feedData = await feedRes.json();
    if (!feedRes.ok) throw new Error(`Coach Feedback Failed: ${JSON.stringify(feedData)}`);
    console.log('✔ Coach feedback saved:', feedData);

    // 12. Search recruiter talent
    console.log('\nStep 11: Scouting search as Recruiter...');
    const searchRes = await fetch(`${BASE_URL}/recruitment/search?sport=Cricket&minScore=75`, {
      headers: { 'Authorization': `Bearer ${tokens.recruiter}` }
    });
    const searchData = await searchRes.json();
    console.log(`✔ Recruiter search returned ${searchData.length} matches. Found athlete name: ${searchData[0]?.name}`);

    // 13. Send recruiter contact interest
    console.log('\nStep 12: Requesting recruiter contact...');
    const contactRes = await fetch(`${BASE_URL}/recruitment/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens.recruiter}`
      },
      body: JSON.stringify({
        athlete_id: ids.athleteProfile,
        message: 'We saw your impressive AI score. We would like to invite you to our state academy selections next week.'
      })
    });
    const contactData = await contactRes.json();
    console.log('✔ Recruiter contact request processed:', contactData.message);

    // 14. Check athlete notifications
    console.log('\nStep 13: Fetching Athlete notifications...');
    const noteRes = await fetch(`${BASE_URL}/notifications`, {
      headers: { 'Authorization': `Bearer ${tokens.athlete}` }
    });
    const noteData = await noteRes.json();
    console.log('✔ Notifications list:');
    noteData.forEach((n, idx) => console.log(`   [${idx+1}] ${n.message}`));

    // 15. Run AI chatbot fitness ask
    console.log('\nStep 14: Checking Chatbot suggestions...');
    const chatRes = await fetch(`${BASE_URL}/chatbot/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens.athlete}`
      },
      body: JSON.stringify({ message: 'How do I increase my sprint speed for running?' })
    });
    const chatData = await chatRes.json();
    console.log('✔ Chatbot response:', chatData.reply.substring(0, 150) + '...');

    // 16. Verify PDF download
    console.log('\nStep 15: Generating PDF Performance Report...');
    const pdfRes = await fetch(`${BASE_URL}/reports/download/${ids.athleteProfile}`, {
      headers: { 'Authorization': `Bearer ${tokens.athlete}` }
    });
    if (!pdfRes.ok) throw new Error('PDF Report download failed');
    const pdfBuffer = await pdfRes.arrayBuffer();
    console.log(`✔ PDF Generated. Received ${pdfBuffer.byteLength} bytes of compiled binary data.`);

    console.log('\n=======================================');
    console.log('     ALL INTEGRATION TESTS PASSED      ');
    console.log('=======================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST RUN ENCOUNTERED AN ERROR:', err.message);
    process.exit(1);
  }
}

runTests();
