import React, { useState, useMemo, useEffect, useRef } from "react";

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
const MEMBERS  = ["Leo", "Shen", "Raha"];
const M_COLOR  = { Leo: "#534AB7", Shen: "#0F6E56", Raha: "#993556" };
const M_BG     = { Leo: "#EEEDFE", Shen: "#E1F5EE", Raha: "#FBEAF0" };
const M_BG2    = { Leo: "#CECBF6", Shen: "#9FE1CB", Raha: "#F4C0D1" };
const M_TEXT   = { Leo: "#534AB7", Shen: "#0F6E56", Raha: "#993556" };
const M_BORDER = { Leo: "#AFA9EC", Shen: "#5DCAA5", Raha: "#ED93B1" };
const M_ROLE   = { Leo: "3D Artist", Shen: "3D Artist", Raha: "Freelancer" };
const STORAGE_KEY   = "3d-team-dashboard-state";
const EDIT_PASSWORD = "3dteam2026";
const DEFAULT_STATE = { tasks:{}, holidays:{}, leaves:{Leo:{},Shen:{},Raha:{}}, photos:{Leo:"",Shen:"",Raha:""} };

function getPHToday() {
  const ph = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  return new Date(ph.getFullYear(), ph.getMonth(), ph.getDate());
}
function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function getMondayOf(d) {
  const day = d.getDay(), mon = new Date(d);
  mon.setDate(d.getDate() - (day===0?6:day-1));
  return mon;
}
function buildWindow(off, today) {
  const base = getMondayOf(today), start = new Date(base);
  start.setDate(base.getDate() + off*14);
  return Array.from({length:14},(_,i)=>{ const d=new Date(start); d.setDate(start.getDate()+i); return d; });
}
function fmtDate(d)  { return d.toLocaleDateString("en-US",{month:"short",day:"numeric"}); }
function dayLabel(d) { return d.toLocaleDateString("en-US",{weekday:"short"}); }
function isWeekend(d){ return d.getDay()===0||d.getDay()===6; }

function workingDaysBetween(startIso, endIso, holidays, leaveMap={}) {
  const s=new Date(startIso+"T00:00:00"), e=new Date(endIso+"T00:00:00");
  let count=0, cur=new Date(s);
  while(cur<=e){ const iso=isoDate(cur); if(!isWeekend(cur)&&!holidays[iso]&&!leaveMap[iso]) count++; cur.setDate(cur.getDate()+1); }
  return count;
}
function workingDaysFromToday(deadlineIso, todayIso, holidays, leaveMap={}) {
  if(deadlineIso<todayIso) return 0;
  return workingDaysBetween(todayIso, deadlineIso, holidays, leaveMap);
}
function taskPtsInWeek(task, weekDays, holidays, leaveMap={}) {
  if(task.done) return 0;
  const start = task.startDate||task.deadline, end = task.deadline;
  const totalWd = workingDaysBetween(start, end, holidays, leaveMap);
  if(totalWd===0) return task.pts;
  const weekWd = weekDays.reduce((s,d)=>{ const iso=isoDate(d); if(isWeekend(d)||holidays[iso]||leaveMap[iso]) return s; return iso>=start&&iso<=end?s+1:s; },0);
  return Math.round((task.pts*weekWd/totalWd)*10)/10;
}
function setFavicon() {
  const c=document.createElement("canvas"); c.width=32; c.height=32;
  const ctx=c.getContext("2d");
  ctx.fillStyle="#534AB7"; ctx.beginPath(); ctx.roundRect(0,0,32,32,8); ctx.fill();
  ctx.fillStyle="#fff"; ctx.font="bold 14px system-ui"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("3D",16,17);
  const l=document.querySelector("link[rel*='icon']")||document.createElement("link");
  l.type="image/x-icon"; l.rel="shortcut icon"; l.href=c.toDataURL(); document.head.appendChild(l);
  document.title="3D Team Dashboard";
}
const emptyForm=()=>({member:"Leo",type:"pitch",difficulty:"medium",project:"",startDate:"",deadline:""});

export default function Dashboard() {
  const today     = useMemo(()=>getPHToday(),[]);
  const TODAY_ISO = useMemo(()=>isoDate(today),[today]);
  const [state, setState]             = useState(DEFAULT_STATE);
  const [loading, setLoading]         = useState(true);
  const [saveStatus, setSaveStatus]   = useState("saved");
  const [isEditMode, setIsEditMode]   = useState(false);
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwInput, setPwInput]         = useState("");
  const [pwError, setPwError]         = useState(false);
  const [windowOffset, setWindowOffset] = useState(0);
  const [tab, setTab]                   = useState("calendar");
  const [form, setForm]                 = useState(emptyForm());
  const [leaveForm, setLeaveForm]       = useState({member:"Leo",date:""});
  const [holForm, setHolForm]           = useState({date:"",label:""});
  const [formTab, setFormTab]           = useState("task");
  const [showSuggest, setShowSuggest]   = useState(false);
  const [boardMember, setBoardMember]   = useState("Leo");
  const [editTask, setEditTask]         = useState(null);
  const [editForm, setEditForm]         = useState({});
  const photoInputRefs = useRef({});
  const saveTimer = useRef(null);

  useEffect(()=>{ setFavicon(); },[]);
  useEffect(()=>{ setWindowOffset(0); },[TODAY_ISO]);

  useEffect(()=>{
    try {
      const saved=localStorage.getItem(STORAGE_KEY);
      if(saved){
        const p=JSON.parse(saved);
        p.leaves=p.leaves||{}; p.photos=p.photos||{};
        MEMBERS.forEach(m=>{ p.leaves[m]=p.leaves[m]||{}; p.photos[m]=p.photos[m]||""; });
        setState(p);
      }
    } catch(e){}
    setLoading(false);
  },[]);

  useEffect(()=>{
    if(loading) return;
    if(saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>{
      try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); setSaveStatus("saved"); }
      catch(e){ setSaveStatus("error"); }
    },600);
  },[state,loading]);

  const updateState=ns=>{ setState(ns); };
  const handleUnlock=()=>{ if(pwInput===EDIT_PASSWORD){setIsEditMode(true);setShowPwModal(false);setPwInput("");setPwError(false);}else{setPwError(true);setPwInput("");} };
  const handlePhotoUpload=(member,file)=>{ if(!file)return; const r=new FileReader(); r.onload=e=>updateState({...state,photos:{...state.photos,[member]:e.target.result}}); r.readAsDataURL(file); };
  const removePhoto=m=>updateState({...state,photos:{...state.photos,[m]:""}});

  const days  = useMemo(()=>buildWindow(windowOffset,today),[windowOffset,today]);
  const week1 = days.slice(0,7), week2=days.slice(7,14);
  const getDay= iso=>(state.tasks||{})[iso]||{Leo:[],Shen:[],Raha:[]};

  const allTasks=useMemo(()=>{
    const out=[];
    Object.entries(state.tasks||{}).forEach(([date,members])=>{
      MEMBERS.forEach(m=>((members||{})[m]||[]).forEach(t=>out.push({...t,date,member:m})));
    });
    return out;
  },[state]);

  const weekLoad=(member,daysArr)=>{
    const mt=allTasks.filter(t=>t.member===member&&!t.done);
    return Math.round(mt.reduce((s,t)=>s+taskPtsInWeek(t,daysArr,state.holidays||{},(state.leaves||{})[member]||{}),0)*10)/10;
  };

  const deadlineMap={};
  allTasks.filter(t=>t.deadline&&!t.done).forEach(t=>{ (deadlineMap[t.deadline]=deadlineMap[t.deadline]||[]).push(t); });
  const overlaps=Object.entries(deadlineMap).filter(([,a])=>a.length>1);
  const w1Loads=MEMBERS.map(m=>weekLoad(m,week1)), w2Loads=MEMBERS.map(m=>weekLoad(m,week2));
  const bothHeavy=(w1Loads[0]>=10&&w1Loads[1]>=10)||(w2Loads[0]>=10&&w2Loads[1]>=10);

  const mutateMember=(iso,member,fn)=>{ const ns={...state,tasks:{...state.tasks,[iso]:{...(state.tasks||{})[iso],[member]:fn(((state.tasks||{})[iso]||{})[member]||[])}}}; updateState(ns); };
  const toggleDone =(iso,member,id)=>mutateMember(iso,member,list=>list.map(t=>t.id===id?{...t,done:!t.done}:t));
  const removeTask =(iso,member,id)=>mutateMember(iso,member,list=>list.filter(t=>t.id!==id));

  const addTask=()=>{
    if(!isEditMode||!form.project.trim()||!form.deadline)return;
    const diff=DIFFICULTY.find(d=>d.id===form.difficulty);
    const task={id:Date.now(),type:form.type,difficulty:form.difficulty,project:form.project.trim(),startDate:form.startDate,deadline:form.deadline,pts:diff.pts,done:false};
    const iso=form.deadline;
    const ns={...state,tasks:{...state.tasks,[iso]:{...(state.tasks||{})[iso],[form.member]:[...((state.tasks||{})[iso]?.[form.member]||[]),task]}}};
    updateState(ns); setForm(emptyForm());
  };

  const openEdit=(iso,member,task)=>{ if(!isEditMode)return; setEditTask({iso,member,task}); setEditForm({type:task.type,difficulty:task.difficulty,project:task.project,startDate:task.startDate||"",deadline:task.deadline}); };
  const saveEdit=()=>{
    if(!editTask||!editForm.project.trim()||!editForm.deadline)return;
    const {iso,member,task}=editTask;
    const diff=DIFFICULTY.find(d=>d.id===editForm.difficulty);
    const updated={...task,type:editForm.type,difficulty:editForm.difficulty,project:editForm.project.trim(),startDate:editForm.startDate,deadline:editForm.deadline,pts:diff.pts};
    const oldList=((state.tasks[iso]||{})[member]||[]).filter(t=>t.id!==task.id);
    const nd=editForm.deadline;
    const newList=[...((state.tasks[nd]||{})[member]||[]),updated];
    updateState({...state,tasks:{...state.tasks,[iso]:{...(state.tasks[iso]||{}),[member]:oldList},[nd]:{...(state.tasks[nd]||{}),[member]:newList}}});
    setEditTask(null);
  };

  const addLeave=()=>{ if(!isEditMode||!leaveForm.date)return; updateState({...state,leaves:{...state.leaves,[leaveForm.member]:{...state.leaves[leaveForm.member],[leaveForm.date]:true}}}); setLeaveForm(f=>({...f,date:""})); };
  const removeLeave=(m,d)=>{ if(!isEditMode)return; const u={...state.leaves[m]}; delete u[d]; updateState({...state,leaves:{...state.leaves,[m]:u}}); };
  const addHoliday=()=>{ if(!isEditMode||!holForm.date||!holForm.label.trim())return; updateState({...state,holidays:{...state.holidays,[holForm.date]:holForm.label.trim()}}); setHolForm({date:"",label:""}); };
  const removeHoliday=d=>{ if(!isEditMode)return; const h={...state.holidays}; delete h[d]; updateState({...state,holidays:h}); };
  const isActiveTaskDay=(iso,member)=>allTasks.some(t=>{ if(t.member!==member||t.done)return false; const s=t.startDate||t.deadline; return iso>=s&&iso<=t.deadline; });

  const Avatar=({member,size=36,showUpload=false})=>{
    const photo=(state.photos||{})[member];
    return(
      <div style={{position:"relative",flexShrink:0}}>
        <div style={{width:size,height:size,borderRadius:"50%",background:M_BG[member],border:`2px solid ${M_BORDER[member]}`,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.38,fontWeight:600,color:M_TEXT[member],cursor:showUpload&&isEditMode?"pointer":"default"}} onClick={()=>showUpload&&isEditMode&&photoInputRefs.current[member]?.click()}>
          {photo?<img src={photo} alt={member} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:member[0]}
        </div>
        {showUpload&&isEditMode&&<><div style={{position:"absolute",bottom:-2,right:-2,width:16,height:16,borderRadius:"50%",background:"#534AB7",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",border:"1.5px solid #fff",fontSize:9,color:"#fff"}} onClick={()=>photoInputRefs.current[member]?.click()}>✏</div><input ref={el=>photoInputRefs.current[member]=el} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handlePhotoUpload(member,e.target.files[0])}/></>}
      </div>
    );
  };

  const DoneBtn=({done,onClick,size=22})=>(
    <button onClick={isEditMode?onClick:undefined} style={{flexShrink:0,width:size,height:size,borderRadius:"50%",border:`2px solid ${done?"#3B6D11":isEditMode?"#888780":"#ddd"}`,background:done?"#3B6D11":isEditMode?"#fff":"#f5f5f5",cursor:isEditMode?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",padding:0,transition:"all .15s",boxShadow:done?"0 0 0 3px #C0DD97":"0 0 0 1px #D3D1C7"}}>
      {done?<span style={{color:"#fff",fontSize:size*0.55,lineHeight:1,fontWeight:700}}>✓</span>:<span style={{color:"#B4B2A9",fontSize:size*0.45,lineHeight:1}}>○</span>}
    </button>
  );
  const EditBtn=({onClick})=>{ if(!isEditMode)return null; return <button onClick={onClick} style={{flexShrink:0,width:20,height:20,borderRadius:4,border:"0.5px solid #ccc",background:"#f5f5f5",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0,fontSize:11,color:"#666"}}>✏</button>; };

  const CompactCard=({t,iso,member})=>{
    const tt=TASK_TYPES.find(x=>x.id===t.type),df=DIFFICULTY.find(x=>x.id===t.difficulty);
    const wdT=t.startDate?workingDaysBetween(t.startDate,t.deadline,state.holidays||{},(state.leaves||{})[member]||{}):null;
    const wdR=!t.done?workingDaysFromToday(t.deadline,TODAY_ISO,state.holidays||{},(state.leaves||{})[member]||{}):null;
    return(
      <div style={{borderRadius:6,padding:"4px 6px",background:t.done?"#f5f5f5":M_BG[member],border:`1px solid ${t.done?"#ddd":M_BORDER[member]}`,opacity:t.done?0.55:1,marginBottom:2}}>
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <DoneBtn done={t.done} onClick={()=>toggleDone(iso,member,t.id)} size={16}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:9,fontWeight:700,color:M_TEXT[member],textTransform:"uppercase",letterSpacing:"0.3px"}}>{member}</div>
            <div style={{fontSize:10,color:t.done?"#888":M_TEXT[member],fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textDecoration:t.done?"line-through":"none"}}>{t.project}</div>
            <div style={{display:"flex",gap:3,marginTop:2,flexWrap:"wrap",alignItems:"center"}}>
              <span style={{fontSize:8,color:M_TEXT[member],opacity:0.75}}>{tt?.label}</span>
              <span style={{fontSize:8,background:df?.bg,color:df?.color,border:`0.5px solid ${df?.border}`,borderRadius:3,padding:"0 4px"}}>{df?.label}·{t.pts}pt</span>
              {wdT!==null&&<span style={{fontSize:8,color:"#888"}}>{wdT}wd</span>}
              {wdR!==null&&<span style={{fontSize:8,color:wdR<=2?"#A32D2D":"#888",fontWeight:wdR<=2?600:400}}>{wdR}d left</span>}
            </div>
          </div>
          {isEditMode&&<div style={{display:"flex",flexDirection:"column",gap:3}}><EditBtn onClick={()=>openEdit(iso,member,t)}/><button onClick={()=>removeTask(iso,member,t.id)} style={{fontSize:10,background:"none",border:"none",color:"#aaa",cursor:"pointer",padding:0,lineHeight:1}}>✕</button></div>}
        </div>
      </div>
    );
  };

  const BoardCard=({t,iso,member})=>{
    const tt=TASK_TYPES.find(x=>x.id===t.type),df=DIFFICULTY.find(x=>x.id===t.difficulty);
    const wdT=t.startDate?workingDaysBetween(t.startDate,t.deadline,state.holidays||{},(state.leaves||{})[member]||{}):null;
    const wdR=!t.done?workingDaysFromToday(t.deadline,TODAY_ISO,state.holidays||{},(state.leaves||{})[member]||{}):null;
    const isPast=!t.done&&t.deadline<TODAY_ISO;
    return(
      <div style={{borderRadius:10,padding:"12px 14px",background:t.done?"#f5f5f5":M_BG[member],border:`1px solid ${t.done?"#ddd":isPast?"#F09595":M_BORDER[member]}`,borderLeft:`4px solid ${t.done?"#ddd":M_COLOR[member]}`,opacity:t.done?0.6:1,marginBottom:8}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
          <DoneBtn done={t.done} onClick={()=>toggleDone(iso,member,t.id)} size={24}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5,flexWrap:"wrap"}}>
              <span style={{fontSize:11,fontWeight:500,background:M_BG2[member],color:M_TEXT[member],border:`0.5px solid ${M_BORDER[member]}`,borderRadius:4,padding:"2px 8px"}}>{tt?.label}</span>
              <span style={{fontSize:13,fontWeight:500,flex:1,textDecoration:t.done?"line-through":"none",color:t.done?"#888":"#111"}}>{t.project}</span>
              <span style={{fontSize:11,background:df?.bg,color:df?.color,border:`0.5px solid ${df?.border}`,borderRadius:4,padding:"2px 8px"}}>{df?.label}·{t.pts}pt</span>
              {isEditMode&&<><EditBtn onClick={()=>openEdit(iso,member,t)}/><button onClick={()=>removeTask(iso,member,t.id)} style={{fontSize:12,background:"none",border:"none",color:"#aaa",cursor:"pointer",padding:"0 2px"}}>✕</button></>}
            </div>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              {t.startDate&&<span style={{fontSize:11,color:"#888"}}>▶ <b style={{color:"#111"}}>{t.startDate}</b></span>}
              <span style={{fontSize:11,color:isPast?"#A32D2D":"#888",display:"flex",gap:4,alignItems:"center"}}>🏁 <b style={{color:isPast?"#A32D2D":"#111"}}>{t.deadline}</b>{isPast&&!t.done&&<span style={{fontSize:10,background:"#FCEBEB",color:"#A32D2D",borderRadius:4,padding:"1px 5px"}}>Past</span>}</span>
              {wdT!==null&&<span style={{fontSize:11,color:"#888"}}>📆 <b style={{color:"#111"}}>{wdT}</b> working days</span>}
              {wdR!==null&&<span style={{fontSize:11,color:wdR<=2?"#A32D2D":"#888"}}>⏳ <b style={{color:wdR<=2?"#A32D2D":"#111"}}>{wdR}</b> days left</span>}
              {t.done&&<span style={{fontSize:11,background:"#EAF3DE",color:"#3B6D11",borderRadius:6,padding:"2px 8px"}}>✓ Completed</span>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const DayCell=({day})=>{
    const iso=isoDate(day),weekend=isWeekend(day),holiday=(state.holidays||{})[iso],isToday=iso===TODAY_ISO;
    const dayTasks=getDay(iso),activeDots=MEMBERS.filter(m=>isActiveTaskDay(iso,m));
    const lL=(state.leaves||{}).Leo?.[iso],sL=(state.leaves||{}).Shen?.[iso],rL=(state.leaves||{}).Raha?.[iso];
    return(
      <div style={{minHeight:110,borderRadius:8,border:isToday?"2px solid #534AB7":"0.5px solid #ddd",background:weekend?"#ECEAE4":holiday?"#FDF3E0":"#fff",padding:"6px 7px",display:"flex",flexDirection:"column",gap:2}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:1}}>
          <span style={{fontSize:11,fontWeight:isToday?700:500,color:weekend?"#888780":isToday?"#534AB7":"#111"}}>{dayLabel(day)} {day.getDate()}</span>
          {isToday&&<span style={{fontSize:9,background:"#EEEDFE",color:"#534AB7",borderRadius:4,padding:"1px 5px",fontWeight:600}}>Today</span>}
          {holiday&&!isToday&&<span style={{fontSize:9,background:"#FAEEDA",color:"#854F0B",borderRadius:4,padding:"1px 5px",maxWidth:58,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{holiday}</span>}
        </div>
        {weekend?<span style={{fontSize:10,color:"#888780",fontStyle:"italic"}}>No work</span>
          :<>
            {activeDots.length>0&&<div style={{display:"flex",gap:3,marginBottom:1}}>{activeDots.map(m=><span key={m} style={{width:7,height:7,borderRadius:"50%",background:M_COLOR[m],display:"inline-block"}}/>)}</div>}
            {(lL||sL||rL)&&<div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
              {lL&&<span style={{fontSize:9,background:M_BG.Leo,color:M_TEXT.Leo,borderRadius:4,padding:"1px 5px"}}>Leo off{isEditMode&&<button onClick={()=>removeLeave("Leo",iso)} style={{marginLeft:3,background:"none",border:"none",cursor:"pointer",color:M_TEXT.Leo,fontSize:9,padding:0}}>✕</button>}</span>}
              {sL&&<span style={{fontSize:9,background:M_BG.Shen,color:M_TEXT.Shen,borderRadius:4,padding:"1px 5px"}}>Shen off{isEditMode&&<button onClick={()=>removeLeave("Shen",iso)} style={{marginLeft:3,background:"none",border:"none",cursor:"pointer",color:M_TEXT.Shen,fontSize:9,padding:0}}>✕</button>}</span>}
              {rL&&<span style={{fontSize:9,background:M_BG.Raha,color:M_TEXT.Raha,borderRadius:4,padding:"1px 5px"}}>Raha off{isEditMode&&<button onClick={()=>removeLeave("Raha",iso)} style={{marginLeft:3,background:"none",border:"none",cursor:"pointer",color:M_TEXT.Raha,fontSize:9,padding:0}}>✕</button>}</span>}
            </div>}
            {MEMBERS.map(m=>(dayTasks[m]||[]).map(t=><CompactCard key={t.id} t={t} iso={iso} member={m}/>))}
          </>
        }
      </div>
    );
  };

  const WeekStrip=({wDays,label})=>{
    const loads=MEMBERS.map(m=>({m,load:weekLoad(m,wDays)}));
    const workdays=wDays.filter(d=>!isWeekend(d)&&!(state.holidays||{})[isoDate(d)]).length;
    return(
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
    if(!editTask)return null;
    const {member}=editTask;
    return(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}} onClick={()=>setEditTask(null)}>
        <div style={{background:"rgba(255,255,255,0.97)",borderRadius:14,padding:"20px 22px",width:340,boxSizing:"border-box",border:`2px solid ${M_BORDER[member]}`,backdropFilter:"blur(8px)"}} onClick={e=>e.stopPropagation()}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}><Avatar member={member} size={26}/><span style={{fontWeight:500,fontSize:14,color:"#111"}}>Edit task — {member}</span></div>
            <button onClick={()=>setEditTask(null)} style={{background:"none",border:"none",fontSize:16,cursor:"pointer",color:"#888"}}>✕</button>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div><label style={{fontSize:11,color:"#555",display:"block",marginBottom:4}}>Task type</label><select value={editForm.type} onChange={e=>setEditForm(f=>({...f,type:e.target.value}))} style={{width:"100%",fontSize:13,padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}>{TASK_TYPES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
            <div><label style={{fontSize:11,color:"#555",display:"block",marginBottom:4}}>Project / event name</label><input value={editForm.project} onChange={e=>setEditForm(f=>({...f,project:e.target.value}))} style={{width:"100%",fontSize:13,boxSizing:"border-box",padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div><label style={{fontSize:11,color:"#555",display:"block",marginBottom:4}}>Start date</label><input type="date" value={editForm.startDate} onChange={e=>setEditForm(f=>({...f,startDate:e.target.value}))} style={{width:"100%",fontSize:13,boxSizing:"border-box",padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}/></div>
              <div><label style={{fontSize:11,color:"#555",display:"block",marginBottom:4}}>Deadline</label><input type="date" value={editForm.deadline} onChange={e=>setEditForm(f=>({...f,deadline:e.target.value}))} style={{width:"100%",fontSize:13,boxSizing:"border-box",padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}/></div>
            </div>
            <div><label style={{fontSize:11,color:"#555",display:"block",marginBottom:6}}>Difficulty</label>
              <div style={{display:"flex",gap:6}}>{DIFFICULTY.map(d=><button key={d.id} onClick={()=>setEditForm(f=>({...f,difficulty:d.id}))} style={{flex:1,fontSize:12,fontWeight:500,padding:"6px 0",borderRadius:8,cursor:"pointer",background:editForm.difficulty===d.id?d.bg:"#f5f5f5",color:editForm.difficulty===d.id?d.color:"#666",border:`0.5px solid ${editForm.difficulty===d.id?d.border:"#ddd"}`}}>{d.label}<br/><span style={{fontSize:10,fontWeight:400}}>{d.pts}pt</span></button>)}</div>
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

  const PasswordModal=()=>(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}} onClick={()=>{setShowPwModal(false);setPwInput("");setPwError(false);}}>
      <div style={{background:"rgba(255,255,255,0.97)",borderRadius:14,padding:"24px",width:300,boxSizing:"border-box",border:"2px solid #AFA9EC",backdropFilter:"blur(8px)"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <span style={{fontWeight:500,fontSize:15,color:"#111"}}>🔒 Editor access</span>
          <button onClick={()=>{setShowPwModal(false);setPwInput("");setPwError(false);}} style={{background:"none",border:"none",fontSize:16,cursor:"pointer",color:"#888"}}>✕</button>
        </div>
        <p style={{fontSize:12,color:"#888",margin:"0 0 14px"}}>Enter the password to enable editing.</p>
        <input type="password" value={pwInput} onChange={e=>{setPwInput(e.target.value);setPwError(false);}} onKeyDown={e=>e.key==="Enter"&&handleUnlock()} placeholder="Enter password" autoFocus style={{width:"100%",fontSize:14,padding:"8px 12px",borderRadius:8,border:`1.5px solid ${pwError?"#F09595":"#ccc"}`,boxSizing:"border-box",marginBottom:6,outline:"none"}}/>
        {pwError&&<p style={{fontSize:11,color:"#A32D2D",margin:"0 0 10px"}}>Incorrect password. Try again.</p>}
        <button onClick={handleUnlock} style={{width:"100%",padding:"10px",fontSize:13,fontWeight:500,background:"#534AB7",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",marginTop:pwError?0:8}}>Unlock editing</button>
      </div>
    </div>
  );

  if(loading)return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:200,flexDirection:"column",gap:12,color:"#888"}}>
      <div style={{width:32,height:32,border:"3px solid #eee",borderTop:"3px solid #534AB7",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{fontSize:13}}>Loading dashboard...</span>
    </div>
  );

  return(
    <div style={{fontFamily:"system-ui,sans-serif",color:"#111",maxWidth:960,margin:"0 auto"}}>
      {showPwModal&&<PasswordModal/>}
      <EditModal/>

      <div style={{background:"linear-gradient(135deg,#1a1040 0%,#2d1b69 50%,#1a3a2a 100%)",borderRadius:"0 0 20px 20px",padding:"24px 24px 0"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
          <div>
            <h2 style={{margin:0,fontSize:22,fontWeight:600,color:"#fff"}}>3D Team Dashboard</h2>
            <p style={{margin:"4px 0 0",fontSize:12,color:"rgba(255,255,255,0.55)"}}>Workload and Calendar Tracker · Philippines Time</p>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:11,color:saveStatus==="error"?"#F09595":saveStatus==="saving"?"#FAC775":"rgba(255,255,255,0.4)",display:"flex",alignItems:"center",gap:4}}>
              <span style={{display:"inline-block",width:7,height:7,borderRadius:"50%",background:saveStatus==="error"?"#E24B4A":saveStatus==="saving"?"#EF9F27":"#639922"}}/>
              {saveStatus==="saving"?"Saving…":saveStatus==="error"?"Save failed":"Saved"}
            </span>
            {isEditMode
              ?<button onClick={()=>setIsEditMode(false)} style={{fontSize:12,fontWeight:500,padding:"6px 14px",borderRadius:20,cursor:"pointer",background:"rgba(159,225,203,0.2)",color:"#9FE1CB",border:"1px solid rgba(159,225,203,0.4)"}}>✓ Editing — Lock</button>
              :<button onClick={()=>setShowPwModal(true)} style={{fontSize:12,fontWeight:500,padding:"6px 14px",borderRadius:20,cursor:"pointer",background:"rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.7)",border:"1px solid rgba(255,255,255,0.2)"}}>🔒 View only</button>
            }
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
          {MEMBERS.map(m=>{
            const w1l=weekLoad(m,week1),w2l=weekLoad(m,week2);
            const over=w1l>=10||w2l>=10,mod=w1l>=6||w2l>=6;
            const badge=over?{bg:"rgba(242,74,74,0.2)",text:"#F09595",label:"Heavy"}:mod?{bg:"rgba(239,159,39,0.2)",text:"#FAC775",label:"Moderate"}:{bg:"rgba(99,153,34,0.2)",text:"#9FE1CB",label:"Light"};
            const leaveDays=Object.keys((state.leaves||{})[m]||{}).filter(d=>{ const dd=new Date(d+"T00:00:00"); return dd>=days[0]&&dd<=days[13]; });
            return(
              <div key={m} style={{background:"rgba(255,255,255,0.08)",borderRadius:"14px 14px 0 0",padding:"16px",border:"1px solid rgba(255,255,255,0.12)",borderBottom:"none"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                  <Avatar member={m} size={42} showUpload={true}/>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:15,color:"#fff"}}>{m}</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,0.5)"}}>{M_ROLE[m]}</div>
                  </div>
                  <span style={{fontSize:10,fontWeight:500,background:badge.bg,color:badge.text,borderRadius:20,padding:"3px 9px",border:`1px solid ${badge.text}33`}}>{badge.label}</span>
                </div>
                <div style={{display:"flex",gap:16,marginBottom:8}}>
                  {[["Wk1",w1l],["Wk2",w2l]].map(([lbl,val])=>(
                    <div key={lbl}><div style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>{lbl}</div>
                    <div style={{fontSize:22,fontWeight:600,color:val>=10?"#F09595":"#fff",lineHeight:1}}>{val}<span style={{fontSize:11,color:"rgba(255,255,255,0.4)",fontWeight:400}}> pt</span></div></div>
                  ))}
                </div>
                <div style={{height:4,borderRadius:4,background:"rgba(255,255,255,0.1)",overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${Math.min(100,Math.max(w1l,w2l)/12*100)}%`,background:over?"#E24B4A":mod?"#EF9F27":M_COLOR[m],borderRadius:4,transition:"width .4s"}}/>
                </div>
                {leaveDays.length>0&&<div style={{marginTop:6,fontSize:10,color:"#FAC775"}}>🏖 {leaveDays.length} leave day{leaveDays.length>1?"s":""}</div>}
                {isEditMode&&(state.photos||{})[m]&&<button onClick={()=>removePhoto(m)} style={{marginTop:6,fontSize:10,background:"rgba(255,255,255,0.1)",border:"none",borderRadius:4,color:"rgba(255,255,255,0.5)",cursor:"pointer",padding:"2px 6px"}}>Remove photo</button>}
              </div>
            );
          })}
        </div>
        <div style={{display:"flex",gap:0,paddingTop:4}}>
          {[["calendar","📅 Calendar"],["board","📋 Board"]].map(([key,lbl])=>(
            <button key={key} onClick={()=>setTab(key)} style={{flex:1,fontSize:13,fontWeight:tab===key?600:400,padding:"12px 0",cursor:"pointer",background:tab===key?"#fff":"transparent",color:tab===key?"#111":"rgba(255,255,255,0.55)",border:"none",borderRadius:tab===key?"10px 10px 0 0":"0",transition:"all .2s"}}>{lbl}</button>
          ))}
        </div>
      </div>

      <div style={{background:"#fff",borderRadius:"0 0 16px 16px",padding:"20px",border:"1px solid #eee",borderTop:"none",marginBottom:16}}>
        {!isEditMode&&<div style={{background:"#f9f9f9",border:"0.5px solid #eee",borderRadius:8,padding:"8px 14px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}><span style={{fontSize:12,color:"#888"}}>👁 View only — tasks and calendar are read-only.</span><button onClick={()=>setShowPwModal(true)} style={{fontSize:11,color:"#534AB7",background:"none",border:"0.5px solid #AFA9EC",borderRadius:6,padding:"3px 10px",cursor:"pointer"}}>Unlock editing</button></div>}
        {bothHeavy&&<div style={{background:"#FCEBEB",border:"0.5px solid #F09595",borderRadius:10,padding:"10px 16px",marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:13,fontWeight:500,color:"#A32D2D"}}>⚠ Team overloaded — consider redistributing or bringing in Raha</span><button onClick={()=>setShowSuggest(s=>!s)} style={{fontSize:11,color:"#A32D2D",background:"none",border:"0.5px solid #E06060",borderRadius:6,padding:"3px 10px",cursor:"pointer"}}>{showSuggest?"Hide":"Suggestions"}</button></div>{showSuggest&&<ul style={{margin:"8px 0 0",paddingLeft:16,fontSize:12,color:"#793030",lineHeight:2}}><li>Assign overflow to Raha.</li><li>Push lower-priority revisions to next week.</li><li>Stagger venue oculars.</li></ul>}</div>}
        {overlaps.length>0&&<div style={{background:"#FBEAF0",border:"0.5px solid #ED93B1",borderRadius:10,padding:"10px 16px",marginBottom:10}}><p style={{margin:"0 0 4px",fontSize:13,fontWeight:500,color:"#993556"}}>📅 Deadline overlaps detected</p>{overlaps.map(([date,arr])=><p key={date} style={{margin:"2px 0",fontSize:12,color:"#72243E"}}><b>{date}</b> — {arr.map(t=>`${t.member}: ${t.project}`).join(" · ")}</p>)}</div>}

        {tab==="calendar"&&<div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <button onClick={()=>setWindowOffset(o=>o-1)} style={{fontSize:13,padding:"6px 16px",borderRadius:8,border:"0.5px solid #ddd",background:"#f9f9f9",color:"#111",cursor:"pointer"}}>← Prev</button>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:14,fontWeight:600}}>{fmtDate(days[0])} – {fmtDate(days[13])}, {days[0].getFullYear()}</div>
              <div style={{fontSize:11,color:"#888",marginTop:2}}>Today: {today.toLocaleDateString("en-PH",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</div>
            </div>
            <button onClick={()=>setWindowOffset(o=>o+1)} style={{fontSize:13,padding:"6px 16px",borderRadius:8,border:"0.5px solid #ddd",background:"#f9f9f9",color:"#111",cursor:"pointer"}}>Next →</button>
          </div>
          <WeekStrip wDays={week1} label="Week 1"/>
          <WeekStrip wDays={week2} label="Week 2"/>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",fontSize:11,color:"#888",marginTop:4}}>
            <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:"#ECEAE4",borderRadius:2,display:"inline-block",border:"0.5px solid #C4C2B9"}}/>Weekend</span>
            <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:"#FDF3E0",borderRadius:2,display:"inline-block"}}/>Holiday</span>
            <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,borderRadius:2,display:"inline-block",border:"2px solid #534AB7"}}/>Today</span>
            {MEMBERS.map(m=><span key={m} style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:"50%",background:M_COLOR[m],display:"inline-block"}}/>{m}</span>)}
          </div>
        </div>}

        {tab==="board"&&<div>
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            {MEMBERS.map(m=>(
              <button key={m} onClick={()=>setBoardMember(m)} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 16px",borderRadius:10,cursor:"pointer",background:boardMember===m?M_BG[m]:"#f9f9f9",border:`1.5px solid ${boardMember===m?M_BORDER[m]:"#eee"}`,transition:"all .15s"}}>
                <Avatar member={m} size={24}/>
                <span style={{fontSize:13,fontWeight:boardMember===m?600:400,color:boardMember===m?M_TEXT[m]:"#888"}}>{m}</span>
              </button>
            ))}
          </div>
          {(()=>{ const mt=allTasks.filter(t=>t.member===boardMember).sort((a,b)=>a.deadline.localeCompare(b.deadline)); const active=mt.filter(t=>!t.done),done=mt.filter(t=>t.done); if(!mt.length)return<div style={{textAlign:"center",padding:"40px 0",color:"#bbb"}}><div style={{fontSize:32,marginBottom:8}}>📋</div><p style={{fontSize:13}}>No tasks assigned to {boardMember} yet.</p></div>; return<>{active.length>0&&<div style={{marginBottom:16}}><p style={{fontSize:12,fontWeight:500,margin:"0 0 8px",color:"#888"}}>Active — {active.length} task{active.length!==1?"s":""}</p>{active.map(t=><BoardCard key={t.id} t={t} iso={t.date} member={boardMember}/>)}</div>}{done.length>0&&<div><p style={{fontSize:12,fontWeight:500,margin:"0 0 8px",color:"#3B6D11"}}>✓ Completed — {done.length} task{done.length!==1?"s":""}</p>{done.map(t=><BoardCard key={t.id} t={t} iso={t.date} member={boardMember}/>)}</div>}</>; })()}
        </div>}
      </div>

      {isEditMode&&<div style={{background:"#fff",border:"0.5px solid #eee",borderRadius:14,padding:"18px",marginBottom:16}}>
        <div style={{display:"flex",gap:4,marginBottom:14}}>
          {[["task","Assign Task"],["leave","Add Leave"],["holiday","Add Holiday"]].map(([key,lbl])=>(
            <button key={key} onClick={()=>setFormTab(key)} style={{fontSize:12,fontWeight:500,padding:"6px 14px",borderRadius:20,cursor:"pointer",background:formTab===key?"#111":"transparent",color:formTab===key?"#fff":"#888",border:`0.5px solid ${formTab===key?"#111":"#ccc"}`}}>{lbl}</button>
          ))}
        </div>
        {formTab==="task"&&<><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
          <div><label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Team member</label><select value={form.member} onChange={e=>setForm(f=>({...f,member:e.target.value}))} style={{width:"100%",fontSize:13,padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}>{MEMBERS.map(m=><option key={m}>{m}</option>)}</select></div>
          <div><label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Task type</label><select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={{width:"100%",fontSize:13,padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}>{TASK_TYPES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
          <div><label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Start date (optional)</label><input type="date" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} style={{width:"100%",fontSize:13,boxSizing:"border-box",padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}/></div>
          <div><label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Deadline</label><input type="date" value={form.deadline} onChange={e=>setForm(f=>({...f,deadline:e.target.value}))} style={{width:"100%",fontSize:13,boxSizing:"border-box",padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}/></div>
          <div style={{gridColumn:"1 / -1"}}><label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Difficulty & points</label><div style={{display:"flex",gap:6}}>{DIFFICULTY.map(d=><button key={d.id} onClick={()=>setForm(f=>({...f,difficulty:d.id}))} style={{flex:1,fontSize:12,fontWeight:500,padding:"7px 0",borderRadius:8,cursor:"pointer",background:form.difficulty===d.id?d.bg:"#f5f5f5",color:form.difficulty===d.id?d.color:"#888",border:`0.5px solid ${form.difficulty===d.id?d.border:"#ddd"}`}}>{d.label}<br/><span style={{fontSize:10,fontWeight:400}}>{d.pts}pt{d.pts>1?"s":""}</span></button>)}</div></div>
          <div style={{gridColumn:"1 / -1"}}><label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Project / event name</label><input value={form.project} onChange={e=>setForm(f=>({...f,project:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addTask()} placeholder="e.g. Ayala Museum pitch, SM North venue walk" style={{width:"100%",fontSize:13,boxSizing:"border-box",padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}/></div>
        </div><button onClick={addTask} style={{width:"100%",padding:"10px",fontSize:13,fontWeight:500,background:"#111",color:"#fff",border:"none",borderRadius:8,cursor:"pointer"}}>+ Assign task</button></>}
        {formTab==="leave"&&<><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
          <div><label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Member</label><select value={leaveForm.member} onChange={e=>setLeaveForm(f=>({...f,member:e.target.value}))} style={{width:"100%",fontSize:13,padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}>{MEMBERS.map(m=><option key={m}>{m}</option>)}</select></div>
          <div><label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Leave date</label><input type="date" value={leaveForm.date} onChange={e=>setLeaveForm(f=>({...f,date:e.target.value}))} style={{width:"100%",fontSize:13,boxSizing:"border-box",padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}/></div>
        </div>
        <button onClick={addLeave} style={{width:"100%",padding:"10px",fontSize:13,fontWeight:500,background:"#111",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",marginBottom:12}}>+ Mark leave day</button>
        {MEMBERS.map(m=>{ const ld=Object.keys((state.leaves||{})[m]||{}).sort(); if(!ld.length)return null; return<div key={m} style={{marginBottom:10}}><p style={{fontSize:12,fontWeight:500,margin:"0 0 6px"}}>{m}'s leave days</p><div style={{display:"flex",flexWrap:"wrap",gap:5}}>{ld.map(d=><span key={d} style={{fontSize:11,background:M_BG[m],color:M_TEXT[m],borderRadius:6,padding:"4px 10px",display:"flex",alignItems:"center",gap:6,border:`0.5px solid ${M_BORDER[m]}`}}>{d}<button onClick={()=>removeLeave(m,d)} style={{background:"#fff",border:`1px solid ${M_BORDER[m]}`,borderRadius:"50%",width:16,height:16,cursor:"pointer",color:M_TEXT[m],fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",padding:0,fontWeight:700}}>✕</button></span>)}</div></div>; })}</>}
        {formTab==="holiday"&&<><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
          <div><label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Date</label><input type="date" value={holForm.date} onChange={e=>setHolForm(f=>({...f,date:e.target.value}))} style={{width:"100%",fontSize:13,boxSizing:"border-box",padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}/></div>
          <div><label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Holiday name</label><input value={holForm.label} onChange={e=>setHolForm(f=>({...f,label:e.target.value}))} placeholder="e.g. Holy Week" style={{width:"100%",fontSize:13,boxSizing:"border-box",padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}/></div>
        </div>
        <button onClick={addHoliday} style={{width:"100%",padding:"10px",fontSize:13,fontWeight:500,background:"#111",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",marginBottom:12}}>+ Add holiday</button>
        {Object.keys(state.holidays||{}).length>0&&<div><p style={{fontSize:12,fontWeight:500,margin:"0 0 6px"}}>Marked holidays</p><div style={{display:"flex",flexWrap:"wrap",gap:5}}>{Object.entries(state.holidays||{}).sort().map(([d,lbl])=><span key={d} style={{fontSize:11,background:"#FAEEDA",color:"#854F0B",borderRadius:6,padding:"4px 10px",display:"flex",alignItems:"center",gap:6,border:"0.5px solid #EF9F27"}}>{d} · {lbl}<button onClick={()=>removeHoliday(d)} style={{background:"#fff",border:"1px solid #EF9F27",borderRadius:"50%",width:16,height:16,cursor:"pointer",color:"#854F0B",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",padding:0,fontWeight:700}}>✕</button></span>)}</div></div>}</>}
      </div>}

      <div style={{display:"flex",flexWrap:"wrap",gap:6,padding:"0 0 16px"}}>
        {TASK_TYPES.map(t=><span key={t.id} style={{fontSize:11,background:"#f5f5f5",color:"#888",border:"0.5px solid #ddd",borderRadius:20,padding:"3px 10px"}}>{t.label}</span>)}
        {MEMBERS.map(m=><span key={m} style={{fontSize:11,background:M_BG[m],color:M_TEXT[m],border:`0.5px solid ${M_BORDER[m]}`,borderRadius:20,padding:"3px 10px"}}>{m}</span>)}
      </div>
    </div>
  );
}
