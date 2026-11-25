# ReachInbox Email Job Scheduler

A full-stack email scheduling and job automation system built with **JavaScript** (not TypeScript) using Node.js, Express, BullMQ, Redis, MongoDB, Nodemailer (Ethereal), and React + Vite + Tailwind CSS.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React.js + Vite + Tailwind CSS |
| **Backend** | Node.js + Express.js (JavaScript) |
| **Database** | MongoDB + Mongoose |
| **Job Queue** | BullMQ + Redis |
| **Email Service** | Nodemailer + Ethereal Email (fake SMTP) |
| **Auth** | JWT (email/password + demo login) |
| **Queue Dashboard** | BullMQ Board (`/admin/queues`) |

## Architecture

- **Backend:** Node.js, Express, JavaScript (routes, controllers, services, Zod validation, centralized error handling)
- **Queue & Scheduler:** BullMQ + Redis (delayed jobs, repeatable jobs, atomic Lua sender-level hourly rate limiting, idempotency locks)
- **Database:** MongoDB + Mongoose ORM (`users`, `senderAccounts`, `emailJobs`, `emailJobLogs`)
- **Email Delivery:** Nodemailer + Ethereal Email sandbox (preview URLs included in responses)
- **Frontend:** React, Vite, Tailwind CSS, React Query, React Hook Form, Lucide Icons

## Project Structure

```
reachinbox-email-scheduler/
├── backend/               # Node.js + Express API server
│   ├── src/
│   │   ├── config/        # DB, Redis, Mail, Env config
│   │   ├── constants/     # App-wide constants
│   │   ├── controllers/   # Route handlers
│   │   ├── middleware/    # Auth, error, validation, rate-limit
│   │   ├── models/        # Mongoose models
│   │   ├── queues/        # BullMQ queue + Bull-Board setup
│   │   ├── routes/        # Express routers
│   │   ├── services/      # Business logic
│   │   ├── utils/         # Logger, asyncHandler, sanitize
│   │   ├── workers/       # BullMQ email worker
│   │   ├── index.js       # App entry point
│   │   └── worker.js      # Standalone worker entry point
│   ├── .env.example
│   └── package.json
├── frontend/              # React + Vite SPA
│   ├── src/
│   │   ├── components/    # UI components (ui/, jobs/, layout/)
│   │   ├── context/       # AuthContext, ToastContext
│   │   ├── hooks/         # useJobs (React Query hooks)
│   │   ├── pages/         # Dashboard, Jobs, Senders, Settings, Login
│   │   ├── services/      # API client (axios)
│   │   ├── utils/         # cn, format helpers
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── vite.config.js
│   └── package.json
├── docker-compose.yml     # MongoDB + Redis
└── README.md
```

## Running Locally

### 1. Start Infrastructure (MongoDB + Redis)
```powershell
docker compose up -d
```

### 2. Configure Backend
```powershell
cd backend
copy .env.example .env
# Edit .env with your values (Ethereal SMTP credentials are auto-generated on first run)
```

### 3. Run Backend
```powershell
cd backend
npm install
npm run dev
```
> Worker runs in-process by default. Set `RUN_IN_PROCESS_WORKER=false` and run `npm run worker` separately for production.

### 4. Run Frontend
```powershell
cd frontend
npm install
npm run dev
```

### 5. Open in Browser
- **Frontend:** http://localhost:5173
- **BullMQ Board:** http://localhost:5000/admin/queues
- **API Health:** http://localhost:5000/api/v1/health

## Environment Variables

See [`backend/.env.example`](backend/.env.example) for all options.

**Key variables:**
| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `REDIS_HOST` / `REDIS_PORT` | Redis connection |
| `JWT_SECRET` | Secret key for JWT tokens |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Ethereal SMTP credentials |
| `WORKER_CONCURRENCY` | Number of concurrent BullMQ workers |
| `DEFAULT_SENDER_HOURLY_LIMIT` | Default emails per sender per hour |

## Features

- ✅ Schedule one-time, delayed, and recurring emails (hourly, daily, weekly, custom interval)
- ✅ Batch scheduling with stagger delay between recipients
- ✅ Per-sender hourly rate limiting enforced atomically in Redis (Lua script)
- ✅ Idempotency keys to prevent duplicate job submissions
- ✅ BullMQ Board dashboard for real-time queue monitoring
- ✅ Ethereal Email preview URLs for inspecting sent emails
- ✅ Full execution timeline / audit logs per job
- ✅ Demo login for evaluators (no signup required)
- ✅ JWT authentication with register/login
- ✅ Responsive React UI with real-time stats dashboard
