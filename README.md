# Agent Flow – Client Call Management System

Web app that replaces `Teacher_Call_Tracker.xlsx`: log calls in 5 rounds, search/filter teachers,
schedule tasks (call back, send demo video, meeting…), see each day's agenda and a calendar.
Backend: FastAPI + SQLAlchemy + SQLite. Frontend: React + TypeScript + Vite + Tailwind.

## First-time setup (Windows, from the project folder)

```powershell
# backend
.venv\Scripts\python -m pip install -r backend\requirements.txt
cd backend
..\.venv\Scripts\python -m app.cli create-user mihara "Mihara"      # asks for a password (min 8 chars)
..\.venv\Scripts\python -m app.cli create-user partner "Partner"    # the second team member
cd ..\frontend
npm install
npm run build
```

## Run

```powershell
cd backend
..\.venv\Scripts\python -m uvicorn app.main:app --port 8000
```
Open http://127.0.0.1:8000, sign in, then **Settings → Import .xlsx** to load your existing workbook
(teachers, phone numbers, any logged calls; follow-up dates become tasks). Importing twice is safe.

Development with hot reload: run the backend as above plus `npm run dev` in `frontend/` and open http://localhost:5173.

## Tests
```powershell
cd backend
..\.venv\Scripts\python -m pytest
```

## Deploying online
Build the `Dockerfile` (single container serving API + app). Set environment variables:
`SECRET_KEY` (long random string – required), `COOKIE_SECURE=true` (HTTPS), optionally `DATABASE_URL`.
Mount a persistent volume at `/srv/backend/data` for the SQLite file and create the two users with
`python -m app.cli create-user …` inside the container. Back the database file up regularly.

## How it maps to the spreadsheet
| Excel | App |
|---|---|
| Contacts sheet | **Teachers** page (filters, R1–R5 chips, status) + teacher detail |
| Call Log (5 rows per teacher) | **Log call** form; extra attempts in a round are numbered automatically |
| Dashboard formulas | **Dashboard** page (calculated live) |
| Lists sheet | **Settings → Dropdown lists** |
| Follow-up Date / Next Action | Auto-created **tasks** → **Today** agenda and **Calendar** |
