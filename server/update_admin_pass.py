import sqlite3
import os

# Portable relative path for any environment
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fantasy_v2.db')

def update_admin_pass():
    if not os.path.exists(DB_PATH):
        print(f"DB not found at {DB_PATH}")
        return
    
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute("UPDATE users SET password = 'adminIPL2026' WHERE username = 'admin'")
        conn.commit()
        print("Admin password updated successfully.")
    except Exception as e:
        print(f"Error updating admin password: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    update_admin_pass()
