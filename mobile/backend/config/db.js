const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, '..', process.env.DB_FILE || 'database.sqlite');
const uploadDir = path.resolve(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Connect to SQLite Database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
    initializeSchema();
  }
});

// Wrap SQLite queries in Promises for modern async/await syntax
const query = {
  run: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },
  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};

async function initializeSchema() {
  try {
    // 1. Users Table
    await query.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT CHECK(role IN ('athlete', 'coach', 'recruiter', 'admin')) NOT NULL,
        status TEXT DEFAULT 'active',
        profile_photo TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Athletes Table
    await query.run(`
      CREATE TABLE IF NOT EXISTS athletes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        sport TEXT NOT NULL,
        age INTEGER NOT NULL,
        gender TEXT NOT NULL,
        height REAL,
        weight REAL,
        achievements TEXT,
        profile_photo TEXT,
        profile_image TEXT,
        district TEXT,
        state TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 3. Coaches Table
    await query.run(`
      CREATE TABLE IF NOT EXISTS coaches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        specialization TEXT NOT NULL,
        experience INTEGER NOT NULL,
        rating REAL DEFAULT 5.0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 3b. Recruiters Table
    await query.run(`
      CREATE TABLE IF NOT EXISTS recruiters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        organization TEXT NOT NULL,
        sport_interest TEXT DEFAULT 'All',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 4. Videos Table
    await query.run(`
      CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        filepath TEXT NOT NULL,
        filesize INTEGER NOT NULL,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 5. Assessments Table
    await query.run(`
      CREATE TABLE IF NOT EXISTS assessments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id INTEGER NOT NULL,
        athlete_id INTEGER NOT NULL,
        score INTEGER NOT NULL,
        speed INTEGER NOT NULL,
        agility INTEGER NOT NULL,
        fitness INTEGER NOT NULL,
        balance INTEGER NOT NULL,
        endurance INTEGER NOT NULL,
        feedback TEXT,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
      )
    `);

    // 6. Leaderboards Table (used by rankings lists)
    await query.run(`
      CREATE TABLE IF NOT EXISTS leaderboards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        athlete_id INTEGER NOT NULL,
        sport TEXT NOT NULL,
        speed_score INTEGER DEFAULT 0,
        fitness_score INTEGER DEFAULT 0,
        overall_score INTEGER DEFAULT 0,
        district TEXT,
        state TEXT,
        FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
      )
    `);

    // 6b. Leaderboard Table (used by coach and scout profiles/dashboards)
    await query.run(`
      CREATE TABLE IF NOT EXISTS leaderboard (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        athlete_id INTEGER NOT NULL,
        sport TEXT NOT NULL,
        district_rank INTEGER DEFAULT 0,
        state_rank INTEGER DEFAULT 0,
        national_rank INTEGER DEFAULT 0,
        score INTEGER DEFAULT 0,
        FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
      )
    `);

    // 7. Feedback Table (Coach Reviews)
    await query.run(`
      CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assessment_id INTEGER NOT NULL,
        coach_id INTEGER NOT NULL,
        athlete_id INTEGER NOT NULL,
        comments TEXT NOT NULL,
        training_recommendations TEXT,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
        FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE,
        FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
      )
    `);

    // Patch users table if missing profile_photo (for existing DBs)
    try {
        await query.run("ALTER TABLE users ADD COLUMN profile_photo TEXT DEFAULT ''");
    } catch(err) {
        // Column already exists, ignore
    }

    await query.run(`
      CREATE TABLE IF NOT EXISTS coach_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        coach_id INTEGER NOT NULL,
        athlete_id INTEGER NOT NULL,
        feedback TEXT NOT NULL,
        rating REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE,
        FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
      )
    `);

    // 8. Fitness Logs Table
    await query.run(`
      CREATE TABLE IF NOT EXISTS fitness_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        athlete_id INTEGER NOT NULL,
        activity TEXT NOT NULL,
        duration_mins INTEGER NOT NULL,
        calories_burned REAL,
        bmi REAL,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
      )
    `);

    // 8b. Fitness Goals Table
    await query.run(`
      CREATE TABLE IF NOT EXISTS fitness_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        athlete_id INTEGER NOT NULL,
        goal_type TEXT CHECK(goal_type IN ('duration', 'calories')) NOT NULL,
        target_value REAL NOT NULL,
        current_value REAL DEFAULT 0.0,
        start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        end_date DATETIME,
        status TEXT CHECK(status IN ('active', 'completed', 'expired')) DEFAULT 'active',
        FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
      )
    `);

    // 9. GPS Logs Table
    await query.run(`
      CREATE TABLE IF NOT EXISTS gps_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        athlete_id INTEGER NOT NULL,
        distance_km REAL NOT NULL,
        speed_avg REAL NOT NULL,
        route_history TEXT, -- Store JSON string representing path
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
      )
    `);

    // 10. Injuries Table
    await query.run(`
      CREATE TABLE IF NOT EXISTS injuries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        athlete_id INTEGER NOT NULL,
        injury_type TEXT NOT NULL,
        recovery_plan TEXT,
        status TEXT CHECK(status IN ('active', 'recovered')) DEFAULT 'active',
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
      )
    `);

    // 11. Notifications Table
    await query.run(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 12. Events Table (Sports Event Management)
    await query.run(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        venue TEXT NOT NULL,
        date DATETIME NOT NULL,
        organizer TEXT NOT NULL,
        capacity INTEGER DEFAULT 100,
        status TEXT DEFAULT 'upcoming'
      )
    `);

    // 12b. Event Registrations Table
    await query.run(`
      CREATE TABLE IF NOT EXISTS event_registrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        registration_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id, user_id),
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 13. Recruitment Messages Table
    await query.run(`
      CREATE TABLE IF NOT EXISTS recruitment_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recruiter_id INTEGER NOT NULL,
        athlete_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (recruiter_id) REFERENCES recruiters(id) ON DELETE CASCADE,
        FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
      )
    `);

    // 14. Recruiter Favorites Table
    await query.run(`
      CREATE TABLE IF NOT EXISTS recruiter_favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recruiter_id INTEGER NOT NULL,
        athlete_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(recruiter_id, athlete_id),
        FOREIGN KEY (recruiter_id) REFERENCES recruiters(id) ON DELETE CASCADE,
        FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
      )
    `);

    // ==========================================
    // AUTO-SEEDING LOGIC
    // ==========================================
    
    // Seed Events
    const eventsCountObj = await query.get('SELECT COUNT(*) as count FROM events');
    if (eventsCountObj && eventsCountObj.count === 0) {
        const demoEvents = [
            ['District Cricket Tournament', 'Annual district level cricket tournament', 'Meerut Stadium', '2026-07-15T10:00:00', 'UP Sports Authority', 200, 'upcoming'],
            ['State Football Championship', 'U-18 state football championship', 'Lucknow Arena', '2026-08-01T09:00:00', 'Football Federation', 150, 'upcoming'],
            ['National Athletics Meet', 'National level track and field', 'Delhi Sports Complex', '2026-09-10T08:00:00', 'Athletics India', 500, 'upcoming'],
            ['Kabaddi League Trials', 'Open trials for Kabaddi League', 'Patna Indoor Stadium', '2026-07-20T14:00:00', 'Pro Kabaddi', 100, 'upcoming'],
            ['Basketball Challenge', '3v3 Street Basketball', 'Mumbai Courts', '2026-08-15T16:00:00', 'Hoops India', 60, 'upcoming']
        ];
        
        for (const ev of demoEvents) {
            await query.run('INSERT INTO events (title, description, venue, date, organizer, capacity, status) VALUES (?, ?, ?, ?, ?, ?, ?)', ev);
        }
        console.log('Demo events seeded.');
    }

    // Seed Leaderboard
    const lbCountObj = await query.get('SELECT COUNT(*) as count FROM leaderboards');
    if (lbCountObj && lbCountObj.count === 0) {
        // Create a few dummy users & athletes
        const dummyAthletes = [
            { name: 'Rahul Kumar', email: 'rahul@test.com', sport: 'Cricket', age: 17, district: 'Meerut', state: 'Uttar Pradesh', speed: 85, fitness: 90, overall: 88 },
            { name: 'Arjun Singh', email: 'arjun@test.com', sport: 'Football', age: 19, district: 'Lucknow', state: 'Uttar Pradesh', speed: 92, fitness: 88, overall: 90 },
            { name: 'Priya Sharma', email: 'priya@test.com', sport: 'Athletics', age: 16, district: 'Delhi', state: 'Delhi', speed: 95, fitness: 95, overall: 95 },
            { name: 'Vikram Das', email: 'vikram@test.com', sport: 'Kabaddi', age: 20, district: 'Patna', state: 'Bihar', speed: 80, fitness: 92, overall: 86 }
        ];

        for (const a of dummyAthletes) {
            try {
                // Try inserting user
                await query.run('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', [a.name, a.email, 'hashedpass123', 'athlete']);
                
                // Get user id (if inserted or already exists)
                const userObj = await query.get('SELECT id FROM users WHERE email = ?', [a.email]);
                const userId = userObj.id;
                
                // Insert athlete
                await query.run('INSERT INTO athletes (user_id, sport, age, gender, district, state) VALUES (?, ?, ?, ?, ?, ?)', [userId, a.sport, a.age, 'Male', a.district, a.state]);
                const athObj = await query.get('SELECT id FROM athletes WHERE user_id = ?', [userId]);
                const athleteId = athObj.id;
                
                // Insert leaderboard
                await query.run('INSERT INTO leaderboards (athlete_id, sport, district, state, speed_score, fitness_score, overall_score) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [athleteId, a.sport, a.district, a.state, a.speed, a.fitness, a.overall]);
            } catch(e) {
                // Skip if duplicate or error
                console.log('Skipping dummy user', a.email);
            }
        }
        console.log('Demo athletes and leaderboard seeded.');
    }

    console.log('Database tables initialized.');
    await seedInitialData();
  } catch (err) {
    console.error('Error during database schema initialization:', err);
  }
}

async function seedInitialData() {
  const usersCount = await query.get('SELECT COUNT(*) as count FROM users');
  if (usersCount.count === 0) {
    console.log('Seeding initial demo accounts...');
    const hashedPwd = await bcrypt.hash('123456', 10);
    
    // Seed Users
    const u1 = await query.run(`INSERT INTO users (name, email, password, role) VALUES ('Test Athlete', 'athlete@test.com', ?, 'athlete')`, [hashedPwd]);
    const u2 = await query.run(`INSERT INTO users (name, email, password, role) VALUES ('Test Coach', 'coach@test.com', ?, 'coach')`, [hashedPwd]);
    const u3 = await query.run(`INSERT INTO users (name, email, password, role) VALUES ('Test Recruiter', 'recruiter@test.com', ?, 'recruiter')`, [hashedPwd]);
    const u4 = await query.run(`INSERT INTO users (name, email, password, role) VALUES ('Test Admin', 'admin@test.com', ?, 'admin')`, [hashedPwd]);

    // Seed Athlete Detail
    await query.run(`
      INSERT INTO athletes (user_id, sport, age, gender, height, weight, achievements, district, state) 
      VALUES (?, 'Cricket', 19, 'Male', 178.5, 72.0, 'Best batsman in U-19 District Tournament 2025', 'Meerut', 'Uttar Pradesh')
    `, [u1.lastID]);

    const athleteId = 1; // Since u1 is the first athlete inserted and id starts at 1

    // Seed Coach Detail
    await query.run(`
      INSERT INTO coaches (user_id, specialization, experience) 
      VALUES (?, 'Cricket Batting', 12)
    `, [u2.lastID]);

    // Seed Recruiter Detail
    await query.run(`
      INSERT INTO recruiters (user_id, organization, sport_interest)
      VALUES (?, 'Elite Sports Academy', 'Cricket')
    `, [u3.lastID]);

    // Seed initial rankings in leaderboards
    await query.run(`
      INSERT INTO leaderboards (athlete_id, sport, speed_score, fitness_score, overall_score, district, state)
      VALUES (?, 'Cricket', 88, 92, 86, 'Meerut', 'Uttar Pradesh')
    `, [athleteId]);

    // Seed a couple of events
    await query.run(`
      INSERT INTO events (title, description, venue, date, organizer)
      VALUES (
        'National Talent Hunt 2026', 
        'Talent identification camp organized for state level athletes.',
        'Meerut Sports Complex',
        '2026-07-15 09:00:00',
        'Sports Authority of India'
      )
    `);

    await query.run(`
      INSERT INTO events (title, description, venue, date, organizer)
      VALUES (
        'State Football Cup', 
        'Annual knockout cup for academy teams.',
        'Lucknow Stadium',
        '2026-08-01 14:00:00',
        'UP Football Association'
      )
    `);

    // Seed some initial notifications
    await query.run(`INSERT INTO notifications (user_id, message) VALUES (?, 'Welcome to AI Talent Assessment App! Complete your profile to get discovered.')`, [u1.lastID]);
    await query.run(`INSERT INTO notifications (user_id, message) VALUES (?, 'You have been registered as an Expert Cricket Coach. Check out athletes in your area.')`, [u2.lastID]);
    await query.run(`INSERT INTO notifications (user_id, message) VALUES (?, 'Welcome Recruiter! Use search filters to scout talented athletes.')`, [u3.lastID]);

    console.log('Seeding completed successfully.');
  }
}

module.exports = {
  db,
  query
};
