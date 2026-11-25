# Goth Bank — Advanced Digital Banking Management System

## Project Overview
Goth Bank is a full-stack simulated digital banking platform built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **Redux Toolkit + RTK Query**, **Recharts**, and **SQLite (`better-sqlite3`)**. It simulates a real-world multi-role banking environment across **Admin**, **Bank Staff**, and **Customer** roles with server-side ACID transactions, cryptographic password & PIN verification (`scrypt`), rule-based compliance flagging, automated loan amortization schedules, PDF/CSV exports, and light/dark mode support.

https://github.com/user-attachments/assets/3ecc1080-c224-45da-8679-7a17254b638c

---

## Application Features
- **Next.js App Router & Route Protection**: Dedicated App Router routes (`/`, `/dashboard`, `/customer`, `/staff`, `/admin`) protected by `src/proxy.ts` and `RolePortalGuard`, plus Next.js App Router API Route Handlers under `src/app/api/**/route.ts`.
- **Multi-Role Portals (Admin, Bank Staff, Customer)** with strict server-side authorization on every API endpoint.
- **Account Management**: Savings, Current, and Business accounts; multi-account dashboard switcher; real-time balances, limits, freeze/unfreeze governance, and downloadable **PDF / CSV Account Statements**.
- **Atomic Fund Transfers**: Own-account and intra-bank customer transfers with Transaction PIN validation, single/daily transfer limit checks, minimum balance enforcement, duplicate request prevention (`idempotencyKey`), and optional/threshold Two-Factor Authentication (2FA).
- **Deposit & Withdrawal Approval Workflow**: Customer funding requests routed through Staff/Admin review (blocking self-approval) with atomic ledger posting.
- **Loan Origination & Repayments**: Customer loan applications, Staff underwriting notes & forwarding (`Pending` → `Under Review`), Admin approval & atomic principal disbursement (`Active`), automated monthly amortization schedules, and customer installment repayments.
- **Transaction Ledger & Compliance**: Search by `tx_ref`, filter by date/type/status/flagged status, pagination, downloadable **PDF Transaction Receipts**, Staff manual flagging, and Admin flag resolution or atomic transfer reversal.
- **Suspicious Activity Detection**: Rule-based alerts for high-value transfers, rapid 10-minute velocity, and >85% single-transaction balance depletion.
- **Real-Time Notifications & Dark Mode**: Unread alert bell popover with category notifications and persistent light/dark theme toggle.

---

## User Roles & Permissions
| Capability | Customer | Bank Staff | Admin |
| --- | :---: | :---: | :---: |
| View own accounts, balances, charts & statements | ✓ | — | — |
| Transfer funds (PIN + limit + 2FA checks) | ✓ | — | — |
| Submit Deposit / Withdrawal requests | ✓ | — | — |
| Apply for loans & repay active installments | ✓ | — | — |
| Register new customers & open accounts | — | ✓ | ✓ |
| Verify customer KYC & flag suspicious transactions | — | ✓ | ✓ |
| Approve / reject Deposit & Withdrawal requests (non-own) | — | ✓ | ✓ |
| Add staff underwriting notes & forward loans | — | ✓ | ✓ |
| Approve / reject & disburse loans | — | ✕ | ✓ |
| Activate / deactivate / block customer profiles | — | ✕ | ✓ |
| Freeze / unfreeze accounts & edit account limits | — | ✕ | ✓ |
| Reverse completed transfers & configure bank-wide limits | — | ✕ | ✓ |

---

## Redux Toolkit Architecture
Redux state is partitioned into modular feature slices under `src/store/slices/`:
- `authSlice.ts`: Handles `loginUser`, `registerCustomer`, `hydrateSession`, and `logoutUser` `createAsyncThunk` flows, centralized auth loading/error state, and in-memory `user` + Bearer `token` state.
- `accountSlice.ts`: Manages active selected customer account scope and directory search/status filters.
- `transactionSlice.ts`: Controls transaction search (`tx_ref`), type/status/date-range/flagged filters, pagination, and active receipt modal inspection.
- `loanSlice.ts`: Tracks selected loan repayment schedule inspection and status filters.
- `uiSlice.ts`: Manages sidebar navigation section, light/dark theme class toggle, mobile drawer state, and toast feedback notifications.

## RTK Query Implementation
`src/store/api/bankingApi.ts` configures `createApi` with a `fetchBaseQuery` wrapper pointing to `/api` that injects `Authorization: Bearer <token>` from `state.auth.token` alongside same-origin `HttpOnly` session cookies. Tag types (`Account`, `Transaction`, `Request`, `Loan`, `Customer`, `Notification`, `Analytics`, `Settings`) keep dashboards, Recharts graphs, balances, and notifications automatically synchronized after every mutation.

---

## Authentication Strategy
- Passwords and 4-digit Transaction PINs are hashed server-side using `crypto.scryptSync` with unique 16-byte per-user salts and verified with `crypto.timingSafeEqual`.
- Sign-in issues a server-signed HMAC-SHA256 token returned to Redux and stored in an `HttpOnly`, `SameSite=Lax` session cookie (`goth_bank_session`).
- Next.js `src/proxy.ts` enforces role-based route protection on `/customer`, `/staff`, `/admin`, and `/dashboard`, while every Next.js API Route Handler calls `requireAuth(req)` and `requireRole(...)`.

---

## Transaction Processing Logic
Fund transfers (`POST /api/transfers` in `src/app/api/transfers/route.ts` backed by `src/lib/server/bankingService.ts`) run inside an atomic SQLite `db.transaction()` block:
1. Verifies `idempotencyKey` uniqueness to prevent duplicate double-submissions.
2. Verifies source account ownership, `active` status, recipient existence, and `active` recipient status.
3. Validates 4-digit Transaction PIN and 6-digit 2FA OTP challenge (when enabled or `amount >= $5,000`).
4. Enforces `single_tx_limit`, cumulative daily transfer volume against `daily_limit`, and `balance - (amount + fee) >= min_balance`.
5. Evaluates automated suspicious activity rules and deducts sender / credits receiver atomically. Any error rolls back the entire transaction cleanly.

---

## Database Structure
Relational SQLite database (`data/meridian_bank.db` locally, `/tmp/goth_bank_data/meridian_bank.db` on serverless platforms) managed in `src/lib/server/db.ts` with `PRAGMA foreign_keys = ON`:
- `users`: Identity, role (`admin`, `staff`, `customer`), status (`active`, `inactive`, `blocked`), `password_hash`, `pin_hash`, `kyc_verified`, `two_factor_enabled`.
- `bank_accounts`: `account_number`, `user_id` FK, `account_type`, `balance CHECK (balance >= 0)`, `status`, `daily_limit`, `single_tx_limit`, `min_balance`.
- `transactions`: Immutable ledger with `tx_ref`, `idempotency_key`, `sender_account_id`, `receiver_account_id`, `tx_type`, `amount`, `fee`, `status`, `flagged`, `flag_reason`.
- `deposit_withdraw_requests`: Customer funding requests (`Pending` / `Approved` / `Rejected`) linked to settled `transaction_id`.
- `loans` & `loan_repayments`: Loan applications, staff notes, admin approval status, disbursement reference, and generated monthly amortization schedule rows.
- `notifications`: Real-time user alerts across transfers, deposits, withdrawals, loans, and security events.
- `bank_settings` & `two_factor_challenges`: Configurable bank-wide limits/thresholds and single-use hashed OTP challenges.

---

## Security Implementation
- Parameterized prepared SQL statements across all queries.
- Server-side balance, fee, and limit computation (frontend amounts/balances are never trusted).
- Ownership checks on all customer reads and mutations; self-approval prevented on deposit/withdrawal/loan reviews.
- Next.js server-level route protection + API middleware blocking Staff from Admin-only loan approvals, reversals, and global policy edits.

---

## Environment Variables
See `.env.example` for optional runtime configuration:
- `PORT`: Server listening port (defaults to `3000`).
- `SESSION_SECRET`: Optional HMAC-SHA256 signing secret for session tokens (falls back to a runtime/deployment key if unset).

---

## Additional Libraries
- `jspdf`: Client-side PDF generation for official transaction receipts and account statements.
- `recharts`: Interactive charts for Admin banking analytics and Customer cashflow visualizations.
- `better-sqlite3`: Synchronous ACID relational SQLite database engine with foreign-key constraints.
- `lucide-react`: Crisp vector iconography across banking workflows and status badges.
- `motion`: Subtle UI motion primitives.

---

## Local Setup Instructions
```bash
npm install
npm run dev      # Starts Next.js App Router on http://localhost:3000
npm run lint     # Runs TypeScript check (tsc --noEmit)
```

## Deployment Instructions

### Option 1 — Vercel (Native Next.js App Router)
1. Push the repository to a public GitHub repository.
2. Import the project in **Vercel** (`Framework Preset`: Next.js, `Build Command`: `npm run build`).
3. Optional: Add `SESSION_SECRET` (any 16+ char string) in Vercel **Environment Variables**.
4. Deploy. `next.config.ts` traces `better-sqlite3` prebuilds automatically for `/api/**`, and SQLite initializes with all demo accounts on cold start (note: `/tmp` is ephemeral across serverless cold starts; for permanent multi-session persistence use Option 2).

### Option 2 — Persistent Node.js Host (Render / Railway / Cloud Run)
```bash
npm run build   # Builds production Next.js App Router bundle
npm run start   # Serves production Next.js app + API Route Handlers on port 3000
```

---

## Demo Credentials (Simulated Assessment Accounts)
| Role | Email | Password | Transaction PIN |
| --- | --- | --- | --- |
| **Customer** | `customer@meridianbank.demo` | `Customer!2026` | `1234` |
| **Bank Staff** | `staff@meridianbank.demo` | `Staff!2026` | `3344` |
| **Admin** | `admin@meridianbank.demo` | `Admin!2026` | `1122` |
