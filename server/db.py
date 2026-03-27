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
    # conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    conn = get_conn()
    conn.executescript("""
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
            password TEXT DEFAULT "",
            group_id TEXT DEFAULT NULL,
            total_points INTEGER DEFAULT 0,
            weekly_points INTEGER DEFAULT 0,
            is_admin INTEGER DEFAULT 0,
            captain_id INTEGER,
            vc_id INTEGER,
            impact_id INTEGER,
            roles_locked INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY,
            allow_team_edit BOOLEAN DEFAULT 0,
            cricapi_key TEXT DEFAULT '',
            auto_fetch INTEGER DEFAULT 0,
            fetch_interval INTEGER DEFAULT 600
        );
        CREATE TABLE IF NOT EXISTS user_teams (
            username TEXT NOT NULL,
            player_id INTEGER NOT NULL,
            PRIMARY KEY (username, player_id),
            FOREIGN KEY (username) REFERENCES users(username),
            FOREIGN KEY (player_id) REFERENCES players(id)
        );
        CREATE TABLE IF NOT EXISTS groups_ (
            code TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_by TEXT NOT NULL
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
                CREATE TABLE IF NOT EXISTS match_lineups (
            username TEXT NOT NULL,
            match_id INTEGER NOT NULL,
            player_ids TEXT NOT NULL,
            captain_id INTEGER,
            vc_id INTEGER,
            impact_id INTEGER,
            PRIMARY KEY (username, match_id),
            FOREIGN KEY (username) REFERENCES users(username),
            FOREIGN KEY (match_id) REFERENCES matches(id)
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
    """)
    count = conn.execute('SELECT COUNT(*) FROM players').fetchone()[0]
    if count == 0:
        seed_players(conn)
    admin = conn.execute('SELECT * FROM users WHERE username = ?', ('admin',)).fetchone()
        # Ensure settings row exists
    has_settings = conn.execute('SELECT 1 FROM settings WHERE id = 1').fetchone()
    if not has_settings:
        conn.execute('INSERT INTO settings (id, allow_team_edit) VALUES (1, 0)')
        
    
    


    
    # --- ROBUST MIGRATIONS ---
    cursor = conn.execute("PRAGMA table_info(users)")
    columns = [row[1] for row in cursor.fetchall()]
    needed = [
        ("captain_id", "INTEGER"),
        ("vc_id", "INTEGER"),
        ("impact_id", "INTEGER"),
        ("roles_locked", "INTEGER DEFAULT 0")
    ]
    for col_name, col_type in needed:
        if col_name not in columns:
            try:
                conn.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
            except: pass
    # --------------------------

    conn.commit()
    if not admin:
        conn.execute('INSERT INTO users (username, is_admin) VALUES (?, ?)', ('admin', 1))
        conn.commit()
    # Migrate: add CricAPI columns if missing
    _migrate_cricapi_columns(conn)
    conn.close()

def _migrate_cricapi_columns(conn):
    """Add CricAPI-related columns to existing tables if they don't exist."""
    # Settings table: cricapi_key, auto_fetch, fetch_interval
    cols = [row[1] for row in conn.execute('PRAGMA table_info(settings)').fetchall()]
    if 'cricapi_key' not in cols:
        conn.execute("ALTER TABLE settings ADD COLUMN cricapi_key TEXT DEFAULT ''")
    if 'auto_fetch' not in cols:
        conn.execute('ALTER TABLE settings ADD COLUMN auto_fetch INTEGER DEFAULT 0')
    if 'fetch_interval' not in cols:
        conn.execute('ALTER TABLE settings ADD COLUMN fetch_interval INTEGER DEFAULT 600')
    # Matches table: cricapi_match_id
    cols2 = [row[1] for row in conn.execute('PRAGMA table_info(matches)').fetchall()]
    if 'cricapi_match_id' not in cols2:
        conn.execute("ALTER TABLE matches ADD COLUMN cricapi_match_id TEXT DEFAULT ''")
    conn.commit()

def seed_players(conn):
    if not os.path.exists(CSV_PATH):
        print(f"CSV not found at {CSV_PATH}")
        return
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        content = f.read()
    header = "Team,Player,Role,Final_Price,Stats,Image_Path"
    if content.startswith(header):
        content = content[len(header):]
    lines = content.strip().split('\n')
    reader = csv.reader(lines)
    for row in reader:
        if len(row) < 4:
            continue
        team_full = row[0].strip()
        name = row[1].strip()
        role_raw = row[2].strip()
        price_raw = row[3].strip()
        stats = row[4].strip() if len(row) > 4 else ''
        image = row[5].strip() if len(row) > 5 else ''
        if not name or not team_full:
            continue
        team_abbr = TEAM_ABBR.get(team_full, team_full[:3].upper())
        role = ROLE_MAP.get(role_raw, 'BAT')
        price = parse_price(price_raw)
        overseas = 0 if name in INDIAN_NAMES else 1
        image_file = os.path.basename(image) if image else ''
        conn.execute(
            'INSERT INTO players (name, team, team_abbr, role, price, overseas, description, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            (name, team_full, team_abbr, role, price, overseas, stats, image_file)
        )
    conn.commit()
    print(f"Seeded {conn.execute('SELECT COUNT(*) FROM players').fetchone()[0]} players")

def calc_points(runs, wickets, catches):
    return runs + (wickets * 25) + (catches * 8)
