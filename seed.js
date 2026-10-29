// seed.js
const bcrypt = require('bcryptjs');
const db = require('./db');

async function seed() {
  const hash = await bcrypt.hash('password123', 10);

  // Clear existing records and reset sequence
  await db.query('TRUNCATE TABLE messages, users RESTART IDENTITY CASCADE;');

  // Insert two test users
  await db.query(`
    INSERT INTO users (username, email, password)
    VALUES
      ('Alice', 'alice@test.com', $1),
      ('Bob', 'bob@test.com', $1);
  `, [hash]);

  console.log('Seeded users:');
  console.log('1. Alice -> Email: alice@test.com | Password: password123');
  console.log('2. Bob   -> Email: bob@test.com   | Password: password123');
  process.exit(0);
}

seed();
