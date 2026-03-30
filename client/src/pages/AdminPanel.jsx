import { useState, useEffect } from "react";
import { api, BASE } from '../api';

const TEAMS = ["CSK","RCB","MI","KKR","SRH","DC","RR","LSG","GT","PBKS"];

function AdminTeamModal({ username, teamMeta, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getUserTeamPublic(username).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [username]);

  return (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.85)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
      <div className="card" style={{width:'100%',maxWidth:600,maxHeight:'85vh',overflowY:'auto',background:'#0f172a',borderColor:'rgba(255,255,255,0.15)'}} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <div>
            <h3 style={{fontWeight:900,fontSize:18}}>{username}'s Squad</h3>
            {data && <span className="text-muted text-xs">{data.total_points} pts total</span>}
          </div>
          <button className="btn btn-sm btn-secondary" onClick={onClose}>✕</button>
        </div>
        {loading && <div className="spinner" />}
        {!loading && !data && <p className="text-muted text-center py-4">Could not load team</p>}
        {data && data.team && (
          <div className="grid-3" style={{gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))'}}>
            {data.team.map(p => {
              const tc = teamMeta[p.team_abbr]?.color || '#666';
              return (
                <div key={p.id} className="card" style={{padding:10,textAlign:'center',position:'relative'}}>
                  <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:tc}} />
                  {p.id === data.captain_id && <span className="badge" style={{position:'absolute',top:6,left:6,background:'#fbbf24',color:'#000',fontWeight:900,fontSize:8}}>C</span>}
                  {p.id === data.vc_id && <span className="badge" style={{position:'absolute',top:6,left:6,background:'#818cf8',color:'#000',fontWeight:900,fontSize:8}}>VC</span>}
                  <img src={`${BASE}/images/${p.image}`} className="player-img" style={{width:40,height:40,margin:'6px auto 4px'}} onError={e => e.target.style.display='none'} />
                  <div style={{fontWeight:700,fontSize:11}}>{p.name}</div>
                  <div className="text-xs" style={{color:tc}}>{p.team_abbr}</div>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <span className={`badge badge-${(p.role||'BAT').toLowerCase()}`} style={{fontSize:8}}>{p.role}</span>
                    {p.overseas ? <span className="badge badge-ovs" style={{fontSize:8}}>OVS</span> : null}
                  </div>
                  <div style={{color:'#fbbf24',fontWeight:700,fontSize:10,marginTop:4}}>₹{p.price}Cr · {p.earned_points||0}pts</div>
                </div>
              );
            })}
          </div>
        )}
        {data && data.team && data.team.length === 0 && (
          <div className="text-center" style={{padding:'32px 16px'}}>
            <div style={{fontSize:40,marginBottom:8}}>🏏</div>
            <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>Yet to Create Team</div>
            <p className="text-muted text-xs">This user hasn't built their fantasy squad yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function LeagueRow({ league, teamMeta, onKick, onDelete, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewUser, setViewUser] = useState(null);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const d = await api.getLeagueLeaderboard(league.code);
      setMembers(d.leaderboard || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const toggleExpand = () => {
    if (!expanded && members.length === 0) {
      fetchMembers();
    }
    setExpanded(!expanded);
  };

  const handleKick = async (username) => {
    await onKick(league.code, username);
    fetchMembers();
  };

  return (
    <div className="card mb-2" style={{borderColor:'rgba(255,255,255,0.05)', padding: '12px 16px', background: 'rgba(0,0,0,0.2)'}}>
      <div className="flex justify-between items-center">
        <div>
          <div style={{fontWeight:800,fontSize:15}}>{league.name}</div>
          <div className="text-muted text-xs">Created by @{league.created_by} · Code: <span style={{fontFamily:'monospace', color:'#34d399'}}>{league.code}</span></div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-sm btn-secondary" onClick={toggleExpand}>
            {expanded ? "Hide Members ▲" : "View Members ▼"}
          </button>
          <button className="btn btn-sm btn-danger" onClick={() => onDelete(league.code)}>🗑 Delete</button>
        </div>
      </div>
      
      {expanded && (
        <div className="mt-3" style={{borderTop:'1px solid rgba(255,255,255,0.05)', paddingTop:12}}>
          {loading ? <div className="spinner my-2" /> : members.length === 0 ? <p className="text-muted text-xs">No members found.</p> : (
            <div className="flex flex-col gap-2">
              {members.map((m, i) => (
                <div key={m.username} className="flex justify-between items-center" style={{background:'rgba(255,255,255,0.02)', padding:'6px 12px', borderRadius:6}}>
                  <div className="flex items-center gap-3">
                    <span className="text-muted text-xs" style={{width: 16}}>{i+1}.</span>
                    <span style={{fontWeight: 600, fontSize: 13}}>{m.username}</span>
                    <span style={{color:'#fbbf24', fontSize:11}}>{m.total_points} pts</span>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-sm btn-secondary" style={{fontSize: 10, padding: '4px 8px'}} onClick={() => setViewUser(m.username)}>👁 View Squad</button>
                    {m.username !== league.created_by && (
                      <button className="btn btn-sm btn-danger" style={{fontSize: 10, padding: '4px 8px'}} onClick={() => handleKick(m.username)}>Kick ✖</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {viewUser && <AdminTeamModal username={viewUser} teamMeta={teamMeta} onClose={() => setViewUser(null)} />}
    </div>
  );
}

export default function AdminPanel({ players, teamMeta, onRefresh }) {
  const [tab, setTab] = useState("matches");
  const [matches, setMatches] = useState([]);
  const [settings, setSettings] = useState({ allow_team_edit: 0 });
  const [groups, setGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [users, setUsers] = useState([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Match creation
  const [team1, setTeam1] = useState("CSK");
  const [team2, setTeam2] = useState("MI");
  const [matchDate, setMatchDate] = useState("");

  // Stats entry
  const [selMatch, setSelMatch] = useState(null);
  const [matchPlayers, setMatchPlayers] = useState([]);
  const [statFilter, setStatFilter] = useState('');
  const [statsMap, setStatsMap] = useState({});

  // Player edit
  const [editPlayer, setEditPlayer] = useState(null);
  const [playerFilter, setPlayerFilter] = useState("");

  // User edit
  const [editUser, setEditUser] = useState(null);
  const [viewUserTeam, setViewUserTeam] = useState(null);

  // CricAPI
  const [cricConfig, setCricConfig] = useState({ cricapi_key: '', auto_fetch: 0, fetch_interval: 600 });
  const [cricStatus, setCricStatus] = useState(null);
  const [cricMatches, setCricMatches] = useState([]);
  const [cricLoading, setCricLoading] = useState(false);
  const [cricScorecard, setCricScorecard] = useState(null);
  const [cricSelectedMatch, setCricSelectedMatch] = useState(null);
  const [cricLocalMatchId, setCricLocalMatchId] = useState(null);

  useEffect(() => {
    loadMatches();
    loadUsers();
    loadSettings();
    loadGroups();
    loadCricConfig();
  }, []);

  const loadSettings = async () => { try { setSettings(await api.getSettings()); } catch(e) {} };
  const loadGroups = async () => { try { setGroups(await api.getAllGroups()); } catch(e) {} };
  
  const toggleEdit = async () => {
    const newVal = settings.allow_team_edit ? 0 : 1;
    try {
      await api.updateSettings(newVal);
      setSettings({...settings, allow_team_edit: newVal});
      showMsg(newVal ? "Transfer Window Opened!" : "Transfer Window Closed!");
    } catch(e) { showErr(e.message); }
  };
  
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      await api.createGroup("Admin", newGroupName);
      setNewGroupName("");
      showMsg("Group Created!");
      loadGroups();
    } catch(e) { showErr(e.message); }
  };
  
  const handleKick = async (code, username) => {
    if (!confirm(`Kick ${username}?`)) return;
    try {
      await api.kickUser(code, username);
      showMsg("User kicked out of group");
      loadUsers();
    } catch(e) { showErr(e.message); }
  };

  const handleDeleteGroup = async (code) => {
    if (!confirm("Delete this group? All members will be removed.")) return;
    try {
      await api.deleteGroup(code);
      showMsg("Group deleted!");
      loadGroups();
      loadUsers();
    } catch(e) { showErr(e.message); }
  };

  const loadMatches = async () => {
    try { setMatches(await api.getMatches()); } catch(e) { console.error(e); }
  };
  const loadUsers = async () => {
    try { setUsers(await api.getAdminUsers()); } catch(e) { console.error(e); }
  };

  const showMsg = (m) => { setMsg(m); setErr(""); setTimeout(() => setMsg(""), 3000); };
  const showErr = (m) => { setErr(m); setMsg(""); setTimeout(() => setErr(""), 3000); };

  const createMatch = async () => {
    if (team1 === team2) { showErr("Teams must be different"); return; }
    try {
      await api.createMatch(team1, team2, matchDate, `${team1} vs ${team2}`);
      showMsg("Match created!");
      loadMatches();
    } catch (e) { showErr(e.message); }
  };

  const openStats = async (match) => {
    setSelMatch(match);
    try {
      const data = await api.getMatchPlayers(match.id);
      setMatchPlayers(data.players);
      const map = {};
      data.players.forEach(p => {
        map[p.id] = { runs: p.runs || 0, wickets: p.wickets || 0, catches: p.catches || 0 };
      });
      setStatsMap(map);
    } catch (e) { showErr(e.message); }
  };

  const updateStat = (pid, field, val) => {
    setStatsMap(prev => ({
      ...prev,
      [pid]: { ...prev[pid], [field]: parseInt(val) || 0 }
    }));
  };

  const saveStats = async () => {
    const stats = Object.entries(statsMap)
      .filter(([,s]) => s.runs > 0 || s.wickets > 0 || s.catches > 0)
      .map(([pid, s]) => ({ player_id: parseInt(pid), ...s }));
    try {
      await api.updateStats(selMatch.id, stats);
      showMsg("Stats saved & points updated!");
      setSelMatch(null);
      loadUsers();
    } catch (e) { showErr(e.message); }
  };

  const resetWeekly = async () => {
    if (!confirm("Reset ALL weekly points to 0?")) return;
    try {
      await api.resetWeekly();
      showMsg("Weekly points reset!");
      loadUsers();
    } catch (e) { showErr(e.message); }
  };

  const recalculate = async () => {
    try {
      await api.recalculate();
      showMsg("Points recalculated!");
      loadUsers();
    } catch (e) { showErr(e.message); }
  };

  const savePlayerEdit = async () => {
    if (!editPlayer) return;
    try {
      await api.updatePlayer(editPlayer.id, editPlayer);
      showMsg("Player updated!");
      setEditPlayer(null);
      onRefresh();
    } catch (e) { showErr(e.message); }
  };

  const deletePlayer = async (id) => {
    if (!confirm("Delete this player?")) return;
    try {
      await api.deletePlayer(id);
      showMsg("Player deleted");
      onRefresh();
    } catch (e) { showErr(e.message); }
  };

  const saveUserEdit = async () => {
    if (!editUser) return;
    try {
      await api.updateUser(editUser.username, {
        total_points: editUser.total_points,
        weekly_points: editUser.weekly_points,
        group_id: editUser.group_id || null,
      });
      showMsg("User updated!");
      setEditUser(null);
      loadUsers();
    } catch (e) { showErr(e.message); }
  };

  const deleteUser = async (username) => {
    if (!confirm(`Delete user ${username}?`)) return;
    try {
      await api.deleteUser(username);
      showMsg("User deleted");
      loadUsers();
    } catch (e) { showErr(e.message); }
  };

  
  const toggleMatchStatus = async (m) => {
    const newStatus = m.status === 'upcoming' ? 'done' : 'upcoming';
    try {
      await api.updateMatchStatus(m.id, newStatus);
      showMsg("Match status updated to " + newStatus);
      loadMatches();
    } catch(e) { showErr(e.message); }
  };

  const delMatch = async (id) => {
    if (!confirm("Delete this match and all its stats?")) return;
    try {
      await api.deleteMatch(id);
      showMsg("Match deleted");
      loadMatches();
      loadUsers();
    } catch(e) { showErr(e.message); }
  };

  const filteredPlayers = (Array.isArray(players) ? players : []).filter(p => !playerFilter || (p.name || '').toLowerCase().includes(playerFilter.toLowerCase()) || (p.team_abbr || '').toLowerCase().includes(playerFilter.toLowerCase()));

  // CricAPI handlers
  const loadCricConfig = async () => {
    try { setCricConfig(await api.getCricApiConfig()); } catch(e) {}
  };
  const saveCricConfig = async () => {
    try {
      await api.updateCricApiConfig(cricConfig.cricapi_key, cricConfig.auto_fetch, cricConfig.fetch_interval);
      showMsg("CricAPI config saved!");
      loadCricStatus();
    } catch(e) { showErr(e.message); }
  };
  const loadCricStatus = async () => {
    try { setCricStatus(await api.getCricApiStatus()); } catch(e) { console.error(e); }
  };
  const fetchCricMatches = async () => {
    setCricLoading(true);
    try {
      const m = await api.getCricApiMatches();
      setCricMatches(m);
      if (m.length === 0) showMsg("No matches found from CricAPI");
    } catch(e) { showErr(e.message); }
    setCricLoading(false);
  };
  const fetchScorecard = async (cricMatch) => {
    setCricLoading(true);
    setCricSelectedMatch(cricMatch);
    try {
      const result = await api.getCricApiScorecard(cricMatch.id, cricLocalMatchId);
      setCricScorecard(result);
      if (!result.matched?.length) showMsg("No players matched from scorecard");
    } catch(e) { showErr(e.message); }
    setCricLoading(false);
  };
  const importScorecard = async () => {
    if (!cricScorecard?.matched?.length) return;
    // Need a local match to import into
    let matchId = cricLocalMatchId;
    if (!matchId) {
      // Auto-create the match from CricAPI data
      const IPL_MAP = { "Chennai Super Kings": "CSK", "Royal Challengers Bengaluru": "RCB", "Royal Challengers Bangalore": "RCB", "Mumbai Indians": "MI", "Kolkata Knight Riders": "KKR", "Sunrisers Hyderabad": "SRH", "Delhi Capitals": "DC", "Rajasthan Royals": "RR", "Lucknow Super Giants": "LSG", "Gujarat Titans": "GT", "Punjab Kings": "PBKS" };
      const teams = cricSelectedMatch?.teams || [];
      const t1 = IPL_MAP[teams[0]] || teams[0]?.substring(0,3)?.toUpperCase() || '???';
      const t2 = IPL_MAP[teams[1]] || teams[1]?.substring(0,3)?.toUpperCase() || '???';
      try {
        const res = await api.createMatch(t1, t2, cricSelectedMatch?.date || '', cricSelectedMatch?.name || '');
        matchId = res.id;
      } catch(e) { showErr("Failed to create match: " + e.message); return; }
    }
    try {
      await api.importCricApiStats(matchId, cricSelectedMatch?.id || '', cricScorecard.matched);
      showMsg(`Imported ${cricScorecard.matched.length} player stats!`);
      setCricScorecard(null);
      setCricSelectedMatch(null);
      setCricLocalMatchId(null);
      loadMatches();
      loadUsers();
      loadCricStatus();
    } catch(e) { showErr(e.message); }
  };
  const triggerAutoImport = async () => {
    setCricLoading(true);
    try {
      const res = await api.triggerAutoImport();
      showMsg(res.message || "Auto-import completed!");
      loadMatches();
      loadUsers();
      loadCricStatus();
    } catch(e) { showErr(e.message); }
    setCricLoading(false);
  };

  return (
    <div>
      <h2 style={{fontWeight:900,fontSize:24,marginBottom:16}}>⚙️ Admin Panel</h2>
      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      <div className="tabs mb-3">
        <button className={`tab ${tab==="matches"?"active":""}`} onClick={() => setTab("matches")}>🏏 Matches</button>
        <button className={`tab ${tab==="players"?"active":""}`} onClick={() => setTab("players")}>👤 Players</button>
        <button className={`tab ${tab==="users"?"active":""}`} onClick={() => setTab("users")}>👥 Users</button>
        <button className={`tab ${tab==="leagues"?"active":""}`} onClick={() => setTab("leagues")}>🏆 Leagues</button>
        <button className={`tab ${tab==="cricapi"?"active":""}`} onClick={() => { setTab("cricapi"); loadCricStatus(); }}>🤖 CricAPI</button>
        <button className={`tab ${tab==="controls"?"active":""}`} onClick={() => setTab("controls")}>🎛️ Controls</button>
      </div>

      {tab === "matches" && (
        <div>
          {selMatch ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 style={{fontWeight:700,fontSize:16}}>{selMatch.team1} vs {selMatch.team2}</h3>
                <div className="flex gap-2">
                  <input className="input input-sm" placeholder="Search player..." value={statFilter} onChange={e => setStatFilter(e.target.value)} style={{width:150}} />
                  <button className="btn btn-sm btn-secondary" onClick={() => setSelMatch(null)}>← Back</button>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Player</th><th>Team</th><th style={{width:80}}>Runs</th><th style={{width:80}}>Wickets</th><th style={{width:80}}>Catches</th><th style={{width:60}}>Pts</th></tr>
                  </thead>
                  <tbody>
                    {matchPlayers.filter(p => !statFilter || (p.name || '').toLowerCase().includes(statFilter.toLowerCase()) || (p.team_abbr || '').toLowerCase().includes(statFilter.toLowerCase())).map(p => {
                      const s = statsMap[p.id] || {runs:0,wickets:0,catches:0};
                      const pts = s.runs + s.wickets * 25 + s.catches * 8;
                      return (
                        <tr key={p.id}>
                          <td>
                            <div className="flex items-center gap-2">
                              <img src={`${BASE}/images/${p.image}`} style={{width:28,height:28,borderRadius:6,objectFit:"cover"}} onError={e=>e.target.style.display="none"} />
                              <span style={{fontWeight:600,fontSize:12}}>{p.name}</span>
                            </div>
                          </td>
                          <td><span style={{color:teamMeta[p.team_abbr]?.color,fontWeight:700,fontSize:11}}>{p.team_abbr}</span></td>
                          <td><input className="input input-sm" type="number" min="0" value={s.runs} onChange={e => updateStat(p.id,"runs",e.target.value)} /></td>
                          <td><input className="input input-sm" type="number" min="0" value={s.wickets} onChange={e => updateStat(p.id,"wickets",e.target.value)} /></td>
                          <td><input className="input input-sm" type="number" min="0" value={s.catches} onChange={e => updateStat(p.id,"catches",e.target.value)} /></td>
                          <td style={{fontWeight:700,color:"#fbbf24",fontSize:13}}>{pts}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button className="btn btn-primary mt-3" onClick={saveStats}>💾 Save Stats & Update Points</button>
            </div>
          ) : (
            <div>
              <div className="card mb-3">
                <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Create Match</div>
                <div className="flex gap-2 items-center flex-wrap">
                  <select className="input input-sm" style={{width:100}} value={team1} onChange={e => setTeam1(e.target.value)}>
                    {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <span style={{fontWeight:700,fontSize:12}}>vs</span>
                  <select className="input input-sm" style={{width:100}} value={team2} onChange={e => setTeam2(e.target.value)}>
                    {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input className="input input-sm" type="date" style={{width:150}} value={matchDate} onChange={e => setMatchDate(e.target.value)} />
                  <button className="btn btn-sm btn-primary" onClick={createMatch}>+ Create</button>
                </div>
              </div>
              <div className="card">
                <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Matches</div>
                {matches.length === 0 && <p className="text-muted text-center" style={{padding:20}}>No matches yet</p>}
                {matches.map(m => (
                  <div key={m.id} className="flex items-center gap-3" style={{padding:"10px 0",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
                    <div className="flex-1">
                      <span style={{fontWeight:700,fontSize:13}}>{m.team1} vs {m.team2}</span>
                      {m.date && <span className="text-muted text-xs" style={{marginLeft:8}}>{m.date}</span>}
                      <span className={`badge ${m.status === 'done' ? 'badge-ovs' : 'badge-wk'}`} style={{marginLeft:8, fontSize:9}}>{(m.status || 'upcoming').toUpperCase()}</span>
                    </div>
                    <button className="btn btn-sm btn-secondary" onClick={() => toggleMatchStatus(m)}>
                      Mark {m.status === 'upcoming' ? 'Done' : 'Upc'}
                    </button>
                    <button className="btn btn-sm btn-primary" onClick={() => openStats(m)}>📝 Stats</button>
                    <button className="btn btn-sm btn-secondary" onClick={() => { setCricLocalMatchId(m.id); setTab('cricapi'); fetchCricMatches(); }} title="Fetch stats from CricAPI">🤖 Fetch</button>
                    <button className="btn btn-sm btn-danger" onClick={() => delMatch(m.id)}>🗑</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "players" && (
        <div>
          <input className="input mb-3" value={playerFilter} onChange={e => setPlayerFilter(e.target.value)} placeholder="Search players..." />
          {editPlayer && (
            <div className="card mb-3" style={{borderColor:"#f9cd1b40"}}>
              <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Edit Player: {editPlayer.name}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <div>
                  <label className="text-xs text-muted">Name</label>
                  <input className="input input-sm" value={editPlayer.name} onChange={e => setEditPlayer({...editPlayer,name:e.target.value})} />
                </div>
                <div>
                  <label className="text-xs text-muted">Team Abbr</label>
                  <select className="input input-sm" value={editPlayer.team_abbr} onChange={e => setEditPlayer({...editPlayer,team_abbr:e.target.value})}>
                    {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted">Role</label>
                  <select className="input input-sm" value={editPlayer.role} onChange={e => setEditPlayer({...editPlayer,role:e.target.value})}>
                    {["BAT","BOWL","AR","WK"].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted">Price (Cr)</label>
                  <input className="input input-sm" type="number" step="0.1" value={editPlayer.price} onChange={e => setEditPlayer({...editPlayer,price:parseFloat(e.target.value)||0})} />
                </div>
                <div>
                  <label className="text-xs text-muted">Overseas</label>
                  <select className="input input-sm" value={editPlayer.overseas} onChange={e => setEditPlayer({...editPlayer,overseas:parseInt(e.target.value)})}>
                    <option value={0}>Indian</option>
                    <option value={1}>Overseas</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted">Image</label>
                  <input className="input input-sm" value={editPlayer.image} onChange={e => setEditPlayer({...editPlayer,image:e.target.value})} />
                </div>
              </div>
              <div className="mt-2">
                <label className="text-xs text-muted">Description</label>
                <textarea className="input" rows="2" value={editPlayer.description} onChange={e => setEditPlayer({...editPlayer,description:e.target.value})} />
              </div>
              <div className="flex gap-2 mt-2">
                <button className="btn btn-sm btn-primary" onClick={savePlayerEdit}>💾 Save</button>
                <button className="btn btn-sm btn-secondary" onClick={() => setEditPlayer(null)}>Cancel</button>
              </div>
            </div>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>#</th><th>Player</th><th>Team</th><th>Role</th><th>Price</th><th>OVS</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {(Array.isArray(filteredPlayers) ? filteredPlayers : []).slice(0,100).map(p => (
                  <tr key={p.id}>
                    <td className="text-muted">{p.id}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <img src={`${BASE}/images/${p.image}`} style={{width:24,height:24,borderRadius:4,objectFit:"cover"}} onError={e=>e.target.style.display="none"} />
                        <span style={{fontWeight:600,fontSize:12}}>{p.name}</span>
                      </div>
                    </td>
                    <td><span style={{color:teamMeta[p.team_abbr]?.color,fontWeight:700,fontSize:11}}>{p.team_abbr}</span></td>
                    <td><span className={`badge badge-${(p.role || 'BAT').toLowerCase()}`}>{p.role}</span></td>
                    <td style={{color:"#fbbf24",fontWeight:700}}>₹{p.price}</td>
                    <td>{p.overseas ? <span className="badge badge-ovs">OVS</span> : "—"}</td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-sm btn-secondary" onClick={() => setEditPlayer({...p})}>✏️</button>
                        <button className="btn btn-sm btn-danger" onClick={() => deletePlayer(p.id)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredPlayers.length > 100 && <p className="text-muted text-center mt-2 text-xs">Showing first 100 of {filteredPlayers.length} results</p>}
        </div>
      )}

      {tab === "users" && (
        <div>
          {editUser && (
            <div className="card mb-3" style={{borderColor:"#f9cd1b40"}}>
              <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Edit User: {editUser.username}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                <div>
                  <label className="text-xs text-muted">Total Points</label>
                  <input className="input input-sm" type="number" value={editUser.total_points} onChange={e => setEditUser({...editUser,total_points:parseInt(e.target.value)||0})} />
                </div>
                <div>
                  <label className="text-xs text-muted">Weekly Points</label>
                  <input className="input input-sm" type="number" value={editUser.weekly_points} onChange={e => setEditUser({...editUser,weekly_points:parseInt(e.target.value)||0})} />
                </div>
                <div>
                  <label className="text-xs text-muted">Group ID</label>
                  <input className="input input-sm" value={editUser.group_id||""} onChange={e => setEditUser({...editUser,group_id:e.target.value})} />
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <button className="btn btn-sm btn-primary" onClick={saveUserEdit}>💾 Save</button>
                <button className="btn btn-sm btn-secondary" onClick={() => setEditUser(null)}>Cancel</button>
              </div>
            </div>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Username</th><th>Team Size</th><th>Total Pts</th><th>Weekly Pts</th><th>Group</th><th>Admin</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.username}>
                    <td style={{fontWeight:700}}>{u.username}</td>
                    <td>{u.team_count}</td>
                    <td style={{fontWeight:700,color:"#fbbf24"}}>{u.total_points}</td>
                    <td style={{color:"#34d399"}}>{u.weekly_points}</td>
                    <td className="text-muted">{u.group_id || "—"}</td>
                    <td>{u.is_admin ? "✅" : "—"}</td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-sm btn-secondary" onClick={() => setViewUserTeam(u.username)} title="View Team">
                          {u.team_count > 0 ? '👁' : '👁'}
                        </button>
                        <button className="btn btn-sm btn-secondary" onClick={() => setEditUser({...u})}>✏️</button>
                        <button className="btn btn-sm btn-danger" onClick={() => deleteUser(u.username)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {viewUserTeam && <AdminTeamModal username={viewUserTeam} teamMeta={teamMeta} onClose={() => setViewUserTeam(null)} />}
        </div>
      )}

      {tab === "leagues" && (
        <div>
          <div className="card mb-3">
            <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Create New League (Admin)</div>
            <div className="flex gap-2">
              <input className="input flex-1" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="League name…" />
              <button className="btn btn-primary" onClick={handleCreateGroup}>Create</button>
            </div>
          </div>
          
          <div className="card">
            <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Active Leagues</div>
            {groups.length === 0 && <p className="text-muted text-center" style={{padding:20}}>No leagues yet</p>}
            {groups.map(g => (
              <LeagueRow key={g.code} league={g} teamMeta={teamMeta} onKick={handleKick} onDelete={handleDeleteGroup} onRefresh={() => { loadGroups(); loadUsers(); }} />
            ))}
          </div>
        </div>
      )}
      
      {tab === "controls" && (
        <div style={{maxWidth:500}}>
          <div className="card mb-3">
            <div style={{fontWeight:700,fontSize:14,marginBottom:8}}>📅 Weekly Reset</div>
            <p className="text-muted text-sm mb-3">Reset ALL users weekly points to 0. Total points are preserved.</p>
            <button className="btn btn-danger" onClick={resetWeekly}>🔄 Reset Weekly Points</button>
          </div>
          <div className="card mb-3">
            <div style={{fontWeight:700,fontSize:14,marginBottom:8}}>🔄 Transfer Window (Team Edits)</div>
            <p className="text-muted text-sm mb-3">Allow players to edit their squads. Currently: <b>{settings.allow_team_edit ? "OPEN" : "LOCKED"}</b></p>
            <button className={`btn ${settings.allow_team_edit ? "btn-danger" : "btn-primary"}`} onClick={toggleEdit}>
              {settings.allow_team_edit ? "🔒 Close Transfer Window" : "🔓 Open Transfer Window"}
            </button>
          </div>
          <div className="card mb-3">
            <div style={{fontWeight:700,fontSize:14,marginBottom:8}}>🔢 Recalculate Points</div>
            <p className="text-muted text-sm mb-3">Recalculate all user points based on their teams player stats.</p>
            <button className="btn btn-primary" onClick={recalculate}>⚡ Recalculate All</button>
          </div>
          <div className="card">
            <div style={{fontWeight:700,fontSize:14,marginBottom:8}}>📊 Stats</div>
            <div className="grid-2 gap-2">
              <div className="card text-center" style={{padding:12}}>
                <div style={{fontSize:24,fontWeight:900}}>{players.length}</div>
                <div className="text-muted text-xs">Players</div>
              </div>
              <div className="card text-center" style={{padding:12}}>
                <div style={{fontSize:24,fontWeight:900}}>{users.length}</div>
                <div className="text-muted text-xs">Users</div>
              </div>
              <div className="card text-center" style={{padding:12}}>
                <div style={{fontSize:24,fontWeight:900}}>{matches.length}</div>
                <div className="text-muted text-xs">Matches</div>
              </div>
              <div className="card text-center" style={{padding:12}}>
                <div style={{fontSize:24,fontWeight:900}}>{(Array.isArray(players) ? players : []).filter(p=>p.overseas).length}</div>
                <div className="text-muted text-xs">Overseas</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "cricapi" && (
        <div style={{maxWidth:800, margin:'0 auto'}}>
          {/* Config Section */}
          <div className="card mb-3">
            <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>🔑 CricAPI Configuration</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:8,alignItems:'end'}}>
              <div>
                <label className="text-xs text-muted">API Key</label>
                <input className="input input-sm" type="password" value={cricConfig.cricapi_key}
                  onChange={e => setCricConfig({...cricConfig, cricapi_key: e.target.value})}
                  placeholder="Enter your CricAPI key..." />
              </div>
              <button className="btn btn-sm btn-primary" onClick={saveCricConfig}>💾 Save</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:12}}>
              <div>
                <label className="text-xs text-muted">Auto-Fetch</label>
                <select className="input input-sm" value={cricConfig.auto_fetch}
                  onChange={e => setCricConfig({...cricConfig, auto_fetch: parseInt(e.target.value)})}>
                  <option value={0}>Disabled</option>
                  <option value={1}>Enabled</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted">Fetch Interval (seconds)</label>
                <input className="input input-sm" type="number" min="60" step="60" value={cricConfig.fetch_interval}
                  onChange={e => setCricConfig({...cricConfig, fetch_interval: parseInt(e.target.value) || 300})} />
              </div>
            </div>
          </div>

          {/* Status Section */}
          {cricStatus && (
            <div className="card mb-3" style={{borderColor: cricStatus.auto_fetch_running ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.1)'}}>
              <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>📡 Status</div>
              <div className="grid-3 gap-2">
                <div className="card text-center" style={{padding:8}}>
                  <div style={{fontSize:16,fontWeight:900,color: cricStatus.configured ? '#34d399' : '#ef4444'}}>
                    {cricStatus.configured ? '✓' : '✗'}
                  </div>
                  <div className="text-muted text-xs">API Key</div>
                </div>
                <div className="card text-center" style={{padding:8}}>
                  <div style={{fontSize:16,fontWeight:900,color: cricStatus.auto_fetch_running ? '#34d399' : '#94a3b8'}}>
                    {cricStatus.auto_fetch_running ? '● Active' : '○ Off'}
                  </div>
                  <div className="text-muted text-xs">Auto-Fetch</div>
                </div>
                <div className="card text-center" style={{padding:8}}>
                  <div style={{fontSize:16,fontWeight:900,color:'#fbbf24'}}>{cricStatus.matches_imported}</div>
                  <div className="text-muted text-xs">Imported</div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button className="btn btn-sm btn-primary" onClick={triggerAutoImport}>
                  ⚡ Run Import Now
                </button>
                <button className="btn btn-sm btn-secondary" onClick={fetchCricMatches}>
                  🔄 Fetch Live Matches
                </button>
                <button className="btn btn-sm btn-secondary" onClick={loadCricStatus}>
                  📡 Refresh Status
                </button>
              </div>
            </div>
          )}

          {/* Scorecard Review (if fetching for a specific match) */}
          {cricScorecard && (
            <div className="card mb-3" style={{borderColor:'rgba(249,205,27,0.3)'}}>
              <div className="flex justify-between items-center mb-3">
                <div>
                  <div style={{fontWeight:700,fontSize:14}}>📋 Scorecard Review</div>
                  <div className="text-xs text-muted">
                    {cricScorecard.matched?.length || 0} matched, {cricScorecard.unmatched?.length || 0} unmatched
                    {cricLocalMatchId && <span> · Local Match #{cricLocalMatchId}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-sm btn-primary" onClick={importScorecard} disabled={!cricScorecard.matched?.length}>
                    ✅ Import {cricScorecard.matched?.length || 0} Stats
                  </button>
                  <button className="btn btn-sm btn-secondary" onClick={() => { setCricScorecard(null); setCricSelectedMatch(null); }}>✕ Close</button>
                </div>
              </div>

              {cricScorecard.matched?.length > 0 && (
                <div className="table-wrap mb-2">
                  <table>
                    <thead>
                      <tr><th>Player (DB)</th><th>API Name</th><th>Runs</th><th>Wkts</th><th>Catches</th><th>Pts</th><th>Conf</th></tr>
                    </thead>
                    <tbody>
                      {cricScorecard.matched.map(s => (
                        <tr key={s.player_id}>
                          <td style={{fontWeight:600,fontSize:12}}>{s.db_name}</td>
                          <td className="text-muted" style={{fontSize:11}}>{s.api_name}</td>
                          <td style={{fontWeight:700}}>{s.runs}</td>
                          <td style={{fontWeight:700}}>{s.wickets}</td>
                          <td style={{fontWeight:700}}>{s.catches}</td>
                          <td style={{fontWeight:700,color:'#fbbf24'}}>{s.runs + s.wickets*25 + s.catches*8}</td>
                          <td>
                            <span style={{color: s.confidence >= 0.9 ? '#34d399' : s.confidence >= 0.7 ? '#fbbf24' : '#ef4444', fontWeight:700, fontSize:11}}>
                              {Math.round(s.confidence * 100)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {cricScorecard.unmatched?.length > 0 && (
                <div>
                  <div className="text-xs text-muted font-bold mb-1" style={{letterSpacing:1,textTransform:'uppercase',color:'#ef4444'}}>⚠ Unmatched Players</div>
                  <div className="flex flex-wrap gap-1">
                    {cricScorecard.unmatched.map((u, i) => (
                      <span key={i} className="badge" style={{borderColor:'rgba(239,68,68,0.3)',color:'#ef4444',fontSize:9}}>
                        {u.api_name} ({u.runs}r/{u.wickets}w/{u.catches}c)
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CricAPI Live Matches */}
          {cricMatches.length > 0 && (
            <div className="card">
              <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>
                🌐 CricAPI Matches ({cricMatches.length})
                {cricLocalMatchId && <span className="text-xs text-muted" style={{marginLeft:8}}>Selecting for Local Match #{cricLocalMatchId}</span>}
              </div>
              {cricMatches.map(m => (
                <div key={m.id} className="flex items-center gap-3" style={{padding:'8px 0',borderTop:'1px solid rgba(255,255,255,0.05)'}}>
                  <div className="flex-1">
                    <div style={{fontWeight:600,fontSize:12}}>{m.name?.substring(0, 60)}</div>
                    <div className="flex gap-2 mt-1">
                      <span className="text-xs text-muted">{m.date}</span>
                      <span className={`badge ${m.completed ? 'badge-ovs' : 'badge-wk'}`} style={{fontSize:8}}>
                        {m.completed ? 'DONE' : m.status?.substring(0, 20) || 'LIVE'}
                      </span>
                      {m.fantasyEnabled && <span className="badge badge-ar" style={{fontSize:8}}>FANTASY</span>}
                    </div>
                  </div>
                  <button className="btn btn-sm btn-primary" onClick={() => fetchScorecard(m)} disabled={cricLoading}>
                    📊 Fetch Stats
                  </button>
                </div>
              ))}
            </div>
          )}

          {cricLoading && <div className="spinner" />}
        </div>
      )}
    </div>
  );
}
