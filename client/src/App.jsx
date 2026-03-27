import { useState, useEffect } from 'react';
import { api, BASE } from './api';
import LoginPage from './pages/LoginPage';
import TeamBuilder from './pages/TeamBuilder';
import Dashboard, { AdminDashboard } from './pages/Dashboard';
import GroupPage from './pages/GroupPage';
import AdminPanel from './pages/AdminPanel';


const TEAM_META = {
  CSK: { color: '#F9CD1B', name: 'Chennai Super Kings' },
  RCB: { color: '#EC1C24', name: 'Royal Challengers Bengaluru' },
  MI:  { color: '#004BA0', name: 'Mumbai Indians' },
  KKR: { color: '#3A177C', name: 'Kolkata Knight Riders' },
  SRH: { color: '#FF822A', name: 'Sunrisers Hyderabad' },
  DC:  { color: '#17479E', name: 'Delhi Capitals' },
  RR:  { color: '#E8206A', name: 'Rajasthan Royals' },
  LSG: { color: '#A0D8EF', name: 'Lucknow Super Giants' },
  GT:  { color: '#6DB8E8', name: 'Gujarat Titans' },
  PBKS:{ color: '#AA4545', name: 'Punjab Kings' },
};

export { TEAM_META };

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('login');
  const [players, setPlayers] = useState([]);
  

  useEffect(() => {
    api.getPlayers().then(setPlayers).catch(console.error);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    if (userData.is_admin) {
      setPage('admin');
    } else if (userData.has_team) {
      setPage('dashboard');
    } else {
      setPage('builder');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setPage('login');
  };

  const refreshUser = async () => {
    if (!user) return;
    const data = await api.getUser(user.username);
    setUser(prev => ({ ...prev, ...data }));
  };

  const refreshPlayers = async () => {
    const p = await api.getPlayers();
    setPlayers(p);
  };

  if (page === 'login') {
    return <LoginPage onLogin={handleLogin} />;
  }

  const nav = (
    <div className="header">
      <div className="header-inner">
        <div className="flex items-center gap-2" style={{cursor:'pointer'}} onClick={() => setPage(user.is_admin ? 'admin' : 'dashboard')}>
          <span style={{fontSize:24}}>🏆</span>
          <div>
            <div style={{fontWeight:900,fontSize:14}}>IPL Fantasy</div>
            <div className="text-xs text-muted">{user.username} {user.is_admin ? '(Admin)' : ''}</div>
          </div>
        </div>
        <div className="flex gap-1">
          {!user.is_admin && (
            <>
              <button className={`tab ${page==='dashboard'?'active':''}`} onClick={() => {refreshUser(); setPage('dashboard')}}>📊 Dashboard</button>
              
              <button className={`tab ${page==='group'?'active':''}`} onClick={() => setPage('group')}>👥 Group</button>
            </>
          )}
          {user.is_admin && (
            <>
              <button className={`tab ${page==='admin'?'active':''}`} onClick={() => setPage('admin')}>⚙️ Admin</button>
              <button className={`tab ${page==='dashboard'?'active':''}`} onClick={() => {refreshUser(); setPage('dashboard')}}>📊 View</button>
            </>
          )}
          <button className="tab" onClick={handleLogout}>🚪</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="page">
      {nav}
      <div className="container" style={{paddingTop:16,paddingBottom:32}}>
        {page === 'builder' && <TeamBuilder user={user} players={players} onSave={() => { refreshUser(); setPage('dashboard'); }} teamMeta={TEAM_META} />}
        {page === 'dashboard' && user.is_admin && <AdminDashboard user={user} />}
        {page === 'dashboard' && !user.is_admin && <Dashboard user={user} players={players} teamMeta={TEAM_META} onEditTeam={() => setPage('builder')} />}
                {page === 'group' && <GroupPage user={user} onUpdate={refreshUser} />}
        
        {page === 'admin' && <AdminPanel players={players} teamMeta={TEAM_META} onRefresh={refreshPlayers} />}
      </div>
    </div>
  );
}
