#!/usr/bin/env python3
"""
Standalone auto-import script for PythonAnywhere Scheduled Tasks.

This script runs ONE import cycle: checks CricAPI for completed IPL matches
that haven't been imported yet, fetches their scorecards, and updates
player stats + user points.

Setup on PythonAnywhere:
  1. Go to the "Tasks" tab
  2. Add a new scheduled task (hourly if on paid plan)
  3. Command: /home/lithinsaikumar/IPL_2026_Fantasy/server/auto_import.py
     Or: cd /home/lithinsaikumar/IPL_2026_Fantasy/server && python3 auto_import.py
"""

import sys
import os

# Ensure the server directory is on the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db import get_conn, calc_points, init_db, recalculate_all_users
import cricapi

def run_import():
    """Run one import cycle."""
    init_db()
    conn = get_conn()
    
    try:
        # Get API key
        row = conn.execute("SELECT cricapi_key FROM settings WHERE id = 1").fetchone()
        apikey = row["cricapi_key"] if row and row["cricapi_key"] else ""
        if not apikey:
            print("ERROR: No CricAPI key configured in settings.")
            return
        
        # Fetch matches from CricAPI
        print("Fetching matches from CricAPI...")
        try:
            current = cricapi.fetch_current_matches(apikey)
        except Exception as e:
            print(f"ERROR fetching current matches: {e}")
            current = []
        
        try:
            match_list = cricapi.fetch_match_list(apikey)
        except Exception as e:
            print(f"ERROR fetching match list: {e}")
            match_list = []
        
        # Deduplicate by CricAPI match ID
        all_matches = list({m["id"]: m for m in (current + match_list)}.values())
        print(f"Found {len(all_matches)} total matches ({len(current)} current, {len(match_list)} from list)")
        
        # Filter to IPL + completed
        ipl_matches = cricapi.filter_ipl_matches(all_matches)
        completed = [m for m in ipl_matches if cricapi.is_match_completed(m)]
        print(f"IPL matches: {len(ipl_matches)}, Completed: {len(completed)}")
        
        if not completed:
            print("No completed IPL matches to import.")
            return
        
        # Get all DB players for matching
        db_players = [dict(p) for p in conn.execute("SELECT * FROM players").fetchall()]
        imported_count = 0
        
        for cm in completed:
            cricapi_id = cm.get("id", "")
            
            # Skip if already imported
            exists = conn.execute(
                "SELECT id FROM matches WHERE cricapi_match_id = ?", (cricapi_id,)
            ).fetchone()
            if exists:
                continue
            
            teams = cm.get("teams", [])
            team1 = cricapi.IPL_TEAM_NAMES.get(teams[0], teams[0][:3].upper()) if len(teams) > 0 else "???"
            team2 = cricapi.IPL_TEAM_NAMES.get(teams[1], teams[1][:3].upper()) if len(teams) > 1 else "???"
            date_str = cm.get("date", cm.get("dateTimeGMT", ""))[:10]
            match_name = cm.get("name", f"{team1} vs {team2}")
            
            print(f"\nImporting: {match_name} ({team1} vs {team2}, {date_str})")
            
            # Check if match already exists manually (by teams + date)
            existing = conn.execute(
                "SELECT id FROM matches WHERE (team1 = ? AND team2 = ? AND date = ?) OR (team1 = ? AND team2 = ? AND date = ?)",
                (team1, team2, date_str, team2, team1, date_str)
            ).fetchone()
            
            if existing:
                match_id = existing["id"]
                conn.execute("UPDATE matches SET cricapi_match_id = ?, status = 'done' WHERE id = ?", (cricapi_id, match_id))
                print(f"  Linked to existing match #{match_id}")
            else:
                cur = conn.execute(
                    "INSERT INTO matches (team1, team2, date, description, status, cricapi_match_id) VALUES (?, ?, ?, ?, 'done', ?)",
                    (team1, team2, date_str, match_name, cricapi_id)
                )
                match_id = cur.lastrowid
                print(f"  Created new match #{match_id}")
            
            # Fetch scorecard
            try:
                scorecard_data = cricapi.fetch_scorecard(apikey, cricapi_id)
                raw_stats = cricapi.extract_player_stats(scorecard_data)
                result = cricapi.match_players_to_db(raw_stats, db_players)
                
                if not result["matched"]:
                    print(f"  WARNING: No players matched!")
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
                imported_count += 1
                
                print(f"  Imported {len(result['matched'])} players")
                if result["unmatched"]:
                    print(f"  Unmatched: {[u['api_name'] for u in result['unmatched']]}")
                    
            except Exception as e:
                print(f"  ERROR importing scorecard: {e}")
                continue
        
        if imported_count > 0:
            print(f"\nDone! Imported {imported_count} new match(es).")
        else:
            print("\nNo new matches to import (all already in database).")
    
    finally:
        conn.close()


if __name__ == "__main__":
    run_import()
