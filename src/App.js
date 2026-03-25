import React, { useState, useMemo, useEffect, useRef } from "react";

const STORAGE_KEY = "3d-team-dashboard-v2";
const SB_URL      = "https://wtlqchkpmjuftgtqrtbq.supabase.co/rest/v1/dashboard";
const SB_KEY      = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0bHFjaGtwbWp1ZnRndHFydGJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4ODQ5MjAsImV4cCI6MjA4OTQ2MDkyMH0.jRH0otPxIJqJrEvGqyFEb_9D70XtBT5Jis1v4lTj284";
const DB_ID       = "3ds-capacity-v1";
const SB_HEADERS  = {"Content-Type":"application/json","apikey":SB_KEY,"Authorization":`Bearer ${SB_KEY}`};

async function loadFromCloud() {
  try {
    const res = await fetch(`${SB_URL}?id=eq.${DB_ID}&select=data`,{headers:SB_HEADERS});
    if(!res.ok) return null;
    const rows = await res.json();
    if(!rows||!rows[0]) return null;
    const p = typeof rows[0].data==="string"?JSON.parse(rows[0].data):rows[0].data;
    return p&&p.tasks!==undefined?p:null;
  } catch(e){return null;}
}
async function saveToCloud(state) {
  try {
    const res = await fetch(SB_URL,{method:"POST",headers:{...SB_HEADERS,"Prefer":"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({id:DB_ID,data:JSON.stringify(state)})});
    return res.ok||res.status===201;
  } catch(e){return false;}
}

const TASK_TYPES = [
  {id:"booth",   label:"Booth Design"},
  {id:"venue",   label:"Venue Layout"},
  {id:"event",   label:"Event Design"},
  {id:"mock",    label:"3D Mock-up"},
  {id:"ocular",  label:"Venue Ocular"},
];

const EXEC_STATUSES = [
  {id:"inprogress", label:"In Progress",       color:"#185FA5", bg:"#E6F1FB", border:"#85B7EB"},
  {id:"internal",   label:"Internal Review",   color:"#854F0B", bg:"#FAEEDA", border:"#EF9F27"},
  {id:"clientfb",   label:"Client Feedback",   color:"#993556", bg:"#FBEAF0", border:"#ED93B1"},
  {id:"approved",   label:"Approved / Done",   color:"#3B6D11", bg:"#EAF3DE", border:"#97C459"},
  {id:"onhold",     label:"On Hold",           color:"#5F5E5A", bg:"#F1EFE8", border:"#B4B2A9"},
];

const PRIORITIES = [
  {id:"urgent", label:"🔥 Urgent", color:"#A32D2D", bg:"#FCEBEB", border:"#F09595"},
  {id:"high",   label:"⚡ High",   color:"#854F0B", bg:"#FAEEDA", border:"#EF9F27"},
  {id:"normal", label:"📋 Normal", color:"#185FA5", bg:"#E6F1FB", border:"#85B7EB"},
  {id:"low",    label:"🧊 Low",    color:"#5F5E5A", bg:"#F1EFE8", border:"#B4B2A9"},
];

const HOUR_PRESETS = [1,2,4,6,8];
const DAILY_CAP    = 8;
const WEEKLY_CAP   = 40;

const MEMBERS  = ["Leo","Shen","Raha"];
const M_COLOR  = {Leo:"#534AB7",Shen:"#0F6E56",Raha:"#993556"};
const M_BG     = {Leo:"#EEEDFE",Shen:"#E1F5EE",Raha:"#FBEAF0"};
const M_TEXT   = {Leo:"#534AB7",Shen:"#0F6E56",Raha:"#993556"};
const M_BORDER = {Leo:"#AFA9EC",Shen:"#5DCAA5",Raha:"#ED93B1"};
const M_ROLE   = {Leo:"3D Artist",Shen:"3D Artist",Raha:"Freelancer"};
const EDIT_PASSWORD = "3dteam2026";
const DEFAULT_STATE = {tasks:{},holidays:{},leaves:{Leo:{},Shen:{},Raha:{}},photos:{Leo:"",Shen:"",Raha:""}};

function getPHToday(){const ph=new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Manila"}));return new Date(ph.getFullYear(),ph.getMonth(),ph.getDate());}
function isoDate(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function getMondayOf(d){const day=d.getDay(),mon=new Date(d);mon.setDate(d.getDate()-(day===0?6:day-1));return mon;}
function buildWindow(off,today){const base=getMondayOf(today),start=new Date(base);start.setDate(base.getDate()+off*14);return Array.from({length:14},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d;});}
function fmtDate(d){return d.toLocaleDateString("en-US",{month:"short",day:"numeric"});}
function dayLabel(d){return d.toLocaleDateString("en-US",{weekday:"short"});}
function isWeekend(d){return d.getDay()===0||d.getDay()===6;}
function daysUntil(deadlineIso,todayIso){const d=new Date(deadlineIso+"T00:00:00"),t=new Date(todayIso+"T00:00:00");return Math.round((d-t)/(1000*60*60*24));}
function isWorkingDay(d,holidays,leaveMap){return !isWeekend(d)&&!holidays[isoDate(d)]&&!leaveMap[isoDate(d)];}

// Hours a task contributes to a specific iso date
function taskHoursOnDay(task, iso, holidays, leaveMap={}) {
  if(task.done) return 0;
  const start = task.startDate||task.deadline;
  if(iso<start||iso>task.deadline) return 0;
  const d = new Date(iso+"T00:00:00");
  if(!isWorkingDay(d,holidays,leaveMap)) return 0;
  return Number(task.hours)||0;
}

// Total hours for a member on a specific day across all tasks
function memberHoursOnDay(allTasks, member, iso, holidays, leaves) {
  return allTasks.filter(t=>t.member===member&&!t.done)
    .reduce((s,t)=>s+taskHoursOnDay(t,iso,holidays,(leaves||{})[member]||{}),0);
}

// Weekly hours for a member (side optional)
function memberWeeklyHours(allTasks, member, weekDays, holidays, leaves, side=null) {
  return weekDays.filter(d=>!isWeekend(d)).reduce((s,d)=>{
    const iso=isoDate(d);
    const dayH=allTasks.filter(t=>t.member===member&&!t.done&&(side===null||t.side===side))
      .reduce((ds,t)=>ds+taskHoursOnDay(t,iso,holidays,(leaves||{})[member]||{}),0);
    return s+dayH;
  },0);
}

function setFavicon(){const c=document.createElement("canvas");c.width=32;c.height=32;const ctx=c.getContext("2d");ctx.fillStyle="#534AB7";ctx.beginPath();ctx.roundRect(0,0,32,32,8);ctx.fill();ctx.fillStyle="#fff";ctx.font="bold 14px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("3D",16,17);const l=document.querySelector("link[rel*='icon']")||document.createElement("link");l.type="image/x-icon";l.rel="shortcut icon";l.href=c.toDataURL();document.head.appendChild(l);document.title="3D Team Dashboard";}

const emptyForm=()=>({member:"Leo",side:"pitch",type:"booth",hours:4,customHours:"",status:"inprogress",priority:"normal",project:"",startDate:"",deadline:""});

export default function Dashboard() {
  const today=useMemo(()=>getPHToday(),[]);
  const TODAY_ISO=useMemo(()=>isoDate(today),[today]);
  const [state,setState]=useState(DEFAULT_STATE);
  const [loading,setLoading]=useState(true);
  const [saveStatus,setSaveStatus]=useState("saved");
  const [isEditMode,setIsEditMode]=useState(false);
  const [showPwModal,setShowPwModal]=useState(false);
  const [pwInput,setPwInput]=useState("");
  const [pwError,setPwError]=useState(false);
  const [windowOffset,setWindowOffset]=useState(0);
  const [tab,setTab]=useState("calendar");
  const [form,setForm]=useState(emptyForm());
  const [leaveForm,setLeaveForm]=useState({member:"Leo",date:""});
  const [holForm,setHolForm]=useState({date:"",label:""});
  const [formTab,setFormTab]=useState("task");
  const [boardMember,setBoardMember]=useState("Leo");
  const [editTask,setEditTask]=useState(null);
  const [editForm,setEditForm]=useState({});
  const photoInputRefs=useRef({});
  const saveTimer=useRef(null);

  useEffect(()=>{setFavicon();},[]);
  useEffect(()=>{setWindowOffset(0);},[TODAY_ISO]);

  useEffect(()=>{
    const load=async()=>{
      const cloud=await loadFromCloud();
      if(cloud){cloud.leaves=cloud.leaves||{};cloud.photos=cloud.photos||{};MEMBERS.forEach(m=>{cloud.leaves[m]=cloud.leaves[m]||{};cloud.photos[m]=cloud.photos[m]||"";});setState(cloud);localStorage.setItem(STORAGE_KEY,JSON.stringify(cloud));}
      else{try{const saved=localStorage.getItem(STORAGE_KEY);if(saved){const p=JSON.parse(saved);p.leaves=p.leaves||{};p.photos=p.photos||{};MEMBERS.forEach(m=>{p.leaves[m]=p.leaves[m]||{};p.photos[m]=p.photos[m]||"";});setState(p);}}catch(e){}}
      setLoading(false);
    };
    load();
  },[]);

  useEffect(()=>{
    const poll=async()=>{const cloud=await loadFromCloud();if(cloud){cloud.leaves=cloud.leaves||{};cloud.photos=cloud.photos||{};MEMBERS.forEach(m=>{cloud.leaves[m]=cloud.leaves[m]||{};cloud.photos[m]=cloud.photos[m]||"";});setState(prev=>JSON.stringify(prev)!==JSON.stringify(cloud)?cloud:prev);}};
    const iv=setInterval(poll,10000);return()=>clearInterval(iv);
  },[]);

  useEffect(()=>{
    if(loading)return;
    if(saveTimer.current)clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));setSaveStatus("saved");},800);
  },[state,loading]);

  const updateState=ns=>setState(ns);
  const handleUnlock=()=>{if(pwInput===EDIT_PASSWORD){setIsEditMode(true);setShowPwModal(false);setPwInput("");setPwError(false);}else{setPwError(true);setPwInput("");}};
  const handlePhotoUpload=(member,file)=>{if(!file)return;const r=new FileReader();r.onload=e=>updateState({...state,photos:{...state.photos,[member]:e.target.result}});r.readAsDataURL(file);};
  const removePhoto=m=>updateState({...state,photos:{...state.photos,[m]:""}});

  const days=useMemo(()=>buildWindow(windowOffset,today),[windowOffset,today]);
  const week1=days.slice(0,7),week2=days.slice(7,14);
  const currentWeek=useMemo(()=>{const mon=getMondayOf(today);return Array.from({length:7},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d;});},[today]);

  const getDay=iso=>(state.tasks||{})[iso]||{Leo:[],Shen:[],Raha:[]};

  const allTasks=useMemo(()=>{
    const out=[];
    Object.entries(state.tasks||{}).forEach(([date,members])=>{MEMBERS.forEach(m=>((members||{})[m]||[]).forEach(t=>out.push({...t,date,member:m})));});
    return out;
  },[state]);

  // Overload detection: find days where any member exceeds DAILY_CAP
  const overloadAlerts=useMemo(()=>{
    const alerts=[];
    const next30=Array.from({length:30},(_,i)=>{const d=new Date(today);d.setDate(today.getDate()+i);return d;}).filter(d=>!isWeekend(d));
    MEMBERS.forEach(m=>{
      const overDays=next30.filter(d=>{
        const iso=isoDate(d);
        if((state.holidays||{})[iso]||((state.leaves||{})[m]||{})[iso]) return false;
        const h=memberHoursOnDay(allTasks,m,iso,state.holidays||{},(state.leaves||{}));
        return h>DAILY_CAP;
      });
      if(overDays.length>0){
        const maxH=Math.max(...overDays.map(d=>memberHoursOnDay(allTasks,m,isoDate(d),state.holidays||{},(state.leaves||{}))));
        alerts.push({member:m,days:overDays.length,maxH:Math.round(maxH*10)/10,firstDay:fmtDate(overDays[0])});
      }
    });
    return alerts;
  },[allTasks,state.holidays,state.leaves,today]);

  // Weekly hours per member per side (current week)
  const wkHours=(member,side)=>Math.round(memberWeeklyHours(allTasks,member,currentWeek,state.holidays||{},state.leaves||{},side)*10)/10;
  const wkTotal=member=>Math.round(memberWeeklyHours(allTasks,member,currentWeek,state.holidays||{},state.leaves||{},null)*10)/10;

  // Hours on a specific day for member (for calendar heat)
  const dayHours=(member,iso)=>Math.round(memberHoursOnDay(allTasks,member,iso,state.holidays||{},state.leaves||{})*10)/10;

  const mutateMember=(iso,member,fn)=>{const ns={...state,tasks:{...state.tasks,[iso]:{...(state.tasks||{})[iso],[member]:fn(((state.tasks||{})[iso]||{})[member]||[])}}};updateState(ns);};
  const toggleDone=(iso,member,id)=>mutateMember(iso,member,list=>list.map(t=>t.id===id?{...t,done:!t.done}:t));
  const removeTask=(iso,member,id)=>mutateMember(iso,member,list=>list.filter(t=>t.id!==id));
  const updateStatus=(iso,member,id,status)=>mutateMember(iso,member,list=>list.map(t=>t.id===id?{...t,status}:t));

  const addTask=()=>{
    if(!isEditMode||!form.project.trim()||!form.deadline)return;
    const hrs=form.customHours?Number(form.customHours):form.hours;
    const task={id:Date.now(),side:form.side,type:form.type,hours:hrs,status:form.side==="execution"?form.status:"",priority:form.side==="execution"?form.priority:"",project:form.project.trim(),startDate:form.startDate,deadline:form.deadline,done:false};
    const iso=form.deadline;
    const ns={...state,tasks:{...state.tasks,[iso]:{...(state.tasks||{})[iso],[form.member]:[...((state.tasks||{})[iso]?.[form.member]||[]),task]}}};
    updateState(ns);setForm(emptyForm());
  };

  const openEdit=(iso,member,task)=>{if(!isEditMode)return;setEditTask({iso,member,task});setEditForm({side:task.side||"pitch",type:task.type||"booth",hours:task.hours||4,customHours:"",status:task.status||"inprogress",priority:task.priority||"normal",project:task.project,startDate:task.startDate||"",deadline:task.deadline});};
  const saveEdit=()=>{
    if(!editTask||!editForm.project.trim()||!editForm.deadline)return;
    const {iso,member,task}=editTask;
    const hrs=editForm.customHours?Number(editForm.customHours):editForm.hours;
    const updated={...task,side:editForm.side,type:editForm.type,hours:hrs,status:editForm.status,priority:editForm.priority,project:editForm.project.trim(),startDate:editForm.startDate,deadline:editForm.deadline};
    const oldList=((state.tasks[iso]||{})[member]||[]).filter(t=>t.id!==task.id);
    const nd=editForm.deadline;
    const newList=[...((state.tasks[nd]||{})[member]||[]),updated];
    updateState({...state,tasks:{...state.tasks,[iso]:{...(state.tasks[iso]||{}),[member]:oldList},[nd]:{...(state.tasks[nd]||{}),[member]:newList}}});
    setEditTask(null);
  };

  const addLeave=()=>{if(!isEditMode||!leaveForm.date)return;updateState({...state,leaves:{...state.leaves,[leaveForm.member]:{...state.leaves[leaveForm.member],[leaveForm.date]:true}}});setLeaveForm(f=>({...f,date:""}));};
  const removeLeave=(m,d)=>{if(!isEditMode)return;const u={...state.leaves[m]};delete u[d];updateState({...state,leaves:{...state.leaves,[m]:u}});};
  const addHoliday=()=>{if(!isEditMode||!holForm.date||!holForm.label.trim())return;updateState({...state,holidays:{...state.holidays,[holForm.date]:holForm.label.trim()}});setHolForm({date:"",label:""});};
  const removeHoliday=d=>{if(!isEditMode)return;const h={...state.holidays};delete h[d];updateState({...state,holidays:h});};
  const isActiveTaskDay=(iso,member)=>allTasks.some(t=>{if(t.member!==member||t.done)return false;const s=t.startDate||t.deadline;return iso>=s&&iso<=t.deadline;});

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

  const DoneBtn=({done,onClick,size=20})=>(
    <button onClick={isEditMode?onClick:undefined} style={{flexShrink:0,width:size,height:size,borderRadius:"50%",border:`2px solid ${done?"#3B6D11":isEditMode?"#888780":"#ddd"}`,background:done?"#3B6D11":isEditMode?"#fff":"#f5f5f5",cursor:isEditMode?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",padding:0,boxShadow:done?"0 0 0 3px #C0DD97":"0 0 0 1px #D3D1C7"}}>
      {done?<span style={{color:"#fff",fontSize:size*0.55,lineHeight:1,fontWeight:700}}>✓</span>:<span style={{color:"#B4B2A9",fontSize:size*0.45,lineHeight:1}}>○</span>}
    </button>
  );

  const BoardCard=({t,iso,member})=>{
    const tt=TASK_TYPES.find(x=>x.id===t.type)||TASK_TYPES[0];
    const st=EXEC_STATUSES.find(x=>x.id===t.status);
    const pr=PRIORITIES.find(x=>x.id===t.priority);
    const dLeft=!t.done?daysUntil(t.deadline,TODAY_ISO):null;
    const isPast=!t.done&&t.deadline<TODAY_ISO;
    return(
      <div style={{borderRadius:10,padding:"10px 12px",background:t.done?"#f9f9f9":M_BG[member],opacity:t.done?0.6:1,marginBottom:8,border:`1px solid ${t.done?"#eee":isPast?"#F09595":M_BORDER[member]}`,borderLeft:`4px solid ${t.done?"#ddd":M_COLOR[member]}`}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
          <DoneBtn done={t.done} onClick={()=>toggleDone(iso,member,t.id)} size={20}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}>
              <span style={{fontSize:11,fontWeight:500,background:"rgba(0,0,0,0.06)",color:M_TEXT[member],borderRadius:4,padding:"1px 7px"}}>{tt.label}</span>
              {pr&&t.side==="execution"&&<span style={{fontSize:10,fontWeight:600,background:pr.bg,color:pr.color,border:`1px solid ${pr.border}`,borderRadius:12,padding:"1px 8px"}}>{pr.label}</span>}
              <span style={{fontSize:13,fontWeight:600,flex:1,textDecoration:t.done?"line-through":"none",color:t.done?"#888":"#111"}}>{t.project}</span>
              {isPast&&!t.done&&<span style={{fontSize:10,background:"#FCEBEB",color:"#A32D2D",borderRadius:4,padding:"1px 6px",fontWeight:600}}>Overdue</span>}
              {isEditMode&&<><button onClick={()=>openEdit(iso,member,t)} style={{fontSize:11,background:"none",border:"0.5px solid #ccc",borderRadius:4,cursor:"pointer",color:"#888",padding:"1px 5px"}}>✏</button><button onClick={()=>removeTask(iso,member,t.id)} style={{fontSize:12,background:"none",border:"none",color:"#bbb",cursor:"pointer",padding:"0 2px"}}>✕</button></>}
            </div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",marginBottom:t.side==="execution"&&!t.done?6:0}}>
              <span style={{fontSize:11,color:"#888"}}>⏱ <b style={{color:"#111"}}>{t.hours}h/day</b></span>
              {t.startDate&&<span style={{fontSize:11,color:"#888"}}>▶ <b style={{color:"#111"}}>{t.startDate}</b></span>}
              <span style={{fontSize:11,color:isPast?"#A32D2D":"#888"}}>🏁 <b style={{color:isPast?"#A32D2D":"#111"}}>{t.deadline}</b></span>
              {dLeft!==null&&dLeft>=0&&<span style={{fontSize:11,color:dLeft<=3?"#A32D2D":"#888"}}><b style={{color:dLeft<=3?"#A32D2D":"#111"}}>{dLeft}</b>d left</span>}
              {t.done&&<span style={{fontSize:11,background:"#EAF3DE",color:"#3B6D11",borderRadius:6,padding:"1px 7px"}}>✓ Done</span>}
            </div>
            {t.side==="execution"&&!t.done&&(
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {EXEC_STATUSES.map(s=>(
                  <button key={s.id} onClick={()=>isEditMode&&updateStatus(iso,member,t.id,s.id)} style={{fontSize:10,fontWeight:s.id===t.status?600:400,padding:"2px 8px",borderRadius:20,border:`1px solid ${s.id===t.status?s.border:"#ddd"}`,background:s.id===t.status?s.bg:"transparent",color:s.id===t.status?s.color:"#bbb",cursor:isEditMode?"pointer":"default",transition:"all .15s"}}>{s.label}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const CompactCard=({t,iso,member})=>{
    const tt=TASK_TYPES.find(x=>x.id===t.type)||TASK_TYPES[0];
    const st=t.side==="execution"?EXEC_STATUSES.find(x=>x.id===t.status):null;
    const pr=t.side==="execution"?PRIORITIES.find(x=>x.id===t.priority):null;
    const dLeft=!t.done?daysUntil(t.deadline,TODAY_ISO):null;
    const isPast=!t.done&&t.deadline<TODAY_ISO;
    const borderColor=isPast?"#F09595":t.side==="pitch"?"#AFA9EC":"#5DCAA5";
    return(
      <div style={{borderRadius:5,padding:"3px 6px",background:t.done?"#f5f5f5":M_BG[member],opacity:t.done?0.55:1,marginBottom:2,border:`1px solid ${t.done?"#ddd":borderColor}`,borderLeft:`3px solid ${t.done?"#ddd":t.side==="pitch"?"#534AB7":"#0F6E56"}`}}>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <DoneBtn done={t.done} onClick={()=>toggleDone(iso,member,t.id)} size={14}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:9,fontWeight:700,color:M_TEXT[member],textTransform:"uppercase",letterSpacing:"0.3px"}}>{member} · {t.side==="pitch"?"🎯":"⚙"}</div>
            <div style={{fontSize:10,color:t.done?"#888":M_TEXT[member],fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textDecoration:t.done?"line-through":"none"}}>{t.project}</div>
            <div style={{display:"flex",gap:3,marginTop:1,flexWrap:"wrap",alignItems:"center"}}>
              <span style={{fontSize:8,color:M_TEXT[member],opacity:0.75}}>{tt.label}</span>
              <span style={{fontSize:8,color:"#888"}}>⏱{t.hours}h/d</span>
              {st&&<span style={{fontSize:8,background:st.bg,color:st.color,borderRadius:3,padding:"0 4px"}}>{st.label}</span>}
              {pr&&<span style={{fontSize:8,background:pr.bg,color:pr.color,borderRadius:3,padding:"0 4px"}}>{pr.label}</span>}
              {dLeft!==null&&dLeft<=3&&!t.done&&<span style={{fontSize:8,fontWeight:700,color:isPast?"#A32D2D":"#854F0B"}}>{isPast?"Overdue":`${dLeft}d`}</span>}
            </div>
          </div>
          {isEditMode&&<button onClick={()=>removeTask(iso,member,t.id)} style={{fontSize:9,background:"none",border:"none",color:"#bbb",cursor:"pointer",padding:0}}>✕</button>}
        </div>
      </div>
    );
  };

  const DayCell=({day})=>{
    const iso=isoDate(day),weekend=isWeekend(day),holiday=(state.holidays||{})[iso],isToday=iso===TODAY_ISO;
    const dayTasks=getDay(iso);
    const lL=(state.leaves||{}).Leo?.[iso],sL=(state.leaves||{}).Shen?.[iso],rL=(state.leaves||{}).Raha?.[iso];
    // Daily load per member for heat tinting
    const memberLoads=MEMBERS.map(m=>({m,h:dayHours(m,iso)}));
    const anyOverload=!weekend&&!holiday&&memberLoads.some(({h})=>h>DAILY_CAP);
    return(
      <div style={{minHeight:110,borderRadius:8,border:isToday?"2px solid #534AB7":"0.5px solid #ddd",background:weekend?"#ECEAE4":holiday?"#FDF3E0":anyOverload?"#FFF8F0":"#fff",padding:"5px 6px",display:"flex",flexDirection:"column",gap:2}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:1}}>
          <span style={{fontSize:11,fontWeight:isToday?700:500,color:weekend?"#888780":isToday?"#534AB7":"#111"}}>{dayLabel(day)} {day.getDate()}</span>
          <div style={{display:"flex",gap:3,alignItems:"center"}}>
            {isToday&&<span style={{fontSize:9,background:"#EEEDFE",color:"#534AB7",borderRadius:4,padding:"1px 5px",fontWeight:600}}>Today</span>}
            {holiday&&!isToday&&<span style={{fontSize:9,background:"#FAEEDA",color:"#854F0B",borderRadius:4,padding:"1px 5px",maxWidth:56,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{holiday}</span>}
            {anyOverload&&<span style={{fontSize:9,color:"#E24B4A",fontWeight:700}}>⚠</span>}
          </div>
        </div>
        {weekend?<span style={{fontSize:10,color:"#888780",fontStyle:"italic"}}>No work</span>
          :<>
            {/* Mini load bars per member */}
            {!holiday&&<div style={{display:"flex",gap:2,marginBottom:2}}>
              {MEMBERS.map(m=>{
                const h=dayHours(m,iso);
                if(h===0)return null;
                const pct=Math.min(100,(h/DAILY_CAP)*100);
                const over=h>DAILY_CAP;
                return <div key={m} title={`${m}: ${h}h`} style={{flex:1,height:3,borderRadius:2,background:"#eee",overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${pct}%`,background:over?"#E24B4A":M_COLOR[m],borderRadius:2,transition:"width .3s"}}/>
                </div>;
              })}
            </div>}
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
    const workdays=wDays.filter(d=>!isWeekend(d)&&!(state.holidays||{})[isoDate(d)]).length;
    return(
      <div style={{marginBottom:18}}>
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8,flexWrap:"wrap"}}>
          <span style={{fontSize:12,fontWeight:500}}>{label} · {fmtDate(wDays[0])} – {fmtDate(wDays[6])}</span>
          <span style={{fontSize:11,color:"#888"}}>{workdays} working days</span>
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
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}} onClick={()=>setEditTask(null)}>
        <div style={{background:"rgba(255,255,255,0.98)",borderRadius:14,padding:"20px 22px",width:360,maxHeight:"90vh",overflowY:"auto",boxSizing:"border-box",border:`2px solid ${M_BORDER[member]}`}} onClick={e=>e.stopPropagation()}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}><Avatar member={member} size={26}/><span style={{fontWeight:600,fontSize:14,color:"#111"}}>Edit — {member}</span></div>
            <button onClick={()=>setEditTask(null)} style={{background:"none",border:"none",fontSize:16,cursor:"pointer",color:"#888"}}>✕</button>
          </div>
          <div style={{display:"flex",gap:6,marginBottom:12}}>
            {["pitch","execution"].map(s=><button key={s} onClick={()=>setEditForm(f=>({...f,side:s,type:"booth"}))} style={{flex:1,padding:"7px 0",fontSize:12,fontWeight:500,borderRadius:8,cursor:"pointer",background:editForm.side===s?(s==="pitch"?"#EEEDFE":"#E1F5EE"):"#f5f5f5",color:editForm.side===s?(s==="pitch"?"#534AB7":"#0F6E56"):"#888",border:`1.5px solid ${editForm.side===s?(s==="pitch"?"#AFA9EC":"#5DCAA5"):"#ddd"}`}}>{s==="pitch"?"🎯 Pitch":"⚙ Execution"}</button>)}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div><label style={{fontSize:11,color:"#555",display:"block",marginBottom:4}}>Task type</label><select value={editForm.type} onChange={e=>setEditForm(f=>({...f,type:e.target.value}))} style={{width:"100%",fontSize:13,padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}>{TASK_TYPES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
            <div><label style={{fontSize:11,color:"#555",display:"block",marginBottom:4}}>Project name</label><input value={editForm.project} onChange={e=>setEditForm(f=>({...f,project:e.target.value}))} style={{width:"100%",fontSize:13,boxSizing:"border-box",padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}/></div>
            <div>
              <label style={{fontSize:11,color:"#555",display:"block",marginBottom:6}}>Hours per day</label>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>{HOUR_PRESETS.map(h=><button key={h} onClick={()=>setEditForm(f=>({...f,hours:h,customHours:""}))} style={{padding:"5px 10px",fontSize:12,borderRadius:6,cursor:"pointer",background:editForm.hours===h&&!editForm.customHours?"#534AB7":"#f5f5f5",color:editForm.hours===h&&!editForm.customHours?"#fff":"#555",border:`0.5px solid ${editForm.hours===h&&!editForm.customHours?"#534AB7":"#ddd"}`}}>{h}h</button>)}</div>
              <input type="number" placeholder="Custom hrs/day" value={editForm.customHours} onChange={e=>setEditForm(f=>({...f,customHours:e.target.value}))} style={{width:"100%",fontSize:13,boxSizing:"border-box",padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}/>
            </div>
            {editForm.side==="execution"&&<>
              <div><label style={{fontSize:11,color:"#555",display:"block",marginBottom:6}}>Priority</label><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{PRIORITIES.map(p=><button key={p.id} onClick={()=>setEditForm(f=>({...f,priority:p.id}))} style={{fontSize:11,padding:"4px 10px",borderRadius:20,cursor:"pointer",background:editForm.priority===p.id?p.bg:"transparent",color:editForm.priority===p.id?p.color:"#aaa",border:`1px solid ${editForm.priority===p.id?p.border:"#ddd"}`}}>{p.label}</button>)}</div></div>
              <div><label style={{fontSize:11,color:"#555",display:"block",marginBottom:6}}>Status</label><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{EXEC_STATUSES.map(s=><button key={s.id} onClick={()=>setEditForm(f=>({...f,status:s.id}))} style={{fontSize:11,padding:"4px 10px",borderRadius:20,cursor:"pointer",background:editForm.status===s.id?s.bg:"transparent",color:editForm.status===s.id?s.color:"#aaa",border:`1px solid ${editForm.status===s.id?s.border:"#ddd"}`}}>{s.label}</button>)}</div></div>
            </>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div><label style={{fontSize:11,color:"#555",display:"block",marginBottom:4}}>Start date</label><input type="date" value={editForm.startDate} onChange={e=>setEditForm(f=>({...f,startDate:e.target.value}))} style={{width:"100%",fontSize:13,boxSizing:"border-box",padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}/></div>
              <div><label style={{fontSize:11,color:"#555",display:"block",marginBottom:4}}>Deadline</label><input type="date" value={editForm.deadline} onChange={e=>setEditForm(f=>({...f,deadline:e.target.value}))} style={{width:"100%",fontSize:13,boxSizing:"border-box",padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}/></div>
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
      <div style={{background:"rgba(255,255,255,0.97)",borderRadius:14,padding:"24px",width:300,boxSizing:"border-box",border:"2px solid #AFA9EC"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><span style={{fontWeight:600,fontSize:15,color:"#111"}}>🔒 Editor access</span><button onClick={()=>{setShowPwModal(false);setPwInput("");setPwError(false);}} style={{background:"none",border:"none",fontSize:16,cursor:"pointer",color:"#888"}}>✕</button></div>
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

  const currentTypeList=TASK_TYPES;

  return(
    <div style={{fontFamily:"system-ui,sans-serif",color:"#111",maxWidth:1100,margin:"0 auto"}}>
      {showPwModal&&<PasswordModal/>}
      <EditModal/>

      {/* ── HEADER ── */}
      <div style={{background:"linear-gradient(135deg,#1a1040 0%,#2d1b69 50%,#1a3a2a 100%)",borderRadius:"0 0 20px 20px",padding:"24px 24px 0"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
          <div>
            <h2 style={{margin:0,fontSize:22,fontWeight:700,color:"#fff"}}>3D Team Capacity</h2>
            <p style={{margin:"4px 0 0",fontSize:12,color:"rgba(255,255,255,0.5)"}}>Workload and Calendar Tracker · Philippines Time · Week of {fmtDate(currentWeek[0])}</p>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:11,color:"rgba(255,255,255,0.4)",display:"flex",alignItems:"center",gap:4}}>
              <span style={{display:"inline-block",width:7,height:7,borderRadius:"50%",background:saveStatus==="error"?"#E24B4A":"#639922"}}/>
              {saveStatus==="saving"?"Syncing…":saveStatus==="error"?"Sync failed":"Synced"}
            </span>
            {isEditMode&&<button onClick={async()=>{setSaveStatus("saving");const ok=await saveToCloud(state);setSaveStatus("saved");alert(ok?"✅ Synced! Team can refresh.":"❌ Sync failed.");}} style={{fontSize:12,fontWeight:500,padding:"6px 14px",borderRadius:20,cursor:"pointer",background:"rgba(99,153,34,0.3)",color:"#9FE1CB",border:"1px solid rgba(99,153,34,0.5)"}}>☁ Sync to cloud</button>}
            {isEditMode?<button onClick={()=>setIsEditMode(false)} style={{fontSize:12,fontWeight:500,padding:"6px 14px",borderRadius:20,cursor:"pointer",background:"rgba(159,225,203,0.2)",color:"#9FE1CB",border:"1px solid rgba(159,225,203,0.4)"}}>✓ Editing — Lock</button>:<button onClick={()=>setShowPwModal(true)} style={{fontSize:12,fontWeight:500,padding:"6px 14px",borderRadius:20,cursor:"pointer",background:"rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.7)",border:"1px solid rgba(255,255,255,0.2)"}}>🔒 View only</button>}
          </div>
        </div>

        {/* Capacity cards */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
          {MEMBERS.map(m=>{
            const ph=wkHours(m,"pitch");
            const eh=wkHours(m,"execution");
            const total=wkTotal(m);
            const free=Math.max(0,Math.round((WEEKLY_CAP-total)*10)/10);
            const pPct=Math.min(100,Math.round((ph/WEEKLY_CAP)*100));
            const ePct=Math.min(100,Math.round((eh/WEEKLY_CAP)*100));
            const totalPct=Math.min(100,Math.round((total/WEEKLY_CAP)*100));
            const over=totalPct>=90,mod=totalPct>=60;
            const badge=over?{bg:"rgba(226,75,74,0.25)",text:"#F09595",label:"⚠ Near Full"}:mod?{bg:"rgba(239,159,39,0.2)",text:"#FAC775",label:"Moderate"}:{bg:"rgba(99,153,34,0.2)",text:"#9FE1CB",label:"Available"};
            const leaveDays=Object.keys((state.leaves||{})[m]||{}).filter(d=>{const dd=new Date(d+"T00:00:00");return dd>=days[0]&&dd<=days[13];});
            return(
              <div key={m} style={{background:"rgba(255,255,255,0.08)",borderRadius:"14px 14px 0 0",padding:"16px",border:"1px solid rgba(255,255,255,0.12)",borderBottom:"none"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                  <Avatar member={m} size={42} showUpload={true}/>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:16,color:"#fff"}}>{m}</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,0.45)"}}>{M_ROLE[m]}</div>
                  </div>
                  <span style={{fontSize:11,fontWeight:700,background:badge.bg,color:badge.text,borderRadius:20,padding:"4px 10px",border:`1px solid ${badge.text}44`}}>{badge.label}</span>
                </div>

                {/* Pitch capacity */}
                <div style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:11,color:"rgba(255,255,255,0.5)",display:"flex",alignItems:"center",gap:5}}><span style={{width:10,height:10,borderRadius:3,background:"#7F77DD",display:"inline-block"}}/>🎯 Pitches</span>
                    <span style={{fontSize:11,color:"#fff",fontWeight:600}}>{ph}h <span style={{color:"rgba(255,255,255,0.4)",fontWeight:400"}}>/ {WEEKLY_CAP}h ({pPct}%)</span></span>
                  </div>
                  <div style={{height:7,borderRadius:4,background:"rgba(255,255,255,0.1)",overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pPct}%`,background:"linear-gradient(90deg,#534AB7,#7F77DD)",borderRadius:4,transition:"width .4s"}}/>
                  </div>
                </div>

                {/* Execution capacity */}
                <div style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:11,color:"rgba(255,255,255,0.5)",display:"flex",alignItems:"center",gap:5}}><span style={{width:10,height:10,borderRadius:3,background:"#1D9E75",display:"inline-block"}}/>⚙ Executions</span>
                    <span style={{fontSize:11,color:"#fff",fontWeight:600}}>{eh}h <span style={{color:"rgba(255,255,255,0.4)",fontWeight:400}}>/ {WEEKLY_CAP}h ({ePct}%)</span></span>
                  </div>
                  <div style={{height:7,borderRadius:4,background:"rgba(255,255,255,0.1)",overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${ePct}%`,background:"linear-gradient(90deg,#0F6E56,#1D9E75)",borderRadius:4,transition:"width .4s"}}/>
                  </div>
                </div>

                {/* Combined total */}
                <div style={{borderTop:"1px solid rgba(255,255,255,0.1)",paddingTop:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:11,color:"rgba(255,255,255,0.5)"}}>Total this week</span>
                    <span style={{fontSize:12,color:over?"#F09595":mod?"#FAC775":"#9FE1CB",fontWeight:700}}>{total}h / {WEEKLY_CAP}h</span>
                  </div>
                  <div style={{height:5,borderRadius:4,background:"rgba(255,255,255,0.1)",overflow:"hidden",display:"flex"}}>
                    <div style={{height:"100%",width:`${pPct}%`,background:"#534AB7",transition:"width .4s"}}/>
                    <div style={{height:"100%",width:`${ePct}%`,background:"#0F6E56",transition:"width .4s"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                    <span style={{fontSize:10,color:"rgba(255,255,255,0.35)"}}>Free: {free}h</span>
                    <span style={{fontSize:10,color:"rgba(255,255,255,0.35)"}}>{WEEKLY_CAP-Math.round(total)}h remaining</span>
                  </div>
                </div>
                {leaveDays.length>0&&<div style={{marginTop:6,fontSize:10,color:"#FAC775"}}>🏖 {leaveDays.length} leave day{leaveDays.length>1?"s":""}</div>}
                {isEditMode&&(state.photos||{})[m]&&<button onClick={()=>removePhoto(m)} style={{marginTop:4,fontSize:10,background:"rgba(255,255,255,0.1)",border:"none",borderRadius:4,color:"rgba(255,255,255,0.5)",cursor:"pointer",padding:"2px 6px"}}>Remove photo</button>}
              </div>
            );
          })}
        </div>

        {/* Tab bar */}
        <div style={{display:"flex",gap:0,paddingTop:4}}>
          {[["calendar","📅 Calendar"],["board","📋 Board"]].map(([key,lbl])=>(
            <button key={key} onClick={()=>setTab(key)} style={{flex:1,fontSize:13,fontWeight:tab===key?700:400,padding:"12px 0",cursor:"pointer",background:tab===key?"#fff":"transparent",color:tab===key?"#111":"rgba(255,255,255,0.55)",border:"none",borderRadius:tab===key?"10px 10px 0 0":"0",transition:"all .2s"}}>{lbl}</button>
          ))}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{background:"#fff",borderRadius:"0 0 16px 16px",padding:"20px",border:"1px solid #eee",borderTop:"none",marginBottom:16}}>

        {/* Overload alerts */}
        {overloadAlerts.length>0&&(
          <div style={{background:"#FCEBEB",border:"1px solid #F09595",borderRadius:10,padding:"12px 16px",marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:700,color:"#A32D2D",marginBottom:6}}>⚠ Overload detected — daily capacity ({DAILY_CAP}h) exceeded</div>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              {overloadAlerts.map(a=>(
                <div key={a.member} style={{display:"flex",alignItems:"center",gap:8,background:"#fff",borderRadius:8,padding:"6px 12px",border:"0.5px solid #F09595"}}>
                  <span style={{fontSize:12,fontWeight:700,color:M_TEXT[a.member]}}>{a.member}</span>
                  <span style={{fontSize:11,color:"#A32D2D"}}>{a.days} day{a.days>1?"s":""} overloaded · up to <b>{a.maxH}h/day</b> · starts {a.firstDay}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isEditMode&&<div style={{background:"#f9f9f9",border:"0.5px solid #eee",borderRadius:8,padding:"8px 14px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}><span style={{fontSize:12,color:"#888"}}>👁 View only — read-only mode.</span><button onClick={()=>setShowPwModal(true)} style={{fontSize:11,color:"#534AB7",background:"none",border:"0.5px solid #AFA9EC",borderRadius:6,padding:"3px 10px",cursor:"pointer"}}>Unlock editing</button></div>}

        {/* CALENDAR */}
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
          <div style={{display:"flex",gap:12,flexWrap:"wrap",fontSize:11,color:"#888",marginTop:4,padding:"8px 10px",background:"#f9f9f9",borderRadius:8}}>
            <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:"#ECEAE4",borderRadius:2,display:"inline-block",border:"0.5px solid #C4C2B9"}}/>Weekend</span>
            <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:"#FFF8F0",borderRadius:2,display:"inline-block",border:"0.5px solid #EF9F27"}}/>Overloaded day</span>
            <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:4,borderRadius:2,background:"#534AB7",display:"inline-block"}}/>🎯 Pitch hours</span>
            <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:4,borderRadius:2,background:"#0F6E56",display:"inline-block"}}/>⚙ Execution hours</span>
            <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:4,borderRadius:2,background:"#E24B4A",display:"inline-block"}}/>Over 8h/day</span>
          </div>
        </div>}

        {/* BOARD */}
        {tab==="board"&&<div>
          <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
            {MEMBERS.map(m=>(
              <button key={m} onClick={()=>setBoardMember(m)} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 16px",borderRadius:10,cursor:"pointer",background:boardMember===m?M_BG[m]:"#f9f9f9",border:`1.5px solid ${boardMember===m?M_BORDER[m]:"#eee"}`}}>
                <Avatar member={m} size={22}/>
                <span style={{fontSize:13,fontWeight:boardMember===m?700:400,color:boardMember===m?M_TEXT[m]:"#888"}}>{m}</span>
              </button>
            ))}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
            {/* Pitches */}
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,padding:"10px 14px",background:"#EEEDFE",borderRadius:10,border:"1px solid #AFA9EC"}}>
                <span style={{fontSize:15,fontWeight:700,color:"#534AB7"}}>🎯 Pitches</span>
                <div style={{flex:1}}>
                  <div style={{height:5,borderRadius:3,background:"rgba(83,74,183,0.15)",overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${Math.min(100,Math.round((wkHours(boardMember,"pitch")/WEEKLY_CAP)*100))}%`,background:"#534AB7",borderRadius:3}}/>
                  </div>
                </div>
                <span style={{fontSize:12,fontWeight:700,color:"#534AB7"}}>{wkHours(boardMember,"pitch")}h this week</span>
              </div>
              {(()=>{
                const tasks=allTasks.filter(t=>t.member===boardMember&&t.side==="pitch").sort((a,b)=>a.deadline.localeCompare(b.deadline));
                const active=tasks.filter(t=>!t.done),done=tasks.filter(t=>t.done);
                if(!tasks.length)return<div style={{textAlign:"center",padding:"30px 0",color:"#bbb",fontSize:13}}>No pitch tasks assigned</div>;
                return<>{active.map(t=><BoardCard key={t.id} t={t} iso={t.date} member={boardMember}/>)}{done.length>0&&<><p style={{fontSize:11,color:"#3B6D11",fontWeight:600,margin:"8px 0 4px"}}>✓ Completed ({done.length})</p>{done.map(t=><BoardCard key={t.id} t={t} iso={t.date} member={boardMember}/>)}</>}</>;
              })()}
            </div>

            {/* Executions */}
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,padding:"10px 14px",background:"#E1F5EE",borderRadius:10,border:"1px solid #5DCAA5"}}>
                <span style={{fontSize:15,fontWeight:700,color:"#0F6E56"}}>⚙ Executions</span>
                <div style={{flex:1}}>
                  <div style={{height:5,borderRadius:3,background:"rgba(15,110,86,0.15)",overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${Math.min(100,Math.round((wkHours(boardMember,"execution")/WEEKLY_CAP)*100))}%`,background:"#0F6E56",borderRadius:3}}/>
                  </div>
                </div>
                <span style={{fontSize:12,fontWeight:700,color:"#0F6E56"}}>{wkHours(boardMember,"execution")}h this week</span>
              </div>
              {(()=>{
                const tasks=allTasks.filter(t=>t.member===boardMember&&t.side==="execution").sort((a,b)=>{const pa=PRIORITIES.findIndex(p=>p.id===a.priority),pb=PRIORITIES.findIndex(p=>p.id===b.priority);return pa-pb||a.deadline.localeCompare(b.deadline);});
                const active=tasks.filter(t=>!t.done),done=tasks.filter(t=>t.done);
                if(!tasks.length)return<div style={{textAlign:"center",padding:"30px 0",color:"#bbb",fontSize:13}}>No execution tasks assigned</div>;
                return<>{active.map(t=><BoardCard key={t.id} t={t} iso={t.date} member={boardMember}/>)}{done.length>0&&<><p style={{fontSize:11,color:"#3B6D11",fontWeight:600,margin:"8px 0 4px"}}>✓ Completed ({done.length})</p>{done.map(t=><BoardCard key={t.id} t={t} iso={t.date} member={boardMember}/>)}</>}</>;
              })()}
            </div>
          </div>
        </div>}
      </div>

      {/* ── FORM ── */}
      {isEditMode&&<div style={{background:"#fff",border:"0.5px solid #eee",borderRadius:14,padding:"18px",marginBottom:16}}>
        <div style={{display:"flex",gap:4,marginBottom:14}}>
          {[["task","Assign Task"],["leave","Add Leave"],["holiday","Add Holiday"]].map(([key,lbl])=>(
            <button key={key} onClick={()=>setFormTab(key)} style={{fontSize:12,fontWeight:500,padding:"6px 14px",borderRadius:20,cursor:"pointer",background:formTab===key?"#111":"transparent",color:formTab===key?"#fff":"#888",border:`0.5px solid ${formTab===key?"#111":"#ccc"}`}}>{lbl}</button>
          ))}
        </div>

        {formTab==="task"&&<>
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            {["pitch","execution"].map(s=>(
              <button key={s} onClick={()=>setForm(f=>({...f,side:s,type:"booth"}))} style={{flex:1,padding:"10px 0",fontSize:13,fontWeight:700,borderRadius:10,cursor:"pointer",background:form.side===s?(s==="pitch"?"#EEEDFE":"#E1F5EE"):"#f5f5f5",color:form.side===s?(s==="pitch"?"#534AB7":"#0F6E56"):"#888",border:`2px solid ${form.side===s?(s==="pitch"?"#AFA9EC":"#5DCAA5"):"#eee"}`}}>
                {s==="pitch"?"🎯 Pitch":"⚙ Execution"}
              </button>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div><label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Team member</label><select value={form.member} onChange={e=>setForm(f=>({...f,member:e.target.value}))} style={{width:"100%",fontSize:13,padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}>{MEMBERS.map(m=><option key={m}>{m}</option>)}</select></div>
            <div><label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Task type</label><select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={{width:"100%",fontSize:13,padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}>{currentTypeList.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
            <div><label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Start date (optional)</label><input type="date" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} style={{width:"100%",fontSize:13,boxSizing:"border-box",padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}/></div>
            <div><label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Deadline</label><input type="date" value={form.deadline} onChange={e=>setForm(f=>({...f,deadline:e.target.value}))} style={{width:"100%",fontSize:13,boxSizing:"border-box",padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}/></div>
            <div style={{gridColumn:"1 / -1"}}>
              <label style={{fontSize:11,color:"#888",display:"block",marginBottom:6}}>Hours per day <span style={{color:"#bbb",fontWeight:400}}>(deducted from 8h daily budget)</span></label>
              <div style={{display:"flex",gap:6,marginBottom:6,flexWrap:"wrap"}}>
                {HOUR_PRESETS.map(h=><button key={h} onClick={()=>setForm(f=>({...f,hours:h,customHours:""}))} style={{padding:"6px 14px",fontSize:12,borderRadius:8,cursor:"pointer",background:form.hours===h&&!form.customHours?"#534AB7":"#f5f5f5",color:form.hours===h&&!form.customHours?"#fff":"#555",border:`0.5px solid ${form.hours===h&&!form.customHours?"#534AB7":"#ddd"}`}}>{h}h</button>)}
                <input type="number" min="0.5" max="8" step="0.5" placeholder="Custom" value={form.customHours} onChange={e=>setForm(f=>({...f,customHours:e.target.value}))} style={{width:80,fontSize:13,padding:"6px 8px",borderRadius:8,border:"0.5px solid #ccc",boxSizing:"border-box"}}/>
              </div>
            </div>
            {form.side==="execution"&&<>
              <div style={{gridColumn:"1 / -1"}}>
                <label style={{fontSize:11,color:"#888",display:"block",marginBottom:6}}>Priority</label>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {PRIORITIES.map(p=><button key={p.id} onClick={()=>setForm(f=>({...f,priority:p.id}))} style={{fontSize:12,padding:"6px 14px",borderRadius:20,cursor:"pointer",background:form.priority===p.id?p.bg:"transparent",color:form.priority===p.id?p.color:"#aaa",border:`1px solid ${form.priority===p.id?p.border:"#ddd"}`,fontWeight:form.priority===p.id?700:400}}>{p.label}</button>)}
                </div>
              </div>
              <div style={{gridColumn:"1 / -1"}}>
                <label style={{fontSize:11,color:"#888",display:"block",marginBottom:6}}>Status</label>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {EXEC_STATUSES.map(s=><button key={s.id} onClick={()=>setForm(f=>({...f,status:s.id}))} style={{fontSize:11,padding:"5px 12px",borderRadius:20,cursor:"pointer",background:form.status===s.id?s.bg:"transparent",color:form.status===s.id?s.color:"#aaa",border:`1px solid ${form.status===s.id?s.border:"#ddd"}`}}>{s.label}</button>)}
                </div>
              </div>
            </>}
            <div style={{gridColumn:"1 / -1"}}><label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Project / event name</label><input value={form.project} onChange={e=>setForm(f=>({...f,project:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addTask()} placeholder="e.g. Ayala Museum pitch, SM North venue walk" style={{width:"100%",fontSize:13,boxSizing:"border-box",padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}/></div>
          </div>
          <button onClick={addTask} style={{width:"100%",padding:"10px",fontSize:13,fontWeight:700,background:form.side==="pitch"?"#534AB7":"#0F6E56",color:"#fff",border:"none",borderRadius:8,cursor:"pointer"}}>+ Assign {form.side==="pitch"?"Pitch":"Execution"} Task</button>
        </>}

        {formTab==="leave"&&<>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div><label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Member</label><select value={leaveForm.member} onChange={e=>setLeaveForm(f=>({...f,member:e.target.value}))} style={{width:"100%",fontSize:13,padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}>{MEMBERS.map(m=><option key={m}>{m}</option>)}</select></div>
            <div><label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Leave date</label><input type="date" value={leaveForm.date} onChange={e=>setLeaveForm(f=>({...f,date:e.target.value}))} style={{width:"100%",fontSize:13,boxSizing:"border-box",padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}/></div>
          </div>
          <button onClick={addLeave} style={{width:"100%",padding:"10px",fontSize:13,fontWeight:500,background:"#111",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",marginBottom:12}}>+ Mark leave day</button>
          {MEMBERS.map(m=>{const ld=Object.keys((state.leaves||{})[m]||{}).sort();if(!ld.length)return null;return<div key={m} style={{marginBottom:10}}><p style={{fontSize:12,fontWeight:500,margin:"0 0 6px"}}>{m}'s leave days</p><div style={{display:"flex",flexWrap:"wrap",gap:5}}>{ld.map(d=><span key={d} style={{fontSize:11,background:M_BG[m],color:M_TEXT[m],borderRadius:6,padding:"4px 10px",display:"flex",alignItems:"center",gap:6,border:`0.5px solid ${M_BORDER[m]}`}}>{d}<button onClick={()=>removeLeave(m,d)} style={{background:"#fff",border:`1px solid ${M_BORDER[m]}`,borderRadius:"50%",width:16,height:16,cursor:"pointer",color:M_TEXT[m],fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",padding:0,fontWeight:700}}>✕</button></span>)}</div></div>;})}
        </>}

        {formTab==="holiday"&&<>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div><label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Date</label><input type="date" value={holForm.date} onChange={e=>setHolForm(f=>({...f,date:e.target.value}))} style={{width:"100%",fontSize:13,boxSizing:"border-box",padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}/></div>
            <div><label style={{fontSize:11,color:"#888",display:"block",marginBottom:4}}>Holiday name</label><input value={holForm.label} onChange={e=>setHolForm(f=>({...f,label:e.target.value}))} placeholder="e.g. Holy Week" style={{width:"100%",fontSize:13,boxSizing:"border-box",padding:"6px 8px",borderRadius:6,border:"0.5px solid #ccc"}}/></div>
          </div>
          <button onClick={addHoliday} style={{width:"100%",padding:"10px",fontSize:13,fontWeight:500,background:"#111",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",marginBottom:12}}>+ Add holiday</button>
          {Object.keys(state.holidays||{}).length>0&&<div><p style={{fontSize:12,fontWeight:500,margin:"0 0 6px"}}>Marked holidays</p><div style={{display:"flex",flexWrap:"wrap",gap:5}}>{Object.entries(state.holidays||{}).sort().map(([d,lbl])=><span key={d} style={{fontSize:11,background:"#FAEEDA",color:"#854F0B",borderRadius:6,padding:"4px 10px",display:"flex",alignItems:"center",gap:6,border:"0.5px solid #EF9F27"}}>{d} · {lbl}<button onClick={()=>removeHoliday(d)} style={{background:"#fff",border:"1px solid #EF9F27",borderRadius:"50%",width:16,height:16,cursor:"pointer",color:"#854F0B",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",padding:0,fontWeight:700}}>✕</button></span>)}</div></div>}
        </>}
      </div>}

      <div style={{display:"flex",flexWrap:"wrap",gap:6,padding:"0 0 16px"}}>
        {PRIORITIES.map(p=><span key={p.id} style={{fontSize:11,background:p.bg,color:p.color,border:`0.5px solid ${p.border}`,borderRadius:20,padding:"3px 10px"}}>{p.label}</span>)}
        {EXEC_STATUSES.map(s=><span key={s.id} style={{fontSize:11,background:s.bg,color:s.color,border:`0.5px solid ${s.border}`,borderRadius:20,padding:"3px 10px"}}>{s.label}</span>)}
      </div>
    </div>
  );
}
