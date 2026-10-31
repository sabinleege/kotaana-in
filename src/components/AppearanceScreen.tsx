"use client";
import {useEffect,useState} from 'react';
import LanguagePicker from './LanguagePicker';
import {useT} from '@/lib/i18n/client';

type Theme = 'dark'|'light';

function applyTheme(theme:Theme){
  document.documentElement.dataset.theme=theme;
  document.documentElement.style.colorScheme=theme;
  try{localStorage.setItem('kotaana-theme',theme)}catch{}
}

export default function AppearanceScreen(){
  const t=useT();
  const [theme,setTheme]=useState<Theme>('light');
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    fetch('/api/profile').then(r=>r.json()).then(d=>{
      const v:Theme=d.profile?.theme==='dark'?'dark':'light'; // an old saved "system" choice now means Light
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
      <span className="pill orange">{t('appearance.eyebrow')}</span>
      <h1 style={{fontSize:28,margin:'9px 0 4px'}}>{t('appearance.title')}</h1>
      <p className="subtitle">{t('appearance.sub')}</p>
    </div>
    <div className="card">
      <div className="list">
        {(['light','dark'] as const).map(v=><button key={v} className={`item themeOption ${theme===v?'selected':''}`} disabled={busy} onClick={()=>save(v)} style={{color:'inherit',textAlign:'left'}}>
          <span>
            <strong>{t(v==='light'?'appearance.light':'appearance.dark')}</strong>
            <small className="small muted">{t(v==='light'?'appearance.lightSub':'appearance.darkSub')}</small>
          </span>
          <span className="pill">{theme===v?t('appearance.selected'):t('appearance.select')}</span>
        </button>)}
      </div>
    </div>
    <div className="card">
      <h2 className="sectionTitle">{t('appearance.language')}</h2>
      <p className="small muted" style={{margin:'4px 0 12px'}}>{t('appearance.languageSub')}</p>
      <LanguagePicker />
    </div>
  </div>
}
