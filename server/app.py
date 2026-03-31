import datetime
import json
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import uuid
import random
import string
from db import get_conn, init_db, calc_points
import cricapi

app = Flask(__name__)

import traceback

@app.errorhandler(Exception)
def handle_exception(e):
    # Pass through HTTP errors
    if hasattr(e, 'code'):
        return jsonify(error=str(e)), e.code
    # Non-HTTP exceptions
    trace = traceback.format_exc()
    print("--- SERVER ERROR TRACEBACK ---")
    print(trace)
    return jsonify(error="Internal Server Error", detail=str(e)), 500

CORS(app)

ADMIN_PASSWORD = "adminIPL2026"
IMAGES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'scrape', 'images')

@app.route('/images/<path:filename>')
def serve_image(filename):
    return send_from_directory(IMAGES_DIR, filename)

# ── Auth: Sign Up ─────────────────────────────────────────────────────────────
@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    admin_pass = data.get('admin_password', '').strip()
    if not username or not password:
        return jsonify(error="Username and password are required"), 400
    conn = get_conn()
    existing = conn.execute('SELECT 1 FROM users WHERE username = ?', (username,)).fetchone()
    if existing:
        conn.close()
        return jsonify(error="Username already taken"), 400
    is_admin = 1 if admin_pass == ADMIN_PASSWORD else 0
    conn.execute('INSERT INTO users (username, password, is_admin, free_transfers) VALUES (?, ?, ?, ?)', (username, password, is_admin, 2))
    conn.commit()
    conn.close()
    return jsonify(username=username, is_admin=bool(is_admin), total_points=0, weekly_points=0, group_id=None, captain_id=None, vc_id=None, impact_id=None, roles_locked=False, has_team=False, team=[], free_transfers=2, triple_captain_used=False, unlimited_transfers_used=False, triple_captain_active=False, unlimited_transfers_active=False, transfer_penalty=0)

# ── Auth: Log In ──────────────────────────────────────────────────────────────
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    admin_pass = data.get('admin_password', '').strip()
    if not username:
        return jsonify(error="Username required"), 400
    conn = get_conn()
    user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    if not user:
        conn.close()
        return jsonify(error="User not found. Please Sign Up first."), 404
    stored_pw = user['password'] or ''
    if stored_pw != password:
        conn.close()
        return jsonify(error="Invalid password"), 401
    if admin_pass == ADMIN_PASSWORD and not user['is_admin']:
        conn.execute('UPDATE users SET is_admin = 1 WHERE username = ?', (username,))
        conn.commit()
    team_rows = conn.execute('SELECT player_id FROM user_teams WHERE username = ?', (username,)).fetchall()
    team_ids = [r['player_id'] for r in team_rows]
    result = {
        'username': user['username'],
        'group_id': user['group_id'],
        'total_points': user['total_points'] or 0,
        'weekly_points': user['weekly_points'] or 0,
        'is_admin': (admin_pass == ADMIN_PASSWORD) or bool(user['is_admin']),
        'captain_id': user['captain_id'],
        'vc_id': user['vc_id'],
        'impact_id': user['impact_id'],
        'roles_locked': bool(user['roles_locked']),
        'has_team': len(team_ids) > 0,
        'team': team_ids,
        'free_transfers': user['free_transfers'] if user['free_transfers'] is not None else 2,
        'triple_captain_used': bool(user['triple_captain_used']),
        'unlimited_transfers_used': bool(user['unlimited_transfers_used']),
        'triple_captain_active': bool(user['triple_captain_active']),
        'unlimited_transfers_active': bool(user['unlimited_transfers_active']),
        'transfer_penalty': user['transfer_penalty'] or 0,
        'global_rank': _get_global_rank(conn, username),
    }
    conn.close()
    return jsonify(result)

# ── Players ───────────────────────────────────────────────────────────────────


@app.route('/api/players')
def get_players():
    conn = get_conn()
    players = conn.execute('SELECT * FROM players ORDER BY team_abbr, price DESC').fetchall()
    conn.close()
    return jsonify([dict(p) for p in players])

@app.route('/api/players/<int:pid>', methods=['PUT'])
def update_player(pid):
    data = request.json
    conn = get_conn()
    fields = []
    values = []
    for key in ['name', 'team', 'team_abbr', 'role', 'price', 'overseas', 'description', 'image']:
        if key in data:
            fields.append(f'{key} = ?')
            values.append(data[key])
    if fields:
        values.append(pid)
        conn.execute(f'UPDATE players SET {", ".join(fields)} WHERE id = ?', values)
        conn.commit()
    player = conn.execute('SELECT * FROM players WHERE id = ?', (pid,)).fetchone()
    conn.close()
    return jsonify(dict(player) if player else {})

@app.route('/api/players/<int:pid>', methods=['DELETE'])
def delete_player(pid):
    conn = get_conn()
    conn.execute('DELETE FROM user_teams WHERE player_id = ?', (pid,))
    conn.execute('DELETE FROM player_stats WHERE player_id = ?', (pid,))
    conn.execute('DELETE FROM players WHERE id = ?', (pid,))
    conn.commit()
    conn.close()
    return jsonify(ok=True)

# ── Teams ─────────────────────────────────────────────────────────────────────
@app.route('/api/team', methods=['POST'])
def save_team():
    data = request.json
    username = data.get('username', '').strip()
    player_ids = data.get('player_ids', [])
    use_unlimited = data.get('use_unlimited', False)
    if not username:
        return jsonify(error="Username required"), 400
    conn = get_conn()
    players = []
    for pid in player_ids:
        p = conn.execute('SELECT * FROM players WHERE id = ?', (pid,)).fetchone()
        if p:
            players.append(dict(p))
    total_price = sum(p['price'] for p in players)
    overseas_count = sum(1 for p in players if p['overseas'])
    team_counts = {}
    roles = {}
    for p in players:
        team_counts[p['team_abbr']] = team_counts.get(p['team_abbr'], 0) + 1
        roles[p['role']] = roles.get(p['role'], 0) + 1
        
    wk_count = roles.get('WK', 0)
    ar_count = roles.get('AR', 0)
    bat_count = roles.get('BAT', 0) + wk_count + ar_count
    bowl_count = roles.get('BOWL', 0) + ar_count
    pure_bat_count = roles.get('BAT', 0) + wk_count
    pure_bowl_count = roles.get('BOWL', 0)

    errors = []
    if len(players) != 12:
        errors.append(f"Exactly 12 players required, got {len(players)}")
    if total_price > 100:
        errors.append(f"Budget exceeded: {total_price} Cr")
    if overseas_count > 4:
        errors.append(f"Max 4 overseas, got {overseas_count}")
    if wk_count < 1:
        errors.append("Min 1 Wicket Keeper required")
    if bat_count < 3:
        errors.append("Batsmen (+WK+AR) must be at least 3")
    if pure_bat_count > 6:
        errors.append("Batsmen (+WK) must be at most 6")
    if ar_count < 1 or ar_count > 5:
        errors.append("All-rounders must be between 1 and 5")
    if bowl_count < 3:
        errors.append("Bowlers (+AR) must be at least 3")
    if pure_bowl_count > 6:
        errors.append("Bowlers must be at most 6")
        
    for t, c in team_counts.items():
        if c > 2:
            errors.append(f"Max 2 from {t}, got {c}")
    if errors:
        conn.close()
        return jsonify(error="; ".join(errors)), 400

    # Check if user already has a team (edit mode)
    existing_team = conn.execute('SELECT player_id FROM user_teams WHERE username = ?', (username,)).fetchall()
    is_edit = len(existing_team) > 0

    if is_edit:
        settings = conn.execute('SELECT allow_team_edit FROM settings WHERE id = 1').fetchone()
        allow_edit = settings['allow_team_edit'] if settings else 0
        if not allow_edit:
            conn.close()
            return jsonify(error="Team editing is currently locked by admin"), 400

        # Count actual transfers (players changed)
        old_ids = set(r['player_id'] for r in existing_team)
        new_ids = set(player_ids)
        transfers_made = len(old_ids - new_ids)  # players removed = players swapped

        user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
        free_transfers = user['free_transfers'] if user['free_transfers'] is not None else 2
        unlimited_active = bool(user['unlimited_transfers_active'])

        if transfers_made > 0 and not unlimited_active:
            # Calculate penalty for exceeding free transfers
            extra_transfers = max(0, transfers_made - free_transfers)
            penalty = extra_transfers * 25
            remaining_free = max(0, free_transfers - transfers_made)

            # Update free transfers and penalty
            new_penalty = (user['transfer_penalty'] or 0) + penalty
            conn.execute('UPDATE users SET free_transfers = ?, transfer_penalty = ? WHERE username = ?',
                         (remaining_free, new_penalty, username))
            # Also deduct penalty from total_points immediately
            if penalty > 0:
                conn.execute('UPDATE users SET total_points = total_points - ? WHERE username = ?',
                             (penalty, username))
        # If unlimited is active, no free_transfers deduction, no penalty

    conn.execute('DELETE FROM user_teams WHERE username = ?', (username,))
    for pid in player_ids:
        conn.execute('INSERT INTO user_teams (username, player_id) VALUES (?, ?)', (username, pid))
    conn.commit()
    conn.close()
    return jsonify(ok=True)

@app.route('/api/team/<username>')
def get_team(username):
    conn = get_conn()
    rows = conn.execute('SELECT p.* FROM user_teams ut JOIN players p ON ut.player_id = p.id WHERE ut.username = ? ORDER BY p.price DESC', (username,)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

# ── Groups ────────────────────────────────────────────────────────────────────
@app.route('/api/group', methods=['POST'])
def create_group():
    data = request.json
    name = data.get('name', '').strip()
    username = data.get('username', '').strip()
    if not name or not username:
        return jsonify(error="Group name and username required"), 400
    code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    conn = get_conn()
    conn.execute('INSERT INTO groups_ (code, name, created_by) VALUES (?, ?, ?)', (code, name, username))
    conn.execute('UPDATE users SET group_id = ? WHERE username = ?', (code, username))
    conn.execute('INSERT OR IGNORE INTO league_members (username, league_code) VALUES (?, ?)', (username, code))
    conn.commit()
    conn.close()
    return jsonify(code=code, name=name)

@app.route('/api/group/join', methods=['POST'])
def join_group():
    data = request.json
    code = data.get('code', '').strip().upper()
    username = data.get('username', '').strip()
    if not code or not username:
        return jsonify(error="Code and username required"), 400
    conn = get_conn()
    has_team = conn.execute('SELECT 1 FROM user_teams WHERE username = ?', (username,)).fetchone()
    if not has_team:
        conn.close()
        return jsonify(error="You must build your squad before joining a group"), 400
    group = conn.execute('SELECT * FROM groups_ WHERE code = ?', (code,)).fetchone()
    if not group:
        conn.close()
        return jsonify(error="Group not found"), 404
    conn.execute('UPDATE users SET group_id = ? WHERE username = ?', (code, username))
    conn.execute('INSERT OR IGNORE INTO league_members (username, league_code) VALUES (?, ?)', (username, code))
    conn.commit()
    conn.close()
    return jsonify(code=code, name=group['name'])

@app.route('/api/group/<code>/leaderboard')
def group_leaderboard(code):
    conn = get_conn()
    users = conn.execute('''
        SELECT u.username, u.total_points, u.weekly_points
        FROM league_members lm
        JOIN users u ON lm.username = u.username
        WHERE lm.league_code = ?
        ORDER BY u.total_points DESC, u.weekly_points DESC
    ''', (code,)).fetchall()
    conn.close()
    result = []
    for i, u in enumerate(users):
        result.append({'rank': i + 1, 'username': u['username'], 'weekly_points': u['weekly_points'], 'total_points': u['total_points']})
    return jsonify(result)

@app.route('/api/groups')
def list_groups():
    conn = get_conn()
    groups = conn.execute('SELECT * FROM groups_').fetchall()
    conn.close()
    return jsonify([dict(g) for g in groups])

@app.route('/api/groups/all', methods=['GET'])
def all_groups():
    conn = get_conn()
    rows = conn.execute('SELECT name, code, created_by FROM groups_').fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/groups/<grp_code>/kick', methods=['POST'])
def kick_group_member(grp_code):
    data = request.json
    username = data.get('username')
    requester = data.get('requester')
    conn = get_conn()
    
    # Check if requester is group owner or admin
    group = conn.execute('SELECT created_by FROM groups_ WHERE code = ?', (grp_code,)).fetchone()
    req_user = conn.execute('SELECT is_admin FROM users WHERE username = ?', (requester,)).fetchone()
    
    if not group:
        conn.close()
        return jsonify(error="Group not found"), 404
        
    is_owner = (group['created_by'] == requester)
    is_admin = bool(req_user and req_user['is_admin'])
    
    if not (is_owner or is_admin):
        conn.close()
        return jsonify(error="Unauthorized: Only league owner or admin can kick members"), 403

    conn.execute('UPDATE users SET group_id = NULL WHERE username = ? AND group_id = ?', (username, grp_code))
    conn.execute('DELETE FROM league_members WHERE username = ? AND league_code = ?', (username, grp_code))
    conn.commit()
    conn.close()
    return jsonify(success=True)

# ── User info ─────────────────────────────────────────────────────────────────
@app.route('/api/user/<username>')
def get_user(username):
    conn = get_conn()
    user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    if not user:
        conn.close()
        return jsonify(error="User not found"), 404
    team_rows = conn.execute('SELECT p.*, COALESCE(SUM(ps.points), 0) as earned_points FROM user_teams ut JOIN players p ON ut.player_id = p.id LEFT JOIN player_stats ps ON ps.player_id = p.id WHERE ut.username = ? GROUP BY p.id ORDER BY earned_points DESC', (username,)).fetchall()
    group_info = None
    if user['group_id']:
        group = conn.execute('SELECT * FROM groups_ WHERE code = ?', (user['group_id'],)).fetchone()
        if group:
            group_info = dict(group)
    conn.close()
    return jsonify(
        username=user['username'],
        group_id=user['group_id'],
        total_points=user['total_points'],
        weekly_points=user['weekly_points'],
        is_admin=bool(user['is_admin']),
        captain_id=user['captain_id'],
        vc_id=user['vc_id'],
        impact_id=user['impact_id'],
        roles_locked=bool(user['roles_locked']),
        team=[dict(r) for r in team_rows],
        group=group_info,
        free_transfers=user['free_transfers'] if user['free_transfers'] is not None else 2,
        triple_captain_used=bool(user['triple_captain_used']),
        unlimited_transfers_used=bool(user['unlimited_transfers_used']),
        triple_captain_active=bool(user['triple_captain_active']),
        unlimited_transfers_active=bool(user['unlimited_transfers_active']),
        transfer_penalty=user['transfer_penalty'] or 0,
        global_rank=_get_global_rank(conn, username),
    )

# ── Settings ──────────────────────────────────────────────────────────────────
@app.route('/api/settings', methods=['GET', 'POST'])
def handle_settings():
    conn = get_conn()
    if request.method == 'POST':
        data = request.json
        allow_edit = int(data.get('allow_team_edit', 0))
        conn.execute('UPDATE settings SET allow_team_edit = ? WHERE id = 1', (allow_edit,))
        conn.commit()
        conn.close()
        return jsonify(success=True)
    row = conn.execute('SELECT allow_team_edit, auto_fetch, fetch_interval FROM settings WHERE id=1').fetchone()
    conn.close()
    if row:
        return jsonify(dict(row))
    return jsonify(allow_team_edit=0, auto_fetch=0, fetch_interval=600)

# ── Public: Matches ───────────────────────────────────────────────────────────

@app.route('/api/matches', methods=['GET'])
def get_public_matches():
    conn = get_conn()
    matches = conn.execute('SELECT * FROM matches ORDER BY date ASC, id ASC').fetchall()
    conn.close()
    return jsonify([dict(m) for m in matches])

@app.route('/api/match/<int:mid>/stats', methods=['GET'])
def get_public_match_stats(mid):
    conn = get_conn()
    stats = conn.execute('SELECT ps.*, p.name as player_name, p.team_abbr FROM player_stats ps JOIN players p ON ps.player_id = p.id WHERE ps.match_id = ? ORDER BY ps.points DESC', (mid,)).fetchall()
    conn.close()
    return jsonify([dict(s) for s in stats])

@app.route('/api/admin/match/<int:mid>/status', methods=['PUT'])
def update_match_status(mid):
    data = request.json
    status = data.get('status', 'upcoming')
    conn = get_conn()
    conn.execute('UPDATE matches SET status = ? WHERE id = ?', (status, mid))
    conn.commit()
    conn.close()
    return jsonify(success=True)

# ── Admin: Matches ────────────────────────────────────────────────────────────
@app.route('/api/admin/matches', methods=['GET'])
def get_matches():
    conn = get_conn()
    matches = conn.execute('SELECT * FROM matches ORDER BY id DESC').fetchall()
    conn.close()
    return jsonify([dict(m) for m in matches])

@app.route('/api/admin/match', methods=['POST'])
def create_match():
    data = request.json
    team1 = data.get('team1', '').strip()
    team2 = data.get('team2', '').strip()
    date = data.get('date', '')
    desc = data.get('description', '')
    if not team1 or not team2:
        return jsonify(error="Both teams required"), 400
    conn = get_conn()
    cur = conn.execute("INSERT INTO matches (team1, team2, date, description, status) VALUES (?, ?, ?, ?, 'upcoming')", (team1, team2, date, desc))
    match_id = cur.lastrowid
    conn.commit()
    conn.close()
    return jsonify(id=match_id)

@app.route('/api/admin/match/<int:mid>/players')
def match_players(mid):
    conn = get_conn()
    match = conn.execute('SELECT * FROM matches WHERE id = ?', (mid,)).fetchone()
    if not match:
        conn.close()
        return jsonify(error="Match not found"), 404
    players = conn.execute('SELECT p.*, COALESCE(ps.runs, 0) as runs, COALESCE(ps.wickets, 0) as wickets, COALESCE(ps.catches, 0) as catches, COALESCE(ps.points, 0) as points FROM players p LEFT JOIN player_stats ps ON ps.player_id = p.id AND ps.match_id = ? WHERE p.team_abbr IN (?, ?) OR p.id IN (SELECT player_id FROM player_stats WHERE match_id = ?) ORDER BY p.team_abbr, p.name', (mid, match['team1'], match['team2'], mid)).fetchall()
    conn.close()
    return jsonify(match=dict(match), players=[dict(p) for p in players])

# ── Admin: Stats ──────────────────────────────────────────────────────────────
@app.route('/api/admin/stats', methods=['POST'])
def update_stats():
    data = request.json
    match_id = data.get('match_id')
    stats_list = data.get('stats', [])
    if not match_id or not stats_list:
        return jsonify(error="match_id and stats required"), 400
    conn = get_conn()
    for s in stats_list:
        pid = s['player_id']
        runs = int(s.get('runs', 0))
        wickets = int(s.get('wickets', 0))
        catches = int(s.get('catches', 0))
        points = calc_points(runs, wickets, catches)
        conn.execute('INSERT INTO player_stats (player_id, match_id, runs, wickets, catches, points) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(player_id, match_id) DO UPDATE SET runs = ?, wickets = ?, catches = ?, points = ?', (pid, match_id, runs, wickets, catches, points, runs, wickets, catches, points))
    conn.commit()
    conn.execute('UPDATE matches SET status = ? WHERE id = ?', ('done', match_id))
    _recalculate_user_points(conn)
    conn.close()
    return jsonify(ok=True)

def _recalculate_user_points(conn):
    users = conn.execute('SELECT username, captain_id, vc_id, impact_id, triple_captain_active, transfer_penalty FROM users').fetchall()
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
        imp_id = u['impact_id']
        tc_active = bool(u['triple_captain_active'])
        penalty = u['transfer_penalty'] or 0
        
        # Iterate over all matches that are 'done'
        done_matches = conn.execute('SELECT id FROM matches WHERE status = "done"').fetchall()
        for m in done_matches:
            mid = m['id']
            # Score for all 12 players in the squad (if they played in this match)
            for pid in squad:
                pts = stats_dict.get((pid, mid), 0)
                mul = 1.0
                if pid == cap_id:
                    mul = 3.0 if tc_active else 2.0
                elif pid == vc_id:
                    mul = 1.5
                # Impact ID gets 1.0x (standard scoring)
                total += pts * mul
        # Subtract transfer penalty from total
        total -= penalty
        conn.execute('UPDATE users SET total_points = ?, weekly_points = ? WHERE username = ?', (total, total, username))
    conn.commit()

@app.route('/api/admin/recalculate', methods=['POST'])
def recalculate():
    conn = get_conn()
    _recalculate_user_points(conn)
    conn.close()
    return jsonify(ok=True)

@app.route('/api/admin/reset-weekly', methods=['POST'])
def reset_weekly():
    conn = get_conn()
    # Reset weekly state, accumulate free transfers (+2, capped at 5), reset active chips
    users = conn.execute('SELECT username, free_transfers FROM users').fetchall()
    for u in users:
        current_ft = u['free_transfers'] if u['free_transfers'] is not None else 0
        new_ft = min(current_ft + 2, 5)
        conn.execute(
            'UPDATE users SET weekly_points = 0, roles_locked = 0, free_transfers = ?, triple_captain_active = 0, unlimited_transfers_active = 0 WHERE username = ?',
            (new_ft, u['username'])
        )
    conn.commit()
    conn.close()
    return jsonify(ok=True)

# ── Admin: Users ──────────────────────────────────────────────────────────────
@app.route('/api/admin/users')
def admin_users():
    conn = get_conn()
    users = conn.execute('SELECT * FROM users ORDER BY total_points DESC').fetchall()
    result = []
    for u in users:
        team_count = conn.execute('SELECT COUNT(*) as cnt FROM user_teams WHERE username = ?', (u['username'],)).fetchone()['cnt']
        result.append({**dict(u), 'team_count': team_count})
    conn.close()
    return jsonify(result)

@app.route('/api/admin/users/<username>', methods=['PUT'])
def admin_update_user(username):
    data = request.json
    conn = get_conn()
    fields = []
    values = []
    for key in ['total_points', 'weekly_points', 'group_id', 'is_admin']:
        if key in data:
            fields.append(f'{key} = ?')
            values.append(data[key])
    if fields:
        values.append(username)
        conn.execute(f'UPDATE users SET {", ".join(fields)} WHERE username = ?', values)
        conn.commit()
    user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    conn.close()
    return jsonify(dict(user) if user else {})

@app.route('/api/admin/users/<username>', methods=['DELETE'])
def admin_delete_user(username):
    conn = get_conn()
    conn.execute('DELETE FROM user_teams WHERE username = ?', (username,))
    conn.execute('DELETE FROM league_members WHERE username = ?', (username,))
    conn.execute('DELETE FROM users WHERE username = ?', (username,))
    conn.commit()
    conn.close()
    return jsonify(ok=True)

@app.route('/api/admin/match/<int:mid>/stats')
def get_match_stats(mid):
    conn = get_conn()
    stats = conn.execute('SELECT ps.*, p.name as player_name, p.team_abbr FROM player_stats ps JOIN players p ON ps.player_id = p.id WHERE ps.match_id = ? ORDER BY ps.points DESC', (mid,)).fetchall()
    conn.close()
    return jsonify([dict(s) for s in stats])

@app.route('/api/admin/match/<int:mid>', methods=['DELETE'])
def delete_match(mid):
    conn = get_conn()
    conn.execute('DELETE FROM player_stats WHERE match_id = ?', (mid,))
    conn.execute('DELETE FROM matches WHERE id = ?', (mid,))
    conn.commit()
    _recalculate_user_points(conn)
    conn.close()
    return jsonify(ok=True)

@app.route('/api/groups/<grp_code>', methods=['DELETE'])
def delete_group(grp_code):
    conn = get_conn()
    conn.execute('UPDATE users SET group_id = NULL WHERE group_id = ?', (grp_code,))
    conn.execute('DELETE FROM league_members WHERE league_code = ?', (grp_code,))
    conn.execute('DELETE FROM groups_ WHERE code = ?', (grp_code,))
    conn.commit()
    conn.close()
    return jsonify(ok=True)


# ── Weekly Roles ─────────────────────────────────────────────────────────────
@app.route('/api/set-roles', methods=['POST'])
def set_roles():
    data = request.json
    username = data.get('username')
    captain_id = data.get('captain_id')
    vc_id = data.get('vc_id')
    impact_id = data.get('impact_id')

    conn = get_conn()
    user = conn.execute('SELECT roles_locked FROM users WHERE username = ?', (username,)).fetchone()
    if user and user['roles_locked']:
        conn.close()
        return jsonify(error="Roles are locked for this week!"), 400

    conn.execute('UPDATE users SET captain_id=?, vc_id=?, impact_id=?, roles_locked=1 WHERE username=?',
                 (captain_id, vc_id, impact_id, username))
    conn.commit()
    conn.close()
    return jsonify(success=True)


# ── Chip Activation ──────────────────────────────────────────────────────────
@app.route('/api/activate-chip', methods=['POST'])
def activate_chip():
    data = request.json
    username = data.get('username', '').strip()
    chip = data.get('chip', '').strip()
    if not username or chip not in ('triple_captain', 'unlimited_transfers'):
        return jsonify(error="Invalid request"), 400
    conn = get_conn()
    user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    if not user:
        conn.close()
        return jsonify(error="User not found"), 404
    if chip == 'triple_captain':
        if user['triple_captain_used']:
            conn.close()
            return jsonify(error="Triple Captain has already been used this season!"), 400
        conn.execute('UPDATE users SET triple_captain_active = 1, triple_captain_used = 1 WHERE username = ?', (username,))
    elif chip == 'unlimited_transfers':
        if user['unlimited_transfers_used']:
            conn.close()
            return jsonify(error="Unlimited Transfers has already been used this season!"), 400
        conn.execute('UPDATE users SET unlimited_transfers_active = 1, unlimited_transfers_used = 1 WHERE username = ?', (username,))
    conn.commit()
    conn.close()
    return jsonify(success=True, chip=chip)


# ── League endpoints (multi-league) ──────────────────────────────────────────

@app.route('/api/leagues/create', methods=['POST'])
def create_league():
    data = request.json
    name = data.get('name', '').strip()
    username = data.get('username', '').strip()
    if not name or not username:
        return jsonify(error="League name and username required"), 400
    code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    conn = get_conn()
    conn.execute('INSERT INTO groups_ (code, name, created_by) VALUES (?, ?, ?)', (code, name, username))
    conn.execute('INSERT OR IGNORE INTO league_members (username, league_code) VALUES (?, ?)', (username, code))
    conn.commit()
    conn.close()
    return jsonify(code=code, name=name)

@app.route('/api/leagues/join', methods=['POST'])
def join_league():
    data = request.json
    code = data.get('code', '').strip().upper()
    username = data.get('username', '').strip()
    if not code or not username:
        return jsonify(error="Code and username required"), 400
    conn = get_conn()
    has_team = conn.execute('SELECT 1 FROM user_teams WHERE username = ?', (username,)).fetchone()
    if not has_team:
        conn.close()
        return jsonify(error="You must build your squad before joining a league"), 400
    group = conn.execute('SELECT * FROM groups_ WHERE code = ?', (code,)).fetchone()
    if not group:
        conn.close()
        return jsonify(error="League not found"), 404
    already = conn.execute('SELECT 1 FROM league_members WHERE username = ? AND league_code = ?', (username, code)).fetchone()
    if already:
        conn.close()
        return jsonify(error="You are already in this league"), 400
    conn.execute('INSERT INTO league_members (username, league_code) VALUES (?, ?)', (username, code))
    conn.commit()
    conn.close()
    return jsonify(code=code, name=group['name'])

@app.route('/api/leagues/<league_code>/leave', methods=['POST'])
def leave_league(league_code):
    data = request.json
    username = data.get('username', '').strip()
    if not username:
        return jsonify(error="Username required"), 400
    conn = get_conn()
    conn.execute('DELETE FROM league_members WHERE username = ? AND league_code = ?', (username, league_code))
    conn.execute('UPDATE users SET group_id = NULL WHERE username = ? AND group_id = ?', (username, league_code))
    conn.commit()
    conn.close()
    return jsonify(ok=True)

@app.route('/api/leagues/<league_code>/leaderboard')
def league_leaderboard(league_code):
    conn = get_conn()
    users = conn.execute('''
        SELECT u.username, u.total_points, u.weekly_points
        FROM league_members lm
        JOIN users u ON lm.username = u.username
        WHERE lm.league_code = ?
        ORDER BY u.total_points DESC, u.weekly_points DESC
    ''', (league_code,)).fetchall()
    group = conn.execute('SELECT * FROM groups_ WHERE code = ?', (league_code,)).fetchone()
    conn.close()
    result = []
    for i, u in enumerate(users):
        result.append({'rank': i + 1, 'username': u['username'], 'weekly_points': u['weekly_points'], 'total_points': u['total_points']})
    return jsonify(league=dict(group) if group else {}, leaderboard=result)

@app.route('/api/user/<username>/leagues')
def user_leagues(username):
    conn = get_conn()
    leagues = conn.execute('''
        SELECT g.code, g.name, g.created_by
        FROM league_members lm
        JOIN groups_ g ON lm.league_code = g.code
        WHERE lm.username = ?
    ''', (username,)).fetchall()
    result = []
    for lg in leagues:
        members = conn.execute('''
            SELECT u.username, u.total_points
            FROM league_members lm2
            JOIN users u ON lm2.username = u.username
            WHERE lm2.league_code = ?
            ORDER BY u.total_points DESC
        ''', (lg['code'],)).fetchall()
        member_count = len(members)
        rank = 0
        for i, m in enumerate(members):
            if m['username'] == username:
                rank = i + 1
                break
        result.append({
            'code': lg['code'],
            'name': lg['name'],
            'created_by': lg['created_by'],
            'member_count': member_count,
            'your_rank': rank,
            'is_creator': lg['created_by'] == username,
        })
    conn.close()
    return jsonify(result)

@app.route('/api/user/<username>/team-public')
def user_team_public(username):
    conn = get_conn()
    user = conn.execute('SELECT total_points, weekly_points, captain_id, vc_id, impact_id FROM users WHERE username = ?', (username,)).fetchone()
    if not user:
        conn.close()
        return jsonify(error="User not found"), 404
    team_rows = conn.execute('''
        SELECT p.*, COALESCE(SUM(ps.points), 0) as earned_points
        FROM user_teams ut
        JOIN players p ON ut.player_id = p.id
        LEFT JOIN player_stats ps ON ps.player_id = p.id
        WHERE ut.username = ?
        GROUP BY p.id
        ORDER BY earned_points DESC
    ''', (username,)).fetchall()
    conn.close()
    return jsonify(
        username=username,
        total_points=user['total_points'],
        weekly_points=user['weekly_points'],
        captain_id=user['captain_id'],
        vc_id=user['vc_id'],
        impact_id=user['impact_id'],
        team=[dict(r) for r in team_rows]
    )

# ── Global Leaderboard ────────────────────────────────────────────────────────
@app.route('/api/global-leaderboard')
def global_leaderboard():
    """Top 100 users across the entire platform."""
    conn = get_conn()
    users = conn.execute('''
        SELECT u.username, u.total_points, u.weekly_points
        FROM users u
        WHERE u.is_admin = 0
        AND EXISTS (SELECT 1 FROM user_teams ut WHERE ut.username = u.username)
        ORDER BY u.total_points DESC, u.weekly_points DESC
        LIMIT 100
    ''').fetchall()
    conn.close()
    result = []
    for i, u in enumerate(users):
        result.append({'rank': i + 1, 'username': u['username'], 'weekly_points': u['weekly_points'], 'total_points': u['total_points']})
    return jsonify(result)

def _get_global_rank(conn, username):
    try:
        # Get all non-admin users sorted by points
        users = conn.execute('SELECT username FROM users WHERE is_admin = 0 ORDER BY total_points DESC').fetchall()
        # Find the index of the current user
        for i, u in enumerate(users):
            if u['username'] == username:
                return i + 1
        return None
    except Exception as e:
        print(f"Rank calculation error for {username}: {e}")
        return None

# ── CricAPI Integration ──────────────────────────────────────────────────────

@app.route('/api/admin/cricapi/config', methods=['GET', 'POST'])
def cricapi_config():
    conn = get_conn()
    if request.method == 'POST':
        data = request.json
        apikey = data.get('cricapi_key', '').strip()
        auto_fetch = int(data.get('auto_fetch', 0))
        interval = int(data.get('fetch_interval', 600))
        conn.execute(
            'UPDATE settings SET cricapi_key = ?, auto_fetch = ?, fetch_interval = ? WHERE id = 1',
            (apikey, auto_fetch, interval)
        )
        conn.commit()
        conn.close()
        # Restart auto-fetch if enabled
        if auto_fetch and apikey:
            cricapi.start_auto_fetch(app, interval)
        else:
            cricapi.stop_auto_fetch()
        return jsonify(success=True)
    row = conn.execute('SELECT cricapi_key, auto_fetch, fetch_interval FROM settings WHERE id = 1').fetchone()
    conn.close()
    if row:
        return jsonify(dict(row))
    return jsonify(cricapi_key='', auto_fetch=0, fetch_interval=600)


@app.route('/api/admin/cricapi/matches', methods=['GET'])
def cricapi_matches():
    """Fetch current/recent matches from CricAPI, filtered to IPL."""
    conn = get_conn()
    row = conn.execute('SELECT cricapi_key FROM settings WHERE id = 1').fetchone()
    conn.close()
    apikey = row['cricapi_key'] if row and row['cricapi_key'] else ''
    if not apikey:
        return jsonify(error='CricAPI key not configured'), 400
    try:
        all_matches = cricapi.fetch_current_matches(apikey)
        ipl = cricapi.filter_ipl_matches(all_matches)
        # Return all if no IPL matches found (for testing)
        result = ipl if ipl else all_matches
        return jsonify([{
            'id': m.get('id', ''),
            'name': m.get('name', ''),
            'teams': m.get('teams', []),
            'status': m.get('status', ''),
            'date': m.get('date', m.get('dateTimeGMT', ''))[:10],
            'matchType': m.get('matchType', ''),
            'completed': cricapi.is_match_completed(m),
            'fantasyEnabled': m.get('fantasyEnabled', False),
        } for m in result])
    except Exception as e:
        return jsonify(error=str(e)), 500


@app.route('/api/admin/cricapi/scorecard/<cricapi_match_id>', methods=['GET'])
def cricapi_scorecard(cricapi_match_id):
    """Fetch scorecard and fuzzy-match players to our DB."""
    local_match_id = request.args.get('local_match_id', type=int)
    conn = get_conn()
    row = conn.execute('SELECT cricapi_key FROM settings WHERE id = 1').fetchone()
    apikey = row['cricapi_key'] if row and row['cricapi_key'] else ''
    if not apikey:
        conn.close()
        return jsonify(error='CricAPI key not configured'), 400
    try:
        scorecard_data = cricapi.fetch_scorecard(apikey, cricapi_match_id)
        raw_stats = cricapi.extract_player_stats(scorecard_data)
        
        # If local_match_id provided, get only players from those teams
        if local_match_id:
            match = conn.execute('SELECT * FROM matches WHERE id = ?', (local_match_id,)).fetchone()
            if match:
                db_players = [dict(p) for p in conn.execute(
                    'SELECT * FROM players WHERE team_abbr IN (?, ?)',
                    (match['team1'], match['team2'])
                ).fetchall()]
            else:
                db_players = [dict(p) for p in conn.execute('SELECT * FROM players').fetchall()]
        else:
            db_players = [dict(p) for p in conn.execute('SELECT * FROM players').fetchall()]
        
        conn.close()
        result = cricapi.match_players_to_db(raw_stats, db_players)
        return jsonify(result)
    except Exception as e:
        conn.close()
        return jsonify(error=str(e)), 500


@app.route('/api/admin/cricapi/import', methods=['POST'])
def cricapi_import():
    """Import reviewed stats from CricAPI into our database."""
    data = request.json
    match_id = data.get('match_id')
    cricapi_match_id = data.get('cricapi_match_id', '')
    stats_list = data.get('stats', [])
    if not match_id or not stats_list:
        return jsonify(error='match_id and stats required'), 400
    
    conn = get_conn()
    # Link CricAPI match ID to our match
    if cricapi_match_id:
        conn.execute('UPDATE matches SET cricapi_match_id = ? WHERE id = ?', (cricapi_match_id, match_id))
    
    for s in stats_list:
        pid = s['player_id']
        runs = int(s.get('runs', 0))
        wickets = int(s.get('wickets', 0))
        catches = int(s.get('catches', 0))
        points = calc_points(runs, wickets, catches)
        conn.execute(
            '''INSERT INTO player_stats (player_id, match_id, runs, wickets, catches, points)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(player_id, match_id) DO UPDATE SET
               runs = ?, wickets = ?, catches = ?, points = ?''',
            (pid, match_id, runs, wickets, catches, points,
             runs, wickets, catches, points)
        )
    conn.commit()
    conn.execute('UPDATE matches SET status = ? WHERE id = ?', ('done', match_id))
    _recalculate_user_points(conn)
    conn.close()
    return jsonify(ok=True)


@app.route('/api/admin/cricapi/auto-import', methods=['POST'])
def cricapi_auto_import():
    """Manually trigger one auto-import cycle (useful for testing)."""
    try:
        cricapi._auto_fetch_cycle(app, is_manual=True)
        return jsonify(ok=True, message='Auto-import cycle completed')
    except Exception as e:
        return jsonify(error=str(e)), 500


@app.route('/api/admin/cricapi/status', methods=['GET'])
def cricapi_status():
    """Get the current status of CricAPI integration."""
    conn = get_conn()
    row = conn.execute('SELECT cricapi_key, auto_fetch, fetch_interval FROM settings WHERE id = 1').fetchone()
    imported = conn.execute(
        "SELECT COUNT(*) as cnt FROM matches WHERE cricapi_match_id != '' AND cricapi_match_id IS NOT NULL"
    ).fetchone()
    conn.close()
    is_running = cricapi._auto_fetch_thread is not None and cricapi._auto_fetch_thread.is_alive()
    return jsonify(
        configured=bool(row and row['cricapi_key']),
        auto_fetch_enabled=bool(row and row['auto_fetch']),
        auto_fetch_running=is_running,
        fetch_interval=row['fetch_interval'] if row else 600,
        matches_imported=imported['cnt'] if imported else 0,
    )


# ── Serve Frontend ────────────────────────────────────────────────────────────
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    dist_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'client', 'dist')
    if path != "" and os.path.exists(os.path.join(dist_dir, path)):
        return send_from_directory(dist_dir, path)
    else:
        # Fallback to index.html if dist exists, else return error
        if os.path.exists(os.path.join(dist_dir, 'index.html')):
            return send_from_directory(dist_dir, 'index.html')
        return "Frontend not built. Run 'npm run build' in client folder.", 404

if __name__ == '__main__':
    init_db()
    # Start CricAPI auto-fetch if configured
    conn = get_conn()
    row = conn.execute('SELECT cricapi_key, auto_fetch, fetch_interval FROM settings WHERE id = 1').fetchone()
    if row and row['cricapi_key'] and row['auto_fetch']:
        cricapi.start_auto_fetch(app, row['fetch_interval'])
        print(f"CricAPI auto-fetch started (interval: {row['fetch_interval']}s)")
    conn.close()
    print("Server starting on http://localhost:5555")
    app.run(debug=True, port=5555)
