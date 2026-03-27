import { useState } from 'react';
import { api } from '../api';

const BUDGET = 100, MAX_SEL = 16, MAX_OVS = 5, MAX_PER_TEAM = 3;
const ROLE_EMOJI = { BAT: '🏏', BOWL: '⚡', AR: '🌟', WK: '🥊' };

function getViolation(selected, player, isEditMode, initialTeamIds) {
  const isBuy = !initialTeamIds.includes(player.id);
  if (isEditMode && isBuy) {
    const buys = selected.filter(p => !initialTeamIds.includes(p.id)).length;
    if (buys >= 2) return 'Max 2 transfers limit';
  }
  if (selected.some(p => p.id === player.id)) return null;
  if (selected.length >= MAX_SEL) return 'Squad full';
  const spent = selected.reduce((s, p) => s + p.price, 0);
  if (spent + player.price > BUDGET) return 'Budget exceeded';
  if (player.overseas && selected.filter(p => p.overseas).length >= MAX_OVS) return 'Max 5 overseas';
  if (selected.filter(p => p.team_abbr === player.team_abbr).length >= MAX_PER_TEAM)
    return `Max ${MAX_PER_TEAM} from ${player.team_abbr}`;
  return null;
}

export default function TeamBuilder({ user, players, onSave, teamMeta }) {
    const initialTeamIds = user.team ? user.team.map(p => typeof p === 'object' ? p.id : p) : [];
  const initialTeam = initialTeamIds.map(id => players.find(p => p.id === id)).filter(Boolean);
  const isEditMode = initialTeam.length === 16;
  const [selected, setSelected] = useState(initialTeam);
  const [activeTeam, setActiveTeam] = useState('CSK');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [showReview, setShowReview] = useState(false);

  const teams = Object.keys(teamMeta);
  const teamPlayers = players.filter(p =>
    p.team_abbr === activeTeam &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()))
  );

  const toggle = (player) => {
    setSelected(s => s.some(p => p.id === player.id)
      ? s.filter(p => p.id !== player.id)
      : [...s, player]);
  };

  const spent = selected.reduce((s, p) => s + p.price, 0);
  const remaining = BUDGET - spent;
  const ovs = selected.filter(p => p.overseas).length;

  const save = async () => {
    setSaving(true);
    setErr('');
    try {
      await api.saveTeam(user.username, selected.map(p => p.id));
      onSave();
    } catch (e) {
      setErr(e.message);
    }
    setSaving(false);
  };

  if (showReview) {
    const dist = selected.reduce((acc, p) => { acc[p.team_abbr] = (acc[p.team_abbr] || 0) + 1; return acc; }, {});
    return (
      <div style={{maxWidth:700,margin:'0 auto'}}>
        <div className="text-center mb-4">
          <p className="text-muted text-xs" style={{letterSpacing:3,textTransform:'uppercase',marginBottom:4}}>Review Your Squad</p>
          <h2 style={{fontSize:28,fontWeight:900}}>{user.username}'s Team</h2>
        </div>
        <div className="grid-3 mb-3">
          {[['👥', `${selected.length}/${MAX_SEL}`, 'Players'],['💰', `₹${remaining.toFixed(1)}Cr`, 'Budget Left'],['✈️', `${ovs}/${MAX_OVS}`, 'Overseas']].map(([ic,val,lbl]) => (
            <div key={lbl} className="card text-center">
              <div style={{fontSize:20}}>{ic}</div>
              <div style={{fontWeight:900,fontSize:14}}>{val}</div>
              <div className="text-muted text-xs">{lbl}</div>
            </div>
          ))}
        </div>
        <div className="card mb-3">
          <div className="text-muted text-xs font-bold mb-2" style={{letterSpacing:1,textTransform:'uppercase'}}>Team Distribution</div>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(dist).map(([t,c]) => (
              <span key={t} className="badge" style={{borderColor: teamMeta[t]?.color+'60', color: teamMeta[t]?.color}}>
                {t} <strong style={{marginLeft:4}}>{c}</strong>
              </span>
            ))}
          </div>
        </div>
        <div className="card mb-3">
          <div className="text-muted text-xs font-bold mb-2" style={{letterSpacing:1,textTransform:'uppercase'}}>Selected ({selected.length})</div>
          {selected.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2" style={{padding:'6px 0',borderTop: i?'1px solid rgba(255,255,255,0.05)':'none'}}>
              <span className="text-muted text-xs" style={{width:20,textAlign:'right'}}>{i+1}</span>
              <img src={`/images/${p.image}`} className="player-img" style={{width:32,height:32,borderRadius:8}} onError={e => e.target.style.display='none'} />
              <div className="flex-1 truncate">
                <div style={{fontWeight:600,fontSize:12}}>{p.name}</div>
                <div className="text-xs" style={{color: teamMeta[p.team_abbr]?.color}}>{p.team_abbr}</div>
              </div>
              <span className={`badge badge-${p.role.toLowerCase()}`}>{p.role}</span>
              <span style={{color:'#fbbf24',fontWeight:700,fontSize:12}}>₹{p.price}</span>
            </div>
          ))}
        </div>
        {err && <div className="alert alert-error">{err}</div>}
        <div className="flex gap-2">
          <button className="btn btn-secondary flex-1" onClick={() => setShowReview(false)}>← Edit</button>
          <button className="btn btn-primary flex-1" onClick={save} disabled={saving} style={{justifyContent:'center'}}>
            {saving ? 'Saving...' : 'Confirm Team ✓'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Sticky sub-header */}
      <div className="flex items-center gap-2 mb-3" style={{flexWrap:'wrap'}}>
        <input className="input input-sm" style={{maxWidth:220}} value={search}
          onChange={e => setSearch(e.target.value)} placeholder="Search player…" />
        <div className="flex-1" />
        <span style={{color:'#fbbf24',fontWeight:900,fontSize:14}}>₹{remaining.toFixed(1)}Cr</span>
        <span className="text-muted text-xs">{selected.length}/{MAX_SEL}</span>
      </div>

      {/* Team tabs */}
      <div className="tabs">
        {teams.map(team => {
          const cnt = selected.filter(p => p.team_abbr === team).length;
          return (
            <button key={team} className={`tab ${team === activeTeam ? 'active' : ''}`}
              onClick={() => { setActiveTeam(team); setSearch(''); }}
              style={team === activeTeam ? {} : {position:'relative'}}>
              {team}
              {cnt > 0 && <span style={{
                position:'absolute',top:-4,right:-4,width:16,height:16,borderRadius:8,
                fontSize:9,fontWeight:900,display:'flex',alignItems:'center',justifyContent:'center',
                background: teamMeta[team]?.color || '#fff', color:'#000'
              }}>{cnt}</span>}
            </button>
          );
        })}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 280px',gap:16}}>
        {/* Player grid */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div style={{width:3,height:24,borderRadius:2,background:teamMeta[activeTeam]?.color}} />
            <span style={{fontWeight:900,fontSize:14}}>{teamMeta[activeTeam]?.name}</span>
            <span className="text-muted text-xs">· {teamPlayers.length} players</span>
          </div>
          <div className="grid-4" style={{gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))'}}>
            {teamPlayers.map(player => {
              const isSel = selected.some(p => p.id === player.id);
              const violation = getViolation(selected, player, isEditMode, initialTeamIds);
              const disabled = !!violation && !isSel;
              return (
                <div key={player.id} onClick={() => !disabled && toggle(player)}
                  className="card" style={{
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.35 : 1,
                    borderColor: isSel ? teamMeta[activeTeam]?.color+'80' : undefined,
                    boxShadow: isSel ? `0 0 20px ${teamMeta[activeTeam]?.color}30` : undefined,
                    position:'relative',padding:12,textAlign:'center',transition:'all 0.15s',
                  }}>
                  <div style={{position:'absolute',top:0,left:0,right:0,height:2,borderRadius:'16px 16px 0 0',background:teamMeta[activeTeam]?.color}} />
                  {isSel && <div style={{position:'absolute',top:6,right:6,width:18,height:18,borderRadius:9,background:teamMeta[activeTeam]?.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:900,color:'#000'}}>✓</div>}
                  {player.overseas ? <span className="badge badge-ovs" style={{position:'absolute',top:6,left:6}}>OVS</span> : null}
                  <img src={`/images/${player.image}`} className="player-img" style={{width:48,height:48,margin:'8px auto 6px'}}
                    onError={e => {e.target.style.display='none'}} />
                  <div style={{fontWeight:700,fontSize:11,marginTop:4}}>{player.name}</div>
                  <div className="text-xs" style={{color:teamMeta[activeTeam]?.color,marginTop:2}}>{player.team_abbr}</div>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <span className={`badge badge-${player.role.toLowerCase()}`}>{ROLE_EMOJI[player.role]} {player.role}</span>
                    <span style={{color:'#fbbf24',fontWeight:700,fontSize:11}}>₹{player.price}Cr</span>
                  </div>
                  {player.description && <p className="text-muted" style={{fontSize:9,marginTop:6,lineHeight:1.3,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{player.description}</p>}
                  {disabled && <p style={{color:'#ef4444',fontSize:9,fontWeight:600,marginTop:4}}>⚠ {violation}</p>}
                </div>
              );
            })}
            {teamPlayers.length === 0 && <div className="text-muted text-center" style={{gridColumn:'1/-1',padding:60}}>No players match "{search}"</div>}
          </div>
        </div>

        {/* Side panel */}
        <div>
          <div className="card" style={{position:'sticky',top:80}}>
            <div style={{fontWeight:900,fontSize:14,marginBottom:12}}>📋 My Squad</div>
            <div className="mb-2">
              {isEditMode && (
                <div className="flex justify-between text-xs mb-2 pb-2" style={{borderBottom:'1px solid rgba(255,255,255,0.1)'}}>
                  <span className="text-muted">Transfers</span>
                  <span style={{color: '#f9cd1b',fontWeight:700}}>{selected.filter(p => !initialTeamIds.includes(p.id)).length} / 2 used</span>
                </div>
              )}
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted">Budget</span>
                <span style={{color: remaining < 10 ? '#ef4444' : '#34d399',fontWeight:700}}>₹{remaining.toFixed(1)}Cr left</span>
              </div>
              <div style={{height:6,borderRadius:3,background:'rgba(255,255,255,0.1)'}}>
                <div style={{height:6,borderRadius:3,transition:'width 0.3s',width:`${Math.min((spent/BUDGET)*100,100)}%`,background:remaining<15?'#ef4444':'linear-gradient(90deg,#f9cd1b,#ff8c00)'}} />
              </div>
            </div>
            <div className="grid-2 mb-2">
              <div className="card text-center" style={{padding:8}}>
                <div style={{fontWeight:900,fontSize:14}}>{selected.length}<span className="text-muted text-xs">/{MAX_SEL}</span></div>
                <div className="text-muted text-xs">Players</div>
              </div>
              <div className="card text-center" style={{padding:8}}>
                <div style={{fontWeight:900,fontSize:14,color:'#818cf8'}}>{ovs}<span className="text-muted text-xs">/{MAX_OVS}</span></div>
                <div className="text-muted text-xs">Overseas</div>
              </div>
            </div>
            {selected.length > 0 && (
              <div style={{maxHeight:240,overflowY:'auto',marginBottom:12}}>
                {selected.map(p => (
                  <div key={p.id} className="flex items-center gap-2" style={{padding:'4px 0',fontSize:10}}>
                    <div style={{width:3,height:20,borderRadius:2,background:teamMeta[p.team_abbr]?.color,flexShrink:0}} />
                    <span className="flex-1 truncate" style={{color:'rgba(255,255,255,0.7)'}}>{p.name}</span>
                    <span style={{color:'#fbbf24',fontWeight:700,flexShrink:0}}>₹{p.price}</span>
                  </div>
                ))}
              </div>
            )}
            <button className="btn btn-primary" style={{width:'100%',justifyContent:'center'}}
              disabled={selected.length !== 16} onClick={() => setShowReview(true)}>
              {selected.length === 16 ? 'Review Team 🏏' : `Need ${16-selected.length} more`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
