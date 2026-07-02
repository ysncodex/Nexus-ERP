# Beans & Butter — Cafe ERP

Full-stack point-of-sale and operations dashboard for **Beans & Butter** cafe.

| Package | Stack | Role |
| -------- | ----- | ---- |
| [`cafe-frontend/`](cafe-frontend/) | React 19, Vite, TypeScript, Tailwind | POS, dashboard, reports (Netlify) |
| [`cafe-backend/`](cafe-backend/) | Express, Prisma, PostgreSQL | REST API, auth, persistence (Render + Neon) |

---

## Quick start (local)

### 1. Backend

```bash
cd cafe-backend
cp .env.example .env
# Edit .env: DATABASE_URL, JWT_SECRET, OWNER_PASSWORD, MANAGER_PASSWORD
npm install
npm run db:deploy
npm run db:seed
npm run dev
```

API runs at `http://localhost:3000/api`.

### 2. Frontend

```bash
cd cafe-frontend
cp .env.example .env
# Set VITE_API_URL=http://localhost:3000/api
# Optional offline fallback: VITE_OWNER_PASSWORD, VITE_MANAGER_PASSWORD
npm install
npm run dev
```

App runs at `http://localhost:5173`.

---

## Business timezone

All reporting uses **Asia/Dhaka (UTC+6)** as the business day, regardless of server or device timezone.

- **Default view = today only** — dashboard, KPIs, and Order History start on the current business day.
- **Historical data** — use date filters or custom ranges when you need past days.
- Transaction dates are stored as **UTC noon** of the business-day key so grouping stays consistent worldwide.

Helpers live in `cafe-frontend/src/shared/utils/businessDate.ts` and `cafe-backend/src/utils/businessDate.ts`.

---

## Authentication

| Role | Access |
| ---- | ------ |
| **Owner** | Full access |
| **Manager** | Operations + manager PIN for sensitive edits |
| **Visitor** | Read-only preview (no password) |

Passwords are **never stored in source code**. Set them in environment variables:

| Location | Variables |
| -------- | --------- |
| Backend `.env` | `OWNER_PASSWORD`, `MANAGER_PASSWORD` (used by `npm run db:seed`) |
| Frontend `.env` | `VITE_OWNER_PASSWORD`, `VITE_MANAGER_PASSWORD` (optional offline fallback) |

Production sign-in uses JWT from the backend API. Visitor mode uses `POST /api/auth/visitor`.

---

## Deployment

| Service | Host | Config |
| ------- | ---- | ------ |
| Frontend | Netlify | `cafe-frontend/netlify.toml` — set `VITE_API_URL` in dashboard |
| Backend | Render | `cafe-backend/render.yaml` — set env vars in dashboard |
| Database | Neon PostgreSQL | `DATABASE_URL` on backend |

After backend deploy: `npm run db:deploy` then `npm run db:seed` (once per environment).

---

## Scripts (per package)

**Backend** (`cafe-backend/`)

```bash
npm run dev          # API with hot reload
npm run db:deploy    # Apply migrations (production-safe)
npm run db:seed      # Seed users + menu
npm run typecheck
```

**Frontend** (`cafe-frontend/`)

```bash
npm run dev
npm run build
npm run lint
```

---

## Security & GitHub

- `.env` files are gitignored — **never commit** real credentials.
- Passwords belong only in `.env` (local) or host environment variables (production).
- If secrets were ever pushed to GitHub, rotate `DATABASE_URL`, `JWT_SECRET`, and login passwords immediately.
- Use `.env.example` files as templates with placeholder values only.

---

## Project layout

```text
BeansAndButter/
├── cafe-frontend/     # React SPA (POS + ERP UI)
├── cafe-backend/      # Express API + Prisma
├── README.md          # This file
└── .gitignore
```

See package READMEs for deeper detail:

- [Frontend README](cafe-frontend/README.md)
- [Backend README](cafe-backend/README.md)

---

## Maintainer

Md. Yeasin — yeasin7y@gmail.com
