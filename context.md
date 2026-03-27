# IPL 2026 Fantasy - Project Context

This document serves as a "Brain" for Antigravity or any developer to understand the current state of the IPL 2026 Fantasy application and continue development.

## 🚀 Project Overview
A full-stack Fantasy Cricket application for the IPL 2026 season. Users build a balanced squad of 12 players and assign weekly roles (Captain, Vice-Captain, Impact). to earn points.

## 🛠️ Tech Stack
- **Frontend**: React (Vite) + Vanilla CSS.
  - **Hosting**: Vercel ([ipl-2026-fantasy.vercel.app](https://ipl-2026-fantasy.vercel.app))
  - **Key Component**: `client/src/api.js` manages all backend communication using an absolute `BASE` URL.
- **Backend**: Python Flask + SQLite.
  - **Hosting**: PythonAnywhere ([lithinsaikumar.pythonanywhere.com](https://lithinsaikumar.pythonanywhere.com))
  - **Database**: `server/fantasy.db` (SQLite).
  - **Image Hosting**: Served from `server/images/` via Flask's `request.host_url`.

## 🏗️ Architecture & Data Flow
1. **Split Hosting**: The Vercel frontend is a static build that makes CORS-enabled requests to the PythonAnywhere API.
2. **Database Persistence**: The SQLite database is created on the first run via `server/db.py` (`init_db`). It is **not** pushed to GitHub to avoid overwriting production users/scores.
3. **Point System**: 
   - 1 Run = 1 Pt.
   - 1 Wicket = 25 Pts.
   - 1 Catch = 8 Pts.
   - **Multipliers**: Captain (2.0x), Vice-Captain (1.5x).
   - **Lineup**: Points only count for the 12 selected players (XI + Impact) for that specific match.

## 📋 Features implemented
- [x] **Squad Building**: 16 players, ₹120Cr budget, strict role constraints (3-6 each category).
- [x] **12-Player Squad**: Strictly balanced (3-6 per category, max 4 overseas, min 1 wk).
- [x] **Deadline Enforcement**: Lineup changes lock at 7:30 PM IST (14:00 UTC) on match day.
- [x] **Admin Panel**: Matches can be created, marked DONE, and stats entered for players.
- [x] **Leaderboard**: Global and Group-based rankings.
- [x] **Match Results**: Clicking a "DONE" match shows the user's finalized squad and their match points.

## 📁 Key File Map
- `/server/app.py`: Main API, point calculation logic, and image serving.
- `/server/db.py`: Schema definition and initial player seeding from `scrape/data.csv`.
- `/client/src/api.js`: All API calls + the production `BASE` URL.
- `/client/src/pages/MatchLineupPage.jsx`: Logic for the 11+1 selection and "Done" match view.
- `/client/src/pages/AdminPanel.jsx`: Critical admin controls for the season.

## ⚠️ Important for Continuity
1. **Always use Absolute URLs for Images**: Images must use `${BASE}/images/${player.image}`.
2. **Database Schema Updates**: If you modify `db.py`, the user must run `python3 -c "from db import init_db; init_db()"` on PythonAnywhere and then **Reload** the web app.
3. **CORS**: PythonAnywhere backend is configured with `flask_cors` to allow Vercel origins.
4. **Timezone**: The server typically runs in UTC. 7:30 PM IST = 14:00 UTC.

## 🛠️ Maintenance Commands (PythonAnywhere)
```bash
git pull
cd server
python3 -c "from db import init_db; init_db()"
# Then Reload in the Web Tab
```
