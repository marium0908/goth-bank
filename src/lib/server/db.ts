import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hashSecret } from './auth';

const globalForDb = globalThis as unknown as {
  __gothBankDb?: Database.Database;
  __gothBankDbInitialized?: boolean;
};

function createDatabaseInstance(): Database.Database {
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const DATA_DIR = isServerless
    ? path.join(os.tmpdir(), 'goth_bank_data')
    : path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const DB_PATH = path.join(DATA_DIR, 'meridian_bank.db');
  const instance = new Database(DB_PATH);

  try {
    instance.pragma(isServerless ? 'journal_mode = DELETE' : 'journal_mode = WAL');
  } catch {
    // Fallback to default journal mode if filesystem restricts pragma changes
  }
  instance.pragma('foreign_keys = ON');
  return instance;
}

export function getDb(): Database.Database {
  if (!globalForDb.__gothBankDb) {
    globalForDb.__gothBankDb = createDatabaseInstance();
  }
  if (!globalForDb.__gothBankDbInitialized) {
    initDatabase(globalForDb.__gothBankDb);
    globalForDb.__gothBankDbInitialized = true;
  }
  return globalForDb.__gothBankDb;
}

export const db = getDb();

export function initDatabase(targetDb: Database.Database = getDb()): void {
  targetDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'customer')),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked')),
      kyc_verified INTEGER NOT NULL DEFAULT 0,
      two_factor_enabled INTEGER NOT NULL DEFAULT 0,
      address TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bank_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_number TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_type TEXT NOT NULL CHECK (account_type IN ('Savings Account', 'Current Account', 'Business Account')),
      balance REAL NOT NULL DEFAULT 0 CHECK (balance >= 0),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'closed')),
      daily_limit REAL NOT NULL DEFAULT 25000,
      single_tx_limit REAL NOT NULL DEFAULT 10000,
      min_balance REAL NOT NULL DEFAULT 100,
      currency TEXT NOT NULL DEFAULT 'USD',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tx_ref TEXT NOT NULL UNIQUE,
      idempotency_key TEXT UNIQUE,
      sender_account_id INTEGER REFERENCES bank_accounts(id),
      receiver_account_id INTEGER REFERENCES bank_accounts(id),
      sender_account_number TEXT,
      receiver_account_number TEXT,
      tx_type TEXT NOT NULL CHECK (tx_type IN ('Deposit', 'Withdrawal', 'Fund Transfer', 'Loan Disbursement', 'Loan Repayment')),
      amount REAL NOT NULL CHECK (amount > 0),
      fee REAL NOT NULL DEFAULT 0 CHECK (fee >= 0),
      status TEXT NOT NULL CHECK (status IN ('Pending', 'Completed', 'Failed', 'Reversed')),
      description TEXT NOT NULL DEFAULT '',
      flagged INTEGER NOT NULL DEFAULT 0,
      flag_reason TEXT NOT NULL DEFAULT '',
      reviewed_by INTEGER REFERENCES users(id),
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deposit_withdraw_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_ref TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      account_id INTEGER NOT NULL REFERENCES bank_accounts(id),
      request_type TEXT NOT NULL CHECK (request_type IN ('Deposit', 'Withdrawal')),
      amount REAL NOT NULL CHECK (amount > 0),
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
      reviewed_by INTEGER REFERENCES users(id),
      review_note TEXT NOT NULL DEFAULT '',
      transaction_id INTEGER REFERENCES transactions(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_ref TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      account_id INTEGER NOT NULL REFERENCES bank_accounts(id),
      loan_type TEXT NOT NULL,
      requested_amount REAL NOT NULL CHECK (requested_amount > 0),
      approved_amount REAL NOT NULL DEFAULT 0,
      interest_rate REAL NOT NULL DEFAULT 6.5,
      duration_months INTEGER NOT NULL CHECK (duration_months > 0),
      monthly_income REAL NOT NULL CHECK (monthly_income >= 0),
      employment_status TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Under Review', 'Approved', 'Rejected', 'Active', 'Completed')),
      remaining_balance REAL NOT NULL DEFAULT 0,
      staff_note TEXT NOT NULL DEFAULT '',
      forwarded_by INTEGER REFERENCES users(id),
      reviewed_by INTEGER REFERENCES users(id),
      disbursement_tx_id INTEGER REFERENCES transactions(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS loan_repayments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_id INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
      installment_number INTEGER NOT NULL,
      due_date TEXT NOT NULL,
      principal_amount REAL NOT NULL,
      interest_amount REAL NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Paid')),
      paid_at TEXT,
      transaction_id INTEGER REFERENCES transactions(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('transfer', 'deposit', 'withdrawal', 'loan', 'security')),
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bank_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      default_daily_transfer_limit REAL NOT NULL DEFAULT 25000,
      default_max_single_tx REAL NOT NULL DEFAULT 10000,
      default_min_balance REAL NOT NULL DEFAULT 100,
      transfer_fee_percent REAL NOT NULL DEFAULT 0.25,
      suspicious_amount_threshold REAL NOT NULL DEFAULT 10000,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS two_factor_challenges (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash TEXT NOT NULL,
      action_type TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_accounts_user ON bank_accounts(user_id);
    CREATE INDEX IF NOT EXISTS idx_tx_sender ON transactions(sender_account_id);
    CREATE INDEX IF NOT EXISTS idx_tx_receiver ON transactions(receiver_account_id);
    CREATE INDEX IF NOT EXISTS idx_tx_created ON transactions(created_at);
    CREATE INDEX IF NOT EXISTS idx_loans_user ON loans(user_id);
    CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
  `);

  const settingsCount = targetDb.prepare('SELECT COUNT(*) AS cnt FROM bank_settings').get() as { cnt: number };
  if (settingsCount.cnt === 0) {
    targetDb.prepare(`
      INSERT INTO bank_settings (id, default_daily_transfer_limit, default_max_single_tx, default_min_balance, transfer_fee_percent, suspicious_amount_threshold)
      VALUES (1, 25000, 10000, 100, 0.25, 10000)
    `).run();
  }

  const userCount = targetDb.prepare('SELECT COUNT(*) AS cnt FROM users').get() as { cnt: number };
  if (userCount.cnt === 0) {
    seedInitialData(targetDb);
  }
}

function seedInitialData(targetDb: Database.Database): void {
  const seed = targetDb.transaction(() => {
    const insertUser = targetDb.prepare(`
      INSERT INTO users (full_name, email, phone, password_hash, pin_hash, role, status, kyc_verified, two_factor_enabled, address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const adminId = Number(
      insertUser.run(
        'Elena Vance',
        'admin@meridianbank.demo',
        '+1 (415) 890-1100',
        hashSecret('Admin!2026'),
        hashSecret('1122'),
        'admin',
        'active',
        1,
        0,
        '400 Montgomery St, San Francisco, CA',
        '2026-05-01 09:00:00'
      ).lastInsertRowid
    );

    const staffId = Number(
      insertUser.run(
        'Marcus Chen',
        'staff@meridianbank.demo',
        '+1 (415) 890-2210',
        hashSecret('Staff!2026'),
        hashSecret('3344'),
        'staff',
        'active',
        1,
        0,
        '400 Montgomery St, San Francisco, CA',
        '2026-05-04 09:30:00'
      ).lastInsertRowid
    );

    const sophiaId = Number(
      insertUser.run(
        'Sophia Martinez',
        'customer@meridianbank.demo',
        '+1 (312) 555-0184',
        hashSecret('Customer!2026'),
        hashSecret('1234'),
        'customer',
        'active',
        1,
        0,
        '215 W Huron St, Chicago, IL',
        '2026-05-12 10:15:00'
      ).lastInsertRowid
    );

    const davidId = Number(
      insertUser.run(
        'David Okafor',
        'david.okafor@meridianbank.demo',
        '+1 (646) 555-0192',
        hashSecret('Customer!2026'),
        hashSecret('5678'),
        'customer',
        'active',
        1,
        0,
        '88 Pine St, New York, NY',
        '2026-05-18 14:20:00'
      ).lastInsertRowid
    );

    const ariaId = Number(
      insertUser.run(
        'Aria Patel',
        'aria.patel@meridianbank.demo',
        '+1 (512) 555-0147',
        hashSecret('Customer!2026'),
        hashSecret('9012'),
        'customer',
        'active',
        0,
        0,
        '600 Congress Ave, Austin, TX',
        '2026-06-02 11:05:00'
      ).lastInsertRowid
    );

    const insertAccount = targetDb.prepare(`
      INSERT INTO bank_accounts (account_number, user_id, account_type, balance, status, daily_limit, single_tx_limit, min_balance, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const sophiaSavings = Number(
      insertAccount.run('4091827364', sophiaId, 'Savings Account', 48250.0, 'active', 25000, 10000, 100, '2026-05-12 10:20:00').lastInsertRowid
    );
    const sophiaCurrent = Number(
      insertAccount.run('4091827399', sophiaId, 'Current Account', 14890.5, 'active', 30000, 15000, 50, '2026-05-12 10:22:00').lastInsertRowid
    );
    const sophiaBusiness = Number(
      insertAccount.run('4091827455', sophiaId, 'Business Account', 92400.0, 'active', 75000, 25000, 500, '2026-06-01 09:00:00').lastInsertRowid
    );

    const davidSavings = Number(
      insertAccount.run('4092104411', davidId, 'Savings Account', 22100.0, 'active', 20000, 10000, 100, '2026-05-18 14:30:00').lastInsertRowid
    );
    const davidCurrent = Number(
      insertAccount.run('4092104488', davidId, 'Current Account', 6420.0, 'active', 15000, 8000, 50, '2026-05-18 14:32:00').lastInsertRowid
    );

    const ariaCurrent = Number(
      insertAccount.run('4093309921', ariaId, 'Current Account', 31500.0, 'active', 25000, 10000, 100, '2026-06-02 11:10:00').lastInsertRowid
    );

    const insertTx = targetDb.prepare(`
      INSERT INTO transactions (tx_ref, sender_account_id, receiver_account_id, sender_account_number, receiver_account_number, tx_type, amount, fee, status, description, flagged, flag_reason, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const historicalTxs: Array<[string, number | null, number | null, string | null, string | null, string, number, number, string, string, number, string, number, string]> = [
      ['TXN-20260615-100001', null, sophiaSavings, null, '4091827364', 'Deposit', 35000, 0, 'Completed', 'Initial liquidity funding', 0, '', staffId, '2026-06-15 09:15:00'],
      ['TXN-20260622-100002', null, davidSavings, null, '4092104411', 'Deposit', 18000, 0, 'Completed', 'Payroll & treasury reserve deposit', 0, '', staffId, '2026-06-22 14:20:00'],
      ['TXN-20260708-100003', null, sophiaBusiness, null, '4091827455', 'Deposit', 65000, 0, 'Completed', 'Q3 commercial retainer settlement', 0, '', staffId, '2026-07-08 11:00:00'],
      ['TXN-20260719-100004', sophiaSavings, sophiaCurrent, '4091827364', '4091827399', 'Fund Transfer', 4500, 0, 'Completed', 'Monthly operating buffer allocation', 0, '', sophiaId, '2026-07-19 16:40:00'],
      ['TXN-20260803-100005', davidCurrent, null, '4092104488', null, 'Withdrawal', 2200, 0, 'Completed', 'Wire settlement withdrawal', 0, '', staffId, '2026-08-03 10:05:00'],
      ['TXN-20260814-100006', null, ariaCurrent, null, '4093309921', 'Deposit', 34000, 0, 'Completed', 'Consulting escrow deposit', 0, '', staffId, '2026-08-14 13:12:00'],
      ['TXN-20260827-100007', sophiaCurrent, davidCurrent, '4091827399', '4092104488', 'Fund Transfer', 1850, 4.63, 'Completed', 'Architectural design milestone payment', 0, '', sophiaId, '2026-08-27 15:48:00'],
      ['TXN-20260909-100008', null, sophiaBusiness, null, '4091827455', 'Deposit', 32000, 0, 'Completed', 'Enterprise software license settlement', 0, '', staffId, '2026-09-09 09:55:00'],
      ['TXN-20260921-100009', sophiaCurrent, null, '4091827399', null, 'Withdrawal', 3100, 0, 'Completed', 'Quarterly tax disbursement', 0, '', staffId, '2026-09-21 12:30:00'],
      ['TXN-20261004-100010', null, davidSavings, null, '4092104411', 'Loan Disbursement', 12000, 0, 'Completed', 'Approved Personal Loan LN-2026-4410 disbursement', 0, '', adminId, '2026-10-04 11:20:00'],
      ['TXN-20261016-100011', ariaCurrent, sophiaBusiness, '4093309921', '4091827455', 'Fund Transfer', 11200, 28, 'Completed', 'Vendor hardware procurement batch', 1, 'Single transaction exceeds $10,000 compliance threshold', ariaId, '2026-10-16 17:05:00'],
      ['TXN-20261102-100012', null, sophiaSavings, null, '4091827364', 'Deposit', 18500, 0, 'Completed', 'Treasury yield maturity credit', 0, '', staffId, '2026-11-02 09:40:00'],
      ['TXN-20261108-100013', davidSavings, null, '4092104411', null, 'Loan Repayment', 1035.42, 0, 'Completed', 'Installment #1 for LN-2026-4410', 0, '', davidId, '2026-11-08 10:15:00'],
      ['TXN-20261114-100014', sophiaBusiness, null, '4091827455', null, 'Withdrawal', 4600, 0, 'Completed', 'Payroll distribution batch', 0, '', staffId, '2026-11-14 14:50:00'],
      ['TXN-20261118-100015', sophiaCurrent, ariaCurrent, '4091827399', '4093309921', 'Fund Transfer', 1420, 3.55, 'Completed', 'Cloud infrastructure shared invoice', 0, '', sophiaId, '2026-11-18 16:12:00'],
    ];

    for (const row of historicalTxs) {
      insertTx.run(...row);
    }

    const insertReq = targetDb.prepare(`
      INSERT INTO deposit_withdraw_requests (request_ref, user_id, account_id, request_type, amount, description, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertReq.run('REQ-20261119-701', sophiaId, sophiaCurrent, 'Deposit', 5400, 'Client retainer check clearing', 'Pending', '2026-11-19 14:10:00');
    insertReq.run('REQ-20261120-702', davidId, davidCurrent, 'Withdrawal', 1200, 'External brokerage settlement', 'Pending', '2026-11-20 09:25:00');

    const insertLoan = targetDb.prepare(`
      INSERT INTO loans (loan_ref, user_id, account_id, loan_type, requested_amount, approved_amount, interest_rate, duration_months, monthly_income, employment_status, description, status, remaining_balance, staff_note, forwarded_by, reviewed_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const davidLoanId = Number(
      insertLoan.run(
        'LN-2026-4410',
        davidId,
        davidSavings,
        'Personal Loan',
        12000,
        12000,
        6.5,
        12,
        8900,
        'Full-Time Salaried',
        'Home studio renovation and equipment upgrade',
        'Active',
        10964.58,
        'Verified W2 income and low debt-to-income ratio.',
        staffId,
        adminId,
        '2026-10-01 10:00:00',
        '2026-10-04 11:20:00'
      ).lastInsertRowid
    );

    insertLoan.run(
      'LN-2026-8821',
      sophiaId,
      sophiaBusiness,
      'Business Expansion',
      45000,
      0,
      7.25,
      24,
      19500,
      'Business Owner',
      'Working capital facility for Q1 regional office launch',
      'Under Review',
      0,
      'Verified 2 years of business account cash flow. Recommended for admin approval.',
      staffId,
      null,
      '2026-11-16 11:30:00',
      '2026-11-18 15:00:00'
    );

    insertLoan.run(
      'LN-2026-9104',
      ariaId,
      ariaCurrent,
      'Auto Finance',
      28000,
      0,
      6.9,
      36,
      11200,
      'Self-Employed Consultant',
      'Commercial electric fleet vehicle purchase',
      'Pending',
      0,
      '',
      null,
      null,
      '2026-11-19 16:45:00',
      '2026-11-19 16:45:00'
    );

    const insertRepayment = targetDb.prepare(`
      INSERT INTO loan_repayments (loan_id, installment_number, due_date, principal_amount, interest_amount, total_amount, status, paid_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 1; i <= 12; i++) {
      const monthOffset = i;
      const dueDate = new Date(Date.UTC(2026, 9 + monthOffset, 8)).toISOString().slice(0, 10);
      insertRepayment.run(
        davidLoanId,
        i,
        dueDate,
        970.42,
        65.0,
        1035.42,
        i === 1 ? 'Paid' : 'Scheduled',
        i === 1 ? '2026-11-08 10:15:00' : null
      );
    }

    const insertNotif = targetDb.prepare(`
      INSERT INTO notifications (user_id, title, message, category, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertNotif.run(sophiaId, 'Deposit credit posted', '$18,500.00 was credited to Savings Account ••7364.', 'deposit', 0, '2026-11-02 09:40:00');
    insertNotif.run(sophiaId, 'Transfer completed', '$1,420.00 sent to Aria Patel (••9921). Ref: TXN-20261118-100015.', 'transfer', 0, '2026-11-18 16:12:00');
    insertNotif.run(sophiaId, 'Loan forwarded to underwriting', 'Your Business Expansion request LN-2026-8821 is Under Review.', 'loan', 1, '2026-11-18 15:00:00');
    insertNotif.run(davidId, 'Loan approved & disbursed', '$12,000.00 was disbursed to your Savings Account ••4411.', 'loan', 0, '2026-10-04 11:20:00');
    insertNotif.run(adminId, 'Compliance alert raised', 'TXN-20261016-100011 ($11,200.00) exceeded threshold and is awaiting review.', 'security', 0, '2026-10-16 17:05:00');
  });

  seed();
}
