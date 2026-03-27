import datetime
import json
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import uuid
from db import get_conn, init_db, calc_points

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

ADMIN_PASSWORD = "ipl2026admin"
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
    conn.execute('INSERT INTO users (username, password, is_admin) VALUES (?, ?, ?)', (username, password, is_admin))
    conn.commit()
    conn.close()
    return jsonify(username=username, is_admin=bool(is_admin), total_points=0, weekly_points=0, group_id=None, has_team=False, team=[])

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
    if stored_pw and stored_pw != password:
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
        'total_points': user['total_points'],
        'weekly_points': user['weekly_points'],
        'is_admin': (admin_pass == ADMIN_PASSWORD) or bool(user['is_admin']),
        'has_team': len(team_ids) > 0,
        'team': team_ids,
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
    for p in players:
        team_counts[p['team_abbr']] = team_counts.get(p['team_abbr'], 0) + 1
    errors = []
    if len(players) > 12:
        errors.append("Max 16 players")
    if total_price > 100:
        errors.append(f"Budget exceeded: {total_price} Cr")
    if overseas_count > 4:
        errors.append(f"Max 5 overseas, got {overseas_count}")
    for t, c in team_counts.items():
        if c > 3:
            errors.append(f"Max 3 from {t}, got {c}")
    if errors:
        conn.close()
        return jsonify(error="; ".join(errors)), 400
    has_team = conn.execute('SELECT 1 FROM user_teams WHERE username = ?', (username,)).fetchone()
    if has_team:
        settings = conn.execute('SELECT allow_team_edit FROM settings WHERE id = 1').fetchone()
        allow_edit = settings['allow_team_edit'] if settings else 0
        if not allow_edit:
            conn.close()
            return jsonify(error="Team editing is currently locked by admin"), 400
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
    code = uuid.uuid4().hex[:8].upper()
    conn = get_conn()
    conn.execute('INSERT INTO groups_ (code, name, created_by) VALUES (?, ?, ?)', (code, name, username))
    conn.execute('UPDATE users SET group_id = ? WHERE username = ?', (code, username))
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
    conn.commit()
    conn.close()
    return jsonify(code=code, name=group['name'])

@app.route('/api/group/<code>/leaderboard')
def group_leaderboard(code):
    conn = get_conn()
    users = conn.execute('SELECT username, total_points, weekly_points FROM users WHERE group_id = ? ORDER BY weekly_points DESC, total_points DESC', (code,)).fetchall()
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
    conn = get_conn()
    conn.execute('UPDATE users SET group_id = NULL WHERE username = ? AND group_id = ?', (username, grp_code))
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
    return jsonify(username=user['username'], group_id=user['group_id'], total_points=user['total_points'], weekly_points=user['weekly_points'], is_admin=bool(user['is_admin']), captain_id=user['captain_id'], vc_id=user['vc_id'], impact_id=user['impact_id'], roles_locked=bool(user['roles_locked']), team=[dict(r) for r in team_rows], group=group_info)

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
    row = conn.execute('SELECT allow_team_edit FROM settings WHERE id=1').fetchone()
    conn.close()
    if row:
        return jsonify(dict(row))
    return jsonify(allow_team_edit=0)

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
    players = conn.execute('SELECT p.*, COALESCE(ps.runs, 0) as runs, COALESCE(ps.wickets, 0) as wickets, COALESCE(ps.catches, 0) as catches, COALESCE(ps.points, 0) as points FROM players p LEFT JOIN player_stats ps ON ps.player_id = p.id AND ps.match_id = ? WHERE p.team_abbr IN (?, ?) ORDER BY p.team_abbr, p.name', (mid, match['team1'], match['team2'])).fetchall()
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
        imp_id = u['impact_id']
        
        # Iterate over all matches that are 'done'
        done_matches = conn.execute('SELECT id FROM matches WHERE status = "done"').fetchall()
        for m in done_matches:
            mid = m['id']
            # Score for all 12 players in the squad (if they played in this match)
            for pid in squad:
                pts = stats_dict.get((pid, mid), 0)
                mul = 1.0
                if pid == cap_id: mul = 2.0
                elif pid == vc_id: mul = 1.5
                # Impact ID gets 1.0x (standard scoring)
                total += pts * mul
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
    conn.execute('UPDATE users SET weekly_points = 0, roles_locked = 0')
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
    print("Server starting on http://localhost:5555")
    app.run(debug=True, port=5555)


