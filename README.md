<div align="center">

# 🏏 IPL 2026 Fantasy League

**A full-stack fantasy cricket platform built entirely by vibing with AI.**  
*Pick your squad. Outsmart your friends. Blame the pitch.*

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-ipl--2026--fantasy.vercel.app-6366f1?style=for-the-badge)](https://ipl-2026-fantasy.vercel.app)
[![Backend](https://img.shields.io/badge/Backend-PythonAnywhere-2ecc71?style=for-the-badge&logo=python)](https://pythonanywhere.com)
[![Frontend](https://img.shields.io/badge/Frontend-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com)
[![Vibe Coded](https://img.shields.io/badge/��_Vibe-Coded-ff6b6b?style=for-the-badge)](https://github.com)
[![May Have Bugs](https://img.shields.io/badge/⚠️_May_Have-Bugs-yellow?style=for-the-badge)](https://github.com)

<br/>

> ⚡ **Fully vibe-coded.** This entire app was built by having conversations with an AI assistant.  
> No traditional software planning. No ticketing system. Just pure chaos and vibes.  
> It works (mostly). There may be bugs. You have been warned. 🙂

</div>

---

## 🎮 What Is This?

IPL 2026 Fantasy League is a **private fantasy cricket platform** built for you and your friends to compete during the IPL 2026 season. It's NOT official, NOT affiliated with the BCCI, and very much held together with vibes and string.

You pick a 12-player squad, set weekly roles, make transfers, join private leagues — and watch your rank rise or fall with every match.

---

## ✨ Features

### 🏟️ Squad Building
- Pick exactly **12 players** from any IPL team with a **₹100 Cr budget**
- Constraints that keep it real:
  - Max **4 overseas** players
  - Min **1 Wicket Keeper**
  - 1–5 All-rounders
  - Balanced batting/bowling composition
  - Max **2 players** from the same team

### 🎯 Weekly Roles (Locked Each Week)
| Role | Multiplier |
|------|-----------|
| 👑 Captain | **2× points** |
| 🥈 Vice-Captain | **1.5× points** |
| ⚡ Impact Player | **1× points** (standard) |

Roles are **locked** once set and only reset when the admin starts a new week.

### 💼 Transfer System
- **2 free transfers** per week (unused ones carry over, max 5)
- Each extra transfer beyond free quota = **-25 points penalty**
- Transferred-in players **only earn points from future matches** (no backdated points)

### 🃏 Season Chips *(use once per season)*
| Chip | Effect |
|------|--------|
| 👑 Triple Captain | Captain earns **3× points** instead of 2× for the week |
| ♾️ Unlimited Transfers | Make **unlimited swaps** with zero penalty for the week |

### 🏆 Leagues
- Create **private leagues** with a shareable 6-character code
- Join **multiple leagues** simultaneously
- League leaderboards with **Overall** and **This Week** toggle
- **Global Leaderboard** — Top 100 players across the entire platform
- League creators can kick members

### 📊 Scoring System
Points are awarded based on **Runs**, **Wickets**, and **Catches** per match. Stats are imported manually via the admin panel or auto-fetched from CricAPI.

### 🤖 CricAPI Auto-Fetch
- Connect a [CricAPI](https://cricapi.com) key in the admin panel
- Auto-fetch live IPL scores at configurable intervals
- Smart duplicate match detection to avoid double-importing

### 👤 Dashboard
- Total Points + Weekly Points breakdown
- **Global Rank** indicator
- Your squad sorted by earnings
- Upcoming & completed match history

### 🔐 Admin Panel
- Manage players (add / edit / delete)
- Add matches manually or import from CricAPI
- Enter stats per match → automatically recalculates all user points
- Open/close the transfer window
- Weekly reset (zeroes weekly points, gives +2 transfers, unlocks roles)
- Full recalculate all user points

---

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| **Frontend** | React (Vite), Vanilla CSS |
| **Backend** | Python, Flask |
| **Database** | SQLite |
| **Hosting (Backend)** | PythonAnywhere |
| **Hosting (Frontend)** | Vercel |
| **Match Data** | CricAPI |
| **Methodology** | Vibes ✨ |

---

## 🚀 Running Locally

### Prerequisites
- Python 3.10+
- Node.js 18+

### Backend

```bash
cd server
pip install flask flask-cors requests
python app.py
```

Server runs at `http://localhost:5000`

### Frontend

```bash
cd client
npm install
npm run dev
```

App runs at `http://localhost:5173`

> Make sure `client/src/api.js` points to `http://localhost:5000` for local development.

---

## 🌐 Deploying (PythonAnywhere + Vercel)

### Backend (PythonAnywhere)

```bash
git pull
cd server
python3 -c "from db import init_db; init_db()"
```
Then hit **Reload** in the PythonAnywhere Web tab.

### Frontend (Vercel)

Push to `main` — Vercel auto-deploys. Done.

---

## 📁 Project Structure

```
IPL_2026_Fantasy/
├── client/                  # React frontend (Vite)
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.jsx       # User home page
│       │   ├── TeamBuilder.jsx     # Squad selection
│       │   ├── GroupPage.jsx       # Leagues & leaderboards
│       │   └── AdminPanel.jsx      # Admin controls
│       └── api.js                  # All API calls
│
├── server/                  # Flask backend
│   ├── app.py               # All API routes
│   ├── db.py                # DB schema, migrations, player seeding
│   └── cricapi.py           # CricAPI integration & auto-fetch
│
└── scrape/
    └── data.csv             # Player data (seeded into DB on first run)
```

---

## ⚠️ Known Quirks & Disclaimers

> 🚨 **This app was vibe-coded.** Features were added as the season progressed, decisions were made in real-time, and the architecture reflects that beautiful chaos.

- **May have bugs.** Found one? Congrats, you are now a QA engineer.
- The SQLite database (`fantasy_v2.db`) is **not** in git. Back it up yourself.
- The admin password is set in `app.py`. Don't expose it publicly.
- Weekly points depend on the admin doing the weekly reset on time. Forget it? Everyone's weekly stays wrong. Fun times.
- Transfer history is tracked at the match level — new players only earn from matches after their transfer date.
- Retroactive stat corrections affect all players who owned that player at that time.
- This is **not** affiliated with IPL, BCCI, Dream11, or any official fantasy platform.

---

## 🔑 Admin Access

Sign up normally and enter the admin password on the login screen. The admin gets:
- Match management & stat entry
- User management
- Weekly resets & full recalculate
- Transfer window open/close controls
- CricAPI configuration

---

## 🙏 Credits

Built with:
- 🤖 Heavy AI assistance (like, *really* heavy)
- ☕ Chai
- 🏏 A deep love for IPL cricket  
- 😅 A concerning amount of "let's just try it and see what happens"

---

<div align="center">

**Made with vibes. Powered by cricket. May or may not survive the playoffs.**

*If it breaks during a final — that's on the pitch, not the code.*

⭐ **Star this repo if it brought you joy, suffering, or both.**

</div>
