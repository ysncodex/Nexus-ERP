# Cafe ERP — Backend API

Express REST API with Prisma and PostgreSQL for the Beans & Butter cafe ERP.

---

## Requirements

- Node.js 20+ (LTS recommended)
- PostgreSQL (Neon or any hosted Postgres)

---

## Setup

```bash
cp .env.example .env
npm install
npm run db:deploy    # apply migrations
npm run db:seed      # users + menu catalog
npm run dev          # http://localhost:3000
```

Base API path: `/api` (e.g. `http://localhost:3000/api/health`).

---

## Environment variables

Copy `.env.example` and fill in real values locally. **Do not commit `.env`.**

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Min 16 chars — random secret for tokens |
| `JWT_EXPIRES_IN` | No | Token lifetime (default `7d`) |
| `CORS_ORIGIN` | No | Frontend origin (default `http://localhost:5173`) |
| `PORT` | No | Server port (default `3000`) |
| `OWNER_PASSWORD` | Seed | Owner login password for `db:seed` |
| `MANAGER_PASSWORD` | Seed | Manager login password for `db:seed` |

---

## Database

```bash
npm run db:deploy     # production: prisma migrate deploy
npm run db:migrate    # development: create + apply migration
npm run db:seed       # seed owner, manager + menu items
npm run db:generate   # regenerate Prisma client
npm run db:check      # connectivity smoke test
```

### Seeded roles

| Role | Login | Notes |
| ---- | ----- | ----- |
| `owner` | role + password | Full access |
| `manager` | role + password | Operations + approval PIN |

Passwords come from `OWNER_PASSWORD` / `MANAGER_PASSWORD` in `.env`.

---

## Business timezone

Reporting and date filters use **Asia/Dhaka (UTC+6)**.

- Helpers: `src/utils/businessDate.ts`, `src/utils/query.ts`
- Transaction `date` fields are stored at **UTC noon** of the business-day key
- Monthly/daily reports use `dateRangeWhere()` — not the server's local clock

---

## API overview

All routes are under `/api`.

### Auth

- `POST /auth/login` — `{ role, password }` → JWT
- `GET /auth/verify` — validate token

### Sales

- `GET/POST /sales`, `GET/PUT/DELETE /sales/:id`
- `GET /sales/stats`, `GET /sales/recent`

### Expenses

- `GET/POST /expenses`, `GET/PUT/DELETE /expenses/:id`
- `GET /expenses/stats`, product/fixed cost endpoints

### Funds

- `GET/POST /funds`, balance and stats endpoints

### Reports

- `GET /reports/daily?date=YYYY-MM-DD`
- `GET /reports/monthly?month=YYYY-MM`
- `GET /reports/profit-loss`, `/reports/custom`, `/reports/export`

### Catalog

- Menu items, suppliers, fixed/product cost catalogs

Protected routes require `Authorization: Bearer <token>`.

---

## Folder structure

```text
cafe-backend/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts              # reads OWNER_PASSWORD / MANAGER_PASSWORD
│   └── migrations/
├── src/
│   ├── server.ts
│   ├── config/env.ts
│   ├── lib/prisma.ts
│   ├── modules/             # auth, sales, expenses, funds, reports, …
│   └── utils/               # businessDate, query, serialize
├── render.yaml              # Render deploy blueprint
├── .env.example
└── package.json
```

---

## Deploy (Render)

1. Connect repo, set root to `cafe-backend`
2. Set environment variables in Render dashboard (never in git)
3. Build: `npm install` (runs `postinstall` → `prisma generate`)
4. Start: `npm start`
5. Run `npm run db:deploy` and `npm run db:seed` against production DB once

Set `CORS_ORIGIN` to your Netlify frontend URL.

---

## Scripts

| Command | Purpose |
| ------- | ------- |
| `npm run dev` | Dev server with `tsx watch` |
| `npm start` | Production server |
| `npm run typecheck` | TypeScript check |
| `npm run db:deploy` | Apply pending migrations |
| `npm run db:seed` | Seed database |

---

## Security notes

- Password hashes live only in the database (bcrypt, cost 12)
- `passwordHash` is never returned in API responses
- Keep `JWT_SECRET` and database credentials in host env vars only
- Rotate all secrets if they were ever committed to version control
