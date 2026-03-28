import { useState } from 'react';
import { api, BASE } from '../api';

const BUDGET = 100, MAX_PLAYERS = 12, MAX_OVERSEAS = 4, MAX_PER_TEAM = 2;
const ROLE_EMOJI = { BAT: '🏏', BOWL: '⚡', AR: '🌟', WK: '🥊' };
const PENALTY_PER_TRANSFER = 25;

function getViolation(selected, player, isEditMode, initialTeamIds, freeTransfers, unlimitedActive) {
  // Transfer limit check (only in edit mode)
  const isBuy = !initialTeamIds.includes(player.id);
  if (isEditMode && isBuy && !unlimitedActive) {
    // No hard block — we allow extra transfers with penalty
    // But still show info if user has used all free transfers
  }
  if (selected.some(p => p.id === player.id)) return null;
  if (selected.length >= MAX_PLAYERS) return `Squad full (${MAX_PLAYERS} players)`;
  
  const spent = selected.reduce((s, p) => s + p.price, 0);
  if (spent + player.price > BUDGET) return `Budget exceeded (₹${BUDGET}Cr)`;
  
  if (player.overseas && selected.filter(p => p.overseas).length >= MAX_OVERSEAS) return `Max ${MAX_OVERSEAS} overseas`;
  
  // Per-team constraint: max 2 from each IPL team
  const teamCount = selected.filter(p => p.team_abbr === player.team_abbr).length;
  if (teamCount >= MAX_PER_TEAM) return `Max ${MAX_PER_TEAM} from ${player.team_abbr}`;
  
  // Role constraints
  const roles = selected.reduce((acc, p) => { acc[p.role] = (acc[p.role] || 0) + 1; return acc; }, {});
  const arCount = (roles['AR'] || 0) + (player.role === 'AR' ? 1 : 0);
  const batCount = (roles['BAT'] || 0) + (roles['WK'] || 0) + (player.role === 'BAT' || player.role === 'WK' ? 1 : 0);
  const bowlCount = (roles['BOWL'] || 0) + (player.role === 'BOWL' ? 1 : 0);
  
  if (batCount > 6 && (player.role === 'BAT' || player.role === 'WK')) return 'Max 6 Batsmen (+WK)';
  if (arCount > 5 && player.role === 'AR') return 'Max 5 All-rounders';
  if (bowlCount > 6 && player.role === 'BOWL') return 'Max 6 Bowlers';
  
  return null;
}

export default function TeamBuilder({ user, players, onSave, teamMeta }) {
  const initialTeamIds = user.team ? user.team.map(p => typeof p === 'object' ? p.id : p) : [];
  const initialTeam = initialTeamIds.map(id => (Array.isArray(players) ? players : []).find(p => p.id === id)).filter(Boolean);
  const isEditMode = initialTeam.length === MAX_PLAYERS;
  const freeTransfers = user.free_transfers ?? 2;
  const unlimitedActive = user.unlimited_transfers_active ?? false;
  
  const [selected, setSelected] = useState(initialTeam);
  const [activeTeam, setActiveTeam] = useState('CSK');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [showReview, setShowReview] = useState(false);

  const teams = Object.keys(teamMeta);
  const teamPlayers = (Array.isArray(players) ? players : []).filter(p =>
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

  // Calculate transfers in edit mode
  const transfersMade = isEditMode
    ? selected.filter(p => !initialTeamIds.includes(p.id)).length
    : 0;
  const extraTransfers = isEditMode && !unlimitedActive
    ? Math.max(0, transfersMade - freeTransfers)
    : 0;
  const penaltyCost = extraTransfers * PENALTY_PER_TRANSFER;

  const save = async () => {
    const roles = selected.reduce((acc, p) => { acc[p.role] = (acc[p.role] || 0) + 1; return acc; }, {});
    const arCount = roles['AR'] || 0;
    const batCount = (roles['BAT'] || 0) + (roles['WK'] || 0) + arCount;
    const bowlCount = (roles['BOWL'] || 0) + arCount;
    const wkCount = roles['WK'] || 0;

    if (selected.length !== MAX_PLAYERS) { setErr(`Squad must have exactly ${MAX_PLAYERS} players`); return; }
    if (wkCount < 1) { setErr("Min 1 Wicket Keeper required"); return; }
    if (batCount < 3) { setErr("Min 3 Batsmen (+WK+AR) required"); return; }
    if (arCount < 1) { setErr("Min 1 All-rounder required"); return; }
    if (bowlCount < 3) { setErr("Min 3 Bowlers (+AR) required"); return; }
    if (selected.filter(p => p.overseas).length > 4) { setErr("Max 4 Overseas allowed"); return; }
    const teamCounts = selected.reduce((acc, p) => { acc[p.team_abbr] = (acc[p.team_abbr] || 0) + 1; return acc; }, {});
    for (const [team, count] of Object.entries(teamCounts)) {
      if (count > MAX_PER_TEAM) { setErr(`Max ${MAX_PER_TEAM} players from ${team}, you have ${count}`); return; }
    }

    // Confirm penalty transfers
    if (extraTransfers > 0) {
      const confirmed = window.confirm(
        `You are making ${extraTransfers} extra transfer(s) beyond your ${freeTransfers} free transfers.\n\nThis will cost you ${penaltyCost} points (-${PENALTY_PER_TRANSFER} per extra transfer).\n\nContinue?`
      );
      if (!confirmed) return;
    }

    setSaving(true);
    setErr('');
    try {
      await api.saveTeam(user.username, selected.map(p => p.id), unlimitedActive);
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
          {[['👥', `${selected.length}/${MAX_PLAYERS}`, 'Players'],['💰', `₹${remaining.toFixed(1)}Cr`, 'Budget Left'],['✈️', `${ovs}/${MAX_OVERSEAS}`, 'Overseas']].map(([ic,val,lbl]) => (
            <div key={lbl} className="card text-center">
              <div style={{fontSize:20}}>{ic}</div>
              <div style={{fontWeight:900,fontSize:14}}>{val}</div>
              <div className="text-muted text-xs">{lbl}</div>
            </div>
          ))}
        </div>

        {/* Transfer cost summary in edit mode */}
        {isEditMode && transfersMade > 0 && (
          <div className="card mb-3" style={{borderColor: penaltyCost > 0 ? '#ef444480' : '#34d39980'}}>
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs font-bold" style={{color: penaltyCost > 0 ? '#ef4444' : '#34d399'}}>
                  {unlimitedActive ? '♾️ Unlimited Transfers Active' : `🔄 ${transfersMade} Transfer(s)`}
                </div>
                <div className="text-xs text-muted mt-1">
                  {unlimitedActive
                    ? 'No penalty — chip active this week'
                    : `${Math.min(transfersMade, freeTransfers)} free · ${extraTransfers} paid`
                  }
                </div>
              </div>
              {penaltyCost > 0 && (
                <div style={{fontWeight:900, color:'#ef4444', fontSize:16}}>
                  -{penaltyCost} pts
                </div>
              )}
            </div>
          </div>
        )}

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
              <img src={`${BASE}/images/${p.image}`} className="player-img" style={{width:32,height:32,borderRadius:8}} onError={e => e.target.style.display='none'} />
              <div className="flex-1 truncate">
                <div style={{fontWeight:600,fontSize:12}}>{p.name}</div>
                <div className="text-xs" style={{color: teamMeta[p.team_abbr]?.color}}>{p.team_abbr}</div>
              </div>
              <span className={`badge badge-${(p.role || 'BAT').toLowerCase()}`}>{p.role}</span>
              <span style={{color:'#fbbf24',fontWeight:700,fontSize:12}}>₹{p.price}</span>
            </div>
          ))}
        </div>
        {err && <div className="alert alert-error">{err}</div>}
        <div className="flex gap-2">
          <button className="btn btn-secondary flex-1" onClick={() => setShowReview(false)}>← Edit</button>
          <button className="btn btn-primary flex-1" onClick={save} disabled={saving} style={{justifyContent:'center'}}>
            {saving ? 'Saving...' : penaltyCost > 0 ? `Confirm Team (-${penaltyCost}pts) ✓` : 'Confirm Team ✓'}
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
        <span className="text-muted text-xs">{selected.length}/{MAX_PLAYERS}</span>
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
              const violation = getViolation(selected, player, isEditMode, initialTeamIds, freeTransfers, unlimitedActive);
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
                  <img src={`${BASE}/images/${player.image}`} className="player-img" style={{width:48,height:48,margin:'8px auto 6px'}}
                    onError={e => {e.target.style.display='none'}} />
                  <div style={{fontWeight:700,fontSize:11,marginTop:4}}>{player.name}</div>
                  <div className="text-xs" style={{color:teamMeta[activeTeam]?.color,marginTop:2}}>{player.team_abbr}</div>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <span className={`badge badge-${(player.role || 'BAT').toLowerCase()}`}>{ROLE_EMOJI[player.role]} {player.role}</span>
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
                <div className="mb-2 pb-2" style={{borderBottom:'1px solid rgba(255,255,255,0.1)'}}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted">Transfers</span>
                    <span style={{color: unlimitedActive ? '#c084fc' : extraTransfers > 0 ? '#ef4444' : '#34d399', fontWeight:700}}>
                      {unlimitedActive ? '♾️ Unlimited' : `${transfersMade} made`}
                    </span>
                  </div>
                  {!unlimitedActive && (
                    <>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted">Free Remaining</span>
                        <span style={{color: freeTransfers - transfersMade > 0 ? '#34d399' : '#ef4444', fontWeight:700}}>
                          {Math.max(0, freeTransfers - transfersMade)} / {freeTransfers}
                        </span>
                      </div>
                      {extraTransfers > 0 && (
                        <div className="flex justify-between text-xs" style={{color:'#ef4444'}}>
                          <span>⚠ Penalty</span>
                          <span style={{fontWeight:900}}>-{penaltyCost} pts</span>
                        </div>
                      )}
                    </>
                  )}
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
                <div style={{fontWeight:900,fontSize:14}}>{selected.length}<span className="text-muted text-xs">/{MAX_PLAYERS}</span></div>
                <div className="text-muted text-xs">Players</div>
              </div>
              <div className="card text-center" style={{padding:8}}>
                <div style={{fontWeight:900,fontSize:14,color:'#818cf8'}}>{ovs}<span className="text-muted text-xs">/{MAX_OVERSEAS}</span></div>
                <div className="text-muted text-xs">Overseas</div>
              </div>
            </div>
            
            <div className="grid-4 mb-2 gap-1 text-center text-xs">
              <div className="card" style={{padding:'4px 2px'}}>
                <div style={{fontWeight:800}}>{selected.filter(p => p.role === 'BAT').length}</div>
                <div className="text-muted" style={{fontSize:9}}>BAT</div>
              </div>
              <div className="card" style={{padding:'4px 2px'}}>
                <div style={{fontWeight:800}}>{selected.filter(p => p.role === 'BOWL').length}</div>
                <div className="text-muted" style={{fontSize:9}}>BOWL</div>
              </div>
              <div className="card" style={{padding:'4px 2px'}}>
                <div style={{fontWeight:800}}>{selected.filter(p => p.role === 'AR').length}</div>
                <div className="text-muted" style={{fontSize:9}}>AR</div>
              </div>
              <div className="card" style={{padding:'4px 2px'}}>
                <div style={{fontWeight:800}}>{selected.filter(p => p.role === 'WK').length}</div>
                <div className="text-muted" style={{fontSize:9}}>WK</div>
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
              disabled={selected.length !== MAX_PLAYERS} onClick={() => setShowReview(true)}>
              {selected.length === MAX_PLAYERS ? 'Review Team 🏏' : `Need ${MAX_PLAYERS-selected.length} more`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
