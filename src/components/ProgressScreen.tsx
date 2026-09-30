"use client";
import {useEffect,useMemo,useState} from "react";
import ReportDataStatus from "./ReportDataStatus";
import { ProgressChart } from "./charts/ProgressCharts";

type Series={days:number;daily:{date:string;readiness:number|null;exercises:number;waterMl:number|null;waterTargetMl:number|null;distanceKm:number}[];weight:{date:string;weight:number}[];targetWeightKg:number|null;findings:string[]};

type Photo = {id:string;pose:string;date:string;imageUrl:string;weight?:number|null};
type Report = {
  status:"complete"|"partial"|"insufficient"; statusLabel:string; missing:string[];
  sevenDay:{performanceEntries:number;completedEntries:number;completionRate:number|null;trackedSessions:number;distanceKm:number;checkins:number;mealsLogged:number;workoutPlans:number};
  thirtyDay:{performanceEntries:number;completedEntries:number;trackedSessions:number;distanceKm:number;weightEntries:number;weightChangeKg:number|null;currentWeightKg:number|null;avgReadiness:number|null;avgSleepHours:number|null;checkins:number;mealsLogged:number;workoutPlans:number;progressPhotos:number};
  sources:{label:string;count:number;available:boolean}[];
  weightSeries:{date:string;weight:number}[];
  goal:string|null; targetWeightKg:number|null; generatedAt:string;
};

function Metric({label,value,detail}:{label:string;value:React.ReactNode;detail?:string}){return <div className="metricCard"><div className="metricLabel">{label}</div><div className="metricValue">{value}</div>{detail&&<div className="metricDetail">{detail}</div>}</div>}

export default function ProgressScreen(){
  const [photos,setPhotos]=useState<Photo[]>([]); const [file,setFile]=useState<File|null>(null); const [pose,setPose]=useState('front'); const [weight,setWeight]=useState(''); const [msg,setMsg]=useState(''); const [report,setReport]=useState<Report|null>(null); const [loading,setLoading]=useState(true); const [days,setDays]=useState(30); const [series,setSeries]=useState<Series|null>(null); const [seriesLoading,setSeriesLoading]=useState(true);
  const load=()=>Promise.all([fetch('/api/progress/photo').then(r=>r.json()),fetch('/api/reports/overview').then(r=>r.json())]).then(([p,r])=>{setPhotos(p.photos||[]);setReport(r.report||null)}).finally(()=>setLoading(false));
  useEffect(()=>{load()},[]);
  useEffect(()=>{setSeriesLoading(true);fetch(`/api/reports/series?days=${days}`).then(r=>r.json()).then(d=>{if(d.daily)setSeries(d)}).finally(()=>setSeriesLoading(false))},[days]);
  const weightPoints=useMemo(()=>{if(!series)return [];const m=new Map(series.weight.map(w=>[w.date,w.weight]));return series.daily.map(d=>({date:d.date,value:m.get(d.date)??null}))},[series]);
  const waterTarget=series?.daily.map(d=>d.waterTargetMl).filter((v):v is number=>v!=null).at(-1)??null;
  const upload=async()=>{if(!file){setMsg('Choose a photo.');return}if(file.size>1_400_000){setMsg('Use a photo under 1.4 MB.');return}const reader=new FileReader();reader.onload=async()=>{const r=await fetch('/api/progress/photo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pose,imageUrl:String(reader.result),weight:weight?Number(weight):null})});const d=await r.json();setMsg(r.ok?'Progress photo saved.':d.error||'Upload failed');if(r.ok){setFile(null);setWeight('');load()}};reader.readAsDataURL(file)};
  const change=report?.thirtyDay.weightChangeKg; const weightText=change==null?'—':`${change>0?'+':''}${change} kg`; const completion=report?.sevenDay.completionRate==null?'—':`${report.sevenDay.completionRate}%`;
  return <div className="stack progressPage">
    <div className="progressHero"><div><span className="pill orange">PROGRESS</span><h1>Your progress</h1><p>Only recorded activity is shown here. Kotaana does not fill missing data with estimates.</p></div><div className="progressHeroMark">↗</div></div>
    <ReportDataStatus />
    <div className="rangeRow" role="group" aria-label="Time range">{[7,30,90].map(d=><button key={d} className={`rangeBtn${days===d?" on":""}`} aria-pressed={days===d} onClick={()=>setDays(d)}>{days===d?"✓ ":""}Last {d} days</button>)}</div>
    {series&&<div className={`card reportCard${seriesLoading?" refreshing":""}`}><div className="eyebrow">{series.days}-DAY REPORT</div><h2 className="sectionTitle">Your progress in plain words</h2><ul className="findings">{series.findings.map(f=><li key={f}>{f}</li>)}</ul></div>}
    {series&&<div className={`chartGrid${seriesLoading?" refreshing":""}`}>
      <ProgressChart title="Readiness" subtitle="Daily check-in score (0–100)" kind="line" unit="/100" yMin={0} yMax={100} points={series.daily.map(d=>({date:d.date,value:d.readiness}))} empty="No check-ins yet. Answer the daily check-in to see how your readiness changes."/>
      <ProgressChart title="Workouts completed" subtitle="Exercise blocks recorded per day" kind="bar" unit="blocks" points={series.daily.map(d=>({date:d.date,value:d.exercises}))} empty="No completed exercises yet. Start a workout and record each block."/>
      <ProgressChart title="Water" subtitle="Millilitres logged per day" kind="bar" unit="ml" target={waterTarget} points={series.daily.map(d=>({date:d.date,value:d.waterMl}))} empty="No water logged yet. Tap “I drank a glass” on the Dashboard or Nutrition page."/>
      <ProgressChart title="Weight" subtitle="Recorded weight" kind="line" unit="kg" digits={1} connectGaps target={series.targetWeightKg} points={weightPoints} empty="No weight recorded in this period. Save your weight in Profile or with a progress photo."/>
      <ProgressChart title="Distance" subtitle="GPS-tracked km per day" kind="bar" unit="km" digits={2} points={series.daily.map(d=>({date:d.date,value:d.distanceKm}))} empty="No GPS activity yet. Track a run, walk or ride in Track Me."/>
    </div>}
    {loading?<div className="card">Loading recorded progress…</div>:report&&<>
      <div className="grid grid3 metricGrid"><Metric label="7-day completion" value={completion} detail="Recorded exercise entries"/><Metric label="30-day activity" value={`${report.thirtyDay.distanceKm} km`} detail={`${report.thirtyDay.trackedSessions} GPS sessions`}/><Metric label="Weight change" value={weightText} detail={report.thirtyDay.weightEntries<2?'Not enough history for a trend':'Based on recorded weight history'}/></div>
      <div className="card reportCard"><div className="row spread"><div><div className="eyebrow">30-DAY REPORT</div><h2 className="sectionTitle">What your data currently shows</h2></div><span className={`reportBadge ${report.status}`}>{report.statusLabel}</span></div><div className="grid grid2 reportColumns"><div className="reportBlock"><span>Workout performance</span><strong>{report.thirtyDay.performanceEntries}</strong><small>{report.thirtyDay.completedEntries} completed entries</small></div><div className="reportBlock"><span>Health check-ins</span><strong>{report.thirtyDay.checkins}</strong><small>{report.thirtyDay.avgReadiness==null?'No readiness data':`Avg readiness ${report.thirtyDay.avgReadiness}`}</small></div><div className="reportBlock"><span>Nutrition logs</span><strong>{report.thirtyDay.mealsLogged}</strong><small>Recorded meal days</small></div><div className="reportBlock"><span>Workout plans</span><strong>{report.thirtyDay.workoutPlans}</strong><small>Generated plans</small></div></div>{report.missing.length>0&&<div className="honestyNote"><strong>Data still missing:</strong> {report.missing.join(', ')}. No conclusion is drawn from those missing areas.</div>}</div>
      <div className="card"><div className="eyebrow">DATA SOURCES</div><h2 className="sectionTitle">What Kotaana actually has</h2><p className="subtitle" style={{marginTop:5}}>These counts are taken directly from your recorded account data for the last 30 days.</p><div className="sourceGrid">{report.sources.map(source=><div className="sourceRow" key={source.label}><span>{source.label}</span><strong>{source.count}</strong></div>)}</div></div>
    </>}
    <div className="card uploadCard"><div><div className="eyebrow">VISUAL PROGRESS</div><h2 className="sectionTitle">Add a progress photo</h2><p className="subtitle">Photos are stored as your recorded progress timeline.</p></div><div className="grid grid2" style={{marginTop:14}}><div><label className="label">Pose</label><select className="select" value={pose} onChange={e=>setPose(e.target.value)}><option>front</option><option>side</option><option>back</option></select></div><div><label className="label">Weight (optional)</label><input className="input" type="number" step="0.1" value={weight} onChange={e=>setWeight(e.target.value)}/></div></div><input style={{marginTop:12}} type="file" accept="image/jpeg,image/png" onChange={e=>setFile(e.target.files?.[0]||null)}/><button className="btn primary" style={{marginTop:12}} onClick={upload}>Save photo</button>{msg&&<p className="small muted">{msg}</p>}</div>
    <div className="card"><div className="row spread"><div><div className="eyebrow">TIMELINE</div><h2 className="sectionTitle">Progress photos</h2></div><span className="pill">{photos.length} recorded</span></div>{photos.length?<div className="photoGrid" style={{marginTop:14}}>{photos.map(p=><div key={p.id} className="photoTile"><img src={p.imageUrl} alt={`${p.pose} progress`} /><div className="photoMeta"><span>{p.pose}</span><span>{String(p.date).slice(0,10)}</span></div></div>)}</div>:<div className="empty" style={{marginTop:14}}>No progress photos recorded yet.</div>}</div>
  </div>
}
