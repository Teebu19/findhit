const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const cors = require('cors');
const session = require('express-session');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// PostgreSQL config
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
});

// Middlewares
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/', (req, res) => {
  res.send('FindHit is live!');
});

app.use(session({
  secret: 'your-super-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // true if using https
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

// SIGNUP
app.post('/signup', async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, email, hashedPassword, role]
    );

    res.status(201).json({ message: 'User created', userId: result.rows[0].id });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already in use' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// LOGIN
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.userId = user.id; // store user session
    res.status(200).json({ message: 'Login successful', userId: user.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 🆕 GET CURRENT USER SESSION DATA
app.get('/me', async (req, res) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ error: 'User not logged in' });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, email, role, bio, location, specialties, key_strengths, services, previous_projects 
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching user info' });
  }
});

// UPDATE PROFILE
app.post('/profile', async (req, res) => {
  const {
    bio,
    location,
    specialties,
    key_strengths,
    services,
    previous_projects,
  } = req.body;

  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ error: 'User not logged in' });
  }

  try {
    await pool.query(`
      UPDATE users SET
        bio = $1,
        location = $2,
        specialties = $3,
        key_strengths = $4,
        services = $5,
        previous_projects = $6
      WHERE id = $7
    `, [bio, location, specialties, key_strengths, services, previous_projects, userId]);

    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// VIEW PROFILE PAGE
app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'viewprofile.html'));
});

// PUBLIC PROFILE DATA BY USER ID
app.get('/api/profile/:userId', async (req, res) => {
  const userId = req.params.userId;

  try {
    const result = await pool.query(
      `SELECT name, email, role, bio, location, specialties, key_strengths, services, previous_projects
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching profile' });
  }
});

// LIST ALL PUBLIC PROFILES
app.get('/profiles', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, bio, location, specialties, key_strengths, services, previous_projects 
      FROM users
      WHERE bio IS NOT NULL
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch profiles' });
  }
});

// WAITLIST SIGNUP
app.post('/api/waitlist', async (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  try {
    const existing = await pool.query('SELECT id FROM waitlist WHERE email = $1', [email]);

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'This email is already on the waitlist.' });
    }

    await pool.query(
      'INSERT INTO waitlist (name, email) VALUES ($1, $2)',
      [name, email]
    );

    res.status(201).json({ message: 'You have been added to the waitlist!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again later.' });
  }
});

// SERVER START
app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});
