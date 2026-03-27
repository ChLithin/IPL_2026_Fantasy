import { useState } from 'react';

export default function Home({ user, setPage }) {
  const [showPointsModal, setShowPointsModal] = useState(false);

  const PointsModal = () => (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.85)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={() => setShowPointsModal(false)}>
      <div className="card" style={{width:'100%',maxWidth:500,maxHeight:'85vh',overflowY:'auto',background:'#0f172a',borderColor:'rgba(249,205,27,0.3)'}} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 style={{fontWeight:900,fontSize:20,color:'#fde047'}}>📊 Points System</h3>
          <button className="btn btn-sm btn-secondary" onClick={() => setShowPointsModal(false)}>✕</button>
        </div>
        
        <div className="mb-4">
          <h4 style={{fontWeight:800,fontSize:14,color:'#34d399',marginBottom:8,textTransform:'uppercase',letterSpacing:1}}>Base Points</h4>
          <div className="grid-2 gap-2 text-sm">
            <div className="flex justify-between items-center bg-gray-800 p-2 rounded" style={{background:'rgba(255,255,255,0.05)'}}>
              <span>Every Run Scored</span>
              <span style={{fontWeight:700,color:'#fde047'}}>+1 pt</span>
            </div>
            <div className="flex justify-between items-center bg-gray-800 p-2 rounded" style={{background:'rgba(255,255,255,0.05)'}}>
              <span>Every Wicket Taken</span>
              <span style={{fontWeight:700,color:'#fde047'}}>+25 pts</span>
            </div>
            <div className="flex justify-between items-center bg-gray-800 p-2 rounded" style={{background:'rgba(255,255,255,0.05)'}}>
              <span>Every Catch Taken</span>
              <span style={{fontWeight:700,color:'#fde047'}}>+8 pts</span>
            </div>
          </div>
        </div>

        <div>
          <h4 style={{fontWeight:800,fontSize:14,color:'#fbbf24',marginBottom:8,textTransform:'uppercase',letterSpacing:1}}>Role Multipliers</h4>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-3 p-2 rounded" style={{background:'rgba(249,205,27,0.1)', border:'1px solid rgba(249,205,27,0.2)'}}>
              <span className="badge" style={{background:'#fbbf24',color:'#000',fontWeight:900,fontSize:10}}>C</span>
              <div className="flex-1">
                <div style={{fontWeight:700,color:'#fde047'}}>Captain</div>
                <div className="text-xs text-muted">2x points for this match</div>
              </div>
              <span style={{fontWeight:900,fontSize:16,color:'#fbbf24'}}>2.0x</span>
            </div>
            <div className="flex items-center gap-3 p-2 rounded" style={{background:'rgba(129,140,248,0.1)', border:'1px solid rgba(129,140,248,0.2)'}}>
              <span className="badge" style={{background:'#818cf8',color:'#000',fontWeight:900,fontSize:10}}>VC</span>
              <div className="flex-1">
                <div style={{fontWeight:700,color:'#a5b4fc'}}>Vice Captain</div>
                <div className="text-xs text-muted">1.5x points for this match</div>
              </div>
              <span style={{fontWeight:900,fontSize:16,color:'#818cf8'}}>1.5x</span>
            </div>
            <div className="flex items-center gap-3 p-2 rounded" style={{background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.2)'}}>
              <span className="badge" style={{background:'#34d399',color:'#000',fontWeight:900,fontSize:10}}>IP</span>
              <div className="flex-1">
                <div style={{fontWeight:700,color:'#6ee7b7'}}>Impact Player</div>
                <div className="text-xs text-muted">Your designated substitute (1x pts)</div>
              </div>
              <span style={{fontWeight:900,fontSize:16,color:'#34d399'}}>1.0x</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const NewUserHome = () => (
    <div style={{maxWidth:700,margin:'0 auto'}}>
      <div className="card text-center mb-4" style={{border:'1px solid #f9cd1b', background:'linear-gradient(135deg, rgba(249,205,27,0.1), transparent)'}}>
        <h2 style={{fontWeight:900,fontSize:32,marginBottom:8,color:'#fde047'}}>Welcome to IPL Fantasy! 🏏</h2>
        <p className="text-muted mb-4" style={{fontSize:16}}>You need to build your dream 11 (plus an impact player) before you can join leagues and start earning points.</p>
        <button className="btn btn-primary" style={{fontSize:18,padding:'12px 32px'}} onClick={() => setPage('builder')}>
          🛠️ Create Your Team
        </button>
      </div>

      <div className="grid-2 gap-3 mb-3">
        <div className="card" style={{borderColor:'rgba(255,255,255,0.1)'}}>
          <div style={{fontSize:24,marginBottom:8}}>💰</div>
          <h3 style={{fontWeight:800,fontSize:16,marginBottom:4}}>100 Crore Purse</h3>
          <p className="text-muted text-sm">You have exactly ₹100Cr to spend on your 12-man squad. Choose your superstars wisely!</p>
        </div>
        <div className="card" style={{borderColor:'rgba(255,255,255,0.1)'}}>
          <div style={{fontSize:24,marginBottom:8}}>🏗️</div>
          <h3 style={{fontWeight:800,fontSize:16,marginBottom:4}}>Squad Rules</h3>
          <p className="text-muted text-sm">Exactly 12 players. Max 4 Overseas. Min 1 Wicket Keeper. Also max: 6 BAT, 5 AR, 6 BOWL.</p>
        </div>
        <div className="card" style={{borderColor:'rgba(255,255,255,0.1)'}}>
          <div style={{fontSize:24,marginBottom:8}}>🏆</div>
          <h3 style={{fontWeight:800,fontSize:16,marginBottom:4}}>Weekly Roles</h3>
          <p className="text-muted text-sm">Assign Captain (2x pts), Vice-Captain (1.5x pts), and Impact Player inside your team dashboard.</p>
        </div>
        <div className="card" style={{borderColor:'rgba(255,255,255,0.1)', cursor:'pointer', transition:'all 0.2s'}} onClick={() => setShowPointsModal(true)} onMouseOver={(e) => e.currentTarget.style.borderColor='rgba(249,205,27,0.5)'} onMouseOut={(e) => e.currentTarget.style.borderColor='rgba(255,255,255,0.1)'}>
          <div style={{fontSize:24,marginBottom:8}}>📊</div>
          <h3 style={{fontWeight:800,fontSize:16,marginBottom:4, color:'#fde047'}}>Points System ↗</h3>
          <p className="text-muted text-sm">Click here to see how players earn points from runs, wickets, and catches.</p>
        </div>
      </div>
    </div>
  );

  const ExistingUserHome = () => (
    <div style={{maxWidth:600,margin:'0 auto'}}>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 style={{fontWeight:900,fontSize:24}}>Welcome Back, {user.username}!</h2>
          <p className="text-muted text-sm mt-1">Ready for the next match?</p>
        </div>
        <button className="btn btn-sm btn-secondary" onClick={() => setShowPointsModal(true)} style={{borderColor:'rgba(249,205,27,0.3)', color:'#fde047'}}>
          📊 Points System
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="card text-center" style={{padding:32, cursor:'pointer', borderColor:'rgba(52,211,153,0.3)', background:'linear-gradient(135deg, rgba(52,211,153,0.05), transparent)', transition:'all 0.2s'}} 
             onClick={() => setPage('dashboard')} onMouseOver={e => e.currentTarget.style.borderColor='#34d399'} onMouseOut={e => e.currentTarget.style.borderColor='rgba(52,211,153,0.3)'}>
          <div style={{fontSize:40,marginBottom:12}}>🏏</div>
          <h3 style={{fontWeight:900,fontSize:20,color:'#6ee7b7'}}>View Your Team</h3>
          <p className="text-muted text-sm mt-2">Check player points, set C / VC / IP roles, or edit your squad</p>
        </div>

        <div className="card text-center" style={{padding:32, cursor:'pointer', borderColor:'rgba(129,140,248,0.3)', background:'linear-gradient(135deg, rgba(129,140,248,0.05), transparent)', transition:'all 0.2s'}}
             onClick={() => setPage('group')} onMouseOver={e => e.currentTarget.style.borderColor='#818cf8'} onMouseOut={e => e.currentTarget.style.borderColor='rgba(129,140,248,0.3)'}>
          <div style={{fontSize:40,marginBottom:12}}>🌍</div>
          <h3 style={{fontWeight:900,fontSize:20,color:'#a5b4fc'}}>Explore Leagues</h3>
          <p className="text-muted text-sm mt-2">See your rank on the Global Leaderboard or create/join private leagues</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {user.has_team ? <ExistingUserHome /> : <NewUserHome />}
      {showPointsModal && <PointsModal />}
    </>
  );
}
