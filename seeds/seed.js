// ─── Database Seed Script ────────────────────────
// Run: node seeds/seed.js
// Populates the database with the same data as lib/mock-data.ts
// so the frontend works identically after switching to the API.

require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool   = require('../config/db');
const { generateId } = require('../utils/helpers');
const fs = require('fs');
const path = require('path');

async function seed() {
  const conn = await pool.getConnection();

  try {
    console.log('🌱 Seeding database...\n');

    // Run schema first
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements) {
      await conn.query(stmt);
    }
    console.log('✅  Schema created\n');

    // ─── Users ─────────────────────────────────
    const userPassword = await bcrypt.hash('password123', 12);
    const adminPassword = await bcrypt.hash('adminpassword', 12);

    // User 1: John Doe (matches mock-data u1)
    await conn.query(
      `INSERT INTO users (id, name, email, password, role, status, joined_at)
       VALUES ('u1', 'John Doe', 'user@example.com', ?, 'user', 'active', '2024-01-15 10:00:00')
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [userPassword]
    );

    // User 2: Jane Smith (matches mock-data u2)
    await conn.query(
      `INSERT INTO users (id, name, email, password, role, status, joined_at)
       VALUES ('u2', 'Jane Smith', 'jane@example.com', ?, 'user', 'active', '2024-02-20 14:30:00')
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [userPassword]
    );

    // Admin: Admin User (matches mock-data a1)
    await conn.query(
      `INSERT INTO users (id, name, email, password, role, status, joined_at)
       VALUES ('a1', 'Admin User', 'admin@example.com', ?, 'admin', 'active', '2024-01-01 00:00:00')
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [adminPassword]
    );

    console.log('✅  Users seeded (user@example.com / password123, admin@example.com / adminpassword)');

    // ─── Accounts ──────────────────────────────
    await conn.query(
      `INSERT INTO accounts (id, user_id, account_number, sort_code, type, balance, currency)
       VALUES ('acc1', 'u1', '12345678', '60-12-34', 'Current Account', 2450.75, 'GBP')
       ON DUPLICATE KEY UPDATE balance = VALUES(balance)`
    );
    await conn.query(
      `INSERT INTO accounts (id, user_id, account_number, sort_code, type, balance, currency)
       VALUES ('acc2', 'u1', '87654321', '60-12-34', 'Savings Account', 12500.00, 'GBP')
       ON DUPLICATE KEY UPDATE balance = VALUES(balance)`
    );
    await conn.query(
      `INSERT INTO accounts (id, user_id, account_number, sort_code, type, balance, currency)
       VALUES ('acc3', 'u2', '11223344', '60-55-22', 'Current Account', 850.20, 'GBP')
       ON DUPLICATE KEY UPDATE balance = VALUES(balance)`
    );

    console.log('✅  Accounts seeded');

    // ─── Transactions ──────────────────────────
    const txs = [
      ['t1', 'u1', 'acc1', 'debit',  'Shopping',  'Amazon UK',        45.99,  '2024-03-20 15:45:00', 'completed'],
      ['t2', 'u1', 'acc1', 'credit', 'Income',    'Tech Corp Salary', 2800.00,'2024-03-01 09:00:00', 'completed'],
      ['t3', 'u1', 'acc1', 'debit',  'Bills',     'British Gas',      120.00, '2024-03-15 10:30:00', 'completed'],
      ['t4', 'u1', 'acc2', 'credit', 'Transfer',  'Internal Transfer',500.00, '2024-03-18 12:00:00', 'completed'],
    ];
    for (const tx of txs) {
      await conn.query(
        `INSERT INTO transactions (id, user_id, account_id, type, category, merchant, amount, date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE merchant = VALUES(merchant)`,
        tx
      );
    }
    console.log('✅  Transactions seeded');

    // ─── Notifications ─────────────────────────
    await conn.query(
      `INSERT INTO notifications (id, user_id, title, message, date, \`read\`)
       VALUES ('n1', 'u1', 'Security Alert', 'New login detected from London, UK.', '2024-03-21 08:00:00', FALSE)
       ON DUPLICATE KEY UPDATE title = VALUES(title)`
    );
    await conn.query(
      `INSERT INTO notifications (id, user_id, title, message, date, \`read\`)
       VALUES ('n2', 'u1', 'Payment Received', 'Your salary has been credited to your account.', '2024-03-01 09:05:00', TRUE)
       ON DUPLICATE KEY UPDATE title = VALUES(title)`
    );
    console.log('✅  Notifications seeded');

    // ─── Support Tickets ───────────────────────
    await conn.query(
      `INSERT INTO tickets (id, user_id, subject, message, status, date)
       VALUES ('tk1', 'u1', 'Card Replacement', 'My card is damaged. Can I get a new one?', 'open', '2024-03-19 11:00:00')
       ON DUPLICATE KEY UPDATE subject = VALUES(subject)`
    );
    console.log('✅  Tickets seeded');

    // ─── Activity Logs ─────────────────────────
    const logs = [
      [generateId(), 'a1', 'Admin',    'Approved transfer #T842',                 'CheckCircle2', 'text-emerald-400'],
      [generateId(), null,  'System',   'New user registration: Jane S.',          'Users',        'text-blue-400'],
      [generateId(), 'a1', 'Admin',    'Updated interest rates',                  'Activity',     'text-nw-pink'],
      [generateId(), null,  'Security', 'Failed login attempt: IP 192.168.1.1',   'AlertCircle',  'text-amber-400'],
      [generateId(), 'a1', 'Admin',    'Resolved ticket #TK102',                  'CheckCircle2', 'text-emerald-400'],
    ];
    for (const log of logs) {
      await conn.query(
        `INSERT INTO activity_logs (id, admin_id, actor, action, icon, color) VALUES (?, ?, ?, ?, ?, ?)`,
        log
      );
    }
    console.log('✅  Activity logs seeded');

    console.log('\n🎉 Database seeded successfully!');
    console.log('\n─── Login Credentials ───────────────');
    console.log('User:  user@example.com  / password123');
    console.log('Admin: admin@example.com / adminpassword');
    console.log('─────────────────────────────────────\n');

  } catch (err) {
    console.error('❌  Seed failed:', err.message);
    console.error(err);
  } finally {
    conn.release();
    process.exit(0);
  }
}

seed();
