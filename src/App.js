import React, { useState, useMemo, useEffect } from "react";

const TASK_TYPES = [
  { id: "pitch",     label: "Pitch Design"    },
  { id: "execution", label: "Execution Design" },
  { id: "revision",  label: "Design Revisions" },
  { id: "ocular",    label: "Venue Ocular"     },
  { id: "ingress",   label: "Event Ingress"    },
];

const DIFFICULTY = [
  { id: "easy",   label: "Easy",   pts: 1, color: "#3B6D11", bg: "#EAF3DE", border: "#97C459" },
  { id: "medium", label: "Medium", pts: 2, color: "#854F0B", bg: "#FAEEDA", border: "#EF9F27" },
  { id: "hard",   label: "Hard",   pts: 3, color: "#A32D2D", bg: "#FCEBEB", border: "#F09595" },
];

const MEMBERS = ["Leo", "Shen", "Raha"];
const M_COLOR  = { Leo: "#534AB7", Shen: "#0F6E56", Raha: "#993556" };
const M_BG     = { Leo: "#EEEDFE", Shen: "#E1F5EE", Raha: "#FBEAF0" };
const M_BG2    = { Leo: "#CECBF6", Shen: "#9FE1CB", Raha: "#F4C0D1" };
const M_TEXT   = { Leo: "#534AB7", Shen: "#0F6E56", Raha: "#993556" };
const M_BORDER = { Leo: "#AFA9EC", Shen: "#5DCAA5", Raha: "#ED93B1" };
const M_ROLE   = { Leo: "3D Artist", Shen: "3D Artist", Raha: "Freelancer" };

const TODAY = new Date(2026, 2, 18);
const STORAGE_KEY = "3d-team-dashboard-state";
const DEFAULT_STATE = { tasks: {}, holidays: {}, leaves: { Leo: {}, Shen: {}, Raha: {} } };

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
const TODAY_ISO = isoDate(TODAY);

function buildWindow(off) {
  const base = new Date(2026, 2, 16);
  const start = new Date(base);
  start.setDate(base.getDate() + off * 14);
  return Array.from({length:14},(_,i)=>{ const d=new Date(start); d.setDate(start.getDate()+i); return d; });
}

function fmtDate(d) { return d.toLocaleDateString("en-US",{month:"short",day:"numeric"}); }
function dayLabel(d) { return d.toLocaleDateString("en-US",{weekday:"short"}); }
function isWeekend(d) { const w=d.getDay(); return w===0||w===6; }

function workingDaysBetween(startIso, endIso, holidays, leaveMap={}) {
  const s=new Date(startIso+"T00:00:00"), e=new Date(endIso+"T00:00:00");
  let count=0, cur=new Date(s);
  while (cur<=e) {
    const iso=isoDate(cur);
    if (!isWeekend(cur)&&!holidays[iso]&&!leaveMap[iso]) count++;
    cur.setDate(cur.getDate()+1);
  }
  return count;
}
function workingDaysFromToday(deadlineIso, holidays, leaveMap={}) {
  if (deadlineIso<TODAY_ISO) return 0;
  return workingDaysBetween(TODAY_ISO, deadlineIso, holidays, leaveMap);
}

const emptyForm = () => ({ member:"Leo", type:"pitch", difficulty:"medium", project:"", startDate:"", deadline:"" });

export default function Dashboard() {
  const [state, setState] = useState(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("saved");

  const [windowOffset, setWindowOffset] = useState(0);
  const [tab, setTab] = useState("calendar");
  const [form, setForm] = useState(emptyForm());
  const [leaveForm, setLeaveForm] = useState({ member:"Leo", date:"" });
  const [holForm, setHolForm] = useState({ date:"", label:"" });
  const [formTab, setFormTab] = useState("task");
  const [showSuggest, setShowSuggest] = useState(false);
  const [boardMember, setBoardMember] = useState("Leo");
  const [editTask, setEditTask] = useState(null);
  const [editForm, setEditForm] = useState({});

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        parsed.leaves = parsed.leaves || {};
        MEMBERS.forEach(m => { parsed.leaves[m] = parsed.leaves[m] || {}; });
        setState(parsed);
      }
    } catch (e) {}
    setLoading(false);
  }, []);

  // Save to localStorage on state change
  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        setSaveStatus("saved");
      } catch (e) {
        setSaveStatus("error");
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [state, loading]);

  const days = useMemo(()=>buildWindow(windowOffset),[windowOffset]);
  const week1=days.slice(0,7), week2=days.slice(7,14);
  const getDay = iso => state.tasks[iso]||{Leo:[],Shen:[],Raha:[]};

  const allTasks = useMemo(()=>{
    const out=[];
    Object.entries(state.tasks).forEach(([date,members])=>{
      MEMBERS.forEach(m=>(members[m]||[]).forEach(t=>out.push({...t,date,member:m})));
    });
    return out;
  },[state.tasks]);

  const weekLoad = (member, daysArr) =>
    daysArr.reduce((s,d)=>{
      const iso=isoDate(d);
      return s+((state.tasks[iso]||{})[member]||[]).filter(t=>!t.done).reduce((ss,t)=>ss+t.pts,0);
    },0);

  const deadlineMap={};
  allTasks.filter(t=>t.deadline&&!t.done).forEach(t=>{
    (deadlineMap[t.deadline]=deadlineMap[t.deadline]||[]).push(t);
  });
  const overlaps=Object.entries(deadlineMap).filter(([,a])=>a.length>1);
  const w1Loads=MEMBERS.map(m=>weekLoad(m,week1));
  const w2Loads=MEMBERS.map(m=>weekLoad(m,week2));
  const bothHeavy=(w1Loads[0]>=10&&w1Loads[1]>=10)||(w2Loads[0]>=10&&w2Loads[1]>=10);

  const mutateMember = (iso, member, fn) => setState(prev=>({
    ...prev,
    tasks:{...prev.tasks,[iso]:{...prev.tasks[iso],[member]:fn((prev.tasks[iso]||{})[member]||[])}}
  }));

  const toggleDone=(iso,member,id)=>mutateMember(iso,member,list=>list.map(t=>t.id===id?{...t,done:!t.done}:t));
  const removeTask=(iso,member,id)=>mutateMember(iso,member,list=>list.filter(t=>t.id!==id));

  const addTask=()=>{
    if(!form.project.trim()||!form.deadline)return;
    const diff=DIFFICULTY.find(d=>d.id===form.difficulty);
    const task={id:Date.now(),type:form.type,difficulty:form.difficulty,project:form.project.trim(),startDate:form.startDate,deadline:form.deadline,pts:diff.pts,done:false};
    mutateMember(form.deadline, form.member, list=>[...list,task]);
    setForm(emptyForm());
  };

  const openEdit=(iso,member,task)=>{ setEditTask({iso,member,task}); setEditForm({type:task.type,difficulty:task.difficulty,project:task.project,startDate:task.startDate||"",deadline:task.deadline}); };

  const saveEdit=()=>{
    if(!editTask||!editForm.project.trim()||!editForm.deadline)return;
    const {iso,member,task}=editTask;
    const diff=DIFFICULTY.find(d=>d.id===editForm.difficulty);
    const updated={...task,type:editForm.type,difficulty:editForm.difficulty,project:editForm.project.trim(),startDate:editForm.startDate,deadline:editForm.deadline,pts:diff.pts};
    setState(prev=>{
      const oldList=((prev.tasks[iso]||{})[member]||[]).filter(t=>t.id!==task.id);
      const newDeadline=editForm.deadline;
      const newList=[...((prev.tasks[newDeadline]||{})[member]||[]),updated];
      return {...prev,tasks:{...prev.tasks,[iso]:{...(prev.tasks[iso]||{}),[member]:oldList},[newDeadline]:{...(prev.tasks[newDeadline]||{}),[member]:newList}}};
    });
    setEditTask(null);
  };

  const addLeave=()=>{ if(!leaveForm.date)return; setState(prev=>({...prev,leaves:{...prev.leaves,[leaveForm.member]:{...prev.leaves[leaveForm.member],[leaveForm.date]:true}}})); setLeaveForm(f=>({...f,date:""})); };
  const removeLeave=(m,d)=>setState(prev=>{ const u={...prev.leaves[m]}; delete u[d]; return{...prev,leaves:{...prev.leaves,[m]:u}}; });
  const addHoliday=()=>{ if(!holForm.date||!holForm.label.trim())return; setState(prev=>({...prev,holidays:{...prev.holidays,[holForm.date]:holForm.label.trim()}})); setHolForm({date:"",label:""}); };
  const removeHoliday=d=>setState(prev=>{ const h={...prev.holidays}; delete h[d]; return{...prev,holidays:h}; });

  const isActiveTaskDay=(iso,member)=>allTasks.some(t=>{ if(t.member!==member||t.done)return false; const start=t.startDate||t.deadline; return iso>=start&&iso<=t.deadline; });

  const DoneBtn=({done,onClick,size=22})=>(
    <button onClick={onClick} title={done?"Mark active":"Mark done"} style={{flexShrink:0,width:size,height:size,borderRadius:"50%",border:`2px solid ${done?"#3B6D11":"#888780"}`,background:done?"#3B6D11":"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0,transition:"all .15s",boxShadow:done?"0 0 0 3px #C0DD97":"0 0 0 1px #D3D1C7"}}>
      {done?<span style={{color:"#fff",fontSize:size*0.55,lineHeight:1,fontWeight:700}}>✓</span>:<span style={{color:"#B4B2A9",fontSize:size*0.45,lineHeight:1}}>○</span>}
    </button>
  );

  const EditBtn=({onClick,size=14})=>(
    <button onClick={onClick} title="Edit task" style={{flexShrink:0,width:size+6,height:size+6,borderRadius:4,border:"0.5px solid #ccc",background:"#f5f5f5",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0,fontSize:size,color:"#666",lineHeight:1}}>✏</button>
  );

  const CompactCard=({t,iso,member})=>{
    const tt=TASK_TYPES.find(x=>x.id===t.type), df=DIFFICULTY.find(x=>x.id===t.difficulty);
    const wdTotal=t.startDate?workingDaysBetween(t.startDate,t.deadline,state.holidays,state.leaves[member]||{}):null;
    const wdRemain=!t.done?workingDaysFromToday(t.deadline,state.holidays,state.leaves[member]||{}):null;
    return (
      <div style={{borderRadius:6,padding:"4px 6px",background:t.done?"#f5f5f5":M_BG[member],border:`1px solid ${t.done?"#ddd":M_BORDER[member]}`,opacity:t.done?0.55:1,transition:"opacity .2s",marginBottom:2}}>
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <DoneBtn done={t.done} onClick={()=>toggleDone(iso,member,t.id)} size={16}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:9,fontWeight:700,color:M_TEXT[member],textTransform:"uppercase",letterSpacing:"0.3px"}}>{member}</div>
            <div style={{fontSize:10,color:t.done?"#888":M_TEXT[member],fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textDecoration:t.done?"line-through":"none"}}>{t.project}</div>
            <div style={{display:"flex",gap:3,marginTop:2,flexWrap:"wrap",alignItems:"center"}}>
              <span style={{fontSize:8,color:M_TEXT[member],opacity:0.75}}>{tt.label}</span>
              <span style={{fontSize:8,background:df.bg,color:df.color,border:`0.5px solid ${df.border}`,borderRadius:3,padding:"0 4px"}}>{df.label}·{t.pts}pt</span>
              {wdTotal!==null&&<span style={{fontSize:8,color:"#888"}}>{wdTotal}wd</span>}
              {wdRemain!==null&&<span style={{fontSize:8,color:wdRemain<=2?"#A32D2D":"#888",fontWeight:wdRemain<=2?600:400}}>{wdRemain}d left</span>}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:3}}>
            <EditBtn onClick={()=>openEdit(iso,member,t)} size={11}/>
            <button onClick={()=>removeTask(iso,member,t.id)} style={{fontSize:10,background:"none",border:"none",color:"#aaa",cursor:"pointer",padding:0,lineHeight:1}}>✕</button>
          </div>
        </div>
      </div>
    );
  };

  const BoardCard=({t,iso,member})=>{
    const tt=TASK_TYPES.find(x=>x.id===t.type), df=DIFFICULTY.find(x=>x.id===t.difficulty);
    const wdTotal=t.startDate?workingDaysBetween(t.startDate,t.deadline,state.holidays,state.leaves[member]||{}):null;
    const wdRemain=!t.done?workingDaysFromToday(t.deadline,state.holidays,state.leaves[member]||{}):null;
    const isPast=!t.done&&t.deadline<TODAY_ISO;
    return (
      <div style={{borderRadius:10,padding:"12px 14px",background:t.done?"#f5f5f5":M_BG[member],border:`1px solid ${t.done?"#ddd":isPast?"#F09595":M_BORDER[member]}`,borderLeft:`4px solid ${t.done?"#ddd":M_COLOR[member]}`,opacity:t.done?0.6:1,marginBottom:8,transition:"opacity .2s"}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
          <DoneBtn done={t.done} onClick={()=>toggleDone(iso,member,t.id)} size={24}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5,flexWrap:"wrap"}}>
              <span style={{fontSize:11,fontWeight:500,background:M_BG2[member],color:M_TEXT[member],border:`0.5px solid ${M_BORDER[member]}`,borderRadius:4,padding:"2px 8px"}}>{tt.label}</span>
              <span style={{fontSize:13,fontWeight:500,flex:1,textDecoration:t.done?"line-through":"none",color:t.done?"#888":"#111"}}>{t.project}</span>
              <span style={{fontSize:11,background:df.bg,color:df.color,border:`0.5px solid ${df.border}`,borderRadius:4,padding:"2px 8px"}}>{df.label}·{t.pts}pt</span>
              <EditBtn onClick={()=>openEdit(iso,member,t)} size={13}/>
              <button onClick={()=>removeTask(iso,member,t.id)} style={{fontSize:12,background:"none",border:"none",color:"#aaa",cursor:"pointer",padding:"0 2px"}}>✕</button>
            </div>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              {t.startDate&&<span style={{fontSize:11,color:"#888"}}>▶ <b style={{color:"#111"}}>{t.startDate}</b></span>}
              <span style={{fontSize:11,color:isPast?"#A32D2D":"#888",display:"flex",gap:4,alignItems:"center"}}>
                🏁 <b style={{color:isPast?"#A32D2D":"#111"}}>{t.deadline}</b>
                {isPast&&!t.done&&<span style={{fontSize:10,background:"#FCEBEB",color:"#A32D2D",borderRadius:4,padding:"1px 5px"}}>Past</span>}
              </span>
              {wdTotal!==null&&<span style={{fontSize:11,color:"#888"}}>📆 <b style={{color:"#111"}}>{wdTotal}</b> working days</span>}
              {wdRemain!==null&&<span style={{fontSize:11,color:wdRemain<=2?"#A32D2D":"#888"}}>⏳ <b style={{color:wdRemain<=2?"#A32D2D":"#111"}}>{wdRemain}</b> days left</span>}
              {t.done&&<span style={{fontSize:11,background:"#EAF3DE",color:"#3B6D11",borderRadius:6,padding:"2px 8px"}}>✓ Completed</span>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const DayCell=({day})=>{
    const iso=isoDate(day), weekend=isWeekend(day), holiday=state.holidays[iso], isToday=iso===TODAY_ISO;
    const dayTasks=getDay(iso), activeDots=MEMBERS.filter(m=>isActiveTaskDay(iso,m));
    const leoLeave=state.leaves.Leo?.[iso], shenLeave=state.leaves.Shen?.[iso], rahaLeave=state.leaves.Raha?.[iso];
    return (
      <div style={{minHeight:110,borderRadius:8,border:isToday?"2px solid #534AB7":"0.5px solid #ddd",background:weekend?"#ECEAE4":holiday?"#FDF3E0":"#fff",padding:"6px 7px",display:"flex",flexDirection:"column",gap:2}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:1}}>
          <span style={{fontSize:11,fontWeight:isToday?700:500,color:weekend?"#888780":isToday?"#534AB7":"#111"}}>{dayLabel(day)} {day.getDate()}</span>
          {isToday&&<span style={{fontSize:9,background:"#EEEDFE",color:"#534AB7",borderRadius:4,padding:"1px 5px",fontWeight:600}}>Today</span>}
          {holiday&&!isToday&&<span style={{fontSize:9,background:"#FAEEDA",color:"#854F0B",borderRadius:4,padding:"1px 5px",maxWidth:58,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{holiday}</span>}
        </div>
        {weekend
          ?<span style={{fontSize:10,color:"#888780",fontStyle:"italic"}}>No work</span>
          :<>
            {activeDots.length>0&&<div style={{display:"flex",gap:3,marginBottom:1}}>{activeDots.map(m=><span key={m} title={`${m} active`} style={{width:7,height:7,borderRadius:"50%",background:M_COLOR[m],display:"inline-block"}}/>)}</div>}
            {(leoLeave||shenLeave||rahaLeave)&&<div style={{display:"flex",gap:3,flexWrap:"wrap"}}>{leoLeave&&<span style={{fontSize:9,background:M_BG.Leo,color:M_TEXT.Leo,borderRadius:4,padding:"1px 5px"}}>Leo off</span>}{shenLeave&&<span style={{fontSize:9,background:M_BG.Shen,color:M_TEXT.Shen,borderRadius:4,padding:"1px 5px"}}>Shen off</span>}{rahaLeave&&<span style={{fontSize:9,background:M_BG.Raha,color:M_TEXT.Raha,borderRadius:4,padding:"1px 5px"}}>Raha off</span>}</div>}
            {MEMBERS.map(m=>(dayTasks[m]||[]).map(t=><CompactCard key={t.id} t={t} iso={iso} member={m}/>))}
          </>
        }
      </div>
    );
  };

  const WeekStrip=({wDays,label})=>{
    const loads=MEMBERS.map(m=>({m,load:weekLoad(m,wDays)}));
    const workdays=wDays.filter(d=>!isWeekend(d)&&!state.holidays[isoDate(d)]).length;
    return (
      <div style={{marginBottom:18}}>
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8,flexWrap:"wrap"}}>
          <span style={{fontSize:12,fontWeight:500}}>{label} · {fmtDate(wDays[0])} – {fmtDate(wDays[6])}</span>
          <span style={{fontSize:11,color:"#888"}}>{workdays} working days</span>
          {loads.map(({m,load})=>{ const over=load>=10,mod=load>=6; return <span key={m} style={{fontSize:11,borderRadius:20,padding:"2px 9px",background:over?"#FCEBEB":mod?"#FAEEDA":M_BG[m],color:over?"#A32D2D":mod?"#854F0B":M_TEXT[m]}}>{m}: {load}pt{over?" ⚠":""}</span>; })}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7, 1fr)",gap:5}}>
          {wDays.map(d=><DayCell key={isoDate(d)} day={d}/>)}
        </div>
      </div>
    );
  };

  const EditModal=()=>{
    if (!editTask) return null;
    const {member}=editTask;
    return (
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}} onClick={()=>setEditTask(null)}>
        <div style={{background:"rgba(255,255,255,0.97)",borderRadius:14,padding:"20px 22px",width:340,boxSizing:"border-box",border:`2px solid ${M_BORDER[member]}`,backdropFilter:"blur(8px)"}} onClick={e=>e.stopPropagation()}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:26,height:26,borderRadius:"50%",background:M_BG[member],display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:600,color:M_TEXT[member]}}>{member[0]}</div>
              <span style={{fontWeight:500,fontSize:14,color:"#111"}}>Edit task — {member}</span>
            </div>
            <button onClick={()=>setEditTask(null)} style={{background:"none",border:"none",fontSize:16,cursor:"pointer",color:"#888"}}>✕</button>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div><label style={{fontSize:11,color:"#555",display:"block",marginBottom:4}}>Task type</label><select value={editForm.type} onChange={e=>setEditForm(f=>({...f,type:e.target.value}))} style={{width:"100%",fontSize:13,padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}>{TASK_TYPES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
            <div><label style={{fontSize:11,color:"#555",display:"block",marginBottom:4}}>Project / event name</label><input value={editForm.project} onChange={e=>setEditForm(f=>({...f,project:e.target.value}))} style={{width:"100%",fontSize:13,boxSizing:"border-box",padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div><label style={{fontSize:11,color:"#555",display:"block",marginBottom:4}}>Start date</label><input type="date" value={editForm.startDate} onChange={e=>setEditForm(f=>({...f,startDate:e.target.value}))} style={{width:"100%",fontSize:13,boxSizing:"border-box",padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}/></div>
              <div><label style={{fontSize:11,color:"#555",display:"block",marginBottom:4}}>Deadline</label><input type="date" value={editForm.deadline} onChange={e=>setEditForm(f=>({...f,deadline:e.target.value}))} style={{width:"100%",fontSize:13,boxSizing:"border-box",padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}/></div>
            </div>
            <div>
              <label style={{fontSize:11,color:"#555",display:"block",marginBottom:6}}>Difficulty</label>
              <div style={{display:"flex",gap:6}}>
                {DIFFICULTY.map(d=><button key={d.id} onClick={()=>setEditForm(f=>({...f,difficulty:d.id}))} style={{flex:1,fontSize:12,fontWeight:500,padding:"6px 0",borderRadius:8,cursor:"pointer",background:editForm.difficulty===d.id?d.bg:"#f5f5f5",color:editForm.difficulty===d.id?d.color:"#666",border:`0.5px solid ${editForm.difficulty===d.id?d.border:"#ddd"}`}}>{d.label}<br/><span style={{fontSize:10,fontWeight:400}}>{d.pts}pt</span></button>)}
              </div>
            </div>
            <div style={{display:"flex",gap:8,marginTop:4}}>
              <button onClick={()=>setEditTask(null)} style={{flex:1,padding:"9px",fontSize:13,borderRadius:8,border:"0.5px solid #ccc",background:"#f5f5f5",color:"#555",cursor:"pointer"}}>Cancel</button>
              <button onClick={saveEdit} style={{flex:2,padding:"9px",fontSize:13,fontWeight:500,borderRadius:8,border:"none",background:M_COLOR[member],color:"#fff",cursor:"pointer"}}>Save changes</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:200,flexDirection:"column",gap:12,color:"#888"}}>
      <div style={{width:32,height:32,border:"3px solid #eee",borderTop:"3px solid #534AB7",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{fontSize:13}}>Loading dashboard...</span>
    </div>
  );

  return (
    <div style={{fontFamily:"system-ui, sans-serif",padding:"1rem",color:"#111",maxWidth:900,margin:"0 auto"}}>
      <EditModal/>

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1.25rem",flexWrap:"wrap",gap:8}}>
        <div>
          <h2 style={{margin:0,fontSize:20,fontWeight:500}}>3D Team Dashboard</h2>
          <p style={{margin:"3px 0 0",fontSize:12,color:"#888"}}>Workload and Calendar Tracker — Leo · Shen · Raha</p>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:11,color:saveStatus==="error"?"#A32D2D":saveStatus==="saving"?"#854F0B":"#3B6D11",display:"flex",alignItems:"center",gap:4}}>
            <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:saveStatus==="error"?"#E24B4A":saveStatus==="saving"?"#EF9F27":"#639922"}}/>
            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
            {saveStatus==="saving"?"Saving…":saveStatus==="error"?"Save failed":"Saved"}
          </span>
          <div style={{display:"flex",gap:6}}>
            {[["calendar","Calendar"],["board","Board"]].map(([key,lbl])=>(
              <button key={key} onClick={()=>setTab(key)} style={{fontSize:12,fontWeight:500,padding:"5px 14px",borderRadius:20,cursor:"pointer",background:tab===key?"#111":"transparent",color:tab===key?"#fff":"#888",border:`0.5px solid ${tab===key?"#111":"#ccc"}`}}>{lbl}</button>
            ))}
          </div>
        </div>
      </div>

      {bothHeavy&&(
        <div style={{background:"#FCEBEB",border:"0.5px solid #F09595",borderRadius:10,padding:"10px 16px",marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:13,fontWeight:500,color:"#A32D2D"}}>⚠ Team overloaded — consider redistributing or bringing in Raha</span>
            <button onClick={()=>setShowSuggest(s=>!s)} style={{fontSize:11,color:"#A32D2D",background:"none",border:"0.5px solid #E06060",borderRadius:6,padding:"3px 10px",cursor:"pointer"}}>{showSuggest?"Hide":"Suggestions"}</button>
          </div>
          {showSuggest&&<ul style={{margin:"8px 0 0",paddingLeft:16,fontSize:12,color:"#793030",lineHeight:2}}><li>Assign overflow pitch or revision tasks to Raha as freelance support.</li><li>Push lower-priority revisions to the following week.</li><li>Stagger venue oculars — one member per event if possible.</li></ul>}
        </div>
      )}
      {overlaps.length>0&&(
        <div style={{background:"#FBEAF0",border:"0.5px solid #ED93B1",borderRadius:10,padding:"10px 16px",marginBottom:10}}>
          <p style={{margin:"0 0 4px",fontSize:13,fontWeight:500,color:"#993556"}}>📅 Deadline overlaps detected</p>
          {overlaps.map(([date,arr])=><p key={date} style={{margin:"2px 0",fontSize:12,color:"#72243E"}}><b>{date}</b> — {arr.map(t=>`${t.member}: ${t.project}`).join(" · ")}</p>)}
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:10,marginBottom:"1.25rem"}}>
        {MEMBERS.map(m=>{
          const w1l=weekLoad(m,week1),w2l=weekLoad(m,week2);
          const over=w1l>=10||w2l>=10,mod=w1l>=6||w2l>=6;
          const badge=over?{bg:"#FCEBEB",text:"#A32D2D",label:"Heavy"}:mod?{bg:"#FAEEDA",text:"#854F0B",label:"Moderate"}:{bg:"#EAF3DE",text:"#3B6D11",label:"Light"};
          const leaveDays=Object.keys(state.leaves[m]||{}).filter(d=>{const dd=new Date(d+"T00:00:00");return dd>=days[0]&&dd<=days[13];});
          return (
            <div key={m} style={{background:"#f9f9f9",borderRadius:12,padding:"14px 16px",border:"0.5px solid #eee",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:0,left:0,width:4,height:"100%",background:M_COLOR[m],borderRadius:"12px 0 0 12px"}}/>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingLeft:6,marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:32,height:32,borderRadius:"50%",background:M_BG[m],display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:500,color:M_TEXT[m]}}>{m[0]}</div>
                  <div><div style={{fontWeight:500,fontSize:14}}>{m}</div><div style={{fontSize:10,color:"#888"}}>{M_ROLE[m]}</div></div>
                </div>
                <span style={{fontSize:10,fontWeight:500,background:badge.bg,color:badge.text,borderRadius:20,padding:"2px 8px"}}>{badge.label}</span>
              </div>
              <div style={{paddingLeft:6}}>
                <div style={{display:"flex",gap:14,marginBottom:6}}>
                  {[["Wk1",w1l],["Wk2",w2l]].map(([lbl,val])=>(
                    <div key={lbl}><div style={{fontSize:10,color:"#888"}}>{lbl}</div><div style={{fontSize:20,fontWeight:500,color:val>=10?"#A32D2D":"#111"}}>{val}<span style={{fontSize:10,color:"#888",fontWeight:400}}> pt</span></div></div>
                  ))}
                </div>
                <div style={{height:4,borderRadius:4,background:"#eee",overflow:"hidden",marginBottom:5}}>
                  <div style={{height:"100%",width:`${Math.min(100,Math.max(w1l,w2l)/12*100)}%`,background:over?"#E24B4A":mod?"#EF9F27":M_COLOR[m],borderRadius:4,transition:"width .4s"}}/>
                </div>
                {leaveDays.length>0&&<div style={{fontSize:11,color:"#854F0B"}}>🏖 {leaveDays.length} leave day{leaveDays.length>1?"s":""}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {tab==="calendar"&&(
        <div style={{marginBottom:"1.25rem"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <button onClick={()=>setWindowOffset(o=>o-1)} style={{fontSize:13,padding:"5px 14px",borderRadius:8,border:"0.5px solid #ccc",background:"transparent",color:"#111",cursor:"pointer"}}>← Prev</button>
            <span style={{fontSize:13,fontWeight:500}}>{fmtDate(days[0])} – {fmtDate(days[13])}, {days[0].getFullYear()}</span>
            <button onClick={()=>setWindowOffset(o=>o+1)} style={{fontSize:13,padding:"5px 14px",borderRadius:8,border:"0.5px solid #ccc",background:"transparent",color:"#111",cursor:"pointer"}}>Next →</button>
          </div>
          <WeekStrip wDays={week1} label="Week 1"/>
          <WeekStrip wDays={week2} label="Week 2"/>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",fontSize:11,color:"#888",marginTop:4}}>
            <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:"#ECEAE4",borderRadius:2,display:"inline-block",border:"0.5px solid #C4C2B9"}}/>Weekend</span>
            <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:"#FDF3E0",borderRadius:2,display:"inline-block"}}/>Holiday</span>
            <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,borderRadius:2,display:"inline-block",border:"2px solid #534AB7"}}/>Today</span>
            {MEMBERS.map(m=><span key={m} style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:"50%",background:M_COLOR[m],display:"inline-block"}}/>{m}</span>)}
          </div>
        </div>
      )}

      {tab==="board"&&(
        <div style={{marginBottom:"1.25rem"}}>
          <div style={{display:"flex",gap:6,marginBottom:14}}>
            {MEMBERS.map(m=><button key={m} onClick={()=>setBoardMember(m)} style={{fontSize:12,fontWeight:500,padding:"5px 16px",borderRadius:20,cursor:"pointer",background:boardMember===m?M_COLOR[m]:"transparent",color:boardMember===m?"#fff":"#888",border:`0.5px solid ${boardMember===m?M_COLOR[m]:"#ccc"}`}}>{m}</button>)}
          </div>
          {(()=>{
            const memberTasks=allTasks.filter(t=>t.member===boardMember).sort((a,b)=>a.deadline.localeCompare(b.deadline));
            const active=memberTasks.filter(t=>!t.done),done=memberTasks.filter(t=>t.done);
            if(!memberTasks.length)return <p style={{fontSize:13,color:"#888"}}>No tasks assigned to {boardMember} yet.</p>;
            return <>
              {active.length>0&&<div style={{marginBottom:16}}><p style={{fontSize:12,fontWeight:500,margin:"0 0 8px",color:"#888"}}>Active — {active.length} task{active.length!==1?"s":""}</p>{active.map(t=><BoardCard key={t.id} t={t} iso={t.date} member={boardMember}/>)}</div>}
              {done.length>0&&<div><p style={{fontSize:12,fontWeight:500,margin:"0 0 8px",color:"#3B6D11"}}>✓ Completed — {done.length} task{done.length!==1?"s":""}</p>{done.map(t=><BoardCard key={t.id} t={t} iso={t.date} member={boardMember}/>)}</div>}
            </>;
          })()}
        </div>
      )}

      <div style={{background:"#fff",border:"0.5px solid #eee",borderRadius:12,padding:"16px",marginBottom:10}}>
        <div style={{display:"flex",gap:4,marginBottom:14}}>
          {[["task","Assign Task"],["leave","Add Leave"],["holiday","Add Holiday"]].map(([key,lbl])=>(
            <button key={key} onClick={()=>setFormTab(key)} style={{fontSize:12,fontWeight:500,padding:"5px 14px",borderRadius:20,cursor:"pointer",background:formTab===key?"#111":"transparent",color:formTab===key?"#fff":"#888",border:`0.5px solid ${formTab===key?"#111":"#ccc"}`}}>{lbl}</button>
          ))}
        </div>

        {formTab==="task"&&(
          <>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <div><label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Team member</label><select value={form.member} onChange={e=>setForm(f=>({...f,member:e.target.value}))} style={{width:"100%",fontSize:13,padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}>{MEMBERS.map(m=><option key={m}>{m}</option>)}</select></div>
              <div><label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Task type</label><select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={{width:"100%",fontSize:13,padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}>{TASK_TYPES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
              <div><label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Start date (optional)</label><input type="date" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} style={{width:"100%",fontSize:13,boxSizing:"border-box",padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}/></div>
              <div><label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Deadline</label><input type="date" value={form.deadline} onChange={e=>setForm(f=>({...f,deadline:e.target.value}))} style={{width:"100%",fontSize:13,boxSizing:"border-box",padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}/></div>
              <div style={{gridColumn:"1 / -1"}}>
                <label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Difficulty & points</label>
                <div style={{display:"flex",gap:6}}>{DIFFICULTY.map(d=><button key={d.id} onClick={()=>setForm(f=>({...f,difficulty:d.id}))} style={{flex:1,fontSize:12,fontWeight:500,padding:"7px 0",borderRadius:8,cursor:"pointer",background:form.difficulty===d.id?d.bg:"#f5f5f5",color:form.difficulty===d.id?d.color:"#888",border:`0.5px solid ${form.difficulty===d.id?d.border:"#ddd"}`}}>{d.label}<br/><span style={{fontSize:10,fontWeight:400}}>{d.pts}pt{d.pts>1?"s":""}</span></button>)}</div>
              </div>
              <div style={{gridColumn:"1 / -1"}}><label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Project / event name</label><input value={form.project} onChange={e=>setForm(f=>({...f,project:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addTask()} placeholder="e.g. Ayala Museum pitch, SM North venue walk" style={{width:"100%",fontSize:13,boxSizing:"border-box",padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}/></div>
            </div>
            <button onClick={addTask} style={{width:"100%",padding:"10px",fontSize:13,fontWeight:500,background:"#111",color:"#fff",border:"none",borderRadius:8,cursor:"pointer"}}>+ Assign task</button>
          </>
        )}

        {formTab==="leave"&&(
          <>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <div><label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Member</label><select value={leaveForm.member} onChange={e=>setLeaveForm(f=>({...f,member:e.target.value}))} style={{width:"100%",fontSize:13,padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}>{MEMBERS.map(m=><option key={m}>{m}</option>)}</select></div>
              <div><label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Leave date</label><input type="date" value={leaveForm.date} onChange={e=>setLeaveForm(f=>({...f,date:e.target.value}))} style={{width:"100%",fontSize:13,boxSizing:"border-box",padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}/></div>
            </div>
            <button onClick={addLeave} style={{width:"100%",padding:"10px",fontSize:13,fontWeight:500,background:"#111",color:"#fff",border:"none",borderRadius:8,cursor:"pointer"}}>+ Mark leave day</button>
            {MEMBERS.map(m=>{ const leaveDays=Object.keys(state.leaves[m]||{}).sort(); if(!leaveDays.length)return null; return <div key={m} style={{marginTop:12}}><p style={{fontSize:12,fontWeight:500,margin:"0 0 6px"}}>{m}'s leave days</p><div style={{display:"flex",flexWrap:"wrap",gap:5}}>{leaveDays.map(d=><span key={d} style={{fontSize:11,background:M_BG[m],color:M_TEXT[m],borderRadius:6,padding:"3px 8px",display:"flex",alignItems:"center",gap:5}}>{d}<button onClick={()=>removeLeave(m,d)} style={{background:"none",border:"none",cursor:"pointer",color:M_TEXT[m],fontSize:10,padding:0}}>✕</button></span>)}</div></div>; })}
          </>
        )}

        {formTab==="holiday"&&(
          <>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <div><label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Date</label><input type="date" value={holForm.date} onChange={e=>setHolForm(f=>({...f,date:e.target.value}))} style={{width:"100%",fontSize:13,boxSizing:"border-box",padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}/></div>
              <div><label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Holiday name</label><input value={holForm.label} onChange={e=>setHolForm(f=>({...f,label:e.target.value}))} placeholder="e.g. Holy Week" style={{width:"100%",fontSize:13,boxSizing:"border-box",padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}/></div>
            </div>
            <button onClick={addHoliday} style={{width:"100%",padding:"10px",fontSize:13,fontWeight:500,background:"#111",color:"#fff",border:"none",borderRadius:8,cursor:"pointer"}}>+ Add holiday</button>
            {Object.keys(state.holidays).length>0&&<div style={{marginTop:12}}><p style={{fontSize:12,fontWeight:500,margin:"0 0 6px"}}>Marked holidays</p><div style={{display:"flex",flexWrap:"wrap",gap:5}}>{Object.entries(state.holidays).sort().map(([d,lbl])=><span key={d} style={{fontSize:11,background:"#FAEEDA",color:"#854F0B",borderRadius:6,padding:"3px 8px",display:"flex",alignItems:"center",gap:5}}>{d} · {lbl}<button onClick={()=>removeHoliday(d)} style={{background:"none",border:"none",cursor:"pointer",color:"#854F0B",fontSize:10,padding:0}}>✕</button></span>)}</div></div>}
          </>
        )}
      </div>

      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
        {TASK_TYPES.map(t=><span key={t.id} style={{fontSize:11,background:"#f5f5f5",color:"#888",border:"0.5px solid #ddd",borderRadius:20,padding:"3px 10px"}}>{t.label}</span>)}
        {MEMBERS.map(m=><span key={m} style={{fontSize:11,background:M_BG[m],color:M_TEXT[m],border:`0.5px solid ${M_BORDER[m]}`,borderRadius:20,padding:"3px 10px"}}>{m}</span>)}
      </div>
    </div>
  );
}