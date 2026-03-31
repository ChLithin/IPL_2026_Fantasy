"""
CricAPI Integration Module
Handles fetching match data and scorecards from CricAPI,
parsing player stats, and fuzzy-matching to local database players.
"""
import requests
import difflib
import threading
import time
import logging

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
        
        # Also check if team names are IPL teams
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
    stats = {}  # player_name -> {runs, wickets, catches}
    
    scorecard = scorecard_data.get("scorecard", [])
    if not isinstance(scorecard, list):
        return stats
    
    for inning in scorecard:
        if not isinstance(inning, dict):
            continue
        
        # Batting — also extract catcher names from dismissals
        for b in inning.get("batting", []):
            name = _get_name(b.get("batsman", b.get("name", "")))
            if not name:
                continue
            
            runs = int(b.get("r", b.get("runs", b.get("R", 0))) or 0)
            
            if name not in stats:
                stats[name] = {"runs": 0, "wickets": 0, "catches": 0}
            stats[name]["runs"] += runs
            
            # Extract catches from dismissal info
            # CricAPI provides: "dismissal-text": "c Hardik Pandya b Shardul Thakur"
            # and/or "catcher" field with the fielder's name
            dismissal = str(b.get("dismissal", b.get("dismissal-type", ""))).lower()
            if dismissal in ("catch", "caught", "c", "lbw"):
                # Only count actual catches, not lbw
                if dismissal != "lbw":
                    catcher_name = _get_name(b.get("catcher", b.get("fielder", "")))
                    if not catcher_name:
                        # Try parsing from dismissal-text: "c FielderName b BowlerName"
                        d_text = str(b.get("dismissal-text", b.get("dismissalText", "")))
                        if d_text.startswith("c ") and " b " in d_text:
                            catcher_name = d_text.split("c ", 1)[1].split(" b ")[0].strip()
                    
                    if catcher_name:
                        if catcher_name not in stats:
                            stats[catcher_name] = {"runs": 0, "wickets": 0, "catches": 0}
                        stats[catcher_name]["catches"] += 1
        
        # Bowling
        for bl in inning.get("bowling", []):
            name = _get_name(bl.get("bowler", bl.get("name", "")))
            if not name:
                continue
            
            wickets = int(bl.get("w", bl.get("W", bl.get("wickets", 0))) or 0)
            
            if name not in stats:
                stats[name] = {"runs": 0, "wickets": 0, "catches": 0}
            stats[name]["wickets"] += wickets
        
        # Catching/Fielding — fallback for APIs that DO provide a separate array
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


# ── Player Name Matching ─────────────────────────────────────────────────────

def _normalize_name(name):
    """Normalize a player name for matching."""
    name = name.strip().lower()
    # Remove common prefixes/suffixes
    for prefix in ["(c)", "(wk)", "(c & wk)"]:
        name = name.replace(prefix, "")
    return name.strip()


def match_players_to_db(extracted_stats, db_players, threshold=0.6):
    """
    Fuzzy-match CricAPI player names to database player records.
    
    Args:
        extracted_stats: {api_name: {runs, wickets, catches}}
        db_players: list of player dicts from database (must have 'id', 'name', 'team_abbr')
        threshold: minimum similarity ratio to accept a match
    
    Returns:
        {
            "matched": [{player_id, db_name, api_name, runs, wickets, catches, confidence}],
            "unmatched": [{api_name, runs, wickets, catches}]
        }
    """
    db_names = {_normalize_name(p["name"]): p for p in db_players}
    db_name_list = list(db_names.keys())
    
    matched = []
    unmatched = []
    used_db_ids = set()
    
    for api_name, api_stats in extracted_stats.items():
        norm_api = _normalize_name(api_name)
        
        # Try exact match first
        if norm_api in db_names:
            p = db_names[norm_api]
            if p["id"] not in used_db_ids:
                matched.append({
                    "player_id": p["id"],
                    "db_name": p["name"],
                    "api_name": api_name,
                    "runs": api_stats["runs"],
                    "wickets": api_stats["wickets"],
                    "catches": api_stats["catches"],
                    "confidence": 1.0,
                })
                used_db_ids.add(p["id"])
                continue
        
        # Fuzzy match
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
                    "runs": api_stats["runs"],
                    "wickets": api_stats["wickets"],
                    "catches": api_stats["catches"],
                    "confidence": round(ratio, 2),
                })
                used_db_ids.add(p["id"])
                continue
        
        # No match found
        if api_stats["runs"] > 0 or api_stats["wickets"] > 0 or api_stats["catches"] > 0:
            unmatched.append({
                "api_name": api_name,
                **api_stats,
            })
    
    return {"matched": matched, "unmatched": unmatched}


# ── Auto-Fetch Background Worker ─────────────────────────────────────────────

_auto_fetch_thread = None
_auto_fetch_stop = threading.Event()


def start_auto_fetch(app, interval_seconds=600):
    """
    Start a background thread that periodically checks for new completed IPL matches
    and automatically imports their stats.
    
    Args:
        app: Flask app instance (needed for app context)
        interval_seconds: How often to poll (default: 5 minutes)
    """
    global _auto_fetch_thread, _auto_fetch_stop
    
    if _auto_fetch_thread and _auto_fetch_thread.is_alive():
        logger.info("Auto-fetch already running")
        return
    
    _auto_fetch_stop.clear()
    
    def worker():
        logger.info(f"Auto-fetch worker started (interval: {interval_seconds}s)")
        while not _auto_fetch_stop.is_set():
            try:
                with app.app_context():
                    _auto_fetch_cycle(app)
            except Exception as e:
                logger.error(f"Auto-fetch cycle error: {e}")
            
            _auto_fetch_stop.wait(interval_seconds)
        logger.info("Auto-fetch worker stopped")
    
    _auto_fetch_thread = threading.Thread(target=worker, daemon=True, name="cricapi-auto-fetch")
    _auto_fetch_thread.start()


def stop_auto_fetch():
    """Stop the auto-fetch background thread."""
    global _auto_fetch_stop
    _auto_fetch_stop.set()


import datetime

def _auto_fetch_cycle(app, is_manual=False):
    """One cycle of the auto-fetch: check for new completed matches and import stats."""
    
    # --- Optimization: Only poll during active IPL hours ---
    # Pause fetching between 2:00 AM and 3:00 PM IST to save API credits
    now_utc = datetime.datetime.utcnow()
    now_ist = now_utc + datetime.timedelta(hours=5, minutes=30)
    if 2 <= now_ist.hour < 15:
        # It's deep night or morning in India, no matches are ending right now.
        return

    from db import get_conn, calc_points
    
    conn = get_conn()
    try:
        # Get API key from settings
        row = conn.execute("SELECT cricapi_key FROM settings WHERE id = 1").fetchone()
        apikey = row["cricapi_key"] if row and row["cricapi_key"] else ""
        if not apikey:
            return  # No API key configured
        
        # Check if auto-fetch is enabled
        settings_row = conn.execute("SELECT auto_fetch FROM settings WHERE id = 1").fetchone()
        if not settings_row or not settings_row["auto_fetch"]:
            return  # Auto-fetch disabled
        
        # Fetch current matches from CricAPI
        try:
            matches = fetch_current_matches(apikey)
        except Exception as e:
            logger.warning(f"Failed to fetch matches: {e}")
            if is_manual:
                raise e
            return
        
        ipl_matches = filter_ipl_matches(matches)
        completed = [m for m in ipl_matches if is_match_completed(m)]
        
        if not completed:
            logger.debug("No completed IPL matches found")
            return
        
        # Get all db players for matching
        db_players = [dict(p) for p in conn.execute("SELECT * FROM players").fetchall()]
        
        for cm in completed:
            cricapi_id = cm.get("id", "")
            
            # Skip if we already imported this match (by ID)
            existing_by_id = conn.execute(
                "SELECT id FROM matches WHERE cricapi_match_id = ?", (cricapi_id,)
            ).fetchone()
            if existing_by_id:
                continue
            
            # Determine team abbreviations
            teams = cm.get("teams", [])
            team1 = IPL_TEAM_NAMES.get(teams[0], teams[0][:3].upper()) if len(teams) > 0 else "???"
            team2 = IPL_TEAM_NAMES.get(teams[1], teams[1][:3].upper()) if len(teams) > 1 else "???"
            date_str = cm.get("date", cm.get("dateTimeGMT", ""))[:10]

            logger.info(f"Auto-importing: {cm.get('name', cricapi_id)}")
            
            # Check if we already have this match (by teams and date) but it's not linked yet
            existing_by_teams = conn.execute(
                "SELECT id FROM matches WHERE (team1 = ? AND team2 = ? AND (date = ? OR date = '')) OR (team1 = ? AND team2 = ? AND (date = ? OR date = ''))", 
                (team1, team2, date_str, team2, team1, date_str)
            ).fetchone()
            
            if existing_by_teams:
                # Link it now and use it
                match_id = existing_by_teams['id']
                conn.execute(
                    "UPDATE matches SET cricapi_match_id = ?, status = 'done' WHERE id = ?",
                    (cricapi_id, match_id)
                )
                logger.info(f"Linked existing manual match {match_id} to CricAPI ID {cricapi_id}")
            else:
                # Create the match in our DB
                cur = conn.execute(
                    "INSERT INTO matches (team1, team2, date, description, status, cricapi_match_id) VALUES (?, ?, ?, ?, 'done', ?)",
                    (team1, team2, date_str, cm.get("name", f"{team1} vs {team2}"), cricapi_id)
                )
                match_id = cur.lastrowid

            # Fetch scorecard
            try:
                scorecard_data = fetch_scorecard(apikey, cricapi_id)
            except Exception as e:
                logger.warning(f"Failed to fetch scorecard for {cricapi_id}: {e}")
                if is_manual:
                    raise e
                continue
            
            # Extract and match stats
            raw_stats = extract_player_stats(scorecard_data)
            result = match_players_to_db(raw_stats, db_players)
            
            if not result["matched"]:
                logger.warning(f"No players matched for match {cricapi_id}")
                continue
            
            # Insert player stats
            for s in result["matched"]:
                points = calc_points(s["runs"], s["wickets"], s["catches"])
                conn.execute(
                    """INSERT INTO player_stats (player_id, match_id, runs, wickets, catches, points)
                       VALUES (?, ?, ?, ?, ?, ?)
                       ON CONFLICT(player_id, match_id) DO UPDATE SET
                       runs = ?, wickets = ?, catches = ?, points = ?""",
                    (s["player_id"], match_id, s["runs"], s["wickets"], s["catches"], points,
                     s["runs"], s["wickets"], s["catches"], points)
                )
            
            conn.commit()
            
            # Recalculate user points
            _recalc_all(conn)
            
            logger.info(f"Auto-imported {len(result['matched'])} player stats for match {match_id} ({team1} vs {team2})")
            if result["unmatched"]:
                logger.warning(f"  {len(result['unmatched'])} unmatched players: {[u['api_name'] for u in result['unmatched']]}")
    
    finally:
        conn.close()


def _recalc_all(conn):
    """Recalculate all user points (mirrors app.py logic exactly)."""
    users = conn.execute('SELECT username, captain_id, vc_id, impact_id FROM users').fetchall()
    
    # Get list of all match stats
    all_stats = conn.execute('SELECT * FROM player_stats').fetchall()
    stats_dict = {} # (pid, mid) -> points
    for s in all_stats:
        stats_dict[(s['player_id'], s['match_id'])] = s['points']

    # Get user squad members
    all_user_players = conn.execute('SELECT * FROM user_teams').fetchall()
    u_players = {} # username -> [ids]
    for up in all_user_players:
        if up['username'] not in u_players: u_players[up['username']] = []
        u_players[up['username']].append(up['player_id'])

    for u in users:
        username = u['username']
        total = 0
        squad = u_players.get(username, [])
        cap_id = u['captain_id']
        vc_id = u['vc_id']
        
        # Iterate over all matches that are 'done'
        done_matches = conn.execute('SELECT id FROM matches WHERE status = "done"').fetchall()
        for m in done_matches:
            mid = m['id']
            # Score for all template players in the squad
            for pid in squad:
                pts = stats_dict.get((pid, mid), 0)
                mul = 1.0
                if pid == cap_id: mul = 2.0
                elif pid == vc_id: mul = 1.5
                total += pts * mul
                
        conn.execute('UPDATE users SET total_points = ?, weekly_points = ? WHERE username = ?', (total, total, username))
    conn.commit()
