import { useState, useEffect } from "react";
import { api, BASE } from "../api";

function TeamModal({ username, teamMeta, onClose }) {
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
        {data && data.team && data.team.length === 0 && <p className="text-muted text-center py-4">No squad built yet</p>}
      </div>
    </div>
  );
}

function LeaderboardView({ code, user, teamMeta, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewUser, setViewUser] = useState(null);

  useEffect(() => {
    api.getLeagueLeaderboard(code).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [code]);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
  };

  if (loading) return <div className="spinner" />;
  if (!data) return <p className="text-muted text-center">Could not load leaderboard</p>;

  const league = data.league || {};
  const lb = data.leaderboard || [];

  return (
    <div>
      {viewUser && <TeamModal username={viewUser} teamMeta={teamMeta} onClose={() => setViewUser(null)} />}
      
      <button className="btn btn-sm btn-secondary mb-3" onClick={onBack}>← Back to Leagues</button>
      
      <div className="card mb-3 text-center" style={{background:'linear-gradient(135deg, rgba(249,205,27,0.12), transparent)', border:'1px solid rgba(249,205,27,0.25)'}}>
        <h3 style={{fontSize:22,fontWeight:900,color:'#fde047',marginBottom:4}}>{league.name || 'League'}</h3>
        <div className="flex items-center justify-center gap-3 mt-2">
          <span className="text-muted text-xs" style={{letterSpacing:2}}>CODE: <span style={{color:'#fff',fontWeight:700,fontFamily:'monospace',fontSize:16,letterSpacing:4}}>{code}</span></span>
          <button className="btn btn-sm btn-secondary" onClick={copyCode} style={{fontSize:10}}>📋 Copy Code</button>
        </div>
        <div className="text-muted text-xs mt-2">{lb.length} member{lb.length !== 1 ? 's' : ''} · Created by @{league.created_by}</div>
      </div>

      <div className="card">
        <div className="text-muted text-xs font-bold mb-3" style={{letterSpacing:1,textTransform:'uppercase'}}>🏅 Leaderboard</div>
        {lb.length === 0 && <p className="text-muted text-center" style={{padding:40}}>No members yet</p>}
        {lb.map((u,i) => (
          <div key={u.username} className="flex items-center gap-3" style={{
            padding:12,borderRadius:12,marginBottom:8,cursor:'pointer',transition:'all 0.15s',
            border: u.username===user.username ? "1px solid rgba(249,205,27,0.3)" : "1px solid rgba(255,255,255,0.05)",
            background: u.username===user.username ? "rgba(249,205,27,0.05)" : "transparent",
          }} onClick={() => setViewUser(u.username)}
             onMouseOver={e => { if(u.username !== user.username) e.currentTarget.style.background='rgba(255,255,255,0.03)'; }}
             onMouseOut={e => { if(u.username !== user.username) e.currentTarget.style.background='transparent'; }}
          >
            <div style={{width:28,textAlign:"center",flexShrink:0}}>
              {i < 3 ? <span style={{fontSize:16}}>{["🥇","🥈","🥉"][i]}</span> : <span className="text-muted text-xs font-bold">{i+1}</span>}
            </div>
            <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#334155,#1e293b)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:13,border:"1px solid rgba(255,255,255,0.1)",flexShrink:0}}>
              {u.username[0].toUpperCase()}
            </div>
            <div className="flex-1" style={{minWidth:0}}>
              <div className="truncate" style={{fontWeight:700,fontSize:13,color:u.username===user.username?"#fde047":"#fff"}}>
                {u.username} {u.username===user.username && <span className="text-muted text-xs">(you)</span>}
              </div>
              <div style={{color:"#34d399",fontSize:11}}>+{u.weekly_points} this week</div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontWeight:900,fontSize:14}}>{u.total_points}</div>
              <div className="text-muted text-xs">total</div>
            </div>
            <div style={{color:'rgba(255,255,255,0.3)',fontSize:10,flexShrink:0}}>👁</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GroupPage({ user, onUpdate, teamMeta }) {
  const [tab, setTab] = useState('my');
  const [myLeagues, setMyLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createName, setCreateName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [viewLeague, setViewLeague] = useState(null);
  const [createdCode, setCreatedCode] = useState(null);
  const [globalLb, setGlobalLb] = useState([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [viewUser, setViewUser] = useState(null);

  useEffect(() => { loadMyLeagues(); }, []);


  const loadMyLeagues = async () => {
    setLoading(true);
    try {
      const lg = await api.getMyLeagues(user.username);
      setMyLeagues(lg);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const loadGlobal = async () => {
    setGlobalLoading(true);
    try {
      const lb = await api.getGlobalLeaderboard();
      setGlobalLb(lb);
    } catch (e) { console.error(e); }
    setGlobalLoading(false);
  };

  const handleCreate = async () => {
    if (!createName.trim()) { setErr("Enter a league name"); return; }
    setErr(""); setMsg("");
    try {
      const res = await api.createLeague(user.username, createName.trim());
      setMsg(`League "${createName}" created!`);
      setCreatedCode(res.code);
      setCreateName("");
      loadMyLeagues();
    } catch (e) { setErr(e.message); }
  };

  const handleJoin = async () => {
    if (!user.has_team) { setErr("You must build your squad first before joining a league!"); return; }
    if (!joinCode.trim()) { setErr("Enter a league code"); return; }
    setErr(""); setMsg("");
    try {
      const res = await api.joinLeague(user.username, joinCode.trim());
      setMsg(`Joined league: ${res.name}`);
      setJoinCode("");
      loadMyLeagues();
      if (onUpdate) onUpdate();
    } catch (e) { setErr(e.message); }
  };

  const handleLeave = async (code, name) => {
    if (!confirm(`Leave league "${name}"?`)) return;
    try {
      await api.leaveLeague(user.username, code);
      setMsg(`Left league "${name}"`);
      loadMyLeagues();
      if (onUpdate) onUpdate();
    } catch (e) { setErr(e.message); }
  };

  if (viewLeague) {
    return (
      <div style={{maxWidth:700,margin:"0 auto"}}>
        <LeaderboardView code={viewLeague} user={user} teamMeta={teamMeta} onBack={() => { setViewLeague(null); loadMyLeagues(); }} />
      </div>
    );
  }

  return (
    <div style={{maxWidth:650,margin:"0 auto"}}>
      <h2 style={{fontWeight:900,fontSize:24,marginBottom:4}}>🏆 Leagues</h2>
      <p className="text-muted text-xs mb-4">Create, join, and compete in multiple leagues with friends</p>

      {msg && <div className="alert alert-success mb-3" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><span>{msg}</span><button onClick={() => setMsg("")} style={{background:'none',border:'none',color:'#fff',cursor:'pointer',fontSize:14}}>✕</button></div>}
      {err && <div className="alert alert-error mb-3" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><span>{err}</span><button onClick={() => setErr("")} style={{background:'none',border:'none',color:'#fff',cursor:'pointer',fontSize:14}}>✕</button></div>}

      <div className="tabs mb-4">
        <button className={`tab ${tab==='my'?'active':''}`} onClick={() => setTab('my')}>📋 My Leagues</button>
        <button className={`tab ${tab==='global'?'active':''}`} onClick={() => { setTab('global'); if(globalLb.length===0) loadGlobal(); }}>🌍 Global</button>
        <button className={`tab ${tab==='create'?'active':''}`} onClick={() => setTab('create')}>➕ Create</button>
        <button className={`tab ${tab==='join'?'active':''}`} onClick={() => setTab('join')}>🔗 Join</button>
      </div>

      {/* ── My Leagues ── */}
      {tab === 'my' && (
        <div>
          {loading && <div className="spinner" />}
          {!loading && myLeagues.length === 0 && (
            <div className="card text-center" style={{padding:48}}>
              <div style={{fontSize:48,marginBottom:12}}>🏟️</div>
              <h3 style={{fontWeight:900,fontSize:18,marginBottom:8}}>No Leagues Yet</h3>
              <p className="text-muted" style={{marginBottom:16}}>Create a league or join one with a code to start competing!</p>
              <div className="flex gap-2 justify-center">
                <button className="btn btn-primary" onClick={() => setTab('create')}>➕ Create League</button>
                <button className="btn btn-secondary" onClick={() => setTab('join')}>🔗 Join League</button>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2">
            {myLeagues.map(lg => (
              <div key={lg.code} className="card" style={{borderColor: lg.is_creator ? 'rgba(249,205,27,0.2)' : 'rgba(255,255,255,0.08)',transition:'all 0.15s'}}>
                <div className="flex items-center gap-3">
                  <div style={{width:44,height:44,borderRadius:12,background: lg.is_creator ? 'linear-gradient(135deg,rgba(249,205,27,0.2),rgba(249,205,27,0.05))' : 'linear-gradient(135deg,#334155,#1e293b)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:18,flexShrink:0,border:'1px solid rgba(255,255,255,0.1)'}}>
                    {lg.is_creator ? '👑' : '⚡'}
                  </div>
                  <div className="flex-1" style={{minWidth:0}}>
                    <div className="flex items-center gap-2">
                      <span style={{fontWeight:800,fontSize:15}} className="truncate">{lg.name}</span>
                      {lg.is_creator && <span className="badge" style={{background:'rgba(249,205,27,0.15)',color:'#fde047',fontSize:8,border:'1px solid rgba(249,205,27,0.3)'}}>CREATOR</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-muted text-xs">{lg.member_count} member{lg.member_count !== 1 ? 's' : ''}</span>
                      <span style={{fontSize:12,fontWeight:800}}>
                        {lg.your_rank > 0 ? (
                          <span style={{background:'linear-gradient(135deg,#f9cd1b,#ff8c00)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
                            #{lg.your_rank} <span style={{WebkitTextFillColor:'#94a3b8',fontSize:10,fontWeight:400}}>of {lg.member_count}</span>
                          </span>
                        ) : <span className="text-muted">—</span>}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1" style={{flexShrink:0}}>
                    <button className="btn btn-sm btn-primary" onClick={() => setViewLeague(lg.code)} style={{fontSize:11}}>View</button>
                    <button className="btn btn-sm btn-secondary" onClick={() => {navigator.clipboard.writeText(lg.code); setMsg(`Code copied: ${lg.code}`)}} style={{fontSize:11}} title="Copy league code">📋</button>
                    {!lg.is_creator && <button className="btn btn-sm btn-secondary" onClick={() => handleLeave(lg.code, lg.name)} style={{fontSize:11,color:'#f87171'}}>Leave</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Create League ── */}
      {tab === 'create' && (
        <div className="card" style={{borderColor:'rgba(249,205,27,0.15)'}}>
          <div style={{fontWeight:800,fontSize:16,marginBottom:16}}>➕ Create a New League</div>
          <div className="flex gap-2 mb-3">
            <input className="input flex-1" value={createName} onChange={e => setCreateName(e.target.value)}
              placeholder="League name (e.g. Office League, College Gang)" onKeyDown={e => e.key==='Enter' && handleCreate()} />
            <button className="btn btn-primary" onClick={handleCreate}>Create</button>
          </div>
          {createdCode && (
            <div className="card" style={{background:'rgba(52,211,153,0.08)',borderColor:'rgba(52,211,153,0.2)',marginTop:12}}>
              <div className="text-xs text-muted mb-1">League created! Share this code with friends:</div>
              <div className="flex items-center gap-2">
                <span style={{fontFamily:'monospace',fontWeight:900,fontSize:22,color:'#34d399',letterSpacing:4}}>{createdCode}</span>
                <button className="btn btn-sm btn-secondary" onClick={() => {navigator.clipboard.writeText(createdCode); setMsg("Code copied!")}}>📋 Copy Code</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Join League ── */}
      {tab === 'join' && (
        <div className="card" style={{borderColor:'rgba(129,140,248,0.15)'}}>
          <div style={{fontWeight:800,fontSize:16,marginBottom:16}}>🔗 Join a League</div>
          {!user.has_team ? (
            <div className="alert alert-error" style={{padding:12,fontSize:13}}>
              <strong>⚠ Build your squad first!</strong><br/>
              <span className="text-xs">You need to create your fantasy team before you can join a league.</span>
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-2">
                <input className="input flex-1" value={joinCode} onChange={e => setJoinCode(e.target.value)}
                  placeholder="Enter league code…" style={{textTransform:"uppercase",letterSpacing:3,fontFamily:'monospace'}}
                  onKeyDown={e => e.key==='Enter' && handleJoin()} />
                <button className="btn btn-primary" onClick={handleJoin}>Join</button>
              </div>
              <div className="text-xs text-muted">Ask a friend for their league code or use an invite link</div>
            </>
          )}
        </div>
      )}

      {/* ── Global League ── */}
      {tab === 'global' && (
        <div>
          {viewUser && <TeamModal username={viewUser} teamMeta={teamMeta} onClose={() => setViewUser(null)} />}
          <div className="card mb-3 text-center" style={{background:'linear-gradient(135deg, rgba(99,102,241,0.12), transparent)', border:'1px solid rgba(99,102,241,0.25)'}}>
            <h3 style={{fontSize:20,fontWeight:900,color:'#a5b4fc',marginBottom:4}}>🌍 Global League</h3>
            <p className="text-muted text-xs">Top 100 players across the entire platform</p>
          </div>
          <div className="card">
            {globalLoading && <div className="spinner" />}
            {!globalLoading && globalLb.length === 0 && <p className="text-muted text-center" style={{padding:40}}>No players with teams yet</p>}
            {globalLb.map((u,i) => {
              const isYou = u.username === user.username;
              return (
                <div key={u.username} className="flex items-center gap-3" style={{
                  padding:12,borderRadius:12,marginBottom:6,cursor:'pointer',transition:'all 0.15s',
                  border: isYou ? '1px solid rgba(249,205,27,0.3)' : '1px solid rgba(255,255,255,0.05)',
                  background: isYou ? 'rgba(249,205,27,0.05)' : 'transparent',
                }} onClick={() => setViewUser(u.username)}
                   onMouseOver={e => { if(!isYou) e.currentTarget.style.background='rgba(255,255,255,0.03)'; }}
                   onMouseOut={e => { if(!isYou) e.currentTarget.style.background='transparent'; }}
                >
                  <div style={{width:28,textAlign:'center',flexShrink:0}}>
                    {i < 3 ? <span style={{fontSize:16}}>{['🥇','🥈','🥉'][i]}</span> : <span className="text-muted text-xs font-bold">{i+1}</span>}
                  </div>
                  <div style={{width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,#334155,#1e293b)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:13,border:'1px solid rgba(255,255,255,0.1)',flexShrink:0}}>
                    {u.username[0].toUpperCase()}
                  </div>
                  <div className="flex-1" style={{minWidth:0}}>
                    <div className="truncate" style={{fontWeight:700,fontSize:13,color:isYou?'#fde047':'#fff'}}>
                      {u.username} {isYou && <span className="text-muted text-xs">(you)</span>}
                    </div>
                    <div style={{color:'#34d399',fontSize:11}}>+{u.weekly_points} this week</div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontWeight:900,fontSize:14}}>{u.total_points}</div>
                    <div className="text-muted text-xs">total</div>
                  </div>
                  <div style={{color:'rgba(255,255,255,0.3)',fontSize:10,flexShrink:0}}>👁</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
