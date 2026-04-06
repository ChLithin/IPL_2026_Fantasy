"""
CricAPI Integration Module
Handles fetching match data and scorecards from CricAPI,
parsing player stats, and fuzzy-matching to local database players.

Smart Auto-Fetch:
  - Only polls during narrow windows after matches are expected to end
  - IPL afternoon matches: 3:30 PM IST -> expected end ~7:00 PM -> poll 7:00-8:00 PM
  - IPL evening matches:   7:30 PM IST -> expected end ~11:00 PM -> poll 11:00 PM-12:00 AM
  - Stops polling once a match is successfully imported
  - Uses only ~3-6 API calls per match instead of 144/day
"""
import requests
import difflib
import threading
import time
import logging
import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('cricapi')

CRICAPI_BASE = "https://api.cricapi.com/v1"

# ── API Calls ────────────────────────────────────────────────────────────────

def fetch_current_matches(apikey):
    """Fetch current/recent matches from CricAPI."""
    url = f"{CRICAPI_BASE}/currentMatches"
    resp = requests.get(url, params={"apikey": apikey, "offset": 0}, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    if data.get("status") != "success":
        raise Exception(data.get("reason", "CricAPI returned failure"))
    return data.get("data", [])


def fetch_match_list(apikey):
    """Fetch broader match list (upcoming + recent)."""
    url = f"{CRICAPI_BASE}/matches"
    resp = requests.get(url, params={"apikey": apikey, "offset": 0}, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    if data.get("status") != "success":
        raise Exception(data.get("reason", "CricAPI returned failure"))
    return data.get("data", [])


def fetch_scorecard(apikey, cricapi_match_id):
    """Fetch full scorecard for a specific match."""
    url = f"{CRICAPI_BASE}/match_scorecard"
    resp = requests.get(url, params={"apikey": apikey, "id": cricapi_match_id}, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    if data.get("status") != "success":
        raise Exception(data.get("reason", "CricAPI returned failure"))
    return data.get("data", {})


# ── Filtering ────────────────────────────────────────────────────────────────

IPL_TEAM_ABBRS = {"CSK", "RCB", "MI", "KKR", "SRH", "DC", "RR", "LSG", "GT", "PBKS"}

IPL_TEAM_NAMES = {
    "Chennai Super Kings": "CSK",
    "Royal Challengers Bengaluru": "RCB",
    "Royal Challengers Bangalore": "RCB",
    "Mumbai Indians": "MI",
    "Kolkata Knight Riders": "KKR",
    "Sunrisers Hyderabad": "SRH",
    "Delhi Capitals": "DC",
    "Rajasthan Royals": "RR",
    "Lucknow Super Giants": "LSG",
    "Gujarat Titans": "GT",
    "Punjab Kings": "PBKS",
}

def filter_ipl_matches(matches):
    """Filter match list to only IPL matches."""
    ipl = []
    for m in matches:
        name = str(m.get("name", "")).lower()
        series = str(m.get("series", "") or "").lower()
        teams = m.get("teams", [])
        
        is_ipl = (
            "ipl" in name or "ipl" in series or
            "indian premier league" in name or "indian premier league" in series
        )
        
        if not is_ipl and teams:
            for t in teams:
                if t in IPL_TEAM_NAMES:
                    is_ipl = True
                    break
        
        if is_ipl:
            ipl.append(m)
    
    return ipl


def is_match_completed(match):
    """Check if a match is completed."""
    status = str(match.get("status", "")).lower()
    ended = match.get("matchEnded", False)
    return ended or "won" in status or "tied" in status or "no result" in status


# ── Scorecard Parsing ────────────────────────────────────────────────────────

def _get_name(obj):
    """Extract player name from a cricapi player object (could be string or dict)."""
    if isinstance(obj, dict):
        return obj.get("name", str(obj))
    return str(obj) if obj else ""


def extract_player_stats(scorecard_data):
    """
    Parse CricAPI scorecard response into a flat dict of player stats.
    Returns: {player_name: {runs: int, wickets: int, catches: int}}
    """
    stats = {}
    
    scorecard = scorecard_data.get("scorecard", [])
    if not isinstance(scorecard, list):
        return stats
    
    for inning in scorecard:
        if not isinstance(inning, dict):
            continue
        
        for b in inning.get("batting", []):
            name = _get_name(b.get("batsman", b.get("name", "")))
            if not name:
                continue
            runs = int(b.get("r", b.get("runs", b.get("R", 0))) or 0)
            if name not in stats:
                stats[name] = {"runs": 0, "wickets": 0, "catches": 0}
            stats[name]["runs"] += runs
            
            dismissal = str(b.get("dismissal", b.get("dismissal-type", ""))).lower()
            if dismissal in ("catch", "caught", "c", "lbw"):
                if dismissal != "lbw":
                    catcher_name = _get_name(b.get("catcher", b.get("fielder", "")))
                    if not catcher_name:
                        d_text = str(b.get("dismissal-text", b.get("dismissalText", "")))
                        if d_text.startswith("c ") and " b " in d_text:
                            catcher_name = d_text.split("c ", 1)[1].split(" b ")[0].strip()
                    if catcher_name:
                        if catcher_name not in stats:
                            stats[catcher_name] = {"runs": 0, "wickets": 0, "catches": 0}
                        stats[catcher_name]["catches"] += 1
        
        for bl in inning.get("bowling", []):
            name = _get_name(bl.get("bowler", bl.get("name", "")))
            if not name:
                continue
            wickets = int(bl.get("w", bl.get("W", bl.get("wickets", 0))) or 0)
            if name not in stats:
                stats[name] = {"runs": 0, "wickets": 0, "catches": 0}
            stats[name]["wickets"] += wickets
        
        catching_data = inning.get("catching", inning.get("fielding", []))
        if catching_data:
            for c in catching_data:
                name = _get_name(c.get("fielder", c.get("name", "")))
                if not name:
                    continue
                catches = int(c.get("catches", c.get("c", c.get("catch", 0))) or 0)
                if name not in stats:
                    stats[name] = {"runs": 0, "wickets": 0, "catches": 0}
                stats[name]["catches"] += catches
    return stats


def _normalize_name(name):
    """Normalize a player name for matching."""
    name = name.strip().lower()
    for prefix in ["(c)", "(wk)", "(c & wk)"]:
        name = name.replace(prefix, "")
    return name.strip()


def match_players_to_db(extracted_stats, db_players, threshold=0.6):
    """Fuzzy-match CricAPI player names to database player records."""
    db_names = {_normalize_name(p["name"]): p for p in db_players}
    db_name_list = list(db_names.keys())
    matched = []
    unmatched = []
    used_db_ids = set()
    for api_name, api_stats in extracted_stats.items():
        norm_api = _normalize_name(api_name)
        if norm_api in db_names:
            p = db_names[norm_api]
            if p["id"] not in used_db_ids:
                matched.append({
                    "player_id": p["id"],
                    "db_name": p["name"],
                    "api_name": api_name,
                    **api_stats,
                    "confidence": 1.0,
                })
                used_db_ids.add(p["id"])
                continue
        close = difflib.get_close_matches(norm_api, db_name_list, n=1, cutoff=threshold)
        if close:
            best = close[0]
            p = db_names[best]
            if p["id"] not in used_db_ids:
                ratio = difflib.SequenceMatcher(None, norm_api, best).ratio()
                matched.append({
                    "player_id": p["id"],
                    "db_name": p["name"],
                    "api_name": api_name,
                    **api_stats,
                    "confidence": round(ratio, 2),
                })
                used_db_ids.add(p["id"])
                continue
        if api_stats["runs"] > 0 or api_stats["wickets"] > 0 or api_stats["catches"] > 0:
            unmatched.append({"api_name": api_name, **api_stats})
    return {"matched": matched, "unmatched": unmatched}


# ── Smart Schedule-Aware Auto-Fetch ──────────────────────────────────────────
#
# IPL match timings (IST):
#   - Afternoon match: starts 3:30 PM, ends ~7:00 PM
#   - Evening match:   starts 7:30 PM, ends ~11:00 PM
#
# Polling windows (IST) — only check during these narrow slots:
#   - Afternoon window: 6:45 PM to 8:00 PM (75 min window)
#   - Evening window:  10:45 PM to 12:00 AM (75 min window)
#
# With 10 min polling interval inside these windows:
#   - Max ~8 poll attempts per day (on double-header days)
#   - Each attempt uses 1 API call (currentMatches) + 1 per new match (scorecard)
#   - Typical usage: 3-6 API calls per match day
#   - Once all matches for a window are imported, remaining polls skip the API call

POLLING_WINDOWS_IST = [
    # (start_hour, start_min, end_hour, end_min) — "afternoon match end" window
    (18, 45, 20, 0),
    # "evening match end" window  
    (22, 45, 23, 59),
]

def _is_in_polling_window(now_ist):
    """Check if the current IST time falls within any polling window."""
    h, m = now_ist.hour, now_ist.minute
    current_mins = h * 60 + m
    
    for sh, sm, eh, em in POLLING_WINDOWS_IST:
        start_mins = sh * 60 + sm
        end_mins = eh * 60 + em
        if start_mins <= current_mins <= end_mins:
            return True
    return False


def _count_unimported_today(conn, today_str):
    """
    Check how many matches today are NOT yet imported.
    We consider a match 'imported' if it has a cricapi_match_id or status='done'.
    Returns the number of matches for today that might still need importing.
    """
    # Check CricAPI matches we've already imported today
    imported = conn.execute(
        "SELECT COUNT(*) as cnt FROM matches WHERE date = ? AND cricapi_match_id != '' AND cricapi_match_id IS NOT NULL",
        (today_str,)
    ).fetchone()
    imported_count = imported['cnt'] if imported else 0
    
    # On any given IPL day, there are 1 or 2 matches (double-header)
    # We don't know the exact count from our DB, so we can't skip based on that alone.
    # But if we've already imported 2 today, we can safely skip.
    return imported_count


_auto_fetch_thread = None
_auto_fetch_stop = threading.Event()
# Track imported matches per day to avoid redundant API calls
_imported_today = set()
_imported_today_date = None


def start_auto_fetch(app, interval_seconds=600):
    """
    Start a background thread that checks for completed IPL matches
    ONLY during narrow post-match windows to minimize API usage.
    
    The worker wakes up every `interval_seconds` but only calls the API
    if we're inside a polling window AND haven't already imported all matches.
    """
    global _auto_fetch_thread, _auto_fetch_stop
    if _auto_fetch_thread and _auto_fetch_thread.is_alive():
        logger.info("Auto-fetch already running")
        return
    _auto_fetch_stop.clear()
    
    def worker():
        logger.info(f"Smart auto-fetch worker started (interval: {interval_seconds}s)")
        logger.info(f"Polling windows (IST): {POLLING_WINDOWS_IST}")
        while not _auto_fetch_stop.is_set():
            try:
                with app.app_context():
                    _smart_auto_fetch_cycle(app)
            except Exception as e:
                logger.error(f"Auto-fetch cycle error: {e}")
            _auto_fetch_stop.wait(interval_seconds)
        logger.info("Auto-fetch worker stopped")
    
    _auto_fetch_thread = threading.Thread(target=worker, daemon=True, name="cricapi-auto-fetch")
    _auto_fetch_thread.start()


def stop_auto_fetch():
    global _auto_fetch_stop
    _auto_fetch_stop.set()


def _smart_auto_fetch_cycle(app):
    """
    One cycle of the smart auto-fetch.
    
    Decision flow:
    1. Check current IST time — are we in a polling window?
    2. If not in a window, skip (costs 0 API calls)
    3. If in a window, check if we already imported matches for this window today
    4. If all imported, skip (costs 0 API calls)
    5. Otherwise, call CricAPI and import any new completed matches
    """
    global _imported_today, _imported_today_date
    
    now_utc = datetime.datetime.utcnow()
    now_ist = now_utc + datetime.timedelta(hours=5, minutes=30)
    today_str = now_ist.strftime("%Y-%m-%d")
    
    # Reset daily tracking at midnight
    if _imported_today_date != today_str:
        _imported_today = set()
        _imported_today_date = today_str
    
    # Gate 1: Are we inside a polling window?
    if not _is_in_polling_window(now_ist):
        return  # Not time yet, skip silently
    
    # Gate 2: Have we already imported enough matches today?
    # On double-header days there are max 2 matches. If we've imported 2, stop.
    if len(_imported_today) >= 2:
        logger.debug(f"Already imported {len(_imported_today)} matches today, skipping")
        return
    
    # We're in a window and might have matches to import — call the API
    logger.info(f"Polling window active at {now_ist.strftime('%H:%M')} IST, checking for completed matches...")
    _auto_fetch_cycle(app, is_manual=False)


def _auto_fetch_cycle(app, is_manual=False):
    """Core auto-fetch logic. Called by smart scheduler or manual trigger."""
    global _imported_today
    
    from db import get_conn, calc_points, recalculate_all_users
    conn = get_conn()
    try:
        row = conn.execute("SELECT cricapi_key FROM settings WHERE id = 1").fetchone()
        apikey = row["cricapi_key"] if row and row["cricapi_key"] else ""
        if not apikey: return
        
        settings_row = conn.execute("SELECT auto_fetch FROM settings WHERE id = 1").fetchone()
        if not settings_row or (not settings_row["auto_fetch"] and not is_manual):
            return
        
        # Fetch matches from CricAPI (1 API call, or 2 if we also fetch match_list)
        try:
            curr = fetch_current_matches(apikey)
            mlist = []
            try: mlist = fetch_match_list(apikey)
            except: pass
            matches = list({m["id"]: m for m in (curr + mlist)}.values())
            logger.info(f"Fetched {len(matches)} matches from CricAPI (curr: {len(curr)}, list: {len(mlist)})")
        except Exception as e:
            logger.warning(f"Failed to fetch matches: {e}")
            if is_manual: raise e
            return
        
        ipl_matches = filter_ipl_matches(matches)
        completed = [m for m in ipl_matches if is_match_completed(m)]
        if not completed:
            logger.info("No completed IPL matches found in this cycle")
            return
        
        db_players = [dict(p) for p in conn.execute("SELECT * FROM players").fetchall()]
        imported_this_cycle = 0
        
        for cm in completed:
            cricapi_id = cm.get("id", "")
            
            # Skip already imported
            if conn.execute("SELECT id FROM matches WHERE cricapi_match_id = ?", (cricapi_id,)).fetchone():
                continue
            
            teams = cm.get("teams", [])
            team1 = IPL_TEAM_NAMES.get(teams[0], teams[0][:3].upper()) if len(teams) > 0 else "???"
            team2 = IPL_TEAM_NAMES.get(teams[1], teams[1][:3].upper()) if len(teams) > 1 else "???"
            date_str = cm.get("date", cm.get("dateTimeGMT", ""))[:10]
            logger.info(f"Auto-importing: {cm.get('name', cricapi_id)} ({team1} vs {team2})")
            
            # Check if match already exists in our DB (manually created)
            existing = conn.execute(
                "SELECT id FROM matches WHERE (team1 = ? AND team2 = ? AND (date = ? OR date = '')) OR (team1 = ? AND team2 = ? AND (date = ? OR date = ''))", 
                (team1, team2, date_str, team2, team1, date_str)
            ).fetchone()
            
            if existing:
                match_id = existing['id']
                conn.execute("UPDATE matches SET cricapi_match_id = ?, status = 'done' WHERE id = ?", (cricapi_id, match_id))
            else:
                cur = conn.execute(
                    "INSERT INTO matches (team1, team2, date, description, status, cricapi_match_id) VALUES (?, ?, ?, ?, 'done', ?)",
                    (team1, team2, date_str, cm.get("name", f"{team1} vs {team2}"), cricapi_id)
                )
                match_id = cur.lastrowid

            # Fetch scorecard (1 more API call per match)
            try:
                scorecard_data = fetch_scorecard(apikey, cricapi_id)
                raw_stats = extract_player_stats(scorecard_data)
                result = match_players_to_db(raw_stats, db_players)
                if not result["matched"]:
                    logger.warning(f"No players matched for {cricapi_id}")
                    continue
                
                for s in result["matched"]:
                    pts = calc_points(s["runs"], s["wickets"], s["catches"])
                    conn.execute(
                        """INSERT INTO player_stats (player_id, match_id, runs, wickets, catches, points)
                           VALUES (?, ?, ?, ?, ?, ?)
                           ON CONFLICT(player_id, match_id) DO UPDATE SET
                           runs = ?, wickets = ?, catches = ?, points = ?""",
                        (s["player_id"], match_id, s["runs"], s["wickets"], s["catches"], pts,
                         s["runs"], s["wickets"], s["catches"], pts)
                    )
                conn.commit()
                recalculate_all_users(conn)
                imported_this_cycle += 1
                
                # Track this import so we don't keep polling
                _imported_today.add(cricapi_id)
                
                logger.info(f"Successfully imported {len(result['matched'])} player stats for match {match_id} ({team1} vs {team2})")
                if result["unmatched"]:
                    logger.warning(f"  Unmatched players: {[u['api_name'] for u in result['unmatched']]}")
                    
            except Exception as e:
                logger.warning(f"Error importing scorecard for {cricapi_id}: {e}")
                if is_manual: raise e
                continue
        
        if imported_this_cycle > 0:
            logger.info(f"Cycle complete: imported {imported_this_cycle} new match(es)")
        else:
            logger.info("Cycle complete: no new matches to import")
                
    finally:
        conn.close()
