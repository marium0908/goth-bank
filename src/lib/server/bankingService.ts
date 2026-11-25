import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';
import {
  extractTokenFromRequest,
  hashSecret,
  HttpError,
  requireRole,
  signAuthToken,
  verifyAuthToken,
  verifySecret,
  type AuthenticatedUser,
} from './auth';
import { getDb } from './db';

function getUserById(id: number): AuthenticatedUser | undefined {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, full_name, email, phone, role, status, kyc_verified, two_factor_enabled, address, created_at
       FROM users WHERE id = ?`
    )
    .get(id) as AuthenticatedUser | undefined;
}

export function requireAuth(req: NextRequest): { user: AuthenticatedUser; token: string } {
  const token = extractTokenFromRequest(req);
  if (!token) {
    throw new HttpError(401, 'Authentication required.');
  }
  const payload = verifyAuthToken(token);
  if (!payload) {
    throw new HttpError(401, 'Session token is invalid or expired.');
  }
  const user = getUserById(payload.sub);
  if (!user) {
    throw new HttpError(401, 'Account no longer exists.');
  }
  if (user.status !== 'active') {
    throw new HttpError(403, `Account is currently ${user.status}. Contact bank administration.`);
  }
  return { user, token };
}

function generateRef(prefix: string): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = crypto.randomInt(100000, 999999);
  return `${prefix}-${datePart}-${randomPart}`;
}

function generateAccountNumber(): string {
  const db = getDb();
  while (true) {
    const num = `409${crypto.randomInt(1000000, 9999999)}`;
    const exists = db.prepare('SELECT id FROM bank_accounts WHERE account_number = ?').get(num);
    if (!exists) return num;
  }
}

function getBankSettings() {
  const db = getDb();
  return db.prepare('SELECT * FROM bank_settings WHERE id = 1').get() as {
    id: number;
    default_daily_transfer_limit: number;
    default_max_single_tx: number;
    default_min_balance: number;
    transfer_fee_percent: number;
    suspicious_amount_threshold: number;
    updated_at: string;
  };
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function createNotification(
  userId: number,
  title: string,
  message: string,
  category: 'transfer' | 'deposit' | 'withdrawal' | 'loan' | 'security'
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO notifications (user_id, title, message, category)
     VALUES (?, ?, ?, ?)`
  ).run(userId, title, message, category);
}

/* ============================================================================
 * AUTHENTICATION & SECURITY
 * ========================================================================== */

export function loginWithCredentials(body: Record<string, unknown>) {
  const db = getDb();
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!email || !password) {
    throw new HttpError(400, 'Email and password are required.');
  }

  const userRow = db
    .prepare('SELECT * FROM users WHERE LOWER(email) = ?')
    .get(email) as (AuthenticatedUser & { password_hash: string }) | undefined;

  if (!userRow || !verifySecret(password, userRow.password_hash)) {
    throw new HttpError(401, 'Invalid email or password.');
  }

  if (userRow.status !== 'active') {
    throw new HttpError(403, `Account is currently ${userRow.status}. Please contact support.`);
  }

  const token = signAuthToken({
    id: userRow.id,
    role: userRow.role,
    email: userRow.email,
  });

  const { password_hash: _pw, ...safeUser } = userRow as AuthenticatedUser & {
    password_hash: string;
    pin_hash?: string;
  };
  delete safeUser.pin_hash;

  return { token, user: safeUser };
}

export function registerNewCustomer(body: Record<string, unknown>) {
  const db = getDb();
  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
  const address = typeof body?.address === 'string' ? body.address.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const pin = typeof body?.pin === 'string' ? body.pin.trim() : '';

  if (fullName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'Valid full name and email address are required.');
  }
  if (password.length < 8) {
    throw new HttpError(400, 'Password must be at least 8 characters.');
  }
  if (!/^\d{4}$/.test(pin)) {
    throw new HttpError(400, 'Transaction PIN must be exactly 4 digits.');
  }

  const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(email);
  if (existing) {
    throw new HttpError(409, 'An account with this email already exists.');
  }

  const settings = getBankSettings();
  const tx = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO users (full_name, email, phone, password_hash, pin_hash, role, status, kyc_verified, address)
         VALUES (?, ?, ?, ?, ?, 'customer', 'active', 0, ?)`
      )
      .run(fullName, email, phone, hashSecret(password), hashSecret(pin), address);

    const newUserId = Number(result.lastInsertRowid);
    const acctNum = generateAccountNumber();
    db.prepare(
      `INSERT INTO bank_accounts (account_number, user_id, account_type, balance, status, daily_limit, single_tx_limit, min_balance)
       VALUES (?, ?, 'Savings Account', 0, 'active', ?, ?, ?)`
    ).run(
      acctNum,
      newUserId,
      settings.default_daily_transfer_limit,
      settings.default_max_single_tx,
      settings.default_min_balance
    );

    createNotification(
      newUserId,
      'Welcome to Goth Bank',
      `Your Savings Account ${acctNum} is ready. Submit a deposit request to fund your balance.`,
      'security'
    );

    return newUserId;
  });

  const userId = tx();
  const user = getUserById(userId)!;
  const token = signAuthToken({ id: user.id, role: user.role, email: user.email });
  return { token, user };
}

export function updateUserSecurity(userId: number, body: Record<string, unknown>) {
  const db = getDb();
  const twoFactorEnabled = body?.twoFactorEnabled;
  const currentPin = typeof body?.currentPin === 'string' ? body.currentPin.trim() : '';
  const newPin = typeof body?.newPin === 'string' ? body.newPin.trim() : '';

  const userRow = db.prepare('SELECT pin_hash FROM users WHERE id = ?').get(userId) as { pin_hash: string };

  if (newPin) {
    if (!verifySecret(currentPin, userRow.pin_hash)) {
      throw new HttpError(403, 'Current transaction PIN is incorrect.');
    }
    if (!/^\d{4}$/.test(newPin)) {
      throw new HttpError(400, 'New transaction PIN must be exactly 4 digits.');
    }
    db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(hashSecret(newPin), userId);
    createNotification(userId, 'Transaction PIN updated', 'Your 4-digit security PIN was changed.', 'security');
  }

  if (typeof twoFactorEnabled === 'boolean') {
    db.prepare('UPDATE users SET two_factor_enabled = ? WHERE id = ?').run(twoFactorEnabled ? 1 : 0, userId);
    createNotification(
      userId,
      twoFactorEnabled ? 'Two-Factor Authentication enabled' : 'Two-Factor Authentication disabled',
      twoFactorEnabled
        ? 'High-value transfers and security actions now require a 6-digit verification code.'
        : 'Two-factor challenge on standard transfers was turned off.',
      'security'
    );
  }

  return { user: getUserById(userId) };
}

export function createTwoFactorChallenge(userId: number, body: Record<string, unknown>) {
  const db = getDb();
  const actionType = typeof body?.actionType === 'string' ? body.actionType : 'transfer';
  const code = String(crypto.randomInt(100000, 999999));
  const challengeId = crypto.randomUUID();
  const expiresAt = Date.now() + 5 * 60 * 1000;

  db.prepare(
    `INSERT INTO two_factor_challenges (id, user_id, code_hash, action_type, expires_at, used)
     VALUES (?, ?, ?, ?, ?, 0)`
  ).run(challengeId, userId, hashSecret(code), actionType, expiresAt);

  return {
    challengeId,
    expiresAt,
    simulatedDeliveryCode: code,
    message: 'Verification code generated for this simulated banking session.',
  };
}

/* ============================================================================
 * ACCOUNTS & CUSTOMER DASHBOARD
 * ========================================================================== */

export function listAccounts(user: AuthenticatedUser, query: { search?: string; status?: string }) {
  const db = getDb();
  if (user.role === 'customer') {
    const accounts = db
      .prepare(
        `SELECT a.*, u.full_name AS owner_name, u.email AS owner_email
         FROM bank_accounts a
         JOIN users u ON u.id = a.user_id
         WHERE a.user_id = ?
         ORDER BY a.id ASC`
      )
      .all(user.id);
    return { accounts };
  }

  const search = (query.search || '').trim().toLowerCase();
  const status = (query.status || '').trim();

  let sql = `
    SELECT a.*, u.full_name AS owner_name, u.email AS owner_email, u.status AS owner_status
    FROM bank_accounts a
    JOIN users u ON u.id = a.user_id
    WHERE 1=1
  `;
  const params: Array<string | number> = [];

  if (search) {
    sql += ` AND (LOWER(a.account_number) LIKE ? OR LOWER(u.full_name) LIKE ? OR LOWER(u.email) LIKE ?)`;
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  if (status && ['active', 'frozen', 'closed'].includes(status)) {
    sql += ` AND a.status = ?`;
    params.push(status);
  }
  sql += ` ORDER BY a.id DESC`;

  const accounts = db.prepare(sql).all(...params);
  return { accounts };
}

export function getCustomerDashboardData(userId: number, accountIdParam: number | null) {
  const db = getDb();
  const accounts = db
    .prepare('SELECT * FROM bank_accounts WHERE user_id = ? ORDER BY id ASC')
    .all(userId) as Array<{
    id: number;
    account_number: string;
    account_type: string;
    balance: number;
    status: string;
    daily_limit: number;
    single_tx_limit: number;
    min_balance: number;
    currency: string;
  }>;

  const accountIds = accountIdParam
    ? accounts.filter((a) => a.id === accountIdParam).map((a) => a.id)
    : accounts.map((a) => a.id);

  const settings = getBankSettings();

  if (accountIds.length === 0) {
    return {
      accounts,
      summary: {
        totalBalance: 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
        activeLoansCount: 0,
        totalLoanBalance: 0,
      },
      policy: {
        transferFeePercent: settings.transfer_fee_percent,
      },
      monthlySeries: [],
      distribution: [],
      recentTransactions: [],
    };
  }

  const placeholders = accountIds.map(() => '?').join(',');

  const totalBalance = accounts
    .filter((a) => accountIds.includes(a.id))
    .reduce((sum, a) => sum + a.balance, 0);

  const depositRow = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM transactions
       WHERE status = 'Completed'
         AND receiver_account_id IN (${placeholders})
         AND tx_type IN ('Deposit', 'Fund Transfer', 'Loan Disbursement')`
    )
    .get(...accountIds) as { total: number };

  const withdrawalRow = db
    .prepare(
      `SELECT COALESCE(SUM(amount + fee), 0) AS total
       FROM transactions
       WHERE status = 'Completed'
         AND sender_account_id IN (${placeholders})
         AND tx_type IN ('Withdrawal', 'Fund Transfer', 'Loan Repayment')`
    )
    .get(...accountIds) as { total: number };

  const loansStats = db
    .prepare(
      `SELECT COUNT(*) AS cnt, COALESCE(SUM(remaining_balance), 0) AS balance
       FROM loans
       WHERE user_id = ? AND status IN ('Active', 'Approved')`
    )
    .get(userId) as { cnt: number; balance: number };

  const txs = db
    .prepare(
      `SELECT *
       FROM transactions
       WHERE (sender_account_id IN (${placeholders}) OR receiver_account_id IN (${placeholders}))
         AND status = 'Completed'
       ORDER BY created_at ASC`
    )
    .all(...accountIds, ...accountIds) as Array<{
    id: number;
    sender_account_id: number | null;
    receiver_account_id: number | null;
    tx_type: string;
    amount: number;
    fee: number;
    created_at: string;
  }>;

  const monthlyMap = new Map<string, { month: string; deposits: number; spending: number }>();
  const typeMap = new Map<string, number>();

  for (const tx of txs) {
    const month = tx.created_at.slice(0, 7);
    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, { month, deposits: 0, spending: 0 });
    }
    const entry = monthlyMap.get(month)!;
    const isInbound = tx.receiver_account_id !== null && accountIds.includes(tx.receiver_account_id);
    const isOutbound = tx.sender_account_id !== null && accountIds.includes(tx.sender_account_id);

    if (isInbound && !isOutbound) {
      entry.deposits = roundCurrency(entry.deposits + tx.amount);
    } else if (isOutbound && !isInbound) {
      entry.spending = roundCurrency(entry.spending + tx.amount + tx.fee);
    } else if (isInbound && isOutbound) {
      entry.deposits = roundCurrency(entry.deposits + tx.amount);
      entry.spending = roundCurrency(entry.spending + tx.amount);
    }

    typeMap.set(tx.tx_type, roundCurrency((typeMap.get(tx.tx_type) || 0) + tx.amount));
  }

  const recentTransactions = db
    .prepare(
      `SELECT *
       FROM transactions
       WHERE sender_account_id IN (${placeholders}) OR receiver_account_id IN (${placeholders})
       ORDER BY created_at DESC, id DESC
       LIMIT 6`
    )
    .all(...accountIds, ...accountIds);

  return {
    accounts,
    summary: {
      totalBalance: roundCurrency(totalBalance),
      totalDeposits: roundCurrency(depositRow.total),
      totalWithdrawals: roundCurrency(withdrawalRow.total),
      activeLoansCount: loansStats.cnt,
      totalLoanBalance: roundCurrency(loansStats.balance),
    },
    policy: {
      transferFeePercent: settings.transfer_fee_percent,
    },
    monthlySeries: Array.from(monthlyMap.values()),
    distribution: Array.from(typeMap.entries()).map(([name, value]) => ({ name, value })),
    recentTransactions,
  };
}

/* ============================================================================
 * FUND TRANSFER (ACID ATOMIC)
 * ========================================================================== */

export function executeFundTransfer(user: AuthenticatedUser, body: Record<string, unknown>) {
  const db = getDb();
  const fromAccountId = Number(body?.fromAccountId);
  const recipientAccountNumber =
    typeof body?.recipientAccountNumber === 'string' ? body.recipientAccountNumber.trim() : '';
  const amount = Number(body?.amount);
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const pin = typeof body?.pin === 'string' ? body.pin.trim() : '';
  const idempotencyKey =
    typeof body?.idempotencyKey === 'string' && body.idempotencyKey.trim()
      ? body.idempotencyKey.trim()
      : null;
  const challengeId = typeof body?.challengeId === 'string' ? body.challengeId.trim() : '';
  const twoFactorCode = typeof body?.twoFactorCode === 'string' ? body.twoFactorCode.trim() : '';

  if (!Number.isInteger(fromAccountId) || fromAccountId <= 0) {
    throw new HttpError(400, 'Valid source account is required.');
  }
  if (!recipientAccountNumber) {
    throw new HttpError(400, 'Recipient account number is required.');
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpError(400, 'Transfer amount must be greater than zero.');
  }
  if (!pin) {
    throw new HttpError(400, 'Transaction PIN is required.');
  }

  if (idempotencyKey) {
    const duplicate = db
      .prepare('SELECT * FROM transactions WHERE idempotency_key = ?')
      .get(idempotencyKey);
    if (duplicate) {
      return {
        status: 200,
        body: {
          transaction: duplicate,
          duplicatePrevented: true,
          message: 'Duplicate request prevented; returning original transaction.',
        },
      };
    }
  }

  const userAuthRow = db.prepare('SELECT pin_hash, two_factor_enabled FROM users WHERE id = ?').get(user.id) as {
    pin_hash: string;
    two_factor_enabled: number;
  };

  if (!verifySecret(pin, userAuthRow.pin_hash)) {
    throw new HttpError(403, 'Invalid transaction PIN.');
  }

  const requires2FA = userAuthRow.two_factor_enabled === 1 || amount >= 5000;
  if (requires2FA) {
    if (!challengeId || !twoFactorCode) {
      throw new HttpError(428, 'Two-factor verification code is required for this transfer.', {
        requiresTwoFactor: true,
      });
    }
    const challenge = db
      .prepare('SELECT * FROM two_factor_challenges WHERE id = ? AND user_id = ?')
      .get(challengeId, user.id) as
      | { id: string; code_hash: string; expires_at: number; used: number }
      | undefined;

    if (!challenge || challenge.used === 1 || Date.now() > challenge.expires_at) {
      throw new HttpError(403, 'Verification challenge expired or already used.');
    }
    if (!verifySecret(twoFactorCode, challenge.code_hash)) {
      throw new HttpError(403, 'Invalid 6-digit two-factor verification code.');
    }
  }

  const result = db.transaction(() => {
    const fromAccount = db
      .prepare('SELECT * FROM bank_accounts WHERE id = ?')
      .get(fromAccountId) as
      | {
          id: number;
          account_number: string;
          user_id: number;
          balance: number;
          status: string;
          daily_limit: number;
          single_tx_limit: number;
          min_balance: number;
        }
      | undefined;

    if (!fromAccount) {
      throw new HttpError(404, 'Source account not found.');
    }
    if (fromAccount.user_id !== user.id) {
      throw new HttpError(403, 'You do not own the selected source account.');
    }
    if (fromAccount.status !== 'active') {
      throw new HttpError(403, `Source account is ${fromAccount.status} and cannot send funds.`);
    }

    const recipientAccount = db
      .prepare(
        `SELECT a.*, u.status AS owner_status
         FROM bank_accounts a
         JOIN users u ON u.id = a.user_id
         WHERE a.account_number = ?`
      )
      .get(recipientAccountNumber) as
      | {
          id: number;
          account_number: string;
          user_id: number;
          balance: number;
          status: string;
          owner_status: string;
        }
      | undefined;

    if (!recipientAccount) {
      throw new HttpError(404, 'Recipient account number was not found.');
    }
    if (recipientAccount.id === fromAccount.id) {
      throw new HttpError(400, 'Cannot transfer funds to the same account.');
    }
    if (recipientAccount.status !== 'active') {
      throw new HttpError(400, `Recipient account is currently ${recipientAccount.status}.`);
    }
    if (recipientAccount.owner_status !== 'active') {
      throw new HttpError(400, `Recipient profile is currently ${recipientAccount.owner_status} and cannot receive transfers.`);
    }

    const cleanAmount = roundCurrency(amount);
    if (cleanAmount > fromAccount.single_tx_limit) {
      throw new HttpError(
        400,
        `Amount exceeds single transaction limit of $${fromAccount.single_tx_limit.toLocaleString()}.`
      );
    }

    const todayVolume = db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM transactions
         WHERE sender_account_id = ?
           AND tx_type = 'Fund Transfer'
           AND status = 'Completed'
           AND date(created_at) = date('now')`
      )
      .get(fromAccount.id) as { total: number };

    if (todayVolume.total + cleanAmount > fromAccount.daily_limit) {
      throw new HttpError(
        400,
        `Daily transfer limit of $${fromAccount.daily_limit.toLocaleString()} would be exceeded.`
      );
    }

    const settings = getBankSettings();
    const isInternalOwnTransfer = recipientAccount.user_id === user.id;
    const fee = isInternalOwnTransfer
      ? 0
      : roundCurrency(cleanAmount * (settings.transfer_fee_percent / 100));
    const totalDebit = roundCurrency(cleanAmount + fee);

    if (fromAccount.balance - totalDebit < fromAccount.min_balance) {
      throw new HttpError(
        400,
        `Insufficient available funds. Account must retain minimum balance of $${fromAccount.min_balance.toFixed(2)}.`
      );
    }

    const flagReasons: string[] = [];
    if (cleanAmount >= settings.suspicious_amount_threshold) {
      flagReasons.push(`Amount exceeds $${settings.suspicious_amount_threshold.toLocaleString()} threshold`);
    }
    const velocityRow = db
      .prepare(
        `SELECT COUNT(*) AS cnt
         FROM transactions
         WHERE sender_account_id = ?
           AND created_at >= datetime('now', '-10 minutes')`
      )
      .get(fromAccount.id) as { cnt: number };
    if (velocityRow.cnt >= 3) {
      flagReasons.push('Rapid high-velocity transfer pattern detected');
    }
    if (fromAccount.balance > 0 && cleanAmount / fromAccount.balance >= 0.85 && cleanAmount >= 2500) {
      flagReasons.push('Single transfer depletes over 85% of account balance');
    }

    const flagged = flagReasons.length > 0 ? 1 : 0;
    const flagReason = flagReasons.join('; ');

    db.prepare('UPDATE bank_accounts SET balance = ROUND(balance - ?, 2) WHERE id = ?').run(
      totalDebit,
      fromAccount.id
    );
    db.prepare('UPDATE bank_accounts SET balance = ROUND(balance + ?, 2) WHERE id = ?').run(
      cleanAmount,
      recipientAccount.id
    );

    if (requires2FA && challengeId) {
      db.prepare('UPDATE two_factor_challenges SET used = 1 WHERE id = ?').run(challengeId);
    }

    const txRef = generateRef('TXN');
    const txInsert = db
      .prepare(
        `INSERT INTO transactions (
          tx_ref, idempotency_key, sender_account_id, receiver_account_id,
          sender_account_number, receiver_account_number, tx_type, amount, fee,
          status, description, flagged, flag_reason, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, 'Fund Transfer', ?, ?, 'Completed', ?, ?, ?, ?)`
      )
      .run(
        txRef,
        idempotencyKey,
        fromAccount.id,
        recipientAccount.id,
        fromAccount.account_number,
        recipientAccount.account_number,
        cleanAmount,
        fee,
        description || 'Fund Transfer',
        flagged,
        flagReason,
        user.id
      );

    const newTx = db
      .prepare('SELECT * FROM transactions WHERE id = ?')
      .get(Number(txInsert.lastInsertRowid));

    createNotification(
      user.id,
      'Transfer completed',
      `$${cleanAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} transferred to account ${recipientAccount.account_number}. Ref: ${txRef}.`,
      'transfer'
    );

    if (recipientAccount.user_id !== user.id) {
      createNotification(
        recipientAccount.user_id,
        'Money received',
        `You received $${cleanAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} into account ${recipientAccount.account_number}. Ref: ${txRef}.`,
        'transfer'
      );
    }

    if (flagged === 1) {
      const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all() as Array<{ id: number }>;
      for (const adm of admins) {
        createNotification(
          adm.id,
          'Suspicious transfer flagged',
          `${txRef} ($${cleanAmount.toFixed(2)}) flagged: ${flagReason}`,
          'security'
        );
      }
    }

    return newTx;
  })();

  return { status: 201, body: { transaction: result } };
}

/* ============================================================================
 * TRANSACTIONS LEDGER, FLAGGING & REVERSAL
 * ========================================================================== */

export function listTransactions(
  user: AuthenticatedUser,
  query: {
    search?: string;
    txType?: string;
    status?: string;
    flagged?: boolean;
    startDate?: string;
    endDate?: string;
    accountId?: number | null;
    userId?: number | null;
    page?: number;
    limit?: number;
  }
) {
  const db = getDb();
  const search = (query.search || '').trim().toLowerCase();
  const txType = (query.txType || '').trim();
  const status = (query.status || '').trim();
  const flaggedOnly = Boolean(query.flagged);
  const startDate = (query.startDate || '').trim();
  const endDate = (query.endDate || '').trim();
  const accountId = query.accountId || null;
  const filterUserId = query.userId || null;
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 12));
  const offset = (page - 1) * limit;

  let where = 'WHERE 1=1';
  const params: Array<string | number> = [];

  if (user.role === 'customer') {
    const userAccts = db
      .prepare('SELECT id FROM bank_accounts WHERE user_id = ?')
      .all(user.id) as Array<{ id: number }>;

    if (userAccts.length === 0) {
      return { transactions: [], total: 0, page, limit, totalPages: 1 };
    }

    const ownedIds = userAccts.map((a) => a.id);
    if (accountId && !ownedIds.includes(accountId)) {
      throw new HttpError(403, 'Cannot view transactions for another customer account.');
    }

    const filterIds = accountId ? [accountId] : ownedIds;
    const placeholders = filterIds.map(() => '?').join(',');
    where += ` AND (t.sender_account_id IN (${placeholders}) OR t.receiver_account_id IN (${placeholders}))`;
    params.push(...filterIds, ...filterIds);
  } else if (accountId) {
    where += ` AND (t.sender_account_id = ? OR t.receiver_account_id = ?)`;
    params.push(accountId, accountId);
  } else if (filterUserId) {
    const targetAccts = db
      .prepare('SELECT id FROM bank_accounts WHERE user_id = ?')
      .all(filterUserId) as Array<{ id: number }>;
    if (targetAccts.length === 0) {
      return { transactions: [], total: 0, page, limit, totalPages: 1 };
    }
    const ids = targetAccts.map((a) => a.id);
    const placeholders = ids.map(() => '?').join(',');
    where += ` AND (t.sender_account_id IN (${placeholders}) OR t.receiver_account_id IN (${placeholders}))`;
    params.push(...ids, ...ids);
  }

  if (search) {
    where += ` AND (LOWER(t.tx_ref) LIKE ? OR LOWER(t.description) LIKE ? OR LOWER(COALESCE(t.sender_account_number, '')) LIKE ? OR LOWER(COALESCE(t.receiver_account_number, '')) LIKE ?)`;
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }

  if (txType) {
    where += ` AND t.tx_type = ?`;
    params.push(txType);
  }

  if (status) {
    where += ` AND t.status = ?`;
    params.push(status);
  }

  if (flaggedOnly) {
    where += ` AND t.flagged = 1`;
  }

  if (startDate) {
    where += ` AND date(t.created_at) >= date(?)`;
    params.push(startDate);
  }

  if (endDate) {
    where += ` AND date(t.created_at) <= date(?)`;
    params.push(endDate);
  }

  const countRow = db
    .prepare(`SELECT COUNT(*) AS total FROM transactions t ${where}`)
    .get(...params) as { total: number };

  const rows = db
    .prepare(
      `SELECT t.*,
              su.full_name AS sender_name,
              ru.full_name AS receiver_name
       FROM transactions t
       LEFT JOIN bank_accounts sa ON sa.id = t.sender_account_id
       LEFT JOIN users su ON su.id = sa.user_id
       LEFT JOIN bank_accounts ra ON ra.id = t.receiver_account_id
       LEFT JOIN users ru ON ru.id = ra.user_id
       ${where}
       ORDER BY t.created_at DESC, t.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  return {
    transactions: rows,
    total: countRow.total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(countRow.total / limit)),
  };
}

export function flagTransactionRecord(user: AuthenticatedUser, txId: number, body: Record<string, unknown>) {
  requireRole(user, 'staff', 'admin');
  const db = getDb();
  const flagged = Boolean(body?.flagged);
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';

  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(txId) as
    | { id: number; tx_ref: string; amount: number }
    | undefined;
  if (!tx) {
    throw new HttpError(404, 'Transaction not found.');
  }

  db.prepare(
    'UPDATE transactions SET flagged = ?, flag_reason = ?, reviewed_by = ? WHERE id = ?'
  ).run(flagged ? 1 : 0, flagged ? reason || 'Flagged by bank staff for review' : '', user.id, txId);

  if (flagged) {
    const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all() as Array<{ id: number }>;
    for (const adm of admins) {
      createNotification(
        adm.id,
        'Transaction flagged by staff',
        `${tx.tx_ref} ($${tx.amount.toFixed(2)}) was flagged: ${reason || 'Manual compliance check'}.`,
        'security'
      );
    }
  }

  return { transaction: db.prepare('SELECT * FROM transactions WHERE id = ?').get(txId) };
}

export function resolveTransactionRecord(user: AuthenticatedUser, txId: number, body: Record<string, unknown>) {
  requireRole(user, 'admin');
  const db = getDb();
  const action = body?.action === 'reverse' ? 'reverse' : 'clear';

  const updated = db.transaction(() => {
    const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(txId) as
      | {
          id: number;
          tx_ref: string;
          tx_type: string;
          sender_account_id: number | null;
          receiver_account_id: number | null;
          amount: number;
          fee: number;
          status: string;
        }
      | undefined;

    if (!tx) throw new HttpError(404, 'Transaction not found.');

    if (action === 'clear') {
      db.prepare('UPDATE transactions SET flagged = 0, reviewed_by = ? WHERE id = ?').run(user.id, txId);
      return db.prepare('SELECT * FROM transactions WHERE id = ?').get(txId);
    }

    if (tx.status !== 'Completed' || tx.tx_type !== 'Fund Transfer') {
      throw new HttpError(400, 'Only completed fund transfers can be reversed.');
    }

    if (!tx.sender_account_id || !tx.receiver_account_id) {
      throw new HttpError(400, 'Both accounts are required for reversal.');
    }

    const receiver = db
      .prepare('SELECT balance, user_id FROM bank_accounts WHERE id = ?')
      .get(tx.receiver_account_id) as { balance: number; user_id: number };
    const sender = db
      .prepare('SELECT user_id FROM bank_accounts WHERE id = ?')
      .get(tx.sender_account_id) as { user_id: number };

    if (receiver.balance < tx.amount) {
      throw new HttpError(400, 'Receiver account has insufficient balance to reverse.');
    }

    db.prepare('UPDATE bank_accounts SET balance = ROUND(balance - ?, 2) WHERE id = ?').run(
      tx.amount,
      tx.receiver_account_id
    );
    db.prepare('UPDATE bank_accounts SET balance = ROUND(balance + ?, 2) WHERE id = ?').run(
      roundCurrency(tx.amount + tx.fee),
      tx.sender_account_id
    );

    db.prepare(
      `UPDATE transactions SET status = 'Reversed', flagged = 0, reviewed_by = ? WHERE id = ?`
    ).run(user.id, txId);

    createNotification(
      sender.user_id,
      'Transfer reversed',
      `Transfer ${tx.tx_ref} ($${tx.amount.toFixed(2)}) was reversed and refunded to your account.`,
      'security'
    );
    createNotification(
      receiver.user_id,
      'Transfer reversed by administration',
      `Transfer ${tx.tx_ref} ($${tx.amount.toFixed(2)}) was reversed following compliance review.`,
      'security'
    );

    return db.prepare('SELECT * FROM transactions WHERE id = ?').get(txId);
  })();

  return { transaction: updated };
}

/* ============================================================================
 * DEPOSIT & WITHDRAWAL REQUESTS
 * ========================================================================== */

export function listDepositWithdrawRequests(user: AuthenticatedUser) {
  const db = getDb();
  if (user.role === 'customer') {
    const rows = db
      .prepare(
        `SELECT r.*, a.account_number, a.account_type
         FROM deposit_withdraw_requests r
         JOIN bank_accounts a ON a.id = r.account_id
         WHERE r.user_id = ?
         ORDER BY r.created_at DESC, r.id DESC`
      )
      .all(user.id);
    return { requests: rows };
  }

  const rows = db
    .prepare(
      `SELECT r.*, a.account_number, a.account_type, u.full_name AS customer_name, u.email AS customer_email
       FROM deposit_withdraw_requests r
       JOIN bank_accounts a ON a.id = r.account_id
       JOIN users u ON u.id = r.user_id
       ORDER BY CASE WHEN r.status = 'Pending' THEN 0 ELSE 1 END, r.created_at DESC`
    )
    .all();
  return { requests: rows };
}

export function createDepositWithdrawRequest(user: AuthenticatedUser, body: Record<string, unknown>) {
  requireRole(user, 'customer');
  const db = getDb();
  const accountId = Number(body?.accountId);
  const requestType =
    body?.requestType === 'Withdrawal'
      ? 'Withdrawal'
      : body?.requestType === 'Deposit'
      ? 'Deposit'
      : '';
  const amount = Number(body?.amount);
  const description = typeof body?.description === 'string' ? body.description.trim() : '';

  if (!requestType) {
    throw new HttpError(400, 'Request type must be Deposit or Withdrawal.');
  }
  if (!Number.isInteger(accountId) || accountId <= 0) {
    throw new HttpError(400, 'Valid bank account is required.');
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
    throw new HttpError(400, 'Amount must be between $0.01 and $1,000,000.');
  }

  const account = db
    .prepare('SELECT * FROM bank_accounts WHERE id = ? AND user_id = ?')
    .get(accountId, user.id) as { id: number; status: string; balance: number; min_balance: number } | undefined;

  if (!account) {
    throw new HttpError(404, 'Account not found.');
  }
  if (account.status !== 'active') {
    throw new HttpError(403, `Account is currently ${account.status}.`);
  }

  const cleanAmount = roundCurrency(amount);
  if (requestType === 'Withdrawal' && account.balance - cleanAmount < account.min_balance) {
    throw new HttpError(
      400,
      `Insufficient funds for withdrawal. Minimum required balance is $${account.min_balance.toFixed(2)}.`
    );
  }

  const requestRef = generateRef('REQ');
  const info = db
    .prepare(
      `INSERT INTO deposit_withdraw_requests (request_ref, user_id, account_id, request_type, amount, description, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Pending')`
    )
    .run(requestRef, user.id, accountId, requestType, cleanAmount, description || `${requestType} request`);

  const created = db
    .prepare(
      `SELECT r.*, a.account_number, a.account_type
       FROM deposit_withdraw_requests r
       JOIN bank_accounts a ON a.id = r.account_id
       WHERE r.id = ?`
    )
    .get(Number(info.lastInsertRowid));

  return { request: created };
}

export function reviewDepositWithdrawRequest(
  user: AuthenticatedUser,
  reqId: number,
  body: Record<string, unknown>
) {
  requireRole(user, 'admin', 'staff');
  const db = getDb();
  const decision =
    body?.decision === 'Approved' ? 'Approved' : body?.decision === 'Rejected' ? 'Rejected' : '';
  const reviewNote = typeof body?.reviewNote === 'string' ? body.reviewNote.trim() : '';

  if (!decision) {
    throw new HttpError(400, 'Decision must be Approved or Rejected.');
  }

  const updated = db.transaction(() => {
    const requestRow = db
      .prepare('SELECT * FROM deposit_withdraw_requests WHERE id = ?')
      .get(reqId) as
      | {
          id: number;
          request_ref: string;
          user_id: number;
          account_id: number;
          request_type: 'Deposit' | 'Withdrawal';
          amount: number;
          description: string;
          status: string;
        }
      | undefined;

    if (!requestRow) throw new HttpError(404, 'Request not found.');
    if (requestRow.status !== 'Pending') throw new HttpError(400, 'Request has already been processed.');
    if (requestRow.user_id === user.id) {
      throw new HttpError(403, 'Cannot approve or reject your own deposit/withdrawal request.');
    }

    const account = db
      .prepare('SELECT * FROM bank_accounts WHERE id = ?')
      .get(requestRow.account_id) as {
      id: number;
      account_number: string;
      balance: number;
      status: string;
      min_balance: number;
    };

    if (decision === 'Rejected') {
      db.prepare(
        `UPDATE deposit_withdraw_requests
         SET status = 'Rejected', reviewed_by = ?, review_note = ?, reviewed_at = datetime('now')
         WHERE id = ?`
      ).run(user.id, reviewNote || 'Rejected by operations', reqId);

      createNotification(
        requestRow.user_id,
        `${requestRow.request_type} rejected`,
        `Your ${requestRow.request_type.toLowerCase()} request ${requestRow.request_ref} ($${requestRow.amount.toFixed(2)}) was rejected.${reviewNote ? ` Note: ${reviewNote}` : ''}`,
        requestRow.request_type === 'Deposit' ? 'deposit' : 'withdrawal'
      );

      return db.prepare('SELECT * FROM deposit_withdraw_requests WHERE id = ?').get(reqId);
    }

    if (account.status !== 'active') {
      throw new HttpError(400, `Target account is ${account.status}.`);
    }

    if (requestRow.request_type === 'Withdrawal') {
      if (account.balance - requestRow.amount < account.min_balance) {
        throw new HttpError(400, 'Account balance is insufficient to approve withdrawal.');
      }
      db.prepare('UPDATE bank_accounts SET balance = ROUND(balance - ?, 2) WHERE id = ?').run(
        requestRow.amount,
        account.id
      );
    } else {
      db.prepare('UPDATE bank_accounts SET balance = ROUND(balance + ?, 2) WHERE id = ?').run(
        requestRow.amount,
        account.id
      );
    }

    const txRef = generateRef('TXN');
    const txRes = db
      .prepare(
        `INSERT INTO transactions (
          tx_ref, sender_account_id, receiver_account_id, sender_account_number, receiver_account_number,
          tx_type, amount, fee, status, description, reviewed_by, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'Completed', ?, ?, ?)`
      )
      .run(
        txRef,
        requestRow.request_type === 'Withdrawal' ? account.id : null,
        requestRow.request_type === 'Deposit' ? account.id : null,
        requestRow.request_type === 'Withdrawal' ? account.account_number : null,
        requestRow.request_type === 'Deposit' ? account.account_number : null,
        requestRow.request_type,
        requestRow.amount,
        requestRow.description || `${requestRow.request_type} (${requestRow.request_ref})`,
        user.id,
        requestRow.user_id
      );

    db.prepare(
      `UPDATE deposit_withdraw_requests
       SET status = 'Approved', reviewed_by = ?, review_note = ?, transaction_id = ?, reviewed_at = datetime('now')
       WHERE id = ?`
    ).run(user.id, reviewNote || 'Approved', Number(txRes.lastInsertRowid), reqId);

    createNotification(
      requestRow.user_id,
      `${requestRow.request_type} approved`,
      `Your ${requestRow.request_type.toLowerCase()} of $${requestRow.amount.toFixed(2)} on account ${account.account_number} is completed (${txRef}).`,
      requestRow.request_type === 'Deposit' ? 'deposit' : 'withdrawal'
    );

    return db.prepare('SELECT * FROM deposit_withdraw_requests WHERE id = ?').get(reqId);
  })();

  return { request: updated };
}

/* ============================================================================
 * LOAN MANAGEMENT SYSTEM
 * ========================================================================== */

export function listLoans(user: AuthenticatedUser) {
  const db = getDb();
  let loans: Array<Record<string, unknown>>;

  if (user.role === 'customer') {
    loans = db
      .prepare(
        `SELECT l.*, a.account_number, a.account_type
         FROM loans l
         JOIN bank_accounts a ON a.id = l.account_id
         WHERE l.user_id = ?
         ORDER BY l.created_at DESC, l.id DESC`
      )
      .all(user.id) as Array<Record<string, unknown>>;
  } else {
    loans = db
      .prepare(
        `SELECT l.*, a.account_number, a.account_type, u.full_name AS customer_name, u.email AS customer_email, u.kyc_verified
         FROM loans l
         JOIN bank_accounts a ON a.id = l.account_id
         JOIN users u ON u.id = l.user_id
         ORDER BY CASE WHEN l.status IN ('Pending', 'Under Review') THEN 0 ELSE 1 END, l.created_at DESC`
      )
      .all() as Array<Record<string, unknown>>;
  }

  const getRepayments = db.prepare(
    'SELECT * FROM loan_repayments WHERE loan_id = ? ORDER BY installment_number ASC'
  );

  const enriched = loans.map((loan) => ({
    ...loan,
    repayments: getRepayments.all(loan.id as number),
  }));

  return { loans: enriched };
}

export function applyForNewLoan(user: AuthenticatedUser, body: Record<string, unknown>) {
  requireRole(user, 'customer');
  const db = getDb();
  const accountId = Number(body?.accountId);
  const loanType = typeof body?.loanType === 'string' ? body.loanType.trim() : '';
  const requestedAmount = Number(body?.requestedAmount);
  const durationMonths = Number(body?.durationMonths);
  const monthlyIncome = Number(body?.monthlyIncome);
  const employmentStatus = typeof body?.employmentStatus === 'string' ? body.employmentStatus.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';

  if (!loanType || !employmentStatus) {
    throw new HttpError(400, 'Loan type and employment status are required.');
  }
  if (!Number.isFinite(requestedAmount) || requestedAmount < 500 || requestedAmount > 500000) {
    throw new HttpError(400, 'Requested amount must be between $500 and $500,000.');
  }
  if (!Number.isInteger(durationMonths) || durationMonths < 6 || durationMonths > 60) {
    throw new HttpError(400, 'Loan duration must be between 6 and 60 months.');
  }
  if (!Number.isFinite(monthlyIncome) || monthlyIncome < 0) {
    throw new HttpError(400, 'Valid monthly income is required.');
  }

  const account = db
    .prepare('SELECT id, status FROM bank_accounts WHERE id = ? AND user_id = ?')
    .get(accountId, user.id) as { id: number; status: string } | undefined;

  if (!account) {
    throw new HttpError(404, 'Disbursement account not found.');
  }
  if (account.status !== 'active') {
    throw new HttpError(400, 'Disbursement account must be active.');
  }

  const loanRef = `LN-2026-${crypto.randomInt(1000, 9999)}`;
  const rateByType: Record<string, number> = {
    'Personal Loan': 6.5,
    'Business Expansion': 7.25,
    Mortgage: 5.4,
    'Auto Finance': 6.1,
    Education: 5.0,
  };
  const interestRate = rateByType[loanType] ?? 6.75;

  const info = db
    .prepare(
      `INSERT INTO loans (
        loan_ref, user_id, account_id, loan_type, requested_amount, interest_rate,
        duration_months, monthly_income, employment_status, description, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`
    )
    .run(
      loanRef,
      user.id,
      accountId,
      loanType,
      roundCurrency(requestedAmount),
      interestRate,
      durationMonths,
      roundCurrency(monthlyIncome),
      employmentStatus,
      description
    );

  createNotification(
    user.id,
    'Loan application submitted',
    `Application ${loanRef} for $${roundCurrency(requestedAmount).toLocaleString()} is now Pending review.`,
    'loan'
  );

  const created = db.prepare('SELECT * FROM loans WHERE id = ?').get(Number(info.lastInsertRowid));
  return { loan: created };
}

export function staffReviewLoanApplication(
  user: AuthenticatedUser,
  loanId: number,
  body: Record<string, unknown>
) {
  requireRole(user, 'staff', 'admin');
  const db = getDb();
  const staffNote = typeof body?.staffNote === 'string' ? body.staffNote.trim() : '';

  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId) as
    | { id: number; user_id: number; status: string; loan_ref: string }
    | undefined;

  if (!loan) {
    throw new HttpError(404, 'Loan application not found.');
  }
  if (loan.user_id === user.id) {
    throw new HttpError(403, 'Staff cannot review or forward their own loan application.');
  }
  if (!['Pending', 'Under Review'].includes(loan.status)) {
    throw new HttpError(400, 'Only Pending or Under Review applications can be updated.');
  }

  db.prepare(
    `UPDATE loans
     SET status = 'Under Review', staff_note = ?, forwarded_by = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(staffNote || 'Reviewed and forwarded for admin decision.', user.id, loanId);

  createNotification(
    loan.user_id,
    'Loan under review',
    `Your loan ${loan.loan_ref} has been reviewed by staff and forwarded for final approval.`,
    'loan'
  );

  return { loan: db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId) };
}

export function adminDecideLoanApplication(
  user: AuthenticatedUser,
  loanId: number,
  body: Record<string, unknown>
) {
  requireRole(user, 'admin');
  const db = getDb();
  const decision =
    body?.decision === 'Approve' ? 'Approve' : body?.decision === 'Reject' ? 'Reject' : '';
  const note = typeof body?.note === 'string' ? body.note.trim() : '';

  if (!decision) {
    throw new HttpError(400, 'Decision must be Approve or Reject.');
  }

  const updated = db.transaction(() => {
    const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId) as
      | {
          id: number;
          loan_ref: string;
          user_id: number;
          account_id: number;
          requested_amount: number;
          interest_rate: number;
          duration_months: number;
          status: string;
          staff_note: string;
        }
      | undefined;

    if (!loan) throw new HttpError(404, 'Loan application not found.');
    if (!['Pending', 'Under Review'].includes(loan.status)) {
      throw new HttpError(400, 'Loan application has already been decided.');
    }

    if (decision === 'Reject') {
      db.prepare(
        `UPDATE loans
         SET status = 'Rejected', reviewed_by = ?, staff_note = COALESCE(NULLIF(?, ''), staff_note), updated_at = datetime('now')
         WHERE id = ?`
      ).run(user.id, note, loanId);

      createNotification(
        loan.user_id,
        'Loan application rejected',
        `Your loan application ${loan.loan_ref} was declined.${note ? ` Reason: ${note}` : ''}`,
        'loan'
      );

      return db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId);
    }

    const account = db
      .prepare('SELECT id, account_number, status FROM bank_accounts WHERE id = ?')
      .get(loan.account_id) as { id: number; account_number: string; status: string };

    if (account.status !== 'active') {
      throw new HttpError(400, 'Target disbursement account is not active.');
    }

    const principal = roundCurrency(loan.requested_amount);
    const monthlyRate = loan.interest_rate / 100 / 12;
    const n = loan.duration_months;
    const emi =
      monthlyRate > 0
        ? roundCurrency((principal * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1))
        : roundCurrency(principal / n);
    const totalRepayable = roundCurrency(emi * n);

    db.prepare('UPDATE bank_accounts SET balance = ROUND(balance + ?, 2) WHERE id = ?').run(
      principal,
      account.id
    );

    const txRef = generateRef('TXN');
    const txRes = db
      .prepare(
        `INSERT INTO transactions (
          tx_ref, receiver_account_id, receiver_account_number,
          tx_type, amount, fee, status, description, reviewed_by, created_by
        ) VALUES (?, ?, ?, 'Loan Disbursement', ?, 0, 'Completed', ?, ?, ?)`
      )
      .run(
        txRef,
        account.id,
        account.account_number,
        principal,
        `Loan disbursement for ${loan.loan_ref}`,
        user.id,
        loan.user_id
      );

    db.prepare(
      `UPDATE loans
       SET status = 'Active', approved_amount = ?, remaining_balance = ?,
           reviewed_by = ?, disbursement_tx_id = ?,
           staff_note = COALESCE(NULLIF(?, ''), staff_note),
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(principal, totalRepayable, user.id, Number(txRes.lastInsertRowid), note, loanId);

    const insertSched = db.prepare(
      `INSERT INTO loan_repayments (loan_id, installment_number, due_date, principal_amount, interest_amount, total_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Scheduled')`
    );

    let remainingPrincipal = principal;
    const baseDate = new Date();
    for (let i = 1; i <= n; i++) {
      const interestPart = roundCurrency(remainingPrincipal * monthlyRate);
      const principalPart = roundCurrency(emi - interestPart);
      remainingPrincipal = Math.max(0, roundCurrency(remainingPrincipal - principalPart));
      const due = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + i, baseDate.getUTCDate()));
      insertSched.run(loanId, i, due.toISOString().slice(0, 10), principalPart, interestPart, emi);
    }

    createNotification(
      loan.user_id,
      'Loan approved & disbursed',
      `$${principal.toLocaleString('en-US', { minimumFractionDigits: 2 })} for ${loan.loan_ref} was disbursed to account ${account.account_number}.`,
      'loan'
    );

    return db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId);
  })();

  return { loan: updated };
}

export function repayLoanInstallment(
  user: AuthenticatedUser,
  loanId: number,
  body: Record<string, unknown>
) {
  requireRole(user, 'customer');
  const db = getDb();
  const accountId = Number(body?.accountId);

  if (!Number.isInteger(accountId) || accountId <= 0) {
    throw new HttpError(400, 'Select an active payment account.');
  }

  return db.transaction(() => {
    const loan = db
      .prepare('SELECT * FROM loans WHERE id = ? AND user_id = ?')
      .get(loanId, user.id) as
      | { id: number; loan_ref: string; status: string; remaining_balance: number }
      | undefined;

    if (!loan) throw new HttpError(404, 'Loan not found.');
    if (loan.status !== 'Active') throw new HttpError(400, 'Only active loans can be repaid.');

    const nextInstallment = db
      .prepare(
        `SELECT * FROM loan_repayments
         WHERE loan_id = ? AND status = 'Scheduled'
         ORDER BY installment_number ASC LIMIT 1`
      )
      .get(loanId) as
      | { id: number; installment_number: number; total_amount: number }
      | undefined;

    if (!nextInstallment) throw new HttpError(400, 'All installments are already paid.');

    const account = db
      .prepare('SELECT * FROM bank_accounts WHERE id = ? AND user_id = ?')
      .get(accountId, user.id) as
      | { id: number; account_number: string; balance: number; status: string; min_balance: number }
      | undefined;

    if (!account) throw new HttpError(404, 'Payment account not found.');
    if (account.status !== 'active') throw new HttpError(400, 'Payment account is not active.');

    if (account.balance - nextInstallment.total_amount < account.min_balance) {
      throw new HttpError(400, 'Insufficient balance to cover this installment.');
    }

    db.prepare('UPDATE bank_accounts SET balance = ROUND(balance - ?, 2) WHERE id = ?').run(
      nextInstallment.total_amount,
      account.id
    );

    const txRef = generateRef('TXN');
    const txRes = db
      .prepare(
        `INSERT INTO transactions (
          tx_ref, sender_account_id, sender_account_number,
          tx_type, amount, fee, status, description, created_by
        ) VALUES (?, ?, ?, 'Loan Repayment', ?, 0, 'Completed', ?, ?)`
      )
      .run(
        txRef,
        account.id,
        account.account_number,
        nextInstallment.total_amount,
        `Installment #${nextInstallment.installment_number} for ${loan.loan_ref}`,
        user.id
      );

    db.prepare(
      `UPDATE loan_repayments SET status = 'Paid', paid_at = datetime('now'), transaction_id = ? WHERE id = ?`
    ).run(Number(txRes.lastInsertRowid), nextInstallment.id);

    const newBalance = Math.max(0, roundCurrency(loan.remaining_balance - nextInstallment.total_amount));
    const remainingCount = db
      .prepare("SELECT COUNT(*) AS cnt FROM loan_repayments WHERE loan_id = ? AND status = 'Scheduled'")
      .get(loanId) as { cnt: number };

    const newStatus = remainingCount.cnt === 0 ? 'Completed' : 'Active';
    db.prepare(
      `UPDATE loans SET remaining_balance = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(newStatus === 'Completed' ? 0 : newBalance, newStatus, loanId);

    createNotification(
      user.id,
      'Loan installment paid',
      `Installment #${nextInstallment.installment_number} ($${nextInstallment.total_amount.toFixed(2)}) paid for ${loan.loan_ref}.`,
      'loan'
    );

    return {
      txRef,
      paidAmount: nextInstallment.total_amount,
      remainingBalance: newStatus === 'Completed' ? 0 : newBalance,
      loanStatus: newStatus,
    };
  })();
}

/* ============================================================================
 * NOTIFICATIONS, STAFF, ADMIN ANALYTICS & SETTINGS
 * ========================================================================== */

export function listNotifications(userId: number) {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 30')
    .all(userId);
  return { notifications: rows };
}

export function markNotificationRead(userId: number, notifId: number) {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(notifId, userId);
  return { ok: true };
}

export function markAllNotificationsRead(userId: number) {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(userId);
  return { ok: true };
}

export function listCustomers(user: AuthenticatedUser, searchQuery: string) {
  requireRole(user, 'admin', 'staff');
  const db = getDb();
  const search = searchQuery.trim().toLowerCase();
  let sql = `
    SELECT u.id, u.full_name, u.email, u.phone, u.role, u.status, u.kyc_verified, u.two_factor_enabled, u.address, u.created_at,
           COUNT(a.id) AS account_count,
           COALESCE(SUM(a.balance), 0) AS total_balance
    FROM users u
    LEFT JOIN bank_accounts a ON a.user_id = u.id
    WHERE u.role = 'customer'
  `;
  const params: string[] = [];

  if (search) {
    sql += ` AND (LOWER(u.full_name) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(u.phone) LIKE ?)`;
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  sql += ` GROUP BY u.id ORDER BY u.id DESC`;
  return { customers: db.prepare(sql).all(...params) };
}

export function staffRegisterCustomer(user: AuthenticatedUser, body: Record<string, unknown>) {
  requireRole(user, 'staff', 'admin');
  const db = getDb();
  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
  const address = typeof body?.address === 'string' ? body.address.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const pin = typeof body?.pin === 'string' ? body.pin.trim() : '1234';
  const accountType =
    body?.accountType === 'Current Account' || body?.accountType === 'Business Account'
      ? body.accountType
      : 'Savings Account';
  const initialDeposit = Math.max(0, Number(body?.initialDeposit) || 0);

  if (fullName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'Valid full name and email are required.');
  }
  if (password.length < 8) {
    throw new HttpError(400, 'Initial password must be at least 8 characters.');
  }
  if (!/^\d{4}$/.test(pin)) {
    throw new HttpError(400, 'Transaction PIN must be 4 digits.');
  }

  const exists = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(email);
  if (exists) {
    throw new HttpError(409, 'Customer with this email already exists.');
  }

  const settings = getBankSettings();
  return db.transaction(() => {
    const userRes = db
      .prepare(
        `INSERT INTO users (full_name, email, phone, password_hash, pin_hash, role, status, kyc_verified, address)
         VALUES (?, ?, ?, ?, ?, 'customer', 'active', 1, ?)`
      )
      .run(fullName, email, phone, hashSecret(password), hashSecret(pin), address);
    const userId = Number(userRes.lastInsertRowid);

    const acctNum = generateAccountNumber();
    const depositAmt = roundCurrency(initialDeposit);
    const acctRes = db
      .prepare(
        `INSERT INTO bank_accounts (account_number, user_id, account_type, balance, status, daily_limit, single_tx_limit, min_balance)
         VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`
      )
      .run(
        acctNum,
        userId,
        accountType,
        depositAmt,
        settings.default_daily_transfer_limit,
        settings.default_max_single_tx,
        settings.default_min_balance
      );

    if (depositAmt > 0) {
      db.prepare(
        `INSERT INTO transactions (tx_ref, receiver_account_id, receiver_account_number, tx_type, amount, fee, status, description, created_by)
         VALUES (?, ?, ?, 'Deposit', ?, 0, 'Completed', 'Initial account opening deposit', ?)`
      ).run(generateRef('TXN'), Number(acctRes.lastInsertRowid), acctNum, depositAmt, user.id);
    }

    return { user: getUserById(userId), accountNumber: acctNum };
  })();
}

export function staffOpenAccount(user: AuthenticatedUser, body: Record<string, unknown>) {
  requireRole(user, 'staff', 'admin');
  const db = getDb();
  const userId = Number(body?.userId);
  const accountType =
    body?.accountType === 'Current Account' || body?.accountType === 'Business Account'
      ? body.accountType
      : 'Savings Account';
  const initialDeposit = Math.max(0, Number(body?.initialDeposit) || 0);

  const customer = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'customer'").get(userId);
  if (!customer) {
    throw new HttpError(404, 'Customer not found.');
  }

  const settings = getBankSettings();
  const created = db.transaction(() => {
    const acctNum = generateAccountNumber();
    const depositAmt = roundCurrency(initialDeposit);
    const info = db
      .prepare(
        `INSERT INTO bank_accounts (account_number, user_id, account_type, balance, status, daily_limit, single_tx_limit, min_balance)
         VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`
      )
      .run(
        acctNum,
        userId,
        accountType,
        depositAmt,
        settings.default_daily_transfer_limit,
        settings.default_max_single_tx,
        settings.default_min_balance
      );
    const acctId = Number(info.lastInsertRowid);

    if (depositAmt > 0) {
      db.prepare(
        `INSERT INTO transactions (tx_ref, receiver_account_id, receiver_account_number, tx_type, amount, fee, status, description, created_by)
         VALUES (?, ?, ?, 'Deposit', ?, 0, 'Completed', 'Account opening deposit', ?)`
      ).run(generateRef('TXN'), acctId, acctNum, depositAmt, user.id);
    }

    createNotification(
      userId,
      'New bank account opened',
      `Your ${accountType} (${acctNum}) is now active.`,
      'security'
    );

    return db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(acctId);
  })();

  return { account: created };
}

export function verifyCustomerKyc(
  user: AuthenticatedUser,
  customerId: number,
  body: Record<string, unknown>
) {
  requireRole(user, 'staff', 'admin');
  const db = getDb();
  const verified = Boolean(body?.verified);
  db.prepare("UPDATE users SET kyc_verified = ? WHERE id = ? AND role = 'customer'").run(
    verified ? 1 : 0,
    customerId
  );
  return { customer: getUserById(customerId) };
}

export function adminUpdateCustomerStatus(
  user: AuthenticatedUser,
  customerId: number,
  body: Record<string, unknown>
) {
  requireRole(user, 'admin');
  const db = getDb();
  const status = body?.status;
  if (typeof status !== 'string' || !['active', 'inactive', 'blocked'].includes(status)) {
    throw new HttpError(400, 'Invalid status value.');
  }

  db.prepare("UPDATE users SET status = ? WHERE id = ? AND role = 'customer'").run(status, customerId);
  return { customer: getUserById(customerId) };
}

export function adminUpdateAccountDetails(
  user: AuthenticatedUser,
  acctId: number,
  body: Record<string, unknown>
) {
  requireRole(user, 'admin');
  const db = getDb();
  const account = db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(acctId) as
    | {
        id: number;
        user_id: number;
        account_number: string;
        status: string;
        daily_limit: number;
        single_tx_limit: number;
        min_balance: number;
        account_type: string;
      }
    | undefined;

  if (!account) {
    throw new HttpError(404, 'Bank account not found.');
  }

  const nextStatus =
    typeof body?.status === 'string' && ['active', 'frozen', 'closed'].includes(body.status)
      ? body.status
      : account.status;
  const nextType =
    typeof body?.accountType === 'string' &&
    ['Savings Account', 'Current Account', 'Business Account'].includes(body.accountType)
      ? body.accountType
      : account.account_type;
  const nextDaily = Number.isFinite(Number(body?.dailyLimit))
    ? Math.max(100, Number(body.dailyLimit))
    : account.daily_limit;
  const nextSingle = Number.isFinite(Number(body?.singleTxLimit))
    ? Math.max(50, Number(body.singleTxLimit))
    : account.single_tx_limit;
  const nextMin = Number.isFinite(Number(body?.minBalance))
    ? Math.max(0, Number(body.minBalance))
    : account.min_balance;

  db.prepare(
    `UPDATE bank_accounts
     SET status = ?, account_type = ?, daily_limit = ?, single_tx_limit = ?, min_balance = ?
     WHERE id = ?`
  ).run(nextStatus, nextType, nextDaily, nextSingle, nextMin, acctId);

  if (nextStatus !== account.status) {
    createNotification(
      account.user_id,
      `Account ${nextStatus}`,
      `Account ${account.account_number} status was updated to ${nextStatus} by administration.`,
      'security'
    );
  }

  return { account: db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(acctId) };
}

export function getAdminAnalyticsOverview(user: AuthenticatedUser) {
  requireRole(user, 'admin', 'staff');
  const db = getDb();
  const totalCustomers = (
    db.prepare("SELECT COUNT(*) AS cnt FROM users WHERE role = 'customer'").get() as { cnt: number }
  ).cnt;
  const totalAccounts = (db.prepare('SELECT COUNT(*) AS cnt FROM bank_accounts').get() as { cnt: number }).cnt;
  const totalBankBalance = (
    db.prepare('SELECT COALESCE(SUM(balance), 0) AS total FROM bank_accounts').get() as { total: number }
  ).total;
  const totalDeposits = (
    db
      .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE tx_type = 'Deposit' AND status = 'Completed'")
      .get() as { total: number }
  ).total;
  const totalWithdrawals = (
    db
      .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE tx_type = 'Withdrawal' AND status = 'Completed'")
      .get() as { total: number }
  ).total;
  const totalTransactions = (db.prepare('SELECT COUNT(*) AS cnt FROM transactions').get() as { cnt: number }).cnt;
  const pendingLoans = (
    db.prepare("SELECT COUNT(*) AS cnt FROM loans WHERE status IN ('Pending', 'Under Review')").get() as { cnt: number }
  ).cnt;
  const flaggedTransactions = (
    db.prepare('SELECT COUNT(*) AS cnt FROM transactions WHERE flagged = 1').get() as { cnt: number }
  ).cnt;

  const monthlyRows = db
    .prepare(
      `SELECT substr(created_at, 1, 7) AS month,
              COALESCE(SUM(CASE WHEN tx_type = 'Deposit' THEN amount ELSE 0 END), 0) AS deposits,
              COALESCE(SUM(CASE WHEN tx_type = 'Withdrawal' THEN amount ELSE 0 END), 0) AS withdrawals,
              COALESCE(SUM(CASE WHEN tx_type = 'Fund Transfer' THEN amount ELSE 0 END), 0) AS transfers,
              COALESCE(SUM(amount), 0) AS volume,
              COUNT(*) AS txCount
       FROM transactions
       WHERE status = 'Completed'
       GROUP BY substr(created_at, 1, 7)
       ORDER BY month ASC`
    )
    .all();

  const accountDistribution = db
    .prepare(
      `SELECT account_type AS name, COUNT(*) AS count, ROUND(SUM(balance), 2) AS balance
       FROM bank_accounts
       GROUP BY account_type`
    )
    .all();

  const loanStats = db
    .prepare(
      `SELECT status AS name, COUNT(*) AS count, ROUND(SUM(requested_amount), 2) AS totalAmount
       FROM loans
       GROUP BY status`
    )
    .all();

  return {
    kpis: {
      totalCustomers,
      totalAccounts,
      totalBankBalance: roundCurrency(totalBankBalance),
      totalDeposits: roundCurrency(totalDeposits),
      totalWithdrawals: roundCurrency(totalWithdrawals),
      totalTransactions,
      pendingLoans,
      flaggedTransactions,
    },
    monthlySeries: monthlyRows,
    accountDistribution,
    loanStats,
  };
}

export function getAdminBankSettings(user: AuthenticatedUser) {
  requireRole(user, 'admin');
  return { settings: getBankSettings() };
}

export function updateAdminBankSettings(user: AuthenticatedUser, body: Record<string, unknown>) {
  requireRole(user, 'admin');
  const db = getDb();
  const current = getBankSettings();
  const daily = Number.isFinite(Number(body?.defaultDailyLimit))
    ? Math.max(500, Number(body.defaultDailyLimit))
    : current.default_daily_transfer_limit;
  const single = Number.isFinite(Number(body?.defaultSingleTxLimit))
    ? Math.max(100, Number(body.defaultSingleTxLimit))
    : current.default_max_single_tx;
  const minBal = Number.isFinite(Number(body?.defaultMinBalance))
    ? Math.max(0, Number(body.defaultMinBalance))
    : current.default_min_balance;
  const feePct = Number.isFinite(Number(body?.transferFeePercent))
    ? Math.min(5, Math.max(0, Number(body.transferFeePercent)))
    : current.transfer_fee_percent;
  const suspThresh = Number.isFinite(Number(body?.suspiciousThreshold))
    ? Math.max(500, Number(body.suspiciousThreshold))
    : current.suspicious_amount_threshold;

  db.prepare(
    `UPDATE bank_settings
     SET default_daily_transfer_limit = ?,
         default_max_single_tx = ?,
         default_min_balance = ?,
         transfer_fee_percent = ?,
         suspicious_amount_threshold = ?,
         updated_at = datetime('now')
     WHERE id = 1`
  ).run(daily, single, minBal, feePct, suspThresh);

  return { settings: getBankSettings() };
}
