import { useState, useEffect } from 'react';
import { api, BASE } from '../api';

const ROLE_EMOJI = { BAT: '🏏', BOWL: '⚡', AR: '🌟', WK: '🥊' };

export default function MatchLineupPage({ user, match, players, teamMeta, onBack }) {
    const [lineup, setLineup] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]); // XI ids
    const [impactId, setImpactId] = useState(null);
    const [captainId, setCaptainId] = useState(null);
    const [vcId, setVcId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    // Filter user's base squad from all players
    const baseSquad = players?.filter(p => user.team?.includes(p.id)) || [];

    useEffect(() => {
        async function load() {
            try {
                const data = await api.getMatchLineup(user.username, match.id);
                if (data) {
                    setSelectedIds(data.player_ids || []);
                    setImpactId(data.impact_id);
                    setCaptainId(data.captain_id);
                    setVcId(data.vc_id);
                }
            } catch (e) {
                console.error(e);
            }
            setLoading(false);
        }
        load();
    }, [user.username, match.id]);

    const toggleXI = (id) => {
        if (impactId === id) setImpactId(null);
        setSelectedIds(prev => {
            if (prev.includes(id)) {
                if (captainId === id) setCaptainId(null);
                if (vcId === id) setVcId(null);
                return prev.filter(x => x !== id);
            }
            if (prev.length >= 11) return prev;
            return [...prev, id];
        });
    };

    const setImpact = (id) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(prev => prev.filter(x => x !== id));
            if (captainId === id) setCaptainId(null);
            if (vcId === id) setVcId(null);
        }
        setImpactId(id === impactId ? null : id);
    };

    const handleSave = async () => {
        if (selectedIds.length !== 11) { setErr("Select exactly 11 players for your XI"); return; }
        if (!captainId || !vcId) { setErr("Select a Captain and Vice-Captain"); return; }
        
        // Final Overseas check for safety
        const xiPlayers = players.filter(p => selectedIds.includes(p.id));
        if (xiPlayers.filter(p => p.overseas).length > 4) {
            setErr("Max 4 overseas allowed in XI");
            return;
        }

        setSaving(true);
        try {
            await api.saveMatchLineup({
                username: user.username,
                match_id: match.id,
                player_ids: selectedIds,
                impact_id: impactId,
                captain_id: captainId,
                vc_id: vcId
            });
            onBack();
        } catch (e) {
            setErr(e.message);
        }
        setSaving(false);
    };

    if (loading) return <div className="spinner" />;

    const xiPlayers = baseSquad.filter(p => selectedIds.includes(p.id));
    const overseasCount = xiPlayers.filter(p => p.overseas).length;

    return (
        <div style={{maxWidth:600, margin:'0 auto'}}>
            <div className="flex items-center justify-between mb-4">
                <button className="btn btn-sm btn-secondary" onClick={onBack}>← Back</button>
                <div style={{textAlign:'right'}}>
                    <div style={{fontWeight:900, fontSize:18}}>{match.team1} v {match.team2}</div>
                    <div className="text-xs text-muted">Lining up for {match.date}</div>
                </div>
            </div>

            <div className="card mb-3" style={{borderColor: '#f9cd1b80'}}>
                <div className="flex justify-between items-center mb-3">
                    <h3 style={{fontWeight:900, fontSize:16}}>Pick Your Lineup (11 + 1)</h3>
                    <div className="flex gap-2">
                        <span className={`badge ${selectedIds.length === 11 ? 'badge-primary' : 'badge-danger'}`}>{selectedIds.length}/11 XI</span>
                        <span className={`badge ${overseasCount <= 4 ? 'badge-primary' : 'badge-danger'}`}>{overseasCount}/4 Overseas</span>
                    </div>
                </div>

                <div className="grid-1 gap-2">
                    {baseSquad.map(p => {
                        const inXI = selectedIds.includes(p.id);
                        const isImpact = impactId === p.id;
                        const isC = captainId === p.id;
                        const isVC = vcId === p.id;
                        const tc = teamMeta[p.team_abbr]?.color || '#fff';

                        return (
                            <div key={p.id} className="card" style={{
                                padding: '8px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                border: (inXI || isImpact) ? `1px solid ${tc}80` : '1px solid rgba(255,255,255,0.05)',
                                background: inXI ? 'rgba(255,255,255,0.03)' : (isImpact ? 'rgba(249,205,27,0.05)' : 'transparent')
                            }}>
                                <img src={`${BASE}/images/${p.image}`} style={{width:40, height:40, borderRadius:8}} onError={e => e.target.style.display='none'} />
                                <div className="flex-1">
                                    <div style={{fontWeight:700, fontSize:13}}>{p.name} {p.overseas ? '✈️' : ''}</div>
                                    <div className="text-xs" style={{color:tc}}>{p.team_abbr} · {p.role}</div>
                                </div>

                                <div className="flex gap-1">
                                    <button 
                                        onClick={() => toggleXI(p.id)}
                                        className={`btn btn-xs ${inXI ? 'btn-primary' : 'btn-secondary'}`}
                                        disabled={!inXI && selectedIds.length >= 11}
                                    >
                                        {inXI ? 'XI ✓' : 'Add to XI'}
                                    </button>
                                    <button 
                                        onClick={() => setImpact(p.id)}
                                        className={`btn btn-xs ${isImpact ? 'btn-primary' : 'btn-secondary'}`}
                                        style={isImpact ? {background:'#fbbf24', color:'#000'} : {}}
                                    >
                                        {isImpact ? 'Impact ✓' : 'Impact?'}
                                    </button>
                                </div>

                                {(inXI || isImpact) && (
                                    <div className="flex gap-1 ml-2" style={{borderLeft:'1px solid rgba(255,255,255,0.1)', paddingLeft:8}}>
                                        <button 
                                            onClick={() => setCaptainId(isC ? null : p.id)}
                                            style={{
                                                width:24, height:24, borderRadius:12, fontSize:10, fontWeight:900,
                                                border:'1px solid #fbbf24', cursor:'pointer',
                                                background: isC ? '#fbbf24' : 'transparent',
                                                color: isC ? '#000' : '#fbbf24'
                                            }}
                                        >C</button>
                                        <button 
                                            onClick={() => setVcId(isVC ? null : p.id)}
                                            style={{
                                                width:24, height:24, borderRadius:12, fontSize:10, fontWeight:900,
                                                border:'1px solid #818cf8', cursor:'pointer',
                                                background: isVC ? '#818cf8' : 'transparent',
                                                color: isVC ? '#000' : '#818cf8'
                                            }}
                                        >VC</button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {err && <div className="alert alert-error mt-3">{err}</div>}
                
                <button 
                    className="btn btn-primary mt-4" 
                    style={{width:'100%', justifyContent:'center'}}
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? 'Saving Lineup...' : 'Confirm Match Lineup 🚀'}
                </button>
            </div>
        </div>
    );
}