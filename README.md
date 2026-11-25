# ReachInbox Email Job Scheduler

Production-grade full-stack email scheduling and automation system built with Node.js, TypeScript, Express, BullMQ, Redis, PostgreSQL (Prisma), Nodemailer (Ethereal), Elasticsearch, and React + Vite + Tailwind CSS.

## Architecture

- **Backend:** Node.js, Express, TypeScript (routes, controllers, services, Zod validation, centralized error handling)
- **Queue & Scheduler:** BullMQ + Redis (delayed jobs, repeatable jobs, atomic Lua sender-level hourly rate limiting, idempotency locks)
- **Database:** PostgreSQL + Prisma ORM (`users`, `sender_accounts`, `email_jobs`, `email_job_logs`, `api_keys`)
- **Search Engine:** Elasticsearch with automatic PostgreSQL fallback
- **Email Delivery:** Nodemailer + Ethereal Email sandbox
- **Frontend:** React, Vite, TypeScript, Tailwind CSS, React Query, React Hook Form, Lucide Icons
- **Integrations:** Google OAuth (`google-auth-library`), Slack OAuth & notifications (`@slack/web-api`), BullMQ Board (`/admin/queues`)

## Running Locally

### 1. Start Infrastructure
```powershell
docker compose up -d
```

### 2. Configure & Run Backend
```powershell
cd backend
npm install
npm run prisma:generate
npx prisma migrate deploy
npm run dev
```
*(Optional: set `RUN_IN_PROCESS_WORKER=false` and run `npm run worker` in a separate process.)*

### 3. Run Frontend
```powershell
cd frontend
npm install
npm run dev
```

### 4. Verification Commands
- **Backend build & tests:** `cd backend && npm test`
- **Backend typecheck:** `cd backend && npm run lint`
- **Frontend build:** `cd frontend && npm run build`
- **Frontend typecheck:** `cd frontend && npm run lint`

## Environment Variables (`backend/.env`)

See [backend/.env.example](backend/.env.example) for all options, including:
- `DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT`, `ELASTICSEARCH_NODE`, `JWT_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_REDIRECT_URI`, `SLACK_WEBHOOK_URL`
- `WORKER_CONCURRENCY`, `DEFAULT_SENDER_HOURLY_LIMIT`, `AUTH_RATE_LIMIT_MAX`, `API_RATE_LIMIT_MAX`
