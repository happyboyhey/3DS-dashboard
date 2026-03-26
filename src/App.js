import React, { useState, useMemo, useEffect, useRef } from "react";

// ─── SUPABASE ──────────────────────────────────────────────────────────────────
const SUPABASE_URL  = "https://wtlqchkpmjuftgtqrtbq.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0bHFjaGtwbWp1ZnRndHFydGJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4ODQ5MjAsImV4cCI6MjA4OTQ2MDkyMH0.jRH0otPxIJqJrEvGqyFEb_9D70XtBT5Jis1v4lTj284";
const DB_KEY        = "3ds-dashboard-v1";

import { createClient } from "@supabase/supabase-js";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ─── ROLES ─────────────────────────────────────────────────────────────────────
const ROLES = {
  pm:       { label:"Project Manager", password:"pm2026",     color:"#185FA5", bg:"#E6F1FB", border:"#85B7EB" },
  designer: { label:"Designer",        password:"design2026", color:"#0F6E56", bg:"#E1F5EE", border:"#5DCAA5" },
  manager:  { label:"Senior Manager",  password:"mgr2026",    color:"#534AB7", bg:"#EEEDFE", border:"#AFA9EC" },
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const TASK_TYPES = [
  { id:"pitch",     label:"Pitch Design",     color:"#534AB7", bg:"#EEEDFE", border:"#AFA9EC" },
  { id:"execution", label:"Execution Design", color:"#0F6E56", bg:"#E1F5EE", border:"#5DCAA5" },
  { id:"revision",  label:"Design Revisions", color:"#185FA5", bg:"#E6F1FB", border:"#85B7EB" },
  { id:"ocular",    label:"Venue Ocular",     color:"#854F0B", bg:"#FAEEDA", border:"#EF9F27" },
  { id:"ingress",   label:"Event Ingress",    color:"#993C1D", bg:"#FAECE7", border:"#F0997B" },
];

const PITCH_TYPES_IDS   = ["pitch","ocular"];
const EXEC_TYPES_IDS    = ["execution","revision","ingress"];

const DIFFICULTY = [
  { id:"easy",   label:"Easy",   pts:1, color:"#3B6D11", bg:"#EAF3DE", border:"#97C459" },
  { id:"medium", label:"Medium", pts:2, color:"#854F0B", bg:"#FAEEDA", border:"#EF9F27" },
  { id:"hard",   label:"Hard",   pts:3, color:"#A32D2D", bg:"#FCEBEB", border:"#F09595" },
];

const PRIORITIES = [
  { id:"low",    label:"Low",    color:"#3B6D11", bg:"#EAF3DE", border:"#97C459" },
  { id:"normal", label:"Normal", color:"#185FA5", bg:"#E6F1FB", border:"#85B7EB" },
  { id:"high",   label:"High",   color:"#A32D2D", bg:"#FCEBEB", border:"#F09595" },
];

const EXEC_STATUSES = [
  { id:"inProgress",     label:"In Progress",     color:"#185FA5", bg:"#E6F1FB", border:"#85B7EB" },
  { id:"internalReview", label:"Internal Review",  color:"#854F0B", bg:"#FAEEDA", border:"#EF9F27" },
  { id:"clientFeedback", label:"Client Feedback",  color:"#993C1D", bg:"#FAECE7", border:"#F0997B" },
  { id:"approvedDone",   label:"Approved / Done",  color:"#3B6D11", bg:"#EAF3DE", border:"#97C459" },
  { id:"onHold",         label:"On Hold",          color:"#666",    bg:"#F2F2F2", border:"#ccc"    },
];

const MEMBERS  = ["Leo","Shen","Raha"];
const M_COLOR  = { Leo:"#534AB7", Shen:"#0F6E56", Raha:"#993556" };
const M_BG     = { Leo:"#EEEDFE", Shen:"#E1F5EE", Raha:"#FBEAF0" };
const M_BG2    = { Leo:"#CECBF6", Shen:"#9FE1CB", Raha:"#F4C0D1" };
const M_BORDER = { Leo:"#AFA9EC", Shen:"#5DCAA5", Raha:"#ED93B1" };
const M_ROLE   = { Leo:"3D Artist", Shen:"3D Artist", Raha:"Freelancer" };

const STORAGE_KEY   = "3d-team-v33";
const DEFAULT_STATE = {
  tasks:{}, holidays:{},
  leaves:{ Leo:{}, Shen:{}, Raha:{} },
  photos:{ Leo:"", Shen:"", Raha:"" },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function getPHToday(){
  const ph=new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Manila"}));
  return new Date(ph.getFullYear(),ph.getMonth(),ph.getDate());
}
function isoDate(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function pad(n){ return String(n).padStart(2,"0"); }
function getMondayOf(d){ const c=new Date(d),day=c.getDay(); c.setDate(c.getDate()-(day===0?6:day-1)); return c; }
function addDays(d,n){ const c=new Date(d); c.setDate(c.getDate()+n); return c; }
function formatDate(iso){
  if(!iso)return"—";
  const[y,m,d]=iso.split("-").map(Number);
  return new Date(y,m-1,d).toLocaleDateString("en-US",{month:"short",day:"numeric"});
}
function daysLeft(iso){
  if(!iso)return null;
  const[y,m,d]=iso.split("-").map(Number);
  const diff=Math.ceil((new Date(y,m-1,d)-getPHToday())/(1000*60*60*24));
  return diff;
}
function buildWindow(offsetWeeks,today){
  const mon=getMondayOf(today);
  mon.setDate(mon.getDate()+offsetWeeks*7);
  return Array.from({length:14},(_,i)=>addDays(mon,i));
}
function taskPtsInWeek(task,daysArr,holidays,leaves){
  if(!task.startDate||!task.deadline)return 0;
  const[sy,sm,sd]=task.startDate.split("-").map(Number);
  const[ey,em,ed]=task.deadline.split("-").map(Number);
  const start=new Date(sy,sm-1,sd), end=new Date(ey,em-1,ed);
  const workDays=[];
  let cur=new Date(start);
  while(cur<=end){ if(cur.getDay()!==0&&cur.getDay()!==6){ const iso=isoDate(cur); if(!holidays[iso]&&!leaves[iso]) workDays.push(iso); } cur=addDays(cur,1); }
  if(!workDays.length)return 0;
  const ptsPerDay=task.pts/workDays.length;
  return daysArr.reduce((s,d)=>{ const iso=isoDate(d); return workDays.includes(iso)?s+ptsPerDay:s; },0);
}
function hoursInWeek(task,daysArr,holidays,leaves){
  if(!task.startDate||!task.deadline)return 0;
  const[sy,sm,sd]=task.startDate.split("-").map(Number);
  const[ey,em,ed]=task.deadline.split("-").map(Number);
  const start=new Date(sy,sm-1,sd),end=new Date(ey,em-1,ed);
  const workDays=[];
  let cur=new Date(start);
  while(cur<=end){ if(cur.getDay()!==0&&cur.getDay()!==6){ const iso=isoDate(cur); if(!holidays[iso]&&!leaves[iso]) workDays.push(iso); } cur=addDays(cur,1); }
  if(!workDays.length)return 0;
  const hpd=(task.hoursPerDay||2);
  return daysArr.reduce((s,d)=>{ const iso=isoDate(d); return workDays.includes(iso)?s+hpd:s; },0);
}
function setFavicon(){
  const c=document.createElement("canvas"); c.width=32;c.height=32;
  const x=c.getContext("2d");
  x.fillStyle="#111"; x.beginPath(); x.roundRect(0,0,32,32,8); x.fill();
  x.fillStyle="#fff"; x.font="bold 18px system-ui"; x.textAlign="center"; x.textBaseline="middle"; x.fillText("3D",16,16);
  const lnk=document.querySelector("link[rel*='icon']")||Object.assign(document.createElement("link"),{rel:"icon"});
  lnk.href=c.toDataURL(); document.head.appendChild(lnk);
  document.title="3D Team Dashboard";
}

function emptyForm(){ return { member:"Leo",type:"pitch",difficulty:"medium",pts:2,project:"",startDate:"",deadline:"",hoursPerDay:2,priority:"normal",notes:"" }; }

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App(){
  const [role, setRole]   = useState(null);
  const [state, setState] = useState(()=>{ try{const r=localStorage.getItem(STORAGE_KEY);return r?{...DEFAULT_STATE,...JSON.parse(r)}:DEFAULT_STATE;}catch(e){return DEFAULT_STATE;} });
  const [loading, setLoading]         = useState(false);
  const [saveStatus, setSaveStatus]   = useState("saved");
  const [windowOffset, setWindowOffset] = useState(0);
  const [tab, setTab]     = useState("calendar");
  const [form, setForm]   = useState(emptyForm());
  const [leaveForm, setLeaveForm]   = useState({member:"Leo",date:""});
  const [holForm, setHolForm]       = useState({date:"",label:""});
  const [formTab, setFormTab]       = useState("task");
  const [boardMember, setBoardMember] = useState("Leo");
  const [editTask, setEditTask]     = useState(null);
  const [editForm, setEditForm]     = useState({});
  const [showSuggest, setShowSuggest] = useState(false);
  const photoInputRefs = useRef({});
  const saveTimer = useRef(null);

  const today    = useMemo(()=>getPHToday(),[]);
  const todayIso = useMemo(()=>isoDate(today),[today]);

  useEffect(()=>{ setFavicon(); },[]);
  useEffect(()=>{ try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch(e){} },[state]);

  // Supabase load + realtime
  useEffect(()=>{
    if(!supabase)return;
    setLoading(true);
    supabase.from("dashboard").select("data").eq("id",DB_KEY).single()
      .then(({data,error})=>{
        if(!error&&data?.data){
          const p=typeof data.data==="string"?JSON.parse(data.data):data.data;
          p.leaves=p.leaves||{}; p.photos=p.photos||{};
          MEMBERS.forEach(m=>{p.leaves[m]=p.leaves[m]||{};p.photos[m]=p.photos[m]||"";});
          setState(p);
        }
        setLoading(false);
      }).catch(()=>setLoading(false));

    const ch=supabase.channel("db-changes")
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"dashboard",filter:`id=eq.${DB_KEY}`},payload=>{
        const f=typeof payload.new.data==="string"?JSON.parse(payload.new.data):payload.new.data;
        f.leaves=f.leaves||{}; f.photos=f.photos||{};
        MEMBERS.forEach(m=>{f.leaves[m]=f.leaves[m]||{};f.photos[m]=f.photos[m]||"";});
        setState(f); setSaveStatus("saved");
      }).subscribe();
    return ()=>supabase.removeChannel(ch);
  },[]);

  const updateState=ns=>{
    setState(ns);
    if(saveTimer.current)clearTimeout(saveTimer.current);
    if(supabase){ setSaveStatus("saving"); saveTimer.current=setTimeout(async()=>{ try{await supabase.from("dashboard").upsert({id:DB_KEY,data:JSON.stringify(ns)});setSaveStatus("saved");}catch(e){setSaveStatus("error");}},800); }
  };

  // Role permissions
  const canAddPitch   = role==="pm"||role==="manager";
  const canAddExec    = role==="designer"||role==="manager";
  const canDelete     = role==="manager";
  const canSeeInsights= role==="manager";
  const canEditLeave  = role==="manager";
  const canEditHoliday= role==="manager";

  const days  = useMemo(()=>buildWindow(windowOffset,today),[windowOffset,today]);
  const week1 = days.slice(0,7), week2=days.slice(7,14);
  const getDay= iso=>(state.tasks[iso]||{});

  const allTasks=useMemo(()=>{
    const out=[];
    Object.entries(state.tasks).forEach(([date,members])=>{
      MEMBERS.forEach(m=>(members[m]||[]).forEach(t=>out.push({...t,date,member:m})));
    });
    return out;
  },[state.tasks]);

  const weekLoad=(member,daysArr)=>{
    const mt=allTasks.filter(t=>t.member===member&&!t.done);
    return Math.round(mt.reduce((s,t)=>s+taskPtsInWeek(t,daysArr,state.holidays,state.leaves[member]||{}),0)*10)/10;
  };
  const weekHours=(member,daysArr)=>{
    const mt=allTasks.filter(t=>t.member===member&&!t.done);
    return Math.round(mt.reduce((s,t)=>s+hoursInWeek(t,daysArr,state.holidays,state.leaves[member]||{}),0)*10)/10;
  };

  const w1Loads=MEMBERS.map(m=>weekLoad(m,week1));
  const w2Loads=MEMBERS.map(m=>weekLoad(m,week2));
  const bothHeavy=(w1Loads[0]>=10&&w1Loads[1]>=10)||(w2Loads[0]>=10&&w2Loads[1]>=10);

  const addTask=()=>{
    if(!form.project.trim())return;
    const iso=form.startDate||todayIso;
    const member=form.member;
    const diff=DIFFICULTY.find(d=>d.id===form.difficulty)||DIFFICULTY[1];
    const task={id:Date.now(),type:form.type,difficulty:form.difficulty,pts:diff.pts,project:form.project,startDate:form.startDate,deadline:form.deadline,hoursPerDay:Number(form.hoursPerDay)||2,priority:form.priority,notes:form.notes,done:false,status:"inProgress"};
    const ns={...state,tasks:{...state.tasks,[iso]:{...(state.tasks[iso]||{}),  [member]:[...((state.tasks[iso]||{})[member]||[]),task]}}};
    updateState(ns); setForm(emptyForm());
  };
  const addLeave=()=>{
    if(!leaveForm.date)return;
    const ns={...state,leaves:{...state.leaves,[leaveForm.member]:{...state.leaves[leaveForm.member],[leaveForm.date]:true}}};
    updateState(ns); setLeaveForm({member:"Leo",date:""});
  };
  const removeLeave=(m,d)=>{ const lv={...state.leaves[m]}; delete lv[d]; updateState({...state,leaves:{...state.leaves,[m]:lv}}); };
  const addHoliday=()=>{
    if(!holForm.date||!holForm.label)return;
    updateState({...state,holidays:{...state.holidays,[holForm.date]:holForm.label}}); setHolForm({date:"",label:""});
  };
  const removeHoliday=d=>{ const h={...state.holidays}; delete h[d]; updateState({...state,holidays:h}); };
  const toggleDone=(iso,member,id)=>{
    const ns={...state,tasks:{...state.tasks,[iso]:{...state.tasks[iso],[member]:(state.tasks[iso][member]||[]).map(t=>t.id===id?{...t,done:!t.done}:t)}}};
    updateState(ns);
  };
  const removeTask=(iso,member,id)=>{
    if(!canDelete)return;
    const ns={...state,tasks:{...state.tasks,[iso]:{...state.tasks[iso],[member]:(state.tasks[iso][member]||[]).filter(t=>t.id!==id)}}};
    updateState(ns);
  };
  const setTaskStatus=(iso,member,id,status)=>{
    const ns={...state,tasks:{...state.tasks,[iso]:{...state.tasks[iso],[member]:(state.tasks[iso][member]||[]).map(t=>t.id===id?{...t,status}:t)}}};
    updateState(ns);
  };
  const handlePhotoUpload=(member,file)=>{
    if(!file)return;
    const reader=new FileReader();
    reader.onload=e=>updateState({...state,photos:{...state.photos,[member]:e.target.result}});
    reader.readAsDataURL(file);
  };
  const removePhoto=member=>updateState({...state,photos:{...state.photos,[member]:""}});

  if(!role) return <LoginScreen onLogin={setRole}/>;
  if(loading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",fontFamily:"system-ui",fontSize:14,color:"#888"}}>Loading dashboard…</div>;

  return (
    <div style={{minHeight:"100vh",background:"#F7F7F5",fontFamily:"system-ui,sans-serif"}}>

      {/* ── HERO HEADER ── */}
      <div style={{background:"linear-gradient(135deg,#1a1a2e 0%,#16213e 40%,#0f3460 70%,#533483 100%)",padding:"28px 24px 0",position:"relative",overflow:"hidden"}}>
        {/* bg blobs */}
        <div style={{position:"absolute",top:-40,right:-40,width:200,height:200,borderRadius:"50%",background:"rgba(83,52,131,0.3)",filter:"blur(60px)"}}/>
        <div style={{position:"absolute",bottom:-20,left:60,width:160,height:160,borderRadius:"50%",background:"rgba(15,110,86,0.2)",filter:"blur(50px)"}}/>

        <div style={{maxWidth:900,margin:"0 auto",position:"relative"}}>
          {/* top bar */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <div>
              <div style={{fontSize:22,fontWeight:700,color:"#fff",letterSpacing:"-0.5px"}}>3D Team Capacity</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.5)",marginTop:2}}>
                Workload and Calendar Tracker · Philippines Time · Week of {days[0].toLocaleDateString("en-US",{month:"short",day:"numeric"})}
              </div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              {supabase&&<span style={{fontSize:11,color:saveStatus==="saved"?"#4ade80":saveStatus==="saving"?"#fbbf24":"#f87171",background:"rgba(0,0,0,0.3)",padding:"4px 10px",borderRadius:20}}>
                {saveStatus==="saved"?"● Synced":saveStatus==="saving"?"● Saving…":"● Error"}
              </span>}
              <span style={{fontSize:11,background:"rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.7)",border:"0.5px solid rgba(255,255,255,0.2)",padding:"4px 10px",borderRadius:20}}>
                {ROLES[role].label}
              </span>
              <button onClick={()=>setRole(null)} style={{fontSize:11,color:"rgba(255,255,255,0.5)",background:"none",border:"0.5px solid rgba(255,255,255,0.2)",borderRadius:8,padding:"5px 12px",cursor:"pointer"}}>Sign out</button>
            </div>
          </div>

          {/* Member cards */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:0}}>
            {MEMBERS.map((m,i)=>{
              const w1h=weekHours(m,week1), w1l=weekLoad(m,week1);
              const cap=40, pct=Math.min(100,Math.round(w1h/cap*100));
              const status=w1l<=5?"Available":w1l<=9?"Moderate":"Heavy";
              const sc=status==="Available"?{color:"#4ade80",bg:"rgba(74,222,128,0.15)"}:status==="Moderate"?{color:"#fbbf24",bg:"rgba(251,191,36,0.15)"}:{color:"#f87171",bg:"rgba(248,113,113,0.15)"};
              const photo=state.photos?.[m]||"";
              return (
                <div key={m} style={{background:"rgba(255,255,255,0.07)",backdropFilter:"blur(10px)",borderRadius:14,padding:"16px",border:"0.5px solid rgba(255,255,255,0.12)",position:"relative"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                    <div style={{position:"relative"}}>
                      {photo
                        ? <img src={photo} alt={m} style={{width:42,height:42,borderRadius:"50%",objectFit:"cover",border:`2px solid ${M_COLOR[m]}`}}/>
                        : <div style={{width:42,height:42,borderRadius:"50%",background:M_BG2[m],display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:M_COLOR[m],border:`2px solid ${M_COLOR[m]}`}}>{m[0]}</div>
                      }
                      <div style={{width:10,height:10,borderRadius:"50%",background:sc.color,border:"2px solid #1a1a2e",position:"absolute",bottom:0,right:0}}/>
                    </div>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:"#fff"}}>{m}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.45)"}}>{M_ROLE[m]}</div>
                    </div>
                    <span style={{marginLeft:"auto",fontSize:10,fontWeight:600,background:sc.bg,color:sc.color,padding:"3px 8px",borderRadius:20}}>{status}</span>
                  </div>

                  <div style={{marginBottom:6}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:11,color:"rgba(255,255,255,0.5)"}}>🎯 Pitches</span>
                      <span style={{fontSize:11,color:"rgba(255,255,255,0.7)"}}>{weekHours(m,week1).toFixed(0)}h / {cap}h ({pct}%)</span>
                    </div>
                    <div style={{height:4,background:"rgba(255,255,255,0.1)",borderRadius:99}}>
                      <div style={{height:"100%",width:`${pct}%`,background:M_COLOR[m],borderRadius:99,transition:"width .4s"}}/>
                    </div>
                  </div>
                  <div style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:11,color:"rgba(255,255,255,0.5)"}}>⚙ Executions</span>
                      <span style={{fontSize:11,color:"rgba(255,255,255,0.7)"}}>{weekHours(m,week2).toFixed(0)}h / {cap}h</span>
                    </div>
                    <div style={{height:4,background:"rgba(255,255,255,0.1)",borderRadius:99}}>
                      <div style={{height:"100%",width:`${Math.min(100,Math.round(weekHours(m,week2)/cap*100))}%`,background:M_COLOR[m],borderRadius:99}}/>
                    </div>
                  </div>

                  <div style={{borderTop:"0.5px solid rgba(255,255,255,0.1)",paddingTop:8,display:"flex",justifyContent:"space-between"}}>
                    <div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>Total this week</div>
                      <div style={{fontSize:13,fontWeight:600,color:"#fff"}}>{w1h.toFixed(0)}h / {cap}h</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>Free: {Math.max(0,cap-w1h).toFixed(0)}h</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{Math.max(0,cap-w1h).toFixed(0)}h remaining</div>
                    </div>
                  </div>

                  {/* Leave days indicator */}
                  {Object.keys(state.leaves[m]||{}).filter(d=>d>=isoDate(days[0])&&d<=isoDate(days[13])).length>0&&(
                    <div style={{marginTop:6,fontSize:10,color:"#fbbf24"}}>
                      🌿 {Object.keys(state.leaves[m]||{}).filter(d=>d>=isoDate(days[0])&&d<=isoDate(days[13])).length} leave day{Object.keys(state.leaves[m]||{}).filter(d=>d>=isoDate(days[0])&&d<=isoDate(days[13])).length>1?"s":""}
                    </div>
                  )}

                  {/* Photo upload — manager only */}
                  {role==="manager"&&(
                    <div style={{marginTop:8}}>
                      <input ref={el=>photoInputRefs.current[m]=el} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handlePhotoUpload(m,e.target.files[0])}/>
                      {photo
                        ? <button onClick={()=>removePhoto(m)} style={{fontSize:10,color:"rgba(255,255,255,0.35)",background:"none",border:"none",cursor:"pointer",padding:0}}>Remove photo</button>
                        : <button onClick={()=>photoInputRefs.current[m]?.click()} style={{fontSize:10,color:"rgba(255,255,255,0.35)",background:"none",border:"none",cursor:"pointer",padding:0}}>Upload photo</button>
                      }
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Calendar / Board tabs in header */}
          <div style={{display:"flex",gap:0,marginTop:20,borderTop:"0.5px solid rgba(255,255,255,0.1)"}}>
            {[
              {key:"calendar",label:"📅 Calendar"},
              {key:"board",   label:"📋 Board"},
              ...(canSeeInsights?[{key:"insights",label:"📊 Insights"}]:[]),
            ].map(t=>(
              <button key={t.key} onClick={()=>setTab(t.key)}
                style={{padding:"12px 24px",fontSize:13,fontWeight:tab===t.key?600:400,
                  background:tab===t.key?"rgba(255,255,255,0.12)":"transparent",
                  color:tab===t.key?"#fff":"rgba(255,255,255,0.45)",
                  border:"none",cursor:"pointer",borderBottom:tab===t.key?"2px solid #fff":"2px solid transparent",transition:"all .15s"}}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{maxWidth:900,margin:"0 auto",padding:"24px 16px 60px"}}>
        {bothHeavy&&<div style={{background:"#FCEBEB",border:"0.5px solid #F09595",borderRadius:10,padding:"12px 16px",marginBottom:16,fontSize:13,color:"#A32D2D",display:"flex",gap:8}}>
          <span>🔥</span><span><strong>Both team members are heavily loaded.</strong> Consider involving Raha (freelancer) or pushing non-urgent tasks to the next window.</span>
        </div>}

        {/* CALENDAR TAB */}
        {tab==="calendar"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <button onClick={()=>setWindowOffset(o=>o-1)} style={navBtn()}>← Previous</button>
              <span style={{fontSize:13,fontWeight:500,color:"#555"}}>
                {days[0].toLocaleDateString("en-US",{month:"long",day:"numeric"})} – {days[13].toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}
              </span>
              <button onClick={()=>setWindowOffset(o=>o+1)} style={navBtn()}>Next →</button>
            </div>
            {[week1,week2].map((wk,wi)=>(
              <div key={wi} style={{marginBottom:16}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
                  {wk.map(day=>{
                    const iso=isoDate(day);
                    const isToday=iso===todayIso;
                    const isWknd=day.getDay()===0||day.getDay()===6;
                    const isHol=!!state.holidays[iso];
                    const memberLeave=MEMBERS.filter(m=>state.leaves[m]?.[iso]);
                    const dayTasks=getDay(iso);
                    const totalTasks=MEMBERS.reduce((s,m)=>s+(dayTasks[m]||[]).length,0);
                    return (
                      <div key={iso} style={{background:isToday?"#1a1a2e":isWknd||isHol?"#F5F5F3":"#fff",border:`1px solid ${isToday?"#534AB7":isWknd||isHol?"#e5e5e5":"#eee"}`,borderRadius:10,padding:"8px 6px",minHeight:70,position:"relative"}}>
                        <div style={{fontSize:11,fontWeight:isToday?700:500,color:isToday?"#fff":isWknd?"#bbb":"#333",marginBottom:3,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <span>{day.toLocaleDateString("en-US",{weekday:"short"})}</span>
                          <span style={{background:isToday?"#534AB7":"transparent",color:isToday?"#fff":"inherit",borderRadius:"50%",width:18,height:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10}}>{day.getDate()}</span>
                        </div>
                        {isHol&&<div style={{fontSize:9,color:"#854F0B",background:"#FAEEDA",borderRadius:4,padding:"1px 4px",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{state.holidays[iso]}</div>}
                        {memberLeave.map(m=><div key={m} style={{fontSize:9,color:M_COLOR[m],background:M_BG[m],borderRadius:4,padding:"1px 4px",marginBottom:1}}>🌿 {m} leave</div>)}
                        {totalTasks>0&&<div style={{fontSize:10,color:"#534AB7",fontWeight:600,marginTop:2}}>📌 {totalTasks} task{totalTasks>1?"s":""}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* BOARD TAB */}
        {tab==="board"&&(
          <div>
            {/* Member picker */}
            <div style={{display:"flex",gap:8,marginBottom:20}}>
              {MEMBERS.map(m=>(
                <button key={m} onClick={()=>setBoardMember(m)}
                  style={{display:"flex",alignItems:"center",gap:6,padding:"7px 16px",borderRadius:20,cursor:"pointer",fontSize:13,fontWeight:boardMember===m?600:400,
                    background:boardMember===m?M_BG[m]:"#fff",color:boardMember===m?M_COLOR[m]:"#555",
                    border:`1px solid ${boardMember===m?M_BORDER[m]:"#e5e5e5"}`}}>
                  {state.photos?.[m]
                    ?<img src={state.photos[m]} style={{width:20,height:20,borderRadius:"50%",objectFit:"cover"}} alt={m}/>
                    :<div style={{width:20,height:20,borderRadius:"50%",background:M_BG[m],display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:M_COLOR[m]}}>{m[0]}</div>
                  }
                  {m}
                </button>
              ))}
            </div>

            {/* Two columns: Pitches | Executions */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              {/* PITCHES */}
              <div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,padding:"10px 14px",background:"#EEEDFE",borderRadius:10,border:"0.5px solid #AFA9EC"}}>
                  <span style={{fontSize:13,fontWeight:600,color:"#534AB7"}}>🎯 Pitches</span>
                  <span style={{fontSize:12,color:"#534AB7",fontWeight:500}}>{weekHours(boardMember,week1).toFixed(0)}h this week</span>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {allTasks.filter(t=>t.member===boardMember&&PITCH_TYPES_IDS.includes(t.type)).length===0&&(
                    <div style={{textAlign:"center",padding:"30px 0",color:"#ccc",fontSize:13}}>No pitch tasks</div>
                  )}
                  {allTasks.filter(t=>t.member===boardMember&&PITCH_TYPES_IDS.includes(t.type)).map(t=>{
                    const tt=TASK_TYPES.find(x=>x.id===t.type)||TASK_TYPES[0];
                    const pr=PRIORITIES.find(x=>x.id===t.priority)||PRIORITIES[1];
                    const dl=daysLeft(t.deadline);
                    return <TaskCard key={t.id} task={t} tt={tt} pr={pr} dl={dl} canDelete={canDelete}
                      onToggle={()=>toggleDone(t.date,t.member,t.id)}
                      onRemove={()=>removeTask(t.date,t.member,t.id)}
                      onStatus={s=>setTaskStatus(t.date,t.member,t.id,s)}
                      showStatusBar={false}/>;
                  })}
                </div>
              </div>

              {/* EXECUTIONS */}
              <div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,padding:"10px 14px",background:"#E1F5EE",borderRadius:10,border:"0.5px solid #5DCAA5"}}>
                  <span style={{fontSize:13,fontWeight:600,color:"#0F6E56"}}>⚙ Executions</span>
                  <span style={{fontSize:12,color:"#0F6E56",fontWeight:500}}>{weekHours(boardMember,week2).toFixed(0)}h this week</span>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {allTasks.filter(t=>t.member===boardMember&&EXEC_TYPES_IDS.includes(t.type)).length===0&&(
                    <div style={{textAlign:"center",padding:"30px 0",color:"#ccc",fontSize:13}}>No execution tasks</div>
                  )}
                  {allTasks.filter(t=>t.member===boardMember&&EXEC_TYPES_IDS.includes(t.type)).map(t=>{
                    const tt=TASK_TYPES.find(x=>x.id===t.type)||TASK_TYPES[0];
                    const pr=PRIORITIES.find(x=>x.id===t.priority)||PRIORITIES[1];
                    const dl=daysLeft(t.deadline);
                    return <TaskCard key={t.id} task={t} tt={tt} pr={pr} dl={dl} canDelete={canDelete}
                      onToggle={()=>toggleDone(t.date,t.member,t.id)}
                      onRemove={()=>removeTask(t.date,t.member,t.id)}
                      onStatus={s=>setTaskStatus(t.date,t.member,t.id,s)}
                      showStatusBar={true}/>;
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* INSIGHTS TAB — Manager only */}
        {tab==="insights"&&canSeeInsights&&(
          <InsightsTab allTasks={allTasks} state={state} week1={week1} week2={week2} weekLoad={weekLoad} weekHours={weekHours}/>
        )}

        {/* ── ASSIGN FORM ── */}
        {(canAddPitch||canAddExec||canEditLeave||canEditHoliday)&&(
          <div style={{marginTop:24,background:"#fff",borderRadius:14,border:"0.5px solid #eee",padding:20,boxShadow:"0 2px 12px rgba(0,0,0,0.04)"}}>
            {/* Form tabs */}
            <div style={{display:"flex",gap:8,marginBottom:16,borderBottom:"0.5px solid #eee",paddingBottom:12}}>
              {[
                {key:"task",    label:"Assign Task",  show:canAddPitch||canAddExec},
                {key:"leave",   label:"Add Leave",    show:canEditLeave},
                {key:"holiday", label:"Add Holiday",  show:canEditHoliday},
              ].filter(t=>t.show).map(t=>(
                <button key={t.key} onClick={()=>setFormTab(t.key)}
                  style={{fontSize:12,fontWeight:formTab===t.key?600:400,padding:"6px 14px",borderRadius:8,cursor:"pointer",
                    background:formTab===t.key?"#111":"#f5f5f5",color:formTab===t.key?"#fff":"#666",border:"none",transition:"all .15s"}}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Task form */}
            {formTab==="task"&&(
              <div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                  <div>
                    <label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Team member</label>
                    <select value={form.member} onChange={e=>setForm(f=>({...f,member:e.target.value}))} style={selectSt()}>
                      {MEMBERS.map(m=><option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Task type</label>
                    <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={selectSt()}>
                      {/* Show only allowed types per role */}
                      {TASK_TYPES.filter(t=>
                        role==="manager" ? true :
                        role==="pm"      ? PITCH_TYPES_IDS.includes(t.id) :
                        role==="designer"? EXEC_TYPES_IDS.includes(t.id) : false
                      ).map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Start date</label>
                    <input type="date" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} style={inputSt()}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Deadline</label>
                    <input type="date" value={form.deadline} onChange={e=>setForm(f=>({...f,deadline:e.target.value}))} style={inputSt()}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Hours / day</label>
                    <input type="number" min={1} max={8} value={form.hoursPerDay} onChange={e=>setForm(f=>({...f,hoursPerDay:e.target.value}))} style={inputSt()}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Priority</label>
                    <div style={{display:"flex",gap:5}}>
                      {PRIORITIES.map(p=>(
                        <button key={p.id} onClick={()=>setForm(f=>({...f,priority:p.id}))}
                          style={{flex:1,fontSize:11,fontWeight:500,padding:"7px 0",borderRadius:8,cursor:"pointer",
                            background:form.priority===p.id?p.bg:"#f5f5f5",color:form.priority===p.id?p.color:"#888",
                            border:`0.5px solid ${form.priority===p.id?p.border:"#ddd"}`}}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{marginBottom:10}}>
                  <label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Difficulty</label>
                  <div style={{display:"flex",gap:6}}>
                    {DIFFICULTY.map(d=>(
                      <button key={d.id} onClick={()=>setForm(f=>({...f,difficulty:d.id,pts:d.pts}))}
                        style={{flex:1,fontSize:12,fontWeight:500,padding:"8px 0",borderRadius:8,cursor:"pointer",
                          background:form.difficulty===d.id?d.bg:"#f5f5f5",color:form.difficulty===d.id?d.color:"#888",
                          border:`0.5px solid ${form.difficulty===d.id?d.border:"#ddd"}`}}>
                        {d.label}<br/><span style={{fontSize:10}}>{d.pts}pt</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{marginBottom:12}}>
                  <label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Project / Event name</label>
                  <input value={form.project} onChange={e=>setForm(f=>({...f,project:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addTask()} placeholder="e.g. SM Prime Gala, Puma Activation" style={{...inputSt(),width:"100%",boxSizing:"border-box"}}/>
                </div>
                <div style={{marginBottom:14}}>
                  <label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Notes (optional)</label>
                  <input value={form.notes||""} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Any extra context..." style={{...inputSt(),width:"100%",boxSizing:"border-box"}}/>
                </div>

                {/* Pitch / Exec split buttons */}
                {role==="manager"&&(
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <button onClick={()=>{ setForm(f=>({...f,type:"pitch"})); addTask(); }}
                      style={{padding:"11px",fontSize:13,fontWeight:600,background:"#EEEDFE",color:"#534AB7",border:"0.5px solid #AFA9EC",borderRadius:10,cursor:"pointer"}}>
                      🎯 Add as Pitch
                    </button>
                    <button onClick={()=>{ setForm(f=>({...f,type:"execution"})); addTask(); }}
                      style={{padding:"11px",fontSize:13,fontWeight:600,background:"#E1F5EE",color:"#0F6E56",border:"0.5px solid #5DCAA5",borderRadius:10,cursor:"pointer"}}>
                      ⚙ Add as Execution
                    </button>
                  </div>
                )}
                {role!=="manager"&&(
                  <button onClick={addTask}
                    style={{width:"100%",padding:"11px",fontSize:13,fontWeight:600,background:"#111",color:"#fff",border:"none",borderRadius:10,cursor:"pointer"}}>
                    + Add Task
                  </button>
                )}
              </div>
            )}

            {/* Leave form — manager only */}
            {formTab==="leave"&&canEditLeave&&(
              <div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                  <div>
                    <label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Member</label>
                    <select value={leaveForm.member} onChange={e=>setLeaveForm(f=>({...f,member:e.target.value}))} style={selectSt()}>
                      {MEMBERS.map(m=><option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Date</label>
                    <input type="date" value={leaveForm.date} onChange={e=>setLeaveForm(f=>({...f,date:e.target.value}))} style={inputSt()}/>
                  </div>
                </div>
                <button onClick={addLeave} style={{width:"100%",padding:"10px",fontSize:13,fontWeight:600,background:"#111",color:"#fff",border:"none",borderRadius:10,cursor:"pointer",marginBottom:12}}>+ Add leave day</button>
                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                  {MEMBERS.map(m=>Object.keys(state.leaves[m]||{}).sort().map(d=>(
                    <span key={m+d} style={{fontSize:11,background:M_BG[m],color:M_COLOR[m],borderRadius:6,padding:"4px 10px",display:"flex",alignItems:"center",gap:6,border:`0.5px solid ${M_BORDER[m]}`}}>
                      {m} · {formatDate(d)}
                      <button onClick={()=>removeLeave(m,d)} style={{background:"#fff",border:`1px solid ${M_BORDER[m]}`,borderRadius:"50%",width:14,height:14,cursor:"pointer",color:M_COLOR[m],fontSize:9,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>✕</button>
                    </span>
                  )))}
                </div>
              </div>
            )}

            {/* Holiday form — manager only */}
            {formTab==="holiday"&&canEditHoliday&&(
              <div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                  <div>
                    <label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Date</label>
                    <input type="date" value={holForm.date} onChange={e=>setHolForm(f=>({...f,date:e.target.value}))} style={inputSt()}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Holiday name</label>
                    <input value={holForm.label} onChange={e=>setHolForm(f=>({...f,label:e.target.value}))} placeholder="e.g. Holy Week" style={inputSt()}/>
                  </div>
                </div>
                <button onClick={addHoliday} style={{width:"100%",padding:"10px",fontSize:13,fontWeight:600,background:"#111",color:"#fff",border:"none",borderRadius:10,cursor:"pointer",marginBottom:12}}>+ Add holiday</button>
                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                  {Object.entries(state.holidays||{}).sort().map(([d,lbl])=>(
                    <span key={d} style={{fontSize:11,background:"#FAEEDA",color:"#854F0B",borderRadius:6,padding:"4px 10px",display:"flex",alignItems:"center",gap:6,border:"0.5px solid #EF9F27"}}>
                      {formatDate(d)} · {lbl}
                      <button onClick={()=>removeHoliday(d)} style={{background:"#fff",border:"1px solid #EF9F27",borderRadius:"50%",width:14,height:14,cursor:"pointer",color:"#854F0B",fontSize:9,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>✕</button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TASK CARD ────────────────────────────────────────────────────────────────
function TaskCard({ task:t, tt, pr, dl, canDelete, onToggle, onRemove, onStatus, showStatusBar }){
  const overdue = dl!==null&&dl<0&&!t.done;
  return (
    <div style={{background:"#fff",borderRadius:12,border:`0.5px solid ${overdue?"#F09595":"#eee"}`,padding:"12px 14px",position:"relative",opacity:t.done?.6:1}}>
      {canDelete&&<button onClick={onRemove} style={{position:"absolute",top:8,right:8,background:"none",border:"0.5px solid #ddd",borderRadius:"50%",width:18,height:18,fontSize:9,cursor:"pointer",color:"#bbb",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>✕</button>}

      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:7}}>
        <span style={{fontSize:10,padding:"2px 7px",borderRadius:20,background:tt.bg,color:tt.color,border:`0.5px solid ${tt.border}`,fontWeight:500}}>{tt.label}</span>
        <span style={{fontSize:10,padding:"2px 7px",borderRadius:20,background:pr.bg,color:pr.color,border:`0.5px solid ${pr.border}`,fontWeight:500}}>{pr.label}</span>
      </div>

      <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
        <button onClick={onToggle} style={{marginTop:1,width:16,height:16,minWidth:16,borderRadius:4,border:`1.5px solid ${t.done?"#4ade80":"#ccc"}`,background:t.done?"#4ade80":"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0,fontSize:9,color:"#fff"}}>
          {t.done?"✓":""}
        </button>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:600,color:t.done?"#aaa":"#111",textDecoration:t.done?"line-through":"none",marginBottom:2}}>{t.project}</div>
          {t.startDate&&<div style={{fontSize:10,color:"#bbb"}}>▶ {formatDate(t.startDate)}</div>}
          {t.deadline&&<div style={{fontSize:10,color:overdue?"#A32D2D":dl<=3?"#854F0B":"#bbb",fontWeight:overdue||dl<=3?600:400}}>
            ⏱ {formatDate(t.deadline)} {dl!==null&&!t.done&&<span>· {overdue?`${Math.abs(dl)}d overdue`:`${dl}d left`}</span>}
          </div>}
          {t.hoursPerDay&&<div style={{fontSize:10,color:"#bbb"}}>⏰ {t.hoursPerDay}h/day</div>}
          {t.notes&&<div style={{fontSize:10,color:"#bbb",fontStyle:"italic",marginTop:2}}>{t.notes}</div>}
        </div>
      </div>

      {showStatusBar&&(
        <div style={{display:"flex",gap:3,flexWrap:"wrap",marginTop:8}}>
          {EXEC_STATUSES.map(s=>(
            <button key={s.id} onClick={()=>onStatus(s.id)}
              style={{fontSize:9,padding:"3px 7px",borderRadius:20,cursor:"pointer",fontWeight:t.status===s.id?700:400,
                background:t.status===s.id?s.bg:"#f5f5f5",color:t.status===s.id?s.color:"#aaa",
                border:`0.5px solid ${t.status===s.id?s.border:"#eee"}`}}>
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── INSIGHTS TAB ────────────────────────────────────────────────────────────
function InsightsTab({ allTasks, state, week1, week2, weekLoad, weekHours }){
  const memberStats=MEMBERS.map(m=>({
    name:m,
    total:allTasks.filter(t=>t.member===m).length,
    active:allTasks.filter(t=>t.member===m&&!t.done).length,
    done:allTasks.filter(t=>t.member===m&&t.done).length,
    pitches:allTasks.filter(t=>t.member===m&&PITCH_TYPES_IDS.includes(t.type)).length,
    execs:allTasks.filter(t=>t.member===m&&EXEC_TYPES_IDS.includes(t.type)).length,
    w1h:weekHours(m,week1), w2h:weekHours(m,week2),
    w1l:weekLoad(m,week1),
  }));
  const maxTotal=Math.max(...memberStats.map(m=>m.total),1);
  const openHigh=allTasks.filter(t=>t.priority==="high"&&!t.done).length;
  const statusCounts=EXEC_STATUSES.map(s=>({...s,count:allTasks.filter(t=>t.status===s.id&&!t.done).length}));

  return (
    <div>
      <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>Team Insights</div>
      <div style={{fontSize:13,color:"#888",marginBottom:20}}>Full overview — Senior Manager view</div>

      {openHigh>0&&<div style={{background:"#FCEBEB",border:"0.5px solid #F09595",borderRadius:10,padding:"12px 16px",marginBottom:20,fontSize:13,color:"#A32D2D",display:"flex",gap:8}}>
        <span>⚠️</span><span><strong>{openHigh} high-priority task{openHigh>1?"s":""}</strong> currently open.</span>
      </div>}

      <div style={{background:"#fff",borderRadius:12,border:"0.5px solid #eee",padding:20,marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:600,marginBottom:14}}>Task Load per Member</div>
        {memberStats.map(m=>(
          <div key={m.name} style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontSize:13,fontWeight:500,color:M_COLOR[m.name]}}>{m.name} <span style={{fontSize:11,color:"#aaa",fontWeight:400}}>({M_ROLE[m.name]})</span></span>
              <span style={{fontSize:12,color:"#888"}}>{m.active} active · {m.done} done</span>
            </div>
            <div style={{height:8,background:"#f0f0f0",borderRadius:99,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${(m.total/maxTotal)*100}%`,background:M_COLOR[m.name],borderRadius:99,transition:"width .4s"}}/>
            </div>
            <div style={{display:"flex",gap:12,marginTop:4}}>
              <span style={{fontSize:11,color:"#888"}}>Pitches: {m.pitches}</span>
              <span style={{fontSize:11,color:"#888"}}>Executions: {m.execs}</span>
              <span style={{fontSize:11,color:"#888"}}>Wk1 load: {m.w1l}pts / {m.w1h}h</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{background:"#fff",borderRadius:12,border:"0.5px solid #eee",padding:20,marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:600,marginBottom:12}}>Execution Status Breakdown</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
          {statusCounts.map(s=>(
            <div key={s.id} style={{background:s.bg,border:`0.5px solid ${s.border}`,borderRadius:10,padding:"12px 14px"}}>
              <div style={{fontSize:20,fontWeight:700,color:s.color}}>{s.count}</div>
              <div style={{fontSize:11,color:s.color,marginTop:2}}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{background:"#fff",borderRadius:12,border:"0.5px solid #eee",padding:20}}>
        <div style={{fontSize:13,fontWeight:600,marginBottom:12}}>Capacity Check</div>
        {memberStats.map(m=>{
          const level=m.w1l<=5?"Light":m.w1l<=9?"Moderate":"Heavy";
          const cfg=level==="Light"?{bg:"#EAF3DE",color:"#3B6D11",border:"#97C459"}:level==="Moderate"?{bg:"#FAEEDA",color:"#854F0B",border:"#EF9F27"}:{bg:"#FCEBEB",color:"#A32D2D",border:"#F09595"};
          return (
            <div key={m.name} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,padding:"10px 14px",background:cfg.bg,border:`0.5px solid ${cfg.border}`,borderRadius:10}}>
              <span style={{fontSize:13,fontWeight:500,color:M_COLOR[m.name]}}>{m.name}</span>
              <span style={{fontSize:12,fontWeight:600,color:cfg.color}}>{level} · {m.w1l}pts · {m.w1h}h this week</span>
            </div>
          );
        })}
        {memberStats.some(m=>m.w1l>9)&&<div style={{fontSize:12,color:"#854F0B",background:"#FAEEDA",border:"0.5px solid #EF9F27",borderRadius:8,padding:"10px 14px",marginTop:8}}>
          💡 Consider redistributing to Raha or delaying non-critical tasks.
        </div>}
      </div>
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }){
  const [sel,setSel]=useState(null);
  const [pw,setPw]=useState("");
  const [err,setErr]=useState("");
  const [show,setShow]=useState(false);
  function attempt(){ if(!sel){setErr("Pick a role first.");return;} if(pw===ROLES[sel].password){onLogin(sel);}else{setErr("Wrong password.");setPw("");} }
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)",fontFamily:"system-ui"}}>
      <div style={{width:340,background:"#fff",borderRadius:20,padding:"36px 32px",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{fontSize:24,fontWeight:800,marginBottom:4,letterSpacing:"-0.5px"}}>3D Team</div>
        <div style={{fontSize:13,color:"#888",marginBottom:28}}>Select your role to continue</div>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
          {Object.entries(ROLES).map(([key,r])=>(
            <button key={key} onClick={()=>{setSel(key);setErr("");setPw("");}}
              style={{padding:"12px 16px",borderRadius:12,border:`1.5px solid ${sel===key?r.border:"#eee"}`,background:sel===key?r.bg:"#fafafa",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:10}}>
              <span style={{width:8,height:8,borderRadius:"50%",background:r.color,display:"inline-block",flexShrink:0}}/>
              <span style={{fontSize:14,fontWeight:sel===key?600:400,color:sel===key?r.color:"#333"}}>{r.label}</span>
            </button>
          ))}
        </div>
        {sel&&<div style={{marginBottom:14}}>
          <label style={{fontSize:12,color:"#666",display:"block",marginBottom:6}}>Password</label>
          <div style={{position:"relative"}}>
            <input type={show?"text":"password"} value={pw} onChange={e=>{setPw(e.target.value);setErr("");}}
              onKeyDown={e=>e.key==="Enter"&&attempt()} placeholder="Enter password"
              style={{width:"100%",boxSizing:"border-box",padding:"10px 40px 10px 12px",fontSize:14,borderRadius:10,border:"0.5px solid #ddd",outline:"none"}}/>
            <button onClick={()=>setShow(s=>!s)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#999",fontSize:11}}>{show?"Hide":"Show"}</button>
          </div>
        </div>}
        {err&&<div style={{fontSize:12,color:"#A32D2D",marginBottom:12,background:"#FCEBEB",padding:"8px 12px",borderRadius:8}}>{err}</div>}
        <button onClick={attempt} style={{width:"100%",padding:"13px",fontSize:14,fontWeight:700,background:"#111",color:"#fff",border:"none",borderRadius:12,cursor:"pointer"}}>Sign in →</button>
      </div>
    </div>
  );
}

// ─── STYLE HELPERS ────────────────────────────────────────────────────────────
function navBtn(){ return {fontSize:12,padding:"7px 14px",borderRadius:8,border:"0.5px solid #ddd",background:"#fff",cursor:"pointer",color:"#555"}; }
function selectSt(){ return {width:"100%",fontSize:13,padding:"8px 10px",borderRadius:8,border:"0.5px solid #ddd",background:"#fff",outline:"none"}; }
function inputSt(){ return {width:"100%",boxSizing:"border-box",fontSize:13,padding:"8px 10px",borderRadius:8,border:"0.5px solid #ddd",outline:"none"}; }
function formatDate(iso){ if(!iso)return"—"; const[y,m,d]=iso.split("-").map(Number); return new Date(y,m-1,d).toLocaleDateString("en-US",{month:"short",day:"numeric"}); }
