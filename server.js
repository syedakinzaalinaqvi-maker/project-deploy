require('dotenv').config();
const express = require('express');
const mariadb = require('mariadb');


const app = express();
app.use(express.json());
app.use(express.static('public'));
// Base connection (for creating DB)
const basePool = mariadb.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  connectionLimit: 5,
});

async function initDatabase() {
  let conn;
  try {
    conn = await basePool.getConnection();
    console.log("✅ Connected to MariaDB server");

    // Create DB if not exists
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
    console.log(`✅ Database '${process.env.DB_NAME}' ensured`);

    await conn.query(`USE \`${process.env.DB_NAME}\``);

    // Create table if not exists
    await conn.query(`
      CREATE TABLE IF NOT EXISTS submissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL,
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Table 'submissions' ensured");
  } catch (err) {
    console.error("❌ DB initialization failed:", err);
    process.exit(1);
  } finally {
    if (conn) conn.release();
  }
}

// After DB exists
const pool = mariadb.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  connectionLimit: 5,
  connectTimeout: 30000,
});

// POST — Save new submission
app.post('/api/submit', async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email)
    return res.status(400).json({ success: false, message: 'Missing fields' });

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query(
      'INSERT INTO submissions (name, email, message) VALUES (?, ?, ?)',
      [name, email, message]
    );
    res.json({ success: true, message: 'Saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'DB error' });
  } finally {
    if (conn) conn.release();
  }
});

// 🆕 GET — Fetch all submissions
app.get('/api/submissions', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query('SELECT * FROM submissions ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch data' });
  } finally {
    if (conn) conn.release();
  }
});

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Start
const port = process.env.PORT || 3000;
initDatabase().then(() => {
  app.listen(port, () => console.log(`🚀 API listening on port ${port}`));
});
