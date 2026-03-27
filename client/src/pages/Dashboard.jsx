import { useState, useEffect } from 'react';
import { api, BASE } from '../api';

export function AdminDashboard({ user }) {
  const [groups, setGroups] = useState([]);
  const [leaderboards, setLeaderboards] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const ag = await api.getAllGroups();
        setGroups(ag);
        const lbs = {};
        for (const g of ag) {
          lbs[g.code] = await api.getLeaderboard(g.code);
        }
        setLeaderboards(lbs);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }
    load();
  }, []);


  if (loading) return <div className="spinner" />;

  return (
    <div style={{maxWidth:900,margin:'0 auto'}}>
      <h2 style={{fontWeight:900,fontSize:24,marginBottom:24,textAlign:'center'}}>🛡️ Admin: All Active Groups</h2>
      {groups.length === 0 && <p className="text-center text-muted">No active groups.</p>}
      <div className="grid-2">
        {groups.map(g => (
          <div key={g.code} className="card" style={{borderColor:'rgba(249,205,27,0.3)'}}>
            <div className="flex justify-between items-center mb-3" style={{borderBottom:'1px solid rgba(255,255,255,0.1)',paddingBottom:8}}>
              <h3 style={{fontWeight:900,fontSize:16,color:'#fde047'}}>{g.name}</h3>
              <span className="text-xs text-muted" style={{fontFamily:'monospace'}}>Code: {g.code}</span>
            </div>
            {(!leaderboards[g.code] || leaderboards[g.code].length === 0) ? (
              <p className="text-xs text-muted">No members yet.</p>
            ) : (
              leaderboards[g.code].map((u, i) => (
                <div key={u.username} className="flex justify-between items-center text-sm py-1">
                  <span>
                    <strong style={{display:'inline-block',width:20}}>{i+1}.</strong> 
                    {u.username}
                  </span>
                  <span style={{fontWeight:700,color:'#34d399'}}>{u.total_points}</span>
                </div>
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard({ user, players, teamMeta, onEditTeam, onSelectMatch }) {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
  const [settings, setSettings] = useState({ allow_team_edit: 0 });
  const [matches, setMatches] = useState([]);
  const [showScorecard, setShowScorecard] = useState(null);
  const [scorecardStats, setScorecardStats] = useState([]);
  const [cap, setCap] = useState(null);
  const [vc, setVc] = useState(null);
  const [imp, setImp] = useState(null);
  const [roleMsg, setRoleMsg] = useState('');

  useEffect(() => {
    api.getSettings().then(setSettings).catch(console.error);
  }, []);

  useEffect(() => {
    loadData();
  }, [user.username]);

  
  const handleSaveRoles = async () => {
    if (!cap || !vc || !imp) { setRoleMsg("Select C, VC, and Impact Player!"); return; }
    try {
      await api.setRoles({ username: user.username, captain_id: cap, vc_id: vc, impact_id: imp });
      setRoleMsg("Roles Locked for the week! 🔒");
      loadData();
    } catch(e) { setRoleMsg(e.message); }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const d = await api.getUser(user.username);
            setUserData(d);
      setCap(d.captain_id);
      setVc(d.vc_id);
      setImp(d.impact_id);
      if (d.group_id) {
        const lb = await api.getLeaderboard(d.group_id);
        setLeaderboard(lb);
      }
      const ms = await api.getPublicMatches();
      setMatches(ms);
    } catch (e) { console.error(e); }
    setLoading(false);
  };


  if (loading) return <div className="spinner" />;
  if (!userData) return <div className="text-center text-muted mt-4">Could not load data</div>;


  const team = userData.team || [];
  const rank = leaderboard.findIndex(u => u.username === user.username) + 1;
  const hasTeam = team.length > 0;

  const doneMatches = matches.filter(m => m.status === 'done');
  const upcMatches = matches.filter(m => m.status === 'upcoming');
  const prevMatch = doneMatches.length > 0 ? doneMatches[doneMatches.length - 1] : null;
  const nextMatch = upcMatches.length > 0 ? upcMatches[0] : null;
  const secondNextMatch = upcMatches.length > 1 ? upcMatches[1] : null;

  const openScorecard = async (m) => {
    setShowScorecard(m);
    setScorecardStats([]);
    try {
      const stats = await api.getPublicMatchStats(m.id);
      setScorecardStats(stats);
    } catch(e) { console.error(e); }
  };


  return (
    <div style={{maxWidth:800,margin:'0 auto'}}>

      {showScorecard && (
        <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.8)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16}}>
          <div className="card" style={{width:'100%', maxWidth:500, maxHeight:'80vh', overflowY:'auto', background:'#0f172a', borderColor:'rgba(255,255,255,0.1)'}}>
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 style={{fontWeight:900, fontSize:18}}>{showScorecard.team1} vs {showScorecard.team2}</h3>
                <span className="badge badge-ovs mt-1" style={{fontSize:9}}>SCORECARD</span>
              </div>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowScorecard(null)}>✕</button>
            </div>
            <div className="text-xs text-muted mb-3" style={{letterSpacing:1, textTransform:'uppercase'}}>Top 5 Players</div>
            {scorecardStats.length === 0 ? <p className="text-muted text-sm text-center py-4">Loading stats...</p> : (
              <div>
                {scorecardStats.slice(0, 5).map((s, i) => {
                  const inTeam = team.some(p => p.id === s.player_id);
                  return (
                    <div key={s.player_id} className="flex justify-between items-center py-2" style={{borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                      <div className="flex items-center gap-3">
                        <span style={{width:16, textAlign:'center', fontWeight:900, color: i < 3 ? '#fbbf24' : '#fff'}}>{i+1}.</span>
                        <div>
                          <div style={{fontWeight:700, fontSize:13}}>{s.player_name}</div>
                          <div className="text-xs" style={{color: teamMeta[s.team_abbr]?.color}}>{s.team_abbr}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {inTeam && <span className="badge" style={{background:'rgba(52,211,153,0.2)', color:'#34d399', border:'1px solid #34d399'}}>In Squad</span>}
                        <span style={{fontWeight:900, color:'#fde047', fontSize:14}}>{s.points} pts</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <>
        
        <div className="flex gap-3 mb-4 overflow-x-auto overflow-y-hidden" style={{paddingBottom: 4, scrollbarWidth: 'none'}}>
          {prevMatch && (
            <div className="card text-center" style={{flex:'0 0 160px', padding:'12px 8px', borderColor:'rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.03)',  transition:'all 0.2s', zIndex:10}} onClick={() => openScorecard(prevMatch)} onMouseOver={e => e.currentTarget.style.borderColor='rgba(255,255,255,0.3)'} onMouseOut={e => e.currentTarget.style.borderColor='rgba(255,255,255,0.1)'}>
              <div className="text-xs text-muted mb-1 uppercase tracking-widest" style={{fontSize:9}}>Previous</div>
              <div style={{fontWeight:900, fontSize:15, marginBottom:4}}>{prevMatch.team1} <span className="text-muted text-xs mx-1">v</span> {prevMatch.team2}</div>
              <span className="badge badge-ovs" style={{fontSize:9, background:'rgba(255,255,255,0.1)'}}>DONE - view stats ↗</span>
            </div>
          )}
          {nextMatch ? (
            <div className="card text-center"  style={{flex:'0 0 200px', padding:'12px 8px',  borderColor:'#f9cd1b', background:'linear-gradient(135deg,rgba(249,205,27,0.15),transparent)', boxShadow:'0 4px 20px rgba(249,205,27,0.1)'}}>
              <div className="text-xs mb-1 uppercase tracking-widest" style={{color:'#fde047', fontWeight:900, fontSize:10}}>Upcoming</div>
              <div style={{fontWeight:900, fontSize:18, marginBottom:4}}>{nextMatch.team1} <span style={{color:'rgba(255,255,255,0.3)'}}>v</span> {nextMatch.team2}</div>
              <div className="text-xs mt-1" style={{color:'#f9cd1b'}}>{nextMatch.date || 'TBD'}</div>
            </div>
          ) : (
            <div className="card text-center text-muted flex items-center justify-center" style={{flex:'0 0 200px', padding:'12px 8px', fontSize:12}}>No upcoming matches</div>
          )}
          {secondNextMatch && (
            <div className="card text-center" onClick={() => onSelectMatch(secondNextMatch)} style={{flex:'0 0 160px', padding:'12px 8px',  borderColor:'rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.03)'}}>
              <div className="text-xs text-muted mb-1 uppercase tracking-widest" style={{fontSize:9}}>Following</div>
              <div style={{fontWeight:900, fontSize:15, marginBottom:4}}>{secondNextMatch.team1} <span className="text-muted text-xs mx-1">v</span> {secondNextMatch.team2}</div>
              <div className="text-xs text-muted mt-1">{secondNextMatch.date || 'TBD'}</div>
            </div>
          )}
        </div>

        {!hasTeam && (
          <div className="card text-center" style={{padding:40,marginBottom:16}}>
            <div style={{fontSize:48,marginBottom:12}}>🏏</div>
            <h3 style={{fontWeight:900,fontSize:18,marginBottom:8}}>No Squad Yet!</h3>
            <p className="text-muted" style={{marginBottom:16}}>You need to build your fantasy team before you can compete.</p>
            {onEditTeam && <button className="btn btn-primary" onClick={onEditTeam}>🛠️ Build Your Team Now</button>}
          </div>
        )}

        
        {hasTeam && (
          <div className="card mb-4" style={{borderColor: userData.roles_locked ? 'rgba(255,255,255,0.1)' : '#f9cd1b80'}}>
            <div className="flex justify-between items-center mb-3">
              <h3 style={{fontWeight:900, fontSize:16}}>🎯 Weekly Roles {userData.roles_locked ? '🔒' : '🔓'}</h3>
              {!userData.roles_locked && <button className="btn btn-sm btn-primary" onClick={handleSaveRoles}>Lock Roles for Week</button>}
            </div>
            {roleMsg && <div className="alert alert-info py-2 text-xs mb-3">{roleMsg}</div>}
            
            <div className="grid-3 gap-2">
              <div className="card p-2 text-center" style={{background:'rgba(255,255,255,0.03)'}}>
                <div className="text-xs text-muted mb-1">CAPTAIN (2x)</div>
                <select className="input input-sm w-full" value={cap || ''} onChange={e => setCap(parseInt(e.target.value))} disabled={userData.roles_locked}>
                  <option value="">Select...</option>
                  {team.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="card p-2 text-center" style={{background:'rgba(255,255,255,0.03)'}}>
                <div className="text-xs text-muted mb-1">VICE-CAPTAIN (1.5x)</div>
                <select className="input input-sm w-full" value={vc || ''} onChange={e => setVc(parseInt(e.target.value))} disabled={userData.roles_locked}>
                  <option value="">Select...</option>
                  {team.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="card p-2 text-center" style={{background:'rgba(255,255,255,0.03)'}}>
                <div className="text-xs text-muted mb-1">IMPACT PLAYER</div>
                <select className="input input-sm w-full" value={imp || ''} onChange={e => setImp(parseInt(e.target.value))} disabled={userData.roles_locked}>
                  <option value="">Select...</option>
                  {team.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            {userData.roles_locked && <p className="text-center text-muted mt-2" style={{fontSize:10}}>Roles are fixed until the next Weekly Reset by Admin.</p>}
          </div>
        )}

        {hasTeam && (
          <div className="flex items-center justify-between mb-3">
            <div />
            {settings.allow_team_edit ? (
              <button className="btn btn-sm btn-primary" onClick={onEditTeam} style={{fontSize:12}}>✎ Edit Team</button>
            ) : (
              <div style={{background:'rgba(255,255,255,0.1)',color:'#94a3b8',fontSize:10,padding:'4px 10px',borderRadius:8}}>🔒 Transfers Locked</div>
            )}
          </div>
        )}

        <div className="grid-3 mb-4">
          {[
            {lbl:'Total Points', val:userData.total_points, icon:'⚡', grad:'linear-gradient(135deg,#f9cd1b,#ff8c00)'},
            {lbl:'This Week', val:userData.weekly_points, icon:'📅', grad:'linear-gradient(135deg,#34d399,#14b8a6)'},
            {lbl:'Your Rank', val:rank?`#${rank}`:'—', icon:'🎯', grad:'linear-gradient(135deg,#c084fc,#818cf8)'},
          ].map(s => (
            <div key={s.lbl} className="card text-center">
              <div style={{fontSize:20,marginBottom:4}}>{s.icon}</div>
              <div style={{fontSize:24,fontWeight:900,background:s.grad,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>{s.val}</div>
              <div className="text-muted text-xs mt-1">{s.lbl}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="text-muted text-xs font-bold mb-3" style={{letterSpacing:1,textTransform:'uppercase'}}>Your Players · Sorted by Points</div>
          <div className="grid-3" style={{gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))'}}>
            {[...team].sort((a,b) => (b.earned_points||0) - (a.earned_points||0)).map((p,i) => {
              const tc = teamMeta[p.team_abbr]?.color || '#666';
              return (
                <div key={p.id} className="card" style={{padding:12,textAlign:'center',position:'relative'}}>
                  <div style={{position:'absolute',top:8,left:8,display:'flex',flexDirection:'column',gap:2}}>
                     {p.id === userData.captain_id && <span className="badge" style={{background:'#fbbf24',color:'#000',fontWeight:900,fontSize:9}}>C</span>}
                     {p.id === userData.vc_id && <span className="badge" style={{background:'#818cf8',color:'#000',fontWeight:900,fontSize:9}}>VC</span>}
                     {p.id === userData.impact_id && <span className="badge" style={{background:'#34d399',color:'#000',fontWeight:900,fontSize:9}}>IP</span>}
                  </div>
                  <img src={`${BASE}/images/${p.image}`} className="player-img player-img-lg" style={{margin:'4px auto 6px',borderColor:tc+'60'}}
                    onError={e => e.target.style.display='none'} />
                  <div style={{position:'absolute',top:8,right:8,background:'#fbbf24',color:'#000',fontSize:10,fontWeight:900,borderRadius:12,padding:'2px 8px'}}>
                    {p.earned_points || 0}
                  </div>
                  <div style={{fontWeight:700,fontSize:12}}>{p.name}</div>
                  <div className="text-xs" style={{color:tc}}>{p.team_abbr}</div>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <span className={`badge badge-${(p.role || 'BAT').toLowerCase()}`}>{p.role}</span>
                    {p.overseas ? <span className="badge badge-ovs">OVS</span> : null}
                  </div>
                  <div style={{marginTop:6,height:3,borderRadius:2,background:'rgba(255,255,255,0.1)'}}>
                    <div style={{height:3,borderRadius:2,background:tc,width:`${Math.min(((p.earned_points||0)/100)*100,100)}%`,transition:'width 0.3s'}} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </>
    </div>
  );
}
