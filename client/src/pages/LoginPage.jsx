import { useState } from 'react';
import { api } from '../api';

export default function LoginPage({ onLogin }) {
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const go = async () => {
    const t = name.trim();
    if (!t) { setErr('Enter your username'); return; }
    if (!password.trim()) { setErr('Enter a password'); return; }

    setLoading(true);
    setErr('');
    try {
      // For login: also send password as admin_password so admin can log in directly
      // The backend checks admin_password separately, so regular users are unaffected
      const data = isSignup
        ? await api.signup(t, password, password)
        : await api.login(t, password, password);
      onLogin(data);
    } catch (e) {
      setErr(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="page" style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100vh',padding:16,position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',top:-120,left:-80,width:500,height:500,borderRadius:'50%',opacity:0.15,filter:'blur(100px)',background:'radial-gradient(#f9cd1b,transparent 70%)',pointerEvents:'none'}}/>
      <div style={{position:'absolute',bottom:-80,right:-60,width:384,height:384,borderRadius:'50%',opacity:0.1,filter:'blur(100px)',background:'radial-gradient(#ec1c24,transparent 70%)',pointerEvents:'none'}}/>

      <div style={{textAlign:'center',marginBottom:40,zIndex:1}}>
        <div style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:96,height:96,borderRadius:24,marginBottom:24,background:'linear-gradient(135deg,#f9cd1b,#ff6b35)',boxShadow:'0 8px 40px rgba(249,205,27,0.3)'}}>
          <span style={{fontSize:48}}>🏆</span>
        </div>
        <h1 style={{fontSize:48,fontWeight:900,letterSpacing:'-1px'}}>
          IPL <span style={{color:'#f9cd1b'}}>Fantasy</span>
        </h1>
        <p className="text-muted text-xs" style={{marginTop:8,letterSpacing:3,textTransform:'uppercase'}}>Friends League · 2026</p>
      </div>

      <div className="card" style={{zIndex:1,width:'100%',maxWidth:380,padding:28}}>
        <p className="text-muted text-sm text-center" style={{marginBottom:20}}>
          {isSignup ? 'Create an account to play' : 'Log in to your account'}
        </p>

        <input className="input" style={{width:'100%',marginBottom:12}} value={name}
          onChange={e => {setName(e.target.value); setErr('');}}
          placeholder="Username" />

        <input className="input" style={{width:'100%',marginBottom:12}} type="password" value={password}
          onChange={e => {setPassword(e.target.value); setErr('');}}
          onKeyDown={e => e.key === 'Enter' && go()} placeholder="Password" />

        {err && <div className="alert alert-error" style={{marginTop:0,marginBottom:12}}>⚠ {err}</div>}

        <button className="btn btn-primary" style={{width:'100%',justifyContent:'center',padding:'14px 0'}}
          onClick={go} disabled={loading}>
          {loading ? 'Loading...' : (isSignup ? 'Create Account 🚀' : 'Enter League 🚀')}
        </button>

        <p className="text-center text-muted" style={{fontSize:12,marginTop:16}}>
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <span style={{color:'#fde047',cursor:'pointer',fontWeight:700}}
            onClick={() => {setIsSignup(!isSignup); setErr('');}}>
            {isSignup ? 'Log In' : 'Sign Up'}
          </span>
        </p>
      </div>
    </div>
  );
}
