import { useState, useEffect } from "react";
import { api } from "../api";

export default function GroupPage({ user, onUpdate }) {
  const [joinCode, setJoinCode] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  const [groupInfo, setGroupInfo] = useState(null);
  const [allGroups, setAllGroups] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user.group_id) loadLeaderboard();
    if (!user.group_id) loadAllGroups();
  }, [user.group_id]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const lb = await api.getLeaderboard(user.group_id);
      setLeaderboard(lb);
      const groups = await api.getGroups();
      const g = groups.find(g => g.code === user.group_id);
      if (g) setGroupInfo(g);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const loadAllGroups = async () => {
    try {
      setAllGroups(await api.getAllGroups());
    } catch (e) { console.error(e); }
  };

  const joinGroup = async () => {
    if (!user.has_team) { setErr("You must build your squad first!"); return; }
    if (!joinCode.trim()) { setErr("Enter a code"); return; }
    setErr(""); setMsg("");
    try {
      const res = await api.joinGroup(user.username, joinCode.trim());
      setMsg(`Joined group: ${res.name}`);
      onUpdate();
    } catch (e) { setErr(e.message); }
  };

  return (
    <div style={{maxWidth:600,margin:"0 auto"}}>
      <h2 style={{fontWeight:900,fontSize:24,marginBottom:16}}>👥 Groups</h2>

      {user.group_id && (
        <div className="card mb-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div style={{fontWeight:900,fontSize:14}}>{groupInfo?.name || "Your Group"}</div>
              <div className="text-muted text-xs">Code: <span style={{color:"#fbbf24",fontWeight:700,letterSpacing:2}}>{user.group_id}</span></div>
            </div>
            <button className="btn btn-sm btn-secondary" onClick={() => {navigator.clipboard.writeText(user.group_id); setMsg("Code copied!")}}>📋 Copy</button>
          </div>
          <div className="text-xs text-muted">Share this code with friends to join your group</div>
        </div>
      )}

      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      {!user.group_id && (
        <>
          <div className="card mb-3">
            <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Join with Code</div>
            {!user.has_team ? (
               <div className="alert alert-error" style={{padding:8,fontSize:12}}>You must craft your team before joining a group!</div>
            ) : (
                <div className="flex gap-2">
                  <input className="input flex-1" value={joinCode} onChange={e => setJoinCode(e.target.value)}
                    placeholder="Enter Private Passcode…" style={{textTransform:"uppercase",letterSpacing:2}} />
                  <button className="btn btn-primary" onClick={joinGroup}>Join</button>
                </div>
            )}
          </div>
          
          <div className="card mt-3">
            <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Active Global Groups</div>
            <div className="text-xs text-muted mb-3">These are the groups currently active. Ask an admin or creator for the passcode.</div>
            {allGroups.length === 0 && <div className="text-muted text-center" style={{padding:20}}>No groups exist yet</div>}
            <div className="flex flex-col gap-2">
              {allGroups.map(g => (
                <div key={g.code} className="card p-2 flex items-center justify-between" style={{background: "rgba(255,255,255,0.02)"}}>
                  <div>
                     <div style={{fontWeight:700}}>{g.name}</div>
                     <div className="text-muted" style={{fontSize:10}}>Creator: @{g.created_by}</div>
                  </div>
                  <span className="badge">�� Lock</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {user.group_id && (
        <div className="card mt-3">
          <div className="text-muted text-xs font-bold mb-3" style={{letterSpacing:1,textTransform:"uppercase"}}>🏅 Leaderboard</div>
          {loading && <div className="spinner" />}
          {!loading && leaderboard.length === 0 && <p className="text-muted text-center" style={{padding:40}}>No members yet</p>}
          {leaderboard.map((u,i) => (
            <div key={u.username} className="flex items-center gap-3" style={{
              padding:12,borderRadius:12,marginBottom:8,
              border: u.username===user.username ? "1px solid rgba(249,205,27,0.3)" : "1px solid rgba(255,255,255,0.05)",
              background: u.username===user.username ? "rgba(249,205,27,0.05)" : "transparent",
            }}>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
