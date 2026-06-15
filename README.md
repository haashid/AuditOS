# AuditOS AI 


AI-powered audit operating system. Month 1 foundation: auth, engagements, transaction upload with anomaly detection, and dashboard.

---

## Quick Start

### Prerequisites
- Docker Desktop (install from https://www.docker.com/products/docker-desktop/)
- Node.js 20+ (you have v24 ✅)

### Step 1 — Start the backend services (Postgres + Redis + FastAPI)

```bash
cd auditos
docker compose up --build
```

Wait for these lines to appear:
```
backend   | INFO:     Application startup complete.
postgres  | database system is ready to accept connections
```

The backend API is now at: http://localhost:8000
API docs (Swagger): http://localhost:8000/docs

### Step 2 — Start the frontend (in a new terminal)

```bash
cd auditos/frontend
npm run dev
```

The app is now at: http://localhost:3000

---

## Usage Flow

1. Open http://localhost:3000
2. Click **"Create one"** → register with your org name + email + password
3. You land on the Dashboard (empty state)
4. Click **Engagements** in the sidebar → **New Engagement**
5. Fill in the engagement name (e.g., "Acme Corp FY2024 Audit") → Create
6. Click the engagement row → go to the detail page
7. Click the **Upload** tab → drag `docs/sample_transactions.csv` onto the zone
8. Click **Upload & Analyze** → see the toast: "Uploaded 8 rows — X flagged"
9. Click **Transactions** tab → see the table with flagged rows highlighted red
10. Toggle **Flagged Only** filter → Dashboard shows updated charts

---

## Project Structure

```
auditos/
├── backend/
│   ├── main.py                    # FastAPI app entry point
│   ├── core/
│   │   ├── config.py              # Pydantic settings from .env
│   │   ├── database.py            # SQLAlchemy engine + Base
│   │   └── security.py            # JWT + bcrypt + current_user dep
│   ├── models/
│   │   ├── user.py                # Organization + User models
│   │   └── engagement.py          # Engagement + Transaction models
│   ├── schemas/
│   │   ├── user.py                # Auth Pydantic schemas
│   │   └── engagement.py          # Engagement/Transaction schemas
│   ├── api/v1/
│   │   ├── auth.py                # POST /register, /login, GET /me
│   │   ├── engagements.py         # CRUD + upload + transaction list
│   │   └── dashboard.py           # Dashboard aggregate stats
│   ├── services/
│   │   └── flag_engine.py         # 5 flag rules engine
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── app/
│   │   ├── layout.tsx             # Root layout (Inter font, dark bg)
│   │   ├── page.tsx               # Redirects → /login
│   │   ├── login/page.tsx         # Login form
│   │   ├── register/page.tsx      # Registration form
│   │   └── (dashboard)/
│   │       ├── layout.tsx         # Protected layout + sidebar
│   │       ├── dashboard/page.tsx # Stats cards + Recharts
│   │       ├── engagements/
│   │       │   ├── page.tsx       # Engagements list + modal
│   │       │   └── [id]/page.tsx  # Upload tab + Transactions tab
│   │       └── settings/page.tsx  # Read-only profile
│   ├── components/
│   │   └── layout/Sidebar.tsx     # Dark nav sidebar
│   ├── lib/
│   │   ├── api.ts                 # API client (auto-JWT)
│   │   └── auth-context.tsx       # Auth context + useAuth hook
│   └── .env.local
├── docs/
│   └── sample_transactions.csv    # 8-row test file (triggers flags)
├── docker-compose.yml
└── .env
```

---

## API Reference

| Method | Path | Description |
|---|---|---|
| POST | /api/v1/auth/register | Create org + user, returns JWT |
| POST | /api/v1/auth/login | Login, returns JWT |
| GET | /api/v1/auth/me | Current user profile |
| POST | /api/v1/engagements | Create engagement |
| GET | /api/v1/engagements | List org's engagements |
| GET | /api/v1/engagements/{id} | Get single engagement |
| POST | /api/v1/engagements/{id}/upload | Upload CSV/XLSX |
| GET | /api/v1/engagements/{id}/transactions | Paginated transaction list |
| GET | /api/v1/dashboard | Org-wide dashboard stats |

Full interactive docs: http://localhost:8000/docs

---

## Flag Rules

| Rule | Points | Description |
|---|---|---|
| Round number above threshold | +20 | Amount is multiple of 1000 and ≥ $10,000 |
| Transaction on weekend | +25 | Posted on Saturday or Sunday |
| High value transaction | +15 | Amount ≥ $100,000 |
| Missing description | +20 | Description field is blank/null |
| No user recorded | +20 | posted_by field is blank/null |

Max risk score: 100. Score ≥ 70 = high risk (red), ≥ 40 = medium (amber), < 40 = low (green).

---

## Multi-Tenancy

Every API endpoint filters data by `org_id` extracted from the JWT token. It is impossible for Firm A to access Firm B's data even if they know the engagement IDs.

---

## Notes

- The backend auto-creates all database tables on first startup (no migrations needed for Month 1)
- Uploads support CSV and Excel (.xlsx, .xls); column names are auto-detected with fuzzy matching
- Re-uploading to the same engagement replaces previous transactions
- JWT tokens expire in 60 minutes (configurable in .env)
