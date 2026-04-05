import sqlite3
import os
import csv
import re
import uuid

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fantasy_v2.db')
CSV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'scrape', 'data.csv')

# Known Indian player names - everyone else is overseas
INDIAN_NAMES = {
    'Khaleel Ahmed', 'Urvil Patel', 'Aman Khan', 'Kartik Sharma', 'Shivam Dube',
    'Ramakrishna Ghosh', 'MS Dhoni', 'Sarfaraz Khan', 'Ayush Mhatre', 'Rahul Chahar',
    'Sanju Samson', 'Prashant Veer', 'Gurjapneet Singh', 'Shreyas Gopal', 'Anshul Kamboj',
    'Ruturaj Gaikwad', 'Mukesh Choudhary', 'Auqib Nabi Dar', 'Sahil Parakh', 'KL Rahul',
    'Madhav Tiwari', 'Vipraj Nigam', 'Axar Patel', 'Kuldeep Yadav', 'Nitish Rana',
    'Prithvi Shaw', 'T Natarajan', 'Ashutosh Sharma', 'Mukesh Kumar', 'Tripurana Vijay',
    'Abishek Porel', 'Karun Nair', 'Sameer Rizvi', 'Jayant Yadav', 'Rahul Tewatia',
    'Nishant Sindhu', 'Shahrukh Khan', 'Kumar Kushagra', 'Shubman Gill', 'Sai Sudharsan',
    'Washington Sundar', 'Ishant Sharma', 'Anuj Rawat', 'Manav Suthar', 'Gurnoor Brar',
    'Arshad Khan', 'Prasidh Krishna', 'Ashok Sharma', 'Umran Malik', 'Tejasvi Dahiya',
    'Manish Pandey', 'Akash Deep', 'Angkrish Raghuvanshi', 'Ramandeep Singh', 'Sarthak Ranjan',
    'Rinku Singh', 'Kartik Tyagi', 'Rahul Tripathi', 'Harshit Rana', 'Anukul Roy',
    'Varun Chakaravarthy', 'Ajinkya Rahane', 'Vaibhav Arora', 'Prashant Solanki', 'Daksh Kamra',
    'Avesh Khan', 'Mayank Yadav', 'Manimaran Siddharth', 'Naman Tiwari', 'Ayush Badoni',
    'Arshin Kulkarni', 'Abdul Samad', 'Digvesh Singh Rathi', 'Mohammed Shami',
    'Akshat Raghuwanshi', 'Akash Maharaj Singh', 'Prince Yadav', 'Rishabh Pant',
    'Mukul Choudhary', 'Mohsin Khan', 'Shahbaz Ahmed', 'Arjun Tendulkar', 'Himmat Singh',
    'Robin Minz', 'Raj Bawa', 'Shardul Thakur', 'Danish Malewar', 'Mayank Markande',
    'Mayank Rawat', 'Mohammed Salahuddin Izhar', 'Deepak Chahar', 'Jasprit Bumrah',
    'Rohit Sharma', 'Naman Dhir', 'Ashwani Kumar', 'Tilak Varma', 'Suryakumar Yadav',
    'Raghu Sharma', 'Atharva Ankolekar', 'Hardik Pandya', 'Vishal Nishad', 'Shashank Singh',
    'Yash Thakur', 'Prabhsimran Singh', 'Arshdeep Singh', 'Suryansh Shedge', 'Harpreet Brar',
    'Pyla Avinash', 'Harnoor Singh', 'Vishnu Vinod', 'Nehal Wadhera', 'Musheer Khan',
    'Praveen Dubey', 'Priyansh Arya', 'Vijaykumar Vyshak', 'Shreyas Iyer',
    'Sandeep Sharma', 'Ravi Singh', 'Ravi Bishnoi', 'Sushant Mishra', 'Tushar Deshpande',
    'Aman Rao', 'Ravindra Jadeja', 'Kuldeep Sen', 'Vignesh Puthur', 'Riyan Parag',
    'Vaibhav Suryavanshi', 'Brijesh Sharma', 'Dhruv Jurel', 'Shubham Dubey',
    'Yashasvi Jaiswal', 'Yash Raj Punja', 'Yudhvir Singh Charak',
    'Devdutt Padikkal', 'Virat Kohli', 'Abhinandan Singh', 'Mangesh Yadav', 'Yash Dayal',
    'Suyash Sharma', 'Rasikh Dar Salam', 'Swapnil Singh', 'Bhuvneshwar Kumar',
    'Kanishk Chouhan', 'Venkatesh Iyer', 'Jitesh Sharma', 'Satvik Deswal', 'Rajat Patidar',
    'Vicky Ostwal', 'Vihaan Malhotra', 'Krunal Pandya',
    'Harshal Patel', 'Aniket Verma', 'Nitish Kumar Reddy',
    'Onkar Tukaram Tarmale', 'Shivam Mavi', 'Krains Fuletra', 'Shivang Kumar', 'Harsh Dubey',
    'Sakib Hussain', 'Amit Kumar', 'Salil Arora', 'Abhishek Sharma', 'Praful Hinge',
    'Zeeshan Ansari', 'Smaran Ravichandran', 'Ishan Kishan', 'Jaydev Unadkat',
    'Prithvi Raj Yarra', 'Ravisrinivasan Sai Kishore', 'Mohammed Siraj', 'Eshan Malinga',
    'Ajay Jadav Mandal',
}

TEAM_ABBR = {
    'Chennai Super Kings': 'CSK',
    'Royal Challengers Bengaluru': 'RCB',
    'Mumbai Indians': 'MI',
    'Kolkata Knight Riders': 'KKR',
    'Sunrisers Hyderabad': 'SRH',
    'Delhi Capitals': 'DC',
    'Rajasthan Royals': 'RR',
    'Lucknow Super Giants': 'LSG',
    'Gujarat Titans': 'GT',
    'Punjab Kings': 'PBKS',
}

ROLE_MAP = {
    'Batter': 'BAT',
    'Bowler': 'BOWL',
    'Allrounder': 'AR',
    'WK-Batter': 'WK',
}

def parse_price(price_str):
    price_str = price_str.strip()
    if 'Cr' in price_str:
        return float(price_str.replace('Cr', '').strip())
    elif 'L' in price_str:
        return round(float(price_str.replace('L', '').strip()) / 100, 2)
    return 0.0

def get_conn():
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    conn = get_conn()
    conn.executescript(\"\"\"
        CREATE TABLE IF NOT EXISTS players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            team TEXT NOT NULL,
            team_abbr TEXT NOT NULL,
            role TEXT NOT NULL,
            price REAL NOT NULL,
            overseas INTEGER NOT NULL DEFAULT 0,
            description TEXT DEFAULT '',
            image TEXT DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password TEXT DEFAULT \"\",
            group_id TEXT DEFAULT NULL,
            total_points INTEGER DEFAULT 0,
            weekly_points INTEGER DEFAULT 0,
            is_admin INTEGER DEFAULT 0,
            captain_id INTEGER,
            vc_id INTEGER,
            impact_id INTEGER,
            roles_locked INTEGER DEFAULT 0,
            free_transfers INTEGER DEFAULT 2,
            triple_captain_used INTEGER DEFAULT 0,
            unlimited_transfers_used INTEGER DEFAULT 0,
            triple_captain_active INTEGER DEFAULT 0,
            unlimited_transfers_active INTEGER DEFAULT 0,
            transfer_penalty INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY,
            allow_team_edit BOOLEAN DEFAULT 0,
            cricapi_key TEXT DEFAULT '',
            auto_fetch INTEGER DEFAULT 0,
            fetch_interval INTEGER DEFAULT 600,
            week_start_match_id INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS user_teams (
            username TEXT NOT NULL,
            player_id INTEGER NOT NULL,
            joined_at_match_id INTEGER DEFAULT 0,
            PRIMARY KEY (username, player_id),
            FOREIGN KEY (username) REFERENCES users(username),
            FOREIGN KEY (player_id) REFERENCES players(id)
        );
        CREATE TABLE IF NOT EXISTS groups_ (
            code TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_by TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS league_members (
            username TEXT NOT NULL,
            league_code TEXT NOT NULL,
            PRIMARY KEY (username, league_code),
            FOREIGN KEY (username) REFERENCES users(username),
            FOREIGN KEY (league_code) REFERENCES groups_(code)
        );
        CREATE TABLE IF NOT EXISTS matches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team1 TEXT NOT NULL,
            team2 TEXT NOT NULL,
            date TEXT DEFAULT '',
            description TEXT DEFAULT '',
            status TEXT DEFAULT 'upcoming',
            cricapi_match_id TEXT DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS player_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_id INTEGER NOT NULL,
            match_id INTEGER NOT NULL,
            runs INTEGER DEFAULT 0,
            wickets INTEGER DEFAULT 0,
            catches INTEGER DEFAULT 0,
            points INTEGER DEFAULT 0,
            FOREIGN KEY (player_id) REFERENCES players(id),
            FOREIGN KEY (match_id) REFERENCES matches(id),
            UNIQUE(player_id, match_id)
        );
    \"\"\")
    # Ensure settings row exists
    has_settings = conn.execute('SELECT 1 FROM settings WHERE id = 1').fetchone()
    if not has_settings:
        conn.execute('INSERT INTO settings (id, allow_team_edit) VALUES (1, 0)')
    
    # --- ROBUST MIGRATIONS ---
    cursor = conn.execute(\"PRAGMA table_info(users)\")
    columns = [row[1] for row in cursor.fetchall()]
    needed = [
        (\"captain_id\", \"INTEGER\"), (\"vc_id\", \"INTEGER\"), (\"impact_id\", \"INTEGER\"),
        (\"roles_locked\", \"INTEGER DEFAULT 0\"), (\"free_transfers\", \"INTEGER DEFAULT 2\"),
        (\"triple_captain_used\", \"INTEGER DEFAULT 0\"), (\"unlimited_transfers_used\", \"INTEGER DEFAULT 0\"),
        (\"triple_captain_active\", \"INTEGER DEFAULT 0\"), (\"unlimited_transfers_active\", \"INTEGER DEFAULT 0\"),
        (\"transfer_penalty\", \"INTEGER DEFAULT 0\"),
    ]
    for col_name, col_type in needed:
        if col_name not in columns:
            try: conn.execute(f\"ALTER TABLE users ADD COLUMN {col_name} {col_type}\")
            except: pass
            
    # Settings migrations
    s_cols = [row[1] for row in conn.execute('PRAGMA table_info(settings)').fetchall()]
    if 'cricapi_key' not in s_cols: conn.execute(\"ALTER TABLE settings ADD COLUMN cricapi_key TEXT DEFAULT ''\")
    if 'auto_fetch' not in s_cols: conn.execute('ALTER TABLE settings ADD COLUMN auto_fetch INTEGER DEFAULT 0')
    if 'fetch_interval' not in s_cols: conn.execute('ALTER TABLE settings ADD COLUMN fetch_interval INTEGER DEFAULT 600')
    if 'week_start_match_id' not in s_cols: conn.execute('ALTER TABLE settings ADD COLUMN week_start_match_id INTEGER DEFAULT 0')

    # user_teams migration
    ut_cols = [row[1] for row in conn.execute('PRAGMA table_info(user_teams)').fetchall()]
    if 'joined_at_match_id' not in ut_cols: conn.execute('ALTER TABLE user_teams ADD COLUMN joined_at_match_id INTEGER DEFAULT 0')
    
    # matches migration
    m_cols = [row[1] for row in conn.execute('PRAGMA table_info(matches)').fetchall()]
    if 'cricapi_match_id' not in m_cols: conn.execute(\"ALTER TABLE matches ADD COLUMN cricapi_match_id TEXT DEFAULT ''\")

    conn.commit()
    admin = conn.execute('SELECT * FROM users WHERE username = ?', ('admin',)).fetchone()
    if not admin:
        conn.execute('INSERT INTO users (username, is_admin) VALUES (?, ?)', ('admin', 1))
        conn.commit()
    conn.close()

def seed_players(conn):
    if not os.path.exists(CSV_PATH): return
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        content = f.read()
    lines = content.strip().split('\\n')
    import csv
    reader = csv.reader(lines)
    for row in reader:
        if len(row) < 4: continue
        team_full, name, role_raw, price_raw = row[0:4]
        team_abbr = TEAM_ABBR.get(team_full, team_full[:3].upper())
        role = ROLE_MAP.get(role_raw, 'BAT')
        price = parse_price(price_raw)
        overseas = 0 if name in INDIAN_NAMES else 1
        conn.execute(
            'INSERT INTO players (name, team, team_abbr, role, price, overseas) VALUES (?, ?, ?, ?, ?, ?)',
            (name, team_full, team_abbr, role, price, overseas)
        )
    conn.commit()

def calc_points(runs, wickets, catches):
    return runs + (wickets * 25) + (catches * 8)

def recalculate_all_users(conn):
    settings = conn.execute('SELECT week_start_match_id FROM settings WHERE id = 1').fetchone()
    week_start_mid = settings['week_start_match_id'] if settings and settings['week_start_match_id'] else 0
    users = conn.execute('SELECT username, captain_id, vc_id, impact_id, triple_captain_active, transfer_penalty FROM users').fetchall()
    all_stats = conn.execute('SELECT * FROM player_stats').fetchall()
    stats_dict = {(s['player_id'], s['match_id']): s['points'] for s in all_stats}
    all_user_players = conn.execute('SELECT username, player_id, COALESCE(joined_at_match_id, 0) as joined_at FROM user_teams').fetchall()
    u_players = {}
    for up in all_user_players:
        if up['username'] not in u_players: u_players[up['username']] = []
        u_players[up['username']].append((up['player_id'], up['joined_at']))
    done_matches = conn.execute('SELECT id FROM matches WHERE status = \"done\"').fetchall()
    all_match_ids = [m['id'] for m in done_matches]
    this_week_ids = set(m['id'] for m in done_matches if m['id'] > week_start_mid)
    for u in users:
        total, weekly = 0, 0
        squad = u_players.get(u['username'], [])
        for mid in all_match_ids:
            for (pid, joined_at) in squad:
                if mid <= joined_at: continue
                pts = stats_dict.get((pid, mid), 0)
                mul = 1.5 if pid == u['vc_id'] else 1.0
                if pid == u['captain_id']: mul = 3.0 if u['triple_captain_active'] else 2.0
                total += pts * mul
                if mid in this_week_ids: weekly += pts * mul
        total -= (u['transfer_penalty'] or 0)
        conn.execute('UPDATE users SET total_points = ?, weekly_points = ? WHERE username = ?', (int(total), int(weekly), u['username']))
    conn.commit()
