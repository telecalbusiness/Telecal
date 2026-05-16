# MediConnect — Telemedicine Platform

Production-grade telemedicine application built with:
- **Frontend**: Vite + React + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + Socket.io + Prisma
- **Database**: PostgreSQL
- **Payments**: Paystack
- **Video**: WebRTC (SimplePeer) — in-app, recorded, timed

---

## Project structure

```
mediconnect/
├── apps/
│   ├── client/          # React frontend (Vite)
│   └── server/          # Node.js backend (Express)
└── packages/
    └── shared/          # Shared TypeScript types, enums, constants
```

---

## Prerequisites

- Node.js >= 20
- npm >= 10
- PostgreSQL database (local or hosted — Railway/Supabase free tier works)

---

## Step 1 — Clone and install dependencies

```bash
# From project root
npm install
```

---

## Step 2 — Configure environment variables

```bash
cd apps/server
cp .env.example .env
```

Open `.env` and fill in the following required values:

### Database
```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/mediconnect_dev"
```
For a free hosted database: https://railway.app or https://supabase.com

### JWT Secrets (generate strong random values)
```bash
# Run these in terminal to generate secure secrets
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```
```env
JWT_ACCESS_SECRET=<64+ character random string>
JWT_REFRESH_SECRET=<different 64+ character random string>
```

### Encryption key (for medical records at rest)
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
```env
ENCRYPTION_KEY=<64 hex characters = 32 bytes>
```

### Paystack (free account at https://paystack.com)
```env
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_PUBLIC_KEY=pk_test_...
PAYSTACK_WEBHOOK_SECRET=<from Paystack dashboard webhook settings>
```

### Client URL
```env
CLIENT_URL=http://localhost:5173
```

---

## Step 3 — Set up the database

```bash
cd apps/server

# Generate Prisma client
npm run db:generate

# Run migrations (creates all tables)
npm run db:migrate

# Seed the database (creates admin account)
npm run db:seed
```

Default admin credentials (change immediately after first login):
- Email: `admin@mediconnect.com`
- Password: `Admin@MediConnect2025!`

---

## Step 4 — Run the application

From the project root:

```bash
npm run dev
```

This starts both the frontend and backend concurrently:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000
- Health check: http://localhost:5000/health

---

## Paystack webhook setup (for local development)

Paystack needs to reach your local server to confirm payments.
Use [ngrok](https://ngrok.com) or [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/) to expose your local port:

```bash
ngrok http 5000
```

Then in your Paystack dashboard:
1. Go to Settings → Webhooks
2. Add webhook URL: `https://YOUR_NGROK_URL/api/v1/payments/webhook`
3. Copy the webhook secret into your `.env` as `PAYSTACK_WEBHOOK_SECRET`

For the payment callback (redirect after payment):
- Set `callbackUrl` in Paystack to: `http://localhost:5173/payment/success`

---

## TURN server for WebRTC (video calls)

For development, Google's public STUN servers are used automatically.
For users behind strict firewalls, you need a TURN server.

Free option: https://metered.ca (100GB/month free tier)
1. Create account, get TURN credentials
2. Add to `.env`:
```env
TURN_SERVER_URL=turn:your-server.metered.ca:80
TURN_SERVER_USERNAME=your-username
TURN_SERVER_CREDENTIAL=your-credential
```

---

## User flows

### Patient
1. Register at `/auth/register/patient` → get unique file number
2. Book consultation at `/dashboard/appointments/new`
3. Pay via Paystack → redirected back on success
4. System auto-assigns an available doctor
5. Join video call at `/session/:appointmentId`
6. After call: submit investigation reports, receive prescriptions

### Doctor
1. Register at `/auth/register/doctor` → upload credentials
2. Admin approves account (via admin dashboard)
3. Log in → click "Go online" on dashboard
4. System auto-assigns patients
5. Receive instant notification → join session → issue prescription
6. Review investigation reports in Investigations section

### Admin
1. Log in with seeded admin credentials
2. Review pending doctors at `/dashboard/doctors`
3. Approve or reject with reason
4. Monitor platform analytics on dashboard
5. View audit logs at `/dashboard/audit`

---

## API routes summary

| Module | Base path |
|--------|-----------|
| Auth | `/api/v1/auth` |
| Users | `/api/v1/users` |
| Patients | `/api/v1/patients` |
| Doctors | `/api/v1/doctors` |
| Appointments | `/api/v1/appointments` |
| Investigations | `/api/v1/investigations` |
| Sessions | `/api/v1/sessions` |
| Payments | `/api/v1/payments` |
| Prescriptions | `/api/v1/prescriptions` |
| Notifications | `/api/v1/notifications` |
| Admin | `/api/v1/admin` |

---

## Security notes

- All tokens stored in httpOnly cookies — immune to XSS
- JWT access tokens expire in 15 minutes; refresh tokens in 7 days
- Stolen refresh tokens trigger full session revocation
- Paystack webhooks verified via HMAC-SHA512 signature
- Payment amounts verified server-side against DB records
- All medical records soft-deleted (never hard deleted)
- Audit log retention: 7 years
- AES-256-GCM encryption for sensitive fields at rest
- Rate limiting: 100 req/15min general, 10 req/15min auth endpoints
- Brute force protection: account locked after 5 failed attempts

---

## Deploying to production

### Frontend → Vercel
```bash
cd apps/client
vercel deploy
```
Set `VITE_API_URL` environment variable in Vercel dashboard.

### Backend → Railway
1. Connect your GitHub repository
2. Set all environment variables from `.env.example`
3. Railway auto-detects Node.js and runs `npm start`
4. Set `DATABASE_URL` to Railway's provided PostgreSQL URL

### Database migrations on deploy
```bash
npm run db:migrate:prod
```

---

## Fees (configurable in `packages/shared/src/constants.ts`)

| Consultation type | Fee |
|---|---|
| General practitioner | ₦5,000 |
| Specialist | ₦7,500 |
| New investigation | ₦3,000 |
| Returning patient investigation | ₦1,500 |

---

## Session time limits

| Type | Duration | Warning |
|---|---|---|
| General practitioner | 20 minutes | 2 min before end |
| Specialist | 30 minutes | 2 min before end |
| Grace period | +60 seconds | Hard disconnect |
