import { useState, useEffect } from "react";
import { api } from "../api";

const TEAMS = ["CSK","RCB","MI","KKR","SRH","DC","RR","LSG","GT","PBKS"];

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

  useEffect(() => {
    loadMatches();
    loadUsers();
    loadSettings();
    loadGroups();
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

  const filteredPlayers = players.filter(p => !playerFilter || (p.name || '').toLowerCase().includes(playerFilter.toLowerCase()) || (p.team_abbr || '').toLowerCase().includes(playerFilter.toLowerCase()));

  return (
    <div>
      <h2 style={{fontWeight:900,fontSize:24,marginBottom:16}}>⚙️ Admin Panel</h2>
      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      <div className="tabs mb-3">
        <button className={`tab ${tab==="matches"?"active":""}`} onClick={() => setTab("matches")}>🏏 Matches</button>
        <button className={`tab ${tab==="players"?"active":""}`} onClick={() => setTab("players")}>👤 Players</button>
        <button className={`tab ${tab==="users"?"active":""}`} onClick={() => setTab("users")}>👥 Users</button>
        <button className={`tab ${tab==="groups"?"active":""}`} onClick={() => setTab("groups")}>🛡️ Groups</button>
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
                {filteredPlayers.slice(0,100).map(p => (
                  <tr key={p.id}>
                    <td className="text-muted">{p.id}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <img src={`${BASE}/images/${p.image}`} style={{width:24,height:24,borderRadius:4,objectFit:"cover"}} onError={e=>e.target.style.display="none"} />
                        <span style={{fontWeight:600,fontSize:12}}>{p.name}</span>
                      </div>
                    </td>
                    <td><span style={{color:teamMeta[p.team_abbr]?.color,fontWeight:700,fontSize:11}}>{p.team_abbr}</span></td>
                    <td><span className={`badge badge-${p.role.toLowerCase()}`}>{p.role}</span></td>
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
                        <button className="btn btn-sm btn-secondary" onClick={() => setEditUser({...u})}>✏️</button>
                        <button className="btn btn-sm btn-danger" onClick={() => deleteUser(u.username)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "groups" && (
        <div>
          <div className="card mb-3">
            <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Create New Group (Admin)</div>
            <div className="flex gap-2">
              <input className="input flex-1" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Group name…" />
              <button className="btn btn-primary" onClick={handleCreateGroup}>Create</button>
            </div>
          </div>
          
          <div className="card">
            <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Active Groups & Member Management</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Code</th><th>Name</th><th>Creator</th><th>Members</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {groups.map(g => {
                    const members = users.filter(u => u.group_id === g.code);
                    return (
                      <tr key={g.code}>
                        <td style={{fontFamily:"monospace",fontWeight:700,color:"#fbbf24"}}>{g.code}</td>
                        <td style={{fontWeight:700}}>{g.name}</td>
                        <td className="text-muted">{g.created_by}</td>
                        <td>
                          {members.length === 0 ? <span className="text-muted text-xs">Empty</span> : (
                            <div className="flex flex-col gap-1">
                              {members.map(m => (
                                <div key={m.username} className="flex items-center justify-between" style={{background:"rgba(255,255,255,0.05)",padding:"2px 8px",borderRadius:4,fontSize:11}}>
                                  <span>{m.username}</span>
                                  <button onClick={() => handleKick(g.code, m.username)} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:12}}>✖</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td>
                          <button className="btn btn-sm btn-danger" onClick={() => handleDeleteGroup(g.code)}>🗑 Delete</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
                <div style={{fontSize:24,fontWeight:900}}>{players.filter(p=>p.overseas).length}</div>
                <div className="text-muted text-xs">Overseas</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
