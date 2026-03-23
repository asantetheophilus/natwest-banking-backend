# NatWest Banking Backend — v1.1 (Fixed & Hardened)

## What Was Fixed

| # | Issue | Fix |
|---|-------|-----|
| 1 | `.env.example` incomplete | Now lists every env var the project uses (DB, JWT, CORS, rate limits, approval threshold) |
| 2 | `/api/transactions/approvals` returned ALL approvals | Now filters `WHERE status = 'pending'` by default; pass `?status=all` to see everything |
| 3 | "Payment Received" notification sent even for pending transfers | Notification now sent ONLY on completed transfers. Pending ones notify payee only after admin approval |
| 4 | Fragile payee matching in approval flow | `transfer_approvals` table now stores `credit_transaction_id` and `payee_id` for direct lookups |
| 5 | No input validation | Added `express-validator` with rules for every endpoint that takes user input, plus XSS sanitisation |
| 6 | No security hardening | Added `helmet`, `express-rate-limit`, `hpp`, body size limits, stricter CORS with multi-origin support |
| 7 | Missing frontend files | Added `dashboard/settings/page.tsx` and `support/page.tsx`; all 14 files now provided |

---

## Step-by-Step Setup

### 1. Prerequisites

- Node.js 18+
- MySQL 8+
- Your existing Next.js frontend project

### 2. Create the Database

```bash
mysql -u root -p < seeds/schema.sql
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:
```
DB_PASSWORD=your_real_mysql_password
JWT_SECRET=run_this_to_generate_one: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
FRONTEND_URL=http://localhost:3000
```

### 4. Install Dependencies & Seed

```bash
npm install
node seeds/seed.js
```

### 5. Start the Server

```bash
npm run dev          # development (with nodemon)
npm start            # production
```

Server runs at `http://localhost:5000`. Verify: `curl http://localhost:5000/api/health`

---

## Step-by-Step Frontend Integration

### 1. Add environment variable

Create/edit `.env.local` in your Next.js project root:
```
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

### 2. Add new file

Copy `frontend-updates/lib/api.ts` → your project's `lib/api.ts`

This is the API client that replaces `lib/store.ts` and `lib/mock-data.ts`.

### 3. Replace these 14 files

Copy each file from `frontend-updates/` into the matching path in your Next.js project:

| Source (in frontend-updates/) | Destination (in your project) |
|---|---|
| `lib/api.ts` | `lib/api.ts` (**NEW**) |
| `hooks/use-auth.tsx` | `hooks/use-auth.tsx` |
| `app/login/page.tsx` | `app/login/page.tsx` |
| `app/register/page.tsx` | `app/register/page.tsx` |
| `app/dashboard/page.tsx` | `app/dashboard/page.tsx` |
| `app/dashboard/transfers/page.tsx` | `app/dashboard/transfers/page.tsx` |
| `app/dashboard/history/page.tsx` | `app/dashboard/history/page.tsx` |
| `app/dashboard/notifications/page.tsx` | `app/dashboard/notifications/page.tsx` |
| `app/dashboard/settings/page.tsx` | `app/dashboard/settings/page.tsx` |
| `app/support/page.tsx` | `app/support/page.tsx` |
| `app/admin/page.tsx` | `app/admin/page.tsx` |
| `app/admin/users/page.tsx` | `app/admin/users/page.tsx` |
| `app/admin/transactions/page.tsx` | `app/admin/transactions/page.tsx` |
| `app/admin/support/page.tsx` | `app/admin/support/page.tsx` |
| `app/admin/settings/page.tsx` | `app/admin/settings/page.tsx` |

### 4. Delete old mock files

```bash
rm lib/mock-data.ts
rm lib/store.ts
```

### 5. Test

Start both servers:
```bash
# Terminal 1 — Backend
cd natwest-banking-backend && npm run dev

# Terminal 2 — Frontend
cd your-nextjs-project && npm run dev
```

Login with: `user@example.com` / `password123` (enter any 6 digits for 2FA)
Admin login: `admin@example.com` / `adminpassword`

---

## What Changed in Each Frontend File

| File | Before (localStorage) | After (API) |
|---|---|---|
| `hooks/use-auth.tsx` | `getStore()` to find user by email/password | Two-step: `authApi.login()` → `authApi.verify2fa()`, stores JWT |
| `app/login/page.tsx` | `login(email, password)` checked store locally | Step 1 calls API for `pre2faToken`, step 2 sends OTP |
| `app/register/page.tsx` | Just set `step = 3`, no real save | Calls `authApi.register()` which creates user + account in DB |
| `app/dashboard/page.tsx` | `getStore().transactions.filter(userId)` | `transactionsApi.getMine({ days: '30' })` |
| `app/dashboard/transfers/page.tsx` | Payees from `getStore().users`, balance updated in localStorage | `payeesApi.getAll()` + `transactionsApi.transfer()` + `refreshUser()` |
| `app/dashboard/history/page.tsx` | `getStore().transactions` with JS filter | `transactionsApi.getMine({ search, type, days })` |
| `app/dashboard/notifications/page.tsx` | `getStore().notifications` | `notificationsApi.getMine()`, `.markRead()`, `.remove()` |
| `app/dashboard/settings/page.tsx` | Static display from `useAuth()` | `settingsApi.changePassword()` with working modal |
| `app/support/page.tsx` | `setSubmitted(true)` only | If logged in: `ticketsApi.create(subject, message)` |
| `app/admin/page.tsx` | `getStore()` for stats, hardcoded activity | `adminApi.getStats()` + `adminApi.getActivity()` |
| `app/admin/users/page.tsx` | `getStore().users`, `updateStore()` | `usersApi.getAll()`, `.updateStatus()`, `.remove()` |
| `app/admin/transactions/page.tsx` | `getStore().transactions` | `transactionsApi.getAll()` |
| `app/admin/support/page.tsx` | `getStore().tickets`, `updateStore()` | `ticketsApi.getAll()`, `.updateStatus()`, `.respond()` |
| `app/admin/settings/page.tsx` | `resetStore()` | `adminApi.resetSystem()`, `.updateSetting()` |

---

## Seed Credentials

| Role | Email | Password |
|------|-------|----------|
| User | user@example.com | password123 |
| User | jane@example.com | password123 |
| Admin | admin@example.com | adminpassword |

2FA: Enter any 6 digits (e.g. 123456). It's a mock verification.
