"use client";
import {useEffect,useState} from 'react';

type Theme = 'system'|'dark'|'light';

function applyTheme(theme:Theme){
  document.documentElement.dataset.theme=theme;
  document.documentElement.style.colorScheme=theme==='light'?'light':theme==='dark'?'dark':'light dark';
  try{localStorage.setItem('kotaana-theme',theme)}catch{}
}

export default function AppearanceScreen(){
  const [theme,setTheme]=useState<Theme>('system');
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    fetch('/api/profile').then(r=>r.json()).then(d=>{
      const v:Theme=d.profile?.theme==='light'||d.profile?.theme==='dark'||d.profile?.theme==='system'?d.profile.theme:'system';
      setTheme(v); applyTheme(v);
    }).catch(()=>{});
  },[]);

  const save=async(v:Theme)=>{
    setBusy(true); setTheme(v); applyTheme(v);
    try{
      const r=await fetch('/api/profile',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({theme:v})});
      if(!r.ok) throw new Error('save failed');
    }catch{}
    finally{setBusy(false)}
  };

  return <div className="stack">
    <div>
      <span className="pill orange">APPEARANCE</span>
      <h1 style={{fontSize:28,margin:'9px 0 4px'}}>Theme</h1>
      <p className="subtitle">Choose how Kotaana looks on this device.</p>
    </div>
    <div className="card">
      <div className="list">
        {(['system','dark','light'] as const).map(v=><button key={v} className={`item themeOption ${theme===v?'selected':''}`} disabled={busy} onClick={()=>save(v)} style={{color:'inherit',textAlign:'left'}}>
          <span>
            <strong>{v[0].toUpperCase()+v.slice(1)}</strong>
            <small className="small muted">{v==='light'?'Bright, clean interface':v==='dark'?'Dark interface':'Follow your device preference'}</small>
          </span>
          <span className="pill">{theme===v?'Selected':'Select'}</span>
        </button>)}
      </div>
    </div>
  </div>
}
