/* NCBI Program Attendance - app logic (front-end demo)
   Sections: sample data -> navigation -> admin views -> student views -> scan logic -> sign in
   Replace the sample data with calls to the Express/PostgreSQL backend later. */

// ---------- Sample data (replace with API calls to the Express backend) ----------
const students=[
{id:1,no:"2023-0142",name:"Maria Clara Dela Cruz",first_name:"Maria Clara",last_name:"Dela Cruz",email:"maria.delacruz@example.com",course:"BSIT",year:3,token:"NCBI-7F3A91",active:true},
{id:2,no:"2023-0157",name:"Jose Rizal Santos",first_name:"Jose Rizal",last_name:"Santos",email:"jose.santos@example.com",course:"BSIT",year:3,token:"NCBI-2B84C0",active:true,checker:true,lead:true},
{id:3,no:"2024-0033",name:"Ana Lim Reyes",first_name:"Ana Lim",last_name:"Reyes",email:"",course:"BSED",year:2,token:"NCBI-91D5E7",active:true},
{id:4,no:"2024-0068",name:"Paolo Garcia",first_name:"Paolo",last_name:"Garcia",email:"paolo.garcia@example.com",course:"BSBA",year:2,token:"NCBI-C3A612",active:true},
{id:5,no:"2022-0210",name:"Liza Mendoza",first_name:"Liza",last_name:"Mendoza",email:"",course:"BSHM",year:4,token:"NCBI-5E07B9",active:false,inactive_reason:"Graduated"},
{id:6,no:"2025-0012",name:"Ramon Cabahug",first_name:"Ramon",last_name:"Cabahug",email:"",course:"BSIT",year:1,token:"NCBI-A41F68",active:true,claim_code:"R4MN-7K2P"},
{id:7,no:"2023-0201",name:"Kristine Mae Torralba",first_name:"Kristine Mae",last_name:"Torralba",email:"kristine.torralba@example.com",course:"BSBA",year:3,token:"NCBI-D81E25",active:true},
{id:8,no:"2025-0044",name:"Mark Anthony Villamor",first_name:"Mark Anthony",last_name:"Villamor",email:"",course:"BSHM",year:1,token:"NCBI-3C9B70",active:true,claim_code:"M8RK-3QWX"},
{id:9,no:"2022-0305",name:"Joy Salazar",first_name:"Joy",last_name:"Salazar",email:"",course:"BSED",year:4,token:"NCBI-F26A14",active:false,inactive_reason:"Dropped out"},
{id:10,no:"2024-0090",name:"Neil Abella",first_name:"Neil",last_name:"Abella",email:"neil.abella@example.com",course:"BSIT",year:2,token:"NCBI-68D0E3",active:true,checker:true}];
const programs=[
{id:1,name:"Foundation Day",date:"2026-01-15",type:"in",lateAfter:"08:00",status:"Completed",venue:"School Gym"},
{id:2,name:"Intramurals",date:"2026-02-10",type:"in",lateAfter:"08:00",status:"Completed",venue:"Sports Field"},
{id:3,name:"General Assembly",date:"2026-03-05",type:"inout",lateAfter:"08:30",status:"Completed",venue:"Auditorium"},
{id:4,name:"Career Orientation",date:new Date().toLocaleDateString("en-CA"),type:"inout",open:"00:00",lateAfter:"23:50",start:"23:55",end:"23:59",status:"Ongoing",venue:"Auditorium"},
{id:5,name:"Foundation Day 2027",date:"2027-01-15",type:"in",lateAfter:"08:00",status:"Upcoming",venue:"School Gym"}];
// Older sample programs get default times: attendance opens 07:00, starts at the cutoff, ends 17:00
programs.forEach(p=>{p.open=p.open||"07:00";p.start=p.start||p.lateAfter;p.end=p.end||"17:00";p.status=autoStatus(p)});
// att[programId][studentId] = {in,out,status,lateMin}
const att={1:{1:{in:"07:42",status:"Present"},2:{in:"08:15",status:"Late",lateMin:15},3:{in:"07:50",status:"Present"}},
2:{2:{in:"07:55",status:"Present"},4:{in:"07:40",status:"Present"}},
3:{1:{in:"08:10",out:"16:00",status:"Present"},2:{in:"08:45",out:"15:50",status:"Late",lateMin:15},3:{in:"08:00",out:"16:05",status:"Present"}},
4:{},5:{}};
const $=s=>document.querySelector(s),pname=id=>programs.find(p=>p.id==id).name;
let role=null,page="dash",me=null,log=[],lastResult=null;
const now=()=>{const d=new Date();return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0")};
const tag=s=>`<span class="tag ${s}">${s}</span>`;
// Default password = last name (lowercase, no spaces or accents) + student number, e.g. sumayo2025-0299
const defaultPw=s=>{const ln=s.last_name||String(s.name||"").trim().split(/\s+/).pop();
return ln.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"")+s.no};

// ---------- Time helpers ----------
const mins=t=>{const [h,m]=t.split(":").map(Number);return h*60+m};
const lateMin=(t,cutoff)=>Math.max(0,mins(t)-mins(cutoff));  // minutes after the on-time cutoff
const fmtTime=t=>{if(!t)return "—";const [h,m]=t.split(":").map(Number);return (h%12||12)+":"+String(m).padStart(2,"0")+(h<12?" AM":" PM")};
const fmtDur=m=>m<60?m+" min":Math.floor(m/60)+" hr"+(m%60?" "+m%60+" min":"");
const fmtLate=m=>fmtDur(m)+" late";
const lateText=r=>r&&r.status==="Late"&&r.lateMin>0?fmtLate(r.lateMin):"";
const esc=s=>String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");
// Status follows the clock: before attendance opens = Upcoming, until the program ends = Ongoing, then Completed
function autoStatus(p){
if(p.status==="Cancelled"||!p.open||!p.end)return p.status;
const n=Date.now(),at=t=>new Date(p.date+"T"+t+":00").getTime();
return n<at(p.open)?"Upcoming":n<=at(p.end)?"Ongoing":"Completed"}
const OUT_GRACE=30;   // minutes after the program ends during which check-outs are still accepted
const MINUTES=[0,5,10,15,20,30,45,60];
const hhmm=m=>String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0");
function outGrace(p){return p.type==="inout"&&p.status==="Completed"&&Date.now()<=new Date(p.date+"T"+p.end+":00").getTime()+OUT_GRACE*60000}
function closedReason(p){
if(p.status==="Cancelled")return p.name+" was cancelled.";
if(p.status==="Upcoming")return "Attendance for "+p.name+" opens at "+fmtTime(p.open)+" on "+p.date+".";
if(p.status==="Completed")return "Attendance for "+p.name+" is closed.";
return "This program is not accepting attendance."}

// Passwords are stored as a SHA-256 hash (salted with the student number), never as plain text
async function hashPw(no,pw){
const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(no+":"+pw));
return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
const genPw=()=>Array.from(crypto.getRandomValues(new Uint8Array(8)),b=>"abcdefghjkmnpqrstuvwxyz23456789"[b%31]).join("");
const isPresent=(pid,sid)=>{const a=(att[pid]||{})[sid];return !!(a&&a.in&&!a.out)};
// An SBO officer may scan when the event is open, scanning isn't paused, and they are a lead officer
// (who can start at once) or have been scanned in themselves
let scanMode="in";   // "in" or "out", chosen on the scanner for check-in and check-out programs
function officerCan(p){const r=(att[p.id]||{})[me.id];
return (p.status==="Ongoing"||outGrace(p))&&!p.paused&&(me.lead?!(r&&r.out):isPresent(p.id,me.id))}
function status(p,s){const r=(att[p.id]||{})[s.id];if(r)return r.status;return p.status==="Completed"?"Absent":"—"}

// ---------- Navigation ----------
const menus={admin:[["dash","Dashboard"],["scan","QR scanner"],["attend","Attendance"],["programs","Programs"],["students","Students"],["ctrl","Scan team"]],
student:[["sdash","My summary"],["sqr","My QR code"],["shist","My attendance"],["spw","Change password"]],
checker:[["scan","QR scanner"],["sdash","My summary"],["sqr","My QR code"],["shist","My attendance"],["spw","Change password"]]};
function nav(){
$("#nav").innerHTML=`<div class="brand"><b>North Coast Bohol Institute</b><span>Program attendance</span></div>`+
(me&&me.must_change_pw?menus.student.filter(x=>x[0]==="spw"):menus[role]).map(([k,l])=>`<button class="${k===page?"on":""}" data-k="${k}">${l}</button>`).join("")+
`<div class="role"><b>${role=="admin"?"Administrator":me.name}</b><br>${role=="admin"?"Full access":role=="checker"?"SBO officer":"Student"}<button id="out" style="margin-top:8px;border:1px solid #dcb57c;display:block;text-align:center;width:100%">Sign out</button></div>`;
document.querySelectorAll("#nav [data-k]").forEach(b=>b.onclick=()=>{page=b.dataset.k;render()});
$("#out").onclick=logout;
}
function render(){stopCam();if(me&&me.must_change_pw)page="spw";nav();views[page]();}

// ---------- Admin views ----------
const views={
dash(){
const act=programs.find(p=>p.status==="Ongoing"),rec=Object.values(att).flatMap(o=>Object.values(o));
const c=k=>programs.filter(p=>p.status===k).length,cnt=s=>rec.filter(r=>r.status===s).length;
$("#view").innerHTML=`<h1>Dashboard</h1><p class="sub">Overview of school program participation.</p>
<div class="grid">
<div class="stat"><b>${students.length}</b><span>Registered students</span></div>
<div class="stat"><b>${programs.length}</b><span>Programs</span></div>
<div class="stat"><b>${c("Upcoming")}</b><span>Upcoming</span></div>
<div class="stat"><b>${c("Ongoing")}</b><span>Ongoing</span></div>
<div class="stat"><b>${cnt("Present")}</b><span>Present records</span></div>
<div class="stat"><b>${cnt("Late")}</b><span>Late records</span></div></div>
<div class="panel"><h2>Programs</h2><div class="tablewrap"><table><tr><th>Program</th><th>Date</th><th>Mode</th><th>Status</th><th>Attended</th></tr>
${programs.map(p=>`<tr><td>${p.name}</td><td>${p.date}</td><td>${p.type=="in"?"Login only":"Login and logout"}</td><td>${tag(p.status)}</td><td>${Object.keys(att[p.id]||{}).length}/${students.filter(s=>s.active).length}</td></tr>`).join("")}</table></div></div>`;
},
scan(){
const list=role==="admin"?programs.filter(p=>p.status!=="Cancelled"):programs.filter(officerCan);
const open=list.filter(p=>p.status==="Ongoing");
if(role!=="admin"&&!list.length){
const going=programs.filter(p=>p.status==="Ongoing"),leads=students.filter(x=>x.lead&&x.active).map(x=>x.name).join(", ")||"none set yet, ask the administrator";
const why=!going.length?"No event has attendance open right now.":going.every(p=>p.paused)?"Scanning is paused by the administrator.":"A lead officer needs to scan your ID first. Lead officers: "+leads+".";
$("#view").innerHTML=`<h1>QR scanner</h1><div class="panel"><h2>Scanning isn’t available yet</h2><p>${why}</p><p class="hint">This page updates by itself. Once you can scan, the scanner appears here.</p></div>`;return}
$("#view").innerHTML=`<h1>QR scanner</h1><p class="sub">Choose a program, then scan a student’s ID.</p>
<div class="scan"><div class="panel"><h2>Scan</h2>
<div class="row"><label>Program<select id="sp">${list.map(p=>`<option value="${p.id}" ${open[0]&&p.id==open[0].id?"selected":""}>${p.name} (${p.status})</option>`).join("")}</select></label></div>
<div class="row hide" id="modebox"><div class="seg" role="group" aria-label="Scan mode"><button type="button" data-mode="in">Check in</button><button type="button" data-mode="out">Check out</button></div><span class="hint" id="modehint"></span></div>
<div class="row"><label style="flex:1">QR code value<input id="tok" placeholder="${role==="admin"?"Code or student number":"e.g. NCBI-7F3A91"}" autocomplete="off"></label><button class="btn" id="go">Record scan</button></div>
<div id="reader" class="hide"></div>
<div class="row"><button class="btn" id="cam">Start camera</button></div>
<p class="sub" style="margin:0 0 6px">${DB.on?"No camera? Type the student’s QR code value above.":"Demo only: pick a student to simulate a scan:"}</p>
<div class="row">${DB.on?"":students.map(s=>`<button class="btn alt" data-t="${s.token}">${s.name.split(" ")[0]}</button>`).join("")}${DB.on?"":`<button class="btn alt" data-t="NCBI-XXXXXX">Bad code</button>`}</div></div>
<div><div class="result" id="res" aria-live="polite"><h3>Ready to scan</h3><p class="big">Results appear here.</p></div></div></div>
<div class="panel"><h2>Recent scans</h2><div class="tablewrap"><table id="lg"></table></div></div>`;
document.querySelectorAll("[data-t]").forEach(b=>b.onclick=()=>doScan(b.dataset.t));
$("#go").onclick=()=>doScan($("#tok").value.trim());
$("#cam").onclick=toggleCam;
const syncMode=()=>{const p=programs.find(x=>x.id==$("#sp").value),io=Boolean(p&&p.type==="inout");$("#modebox").classList.toggle("hide",!io);
if(io){document.querySelectorAll("[data-mode]").forEach(b=>b.classList.toggle("on",b.dataset.mode===scanMode));
$("#modehint").textContent=scanMode==="in"?"Scanning students as they arrive.":"Scanning students as they leave. Check-outs are accepted for "+OUT_GRACE+" minutes after the program ends."}};
$("#sp").onchange=syncMode;document.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>{scanMode=b.dataset.mode;syncMode()});syncMode();
$("#tok").onkeydown=e=>{if(e.key==="Enter")doScan(e.target.value.trim())};
paintLog();if(lastResult)showRes(lastResult);
},
programs(){
$("#view").innerHTML=`<div class="head"><div><h1>Programs</h1><p class="sub">Set when attendance opens, when the program starts and ends, and how long students have to arrive on time.</p></div><button class="btn" id="new-pg">New program</button></div>
<div class="panel"><div class="tablewrap"><table><tr><th>Program</th><th>Date</th><th>Attendance</th><th>Opens</th><th>Starts</th><th>Ends</th><th>On time until</th><th>Status</th><th><span class="sr">Actions</span></th></tr>
${[...programs].sort((a,b)=>b.date.localeCompare(a.date)).map(p=>`<tr><td>${p.name}</td><td>${p.date}</td><td>${p.type==="inout"?"Check-in and check-out":"Check-in only"}</td><td>${fmtTime(p.open)}</td><td>${fmtTime(p.start)}</td><td>${fmtTime(p.end)}</td><td>${fmtTime(p.lateAfter)}</td><td>${tag(p.status)}</td>
<td class="nowrap">${p.status==="Upcoming"||p.status==="Ongoing"?`<button class="btn alt" data-e="${p.id}">Edit</button> <button class="btn alt" data-x="${p.id}">Cancel</button>`:""}</td></tr>`).join("")}</table></div></div>`;
$("#new-pg").onclick=()=>programDialog();
document.querySelectorAll("[data-e]").forEach(b=>b.onclick=()=>programDialog(programs.find(x=>x.id==b.dataset.e)));
document.querySelectorAll("[data-x]").forEach(b=>b.onclick=()=>cancelProgram(programs.find(x=>x.id==b.dataset.x)));
},
students(){
const courses=[...new Set(students.map(x=>x.course))].sort();
$("#view").innerHTML=`<div class="head"><div><h1>Students</h1><p class="sub" id="cnt"></p></div><div class="btns"><button class="btn alt" id="print-st">Print activation codes</button><button class="btn alt" id="imp-st">Import CSV</button><button class="btn" id="add-st">Add student</button></div></div>
<div id="nudge"></div>
<div class="panel"><div class="filters">
<label class="grow">Search<input id="q" placeholder="Name, student number, or email"></label>
<label>Course<select id="fc"><option value="">All courses</option>${courses.map(c=>`<option>${c}</option>`).join("")}</select></label>
<label>Year<select id="fy"><option value="">All years</option>${[1,2,3,4].map(y=>`<option value="${y}">Year ${y}</option>`).join("")}</select></label>
<label>Role<select id="fr"><option value="">All roles</option><option value="lead">Lead officers</option><option value="sbo">All SBO officers</option><option value="student">Students</option></select></label>
<label>Show<select id="fs"><option value="current">Current students</option><option value="pending">Not activated yet</option><option value="inactive">Left school (inactive)</option><option value="">Everyone</option></select></label>
<button class="btn alt" id="fx">Clear filters</button></div>
<div class="tablewrap"><table id="st"></table></div></div>`;
$("#q").value=fl.q;$("#fc").value=fl.course;$("#fy").value=fl.year;$("#fr").value=fl.role;$("#fs").value=fl.status;
const draw=()=>{
const q=fl.q.toLowerCase();
const list=students.filter(x=>(x.name+" "+x.no+" "+(x.email||"")).toLowerCase().includes(q)&&(!fl.course||x.course===fl.course)&&(!fl.year||String(x.year)===fl.year)&&(!fl.role||(fl.role==="lead"?!!x.lead:(fl.role==="sbo")===!!x.checker))&&(!fl.status||(fl.status==="current"&&x.active)||(fl.status==="pending"&&x.active&&!x.pw)||(fl.status==="inactive"&&!x.active)));
$("#cnt").textContent="Showing "+list.length+" of "+students.length+" students";
const np=students.filter(x=>x.active&&!x.pw).length;
$("#nudge").innerHTML=np?`<div class="notice">${np} of ${students.filter(x=>x.active).length} current students haven’t activated their account yet. <button class="link" id="nudge-go">Print their activation codes</button> for the class representatives.</div>`:"";
$("#st").innerHTML=list.length?`<tr><th>Student</th><th>Course and year</th><th>Email</th><th>Role</th><th>Status</th><th><span class="sr">Actions</span></th></tr>`+
list.map(x=>`<tr><td><button class="link" data-v="${x.id}">${x.name}</button><br><small>${x.no}</small></td><td>${x.course}, year ${x.year}</td><td>${x.email||"—"}</td>
<td>${x.lead?`<span class="tag Completed">Lead officer</span>`:x.checker?`<span class="tag Present">SBO officer</span>`:"Student"}</td>
<td>${!x.active?`<span class="tag Absent">Inactive</span>${x.inactive_reason?`<br><small>${x.inactive_reason}</small>`:""}`:x.pw?`<span class="tag Present">Active</span>`:`<span class="tag Late">Not activated</span><br><small>Code: ${x.claim_code||"none"}</small>`}</td>
<td class="act"><button class="kebab" data-m="${x.id}" aria-haspopup="menu" aria-label="Actions for ${esc(x.name)}">${DOTS}</button></td></tr>`).join(""):`<tr><td colspan="6">No students match these filters.</td></tr>`;
document.querySelectorAll("#st .kebab").forEach(b=>b.onclick=e=>{e.stopPropagation();openMenu(b,b.dataset.m)});
document.querySelectorAll("#st .link").forEach(b=>b.onclick=()=>studentDialog(students.find(x=>x.id==b.dataset.v)));const ng=$("#nudge-go");if(ng)ng.onclick=printDialog};
$("#q").oninput=e=>{fl.q=e.target.value;draw()};
$("#fc").onchange=e=>{fl.course=e.target.value;draw()};
$("#fy").onchange=e=>{fl.year=e.target.value;draw()};
$("#fr").onchange=e=>{fl.role=e.target.value;draw()};
$("#fs").onchange=e=>{fl.status=e.target.value;draw()};
$("#fx").onclick=()=>{fl={q:"",course:"",year:"",role:"",status:"current"};views.students()};
$("#add-st").onclick=()=>studentDialog();
$("#imp-st").onclick=importDialog;$("#print-st").onclick=printDialog;
draw();
},
attend(){
const ps=programs.filter(p=>p.status!=="Cancelled");
if(!ps.length){$("#view").innerHTML=`<h1>Attendance</h1><div class="panel">No programs yet.</div>`;return}
if(!ps.some(p=>p.id==attProg))attProg=(ps.find(p=>p.status==="Ongoing")||ps[ps.length-1]).id;
const p=programs.find(x=>x.id==attProg),rows=students.filter(s=>s.active),cnt=k=>rows.filter(s=>status(p,s)===k).length;
$("#view").innerHTML=`<h1>Attendance</h1><p class="sub">See who attended, who was late, and by how much.</p>
<div class="panel"><div class="row"><label>Program<select id="ap">${ps.map(x=>`<option value="${x.id}" ${x.id==p.id?"selected":""}>${x.name} (${x.date})</option>`).join("")}</select></label></div>
<p class="sub" style="margin:0 0 12px">Attendance opens ${fmtTime(p.open)}. On time until ${fmtTime(p.lateAfter)}. Starts ${fmtTime(p.start)}. Ends ${fmtTime(p.end)}.</p>
<div class="grid"><div class="stat"><b>${cnt("Present")}</b><span>On time</span></div><div class="stat"><b>${cnt("Late")}</b><span>Late</span></div><div class="stat"><b>${cnt("Absent")}</b><span>Absent</span></div>${p.type==="inout"?`<div class="stat"><b>${rows.filter(x=>{const r=(att[p.id]||{})[x.id];return r&&r.in&&!r.out}).length}</b><span>${p.status==="Completed"?"No check-out":"Still inside"}</span></div>`:""}</div>
<div class="tablewrap"><table><tr><th>Student no.</th><th>Name</th><th>Course</th><th>Time in</th><th>Time out</th><th>Status</th><th>Late by</th><th>Scanned by</th></tr>
${rows.map(s=>{const r=(att[p.id]||{})[s.id]||{},st=status(p,s);return `<tr><td>${s.no}</td><td>${s.name}</td><td>${s.course}</td><td>${r.in||"—"}</td><td>${p.type=="in"?"n/a":r.out||(r.in&&p.status==="Completed"?"No check-out":"—")}</td><td>${st=="—"?"Not yet scanned":tag(st)}</td><td>${r.status==="Late"&&r.lateMin>0?fmtDur(r.lateMin):"—"}</td><td>${r.by?(r.by==="admin"?"Administrator":(students.find(v=>v.no===r.by)||{}).name||r.by):"—"}</td></tr>`}).join("")}</table></div></div>`;
$("#ap").onchange=e=>{attProg=+e.target.value;render()};
},
ctrl(){
const officers=students.filter(x=>x.checker&&x.active).sort((a,b)=>(b.lead?1:0)-(a.lead?1:0)||a.name.localeCompare(b.name));
const progs=programs.filter(p=>p.status==="Ongoing"||p.status==="Upcoming");
$("#view").innerHTML=`<h1>Scan team</h1><p class="sub">Lead officers can scan as soon as attendance opens. Other SBO officers can scan once a lead officer, or you, has scanned their ID. Nothing here needs your attention during an event.</p>`+
(officers.some(o=>o.lead)?"":`<div class="notice">There are no lead officers yet. Until you make one on the Students page, only you can scan officers in.</div>`)+
(progs.map(p=>{const recs=att[p.id]||{};
return `<div class="panel"><div class="row" style="justify-content:space-between;align-items:center"><div><h2>${p.name}</h2>${p.date}, ${fmtTime(p.open)} to ${fmtTime(p.end)} ${tag(p.status)}${p.paused?` <span class="tag Absent">Paused</span>`:""}</div>
${p.status==="Ongoing"?`<button class="btn ${p.paused?"":"alt"}" data-pz="${p.id}">${p.paused?"Resume scanning":"Pause scanning"}</button>`:""}</div>
<div class="tablewrap"><table><tr><th>SBO officer</th><th>Can scan?</th><th>Scans made</th><th>Last scan</th></tr>
${officers.map(o=>{const mine=Object.values(recs).filter(r=>r.by===o.no),last=mine.map(r=>r.in).sort().pop(),out=(recs[o.id]||{}).out;
const can=p.paused?"Paused":o.lead?(out?"No, scanned out":"Yes, lead officer"):isPresent(p.id,o.id)?"Yes, scanned in at "+recs[o.id].in:"Not yet, waiting to be scanned in";
return `<tr><td>${o.name}${o.lead?` <span class="tag Completed">Lead</span>`:""}</td><td>${can}</td><td>${mine.length}</td><td>${last||"—"}</td></tr>`}).join("")||`<tr><td colspan="4">No SBO officers yet. Make one on the Students page.</td></tr>`}</table></div></div>`}).join("")||`<div class="panel">No upcoming or ongoing programs.</div>`);
document.querySelectorAll("[data-pz]").forEach(b=>b.onclick=async()=>{const p=programs.find(x=>x.id==b.dataset.pz);
try{await DB.setProgram(p.id,{paused:!p.paused});p.paused=!p.paused;render();toast(p.paused?"Scanning is paused for "+p.name+".":"Scanning resumed for "+p.name+".")}
catch(e){toast("Couldn’t change that. Check the internet connection and try again.")}});
},
// ---------- Student views ----------
spw(){
$("#view").innerHTML=`<h1>Change password</h1>${me.must_change_pw?`<p class="notice">You’re using a default password. Choose a new one to continue.</p>`:`<p class="sub">Choose a new password whenever you like.</p>`}
<div class="panel" style="max-width:420px"><div class="row" style="flex-direction:column;align-items:stretch">
<label>Current password<input id="pw0" type="password" autocomplete="current-password"></label>
<label>New password (at least 6 characters)<input id="pw1" type="password" autocomplete="new-password"></label>
<label>Confirm new password<input id="pw2" type="password" autocomplete="new-password"></label>
<button class="btn" id="pw-save">Save new password</button></div><p class="sub" id="pw-msg" style="margin:0" role="status"></p></div>
<div class="panel" style="max-width:420px"><h2>Recovery code</h2><p>${me.recovery_hash?"You have a recovery code. It lets you reset your own password if you forget it.":"You don’t have a recovery code yet. It lets you reset your own password if you forget it, without asking anyone."}</p>
<button class="btn alt" id="rc-new">${me.recovery_hash?"Get a new recovery code":"Create my recovery code"}</button></div>`;
$("#rc-new").onclick=recoveryDialog;
$("#pw-save").onclick=async()=>{const m=t=>{$("#pw-msg").textContent=t};
if(await hashPw(me.no,$("#pw0").value)!==me.pw)return m("Your current password is incorrect.");
const n=$("#pw1").value;if(n.length<6)return m("Use at least 6 characters.");
if(n===defaultPw(me))return m("Choose a password different from the default one.");
if(n!==$("#pw2").value)return m("The two new passwords don’t match.");
try{const h=await hashPw(me.no,n),forced=me.must_change_pw;await DB.setStudent(me.id,{pw:h,must_change_pw:false});me.pw=h;me.must_change_pw=false;
if(forced){page=role==="checker"?"scan":"sdash";return render()}
["#pw0","#pw1","#pw2"].forEach(i=>$(i).value="");m("Password changed. Use it the next time you sign in.")}
catch(e){m("Couldn’t save the new password. Check the internet connection and try again.")}}
},
sdash(){
const done=programs.filter(p=>p.status==="Completed"),st=done.map(p=>status(p,me));
const lateTotal=done.reduce((a,p)=>a+(((att[p.id]||{})[me.id]||{}).lateMin||0),0);
const pres=st.filter(x=>x=="Present").length,late=st.filter(x=>x=="Late").length,abs=st.filter(x=>x=="Absent").length;
const pct=done.length?Math.round((pres+late)/done.length*100):0;
$("#view").innerHTML=`<h1>${me.name}</h1><p class="sub">${me.no} · ${me.course}, year ${me.year}</p>
${me.recovery_hash?"":`<div class="notice">Set up your recovery code so you can reset your own password if you forget it. <button class="link" id="go-rc">Set it up</button></div>`}
<div class="grid"><div class="stat"><b>${done.length}</b><span>Programs held</span></div><div class="stat"><b>${pres+late}</b><span>Attended</span></div>
<div class="stat"><b>${late}</b><span>Late</span></div><div class="stat"><b>${fmtDur(lateTotal)}</b><span>Total time late</span></div><div class="stat"><b>${abs}</b><span>Absent</span></div></div>
<div class="panel"><h2>Attendance rate: ${pct}%</h2><div class="bar"><i style="width:${pct}%"></i></div></div>`;
const g=$("#go-rc");if(g)g.onclick=()=>{page="spw";render()};
},
sqr(){
$("#view").innerHTML=`<h1>My QR code</h1><p class="sub">Show this to the scanner if you don’t have your school ID.</p>
<div class="panel" style="text-align:center"><div class="qrbox" id="qr"></div><p><b>${me.name}</b><br>${me.no}</p>
<button class="btn" id="dl">Download QR code</button></div>`;
new QRCode($("#qr"),{text:me.token,width:200,height:200});
$("#dl").onclick=()=>{const c=$("#qr canvas"),i=$("#qr img"),a=document.createElement("a");a.href=c?c.toDataURL("image/png"):i.src;a.download="ncbi-qr-"+me.no+".png";a.click()};
},
shist(){
$("#view").innerHTML=`<h1>My attendance</h1><p class="sub">Every program and how you were recorded. You can’t edit these records.</p>
<div class="panel"><div class="tablewrap"><table><tr><th>Program</th><th>Date</th><th>Time in</th><th>Time out</th><th>Status</th></tr>
${programs.filter(p=>p.status!=="Cancelled"&&p.status!=="Upcoming").map(p=>{const r=(att[p.id]||{})[me.id]||{};return `<tr><td>${p.name}</td><td>${p.date}</td><td>${r.in||"—"}</td><td>${p.type=="in"?"n/a":r.out||(r.in&&p.status==="Completed"?"No check-out":"—")}</td><td>${status(p,me)=="—"?"Not yet recorded":tag(status(p,me))+(lateText(r)?" "+lateText(r):"")}</td></tr>`}).join("")}</table></div></div>`;
}};

// ---------- Program details: validate, save, re-mark ----------
let attProg=null;
function checkProgram(f){
if(!f.name||!f.date||!f.open||!f.lateAfter||!f.start||!f.end)return "Fill in the name, the date, and the three times.";
if(f.open>=f.start)return "Attendance must open before the program starts.";
if(f.end<=f.start)return "The program must end after it starts.";
if(f.lateAfter<f.open||f.lateAfter>f.start)return "“On time until” must be between the time attendance opens and the time the program starts.";
return ""}
// One popup for creating a program and for editing it.
//   Upcoming: everything can be changed.   Started: only the name, end time and on-time cutoff.
function programDialog(p){
if(role!=="admin")return;
const edit=Boolean(p),live=edit&&p.status==="Ongoing",lock=live?"disabled":"";
const ed=p||{name:"",date:"",type:"in",open:"09:00",start:"10:00",end:"12:00",lateAfter:"09:50"};
let minutes=Math.max(0,mins(ed.start)-mins(ed.lateAfter)),confirmed=false;   // minutes before the start that still count as on time
const options=MINUTES.includes(minutes)?MINUTES:[...MINUTES,minutes].sort((a,b)=>a-b);
dialog(`<form class="dform" id="pf"><h2>${edit?"Edit program":"New program"}</h2>
${live?`<p class="notice">This program has started, so you can only change its name, end time and on-time cutoff.</p>`:""}
<label>Name<input id="pg-name" value="${esc(ed.name)}" placeholder="e.g. Christmas party"></label>
<label>Date<input type="date" id="pg-date" value="${ed.date}" ${lock}></label>
<fieldset class="modes" ${lock}><legend>How is attendance taken?</legend>
<label class="radio"><input type="radio" name="pg-type" value="in" ${ed.type==="in"?"checked":""}><span><b>Check-in only</b> (recommended)<br><small>One scan when students arrive. Fast, with shorter lines.</small></span></label>
<label class="radio"><input type="radio" name="pg-type" value="inout" ${ed.type==="inout"?"checked":""}><span><b>Check-in and check-out</b><br><small>Also scan when students leave. Use it when staying until the end matters.</small></span></label></fieldset>
<div class="three"><label>Attendance opens<input type="time" id="pg-open" value="${ed.open}" ${lock}></label>
<label>Program starts<input type="time" id="pg-start" value="${ed.start}" ${lock}></label>
<label>Program ends<input type="time" id="pg-end" value="${ed.end}"></label></div>
<div class="field"><span class="lbl">On time if students scan up to this long before the program starts</span>
<div class="carousel"><button type="button" class="car-btn" id="car-l" aria-label="Show shorter times">‹</button>
<div class="chipscroll" id="pg-chips" role="radiogroup" aria-label="Minutes before the program starts">${options.map(m=>`<button type="button" role="radio" class="chip" data-m="${m}">${m?m+" min":"At start"}</button>`).join("")}</div>
<button type="button" class="car-btn" id="car-r" aria-label="Show longer times">›</button></div>
<p class="hint" id="pg-sum"></p></div>
<p class="err" id="pg-err" role="alert"></p>
<div class="dbtn"><button type="button" class="btn alt" id="pg-cancel">Cancel</button><button type="submit" class="btn" id="pg-save">${edit?"Save changes":"Create program"}</button></div></form>`,d=>{
const chips=[...d.querySelectorAll(".chip")],err=t=>{$("#pg-err").textContent=t};
const resetConfirm=()=>{if(confirmed){confirmed=false;$("#pg-save").textContent=edit?"Save changes":"Create program";err("")}};
const refresh=()=>{
const st=$("#pg-start").value,op=$("#pg-open").value,ok=m=>Boolean(st&&op)&&mins(st)-m>=mins(op);
if(!ok(minutes)){const valid=chips.map(c=>+c.dataset.m).filter(ok),smaller=valid.filter(v=>v<=minutes);if(valid.length)minutes=smaller.length?Math.max(...smaller):Math.min(...valid)}
chips.forEach(c=>{const m=+c.dataset.m;c.disabled=!ok(m);c.setAttribute("aria-checked",String(m===minutes));c.classList.toggle("on",m===minutes)});
$("#pg-sum").textContent=ok(minutes)?"Students scanned up to "+fmtTime(hhmm(mins(st)-minutes))+" are on time. Anyone after that is still recorded, but marked late, with how late they were.":"Set the times the program opens and starts first."};
chips.forEach(c=>c.onclick=()=>{minutes=+c.dataset.m;resetConfirm();refresh()});
$("#pg-open").oninput=()=>{resetConfirm();refresh()};$("#pg-start").oninput=()=>{resetConfirm();refresh()};
$("#car-l").onclick=()=>$("#pg-chips").scrollBy({left:-180,behavior:"smooth"});
$("#car-r").onclick=()=>$("#pg-chips").scrollBy({left:180,behavior:"smooth"});
$("#pg-cancel").onclick=()=>d.close();
refresh();
$("#pf").onsubmit=async e=>{e.preventDefault();
const f={name:$("#pg-name").value.trim(),date:$("#pg-date").value,type:(d.querySelector('input[name="pg-type"]:checked')||{}).value||"in",open:$("#pg-open").value,start:$("#pg-start").value,end:$("#pg-end").value};
f.lateAfter=f.start?hhmm(Math.max(0,mins(f.start)-minutes)):"";
const bad=checkProgram(f);if(bad)return err(bad);
if((!edit||f.date!==p.date)&&f.date<new Date().toLocaleDateString("en-CA"))return err("Choose today or a later date.");
try{
if(edit){
const n=Object.keys(att[p.id]||{}).length,changed=f.lateAfter!==p.lateAfter||f.date!==p.date;
if(changed&&n&&!confirmed){confirmed=true;$("#pg-save").textContent="Save and re-mark";return err(n+" attendance record"+(n==1?"":"s")+" already exist. They will be re-marked on time or late using the new cutoff. Press the button again to continue.")}
await DB.updateProgram(p.id,f);Object.assign(p,f);p.status=autoStatus(p);if(changed)await remark(p);
}else{const np=await DB.addProgram({...f,status:"Upcoming"});np.status=autoStatus(np);programs.push(np);att[np.id]={}}
d.close();views.programs();toast(edit?"Saved changes to "+f.name+".":"Created "+f.name+".")
}catch(er){err("Couldn’t save the program. Check the internet connection and try again.")}}})}

function cancelProgram(p){
if(role!=="admin"||!p)return;
dialog(`<form class="dform"><h2>Cancel program</h2><p>Cancel “${esc(p.name)}”? Nobody will be able to scan for it. Attendance already recorded is kept.</p>
<div class="dbtn"><button type="button" class="btn alt" id="cx-no">Keep program</button><button type="submit" class="btn warn">Cancel program</button></div></form>`,d=>{
$("#cx-no").onclick=()=>d.close();
d.querySelector("form").onsubmit=async e=>{e.preventDefault();
try{await DB.setProgram(p.id,{status:"Cancelled"});p.status="Cancelled";d.close();views.programs();toast(p.name+" was cancelled.")}
catch(er){toast("Couldn’t cancel the program. Try again.")}}})}

// After the cutoff changes, re-mark each record from the time the student was scanned
async function remark(p){
for(const [sid,rec] of Object.entries(att[p.id]||{})){
const lm=lateMin(rec.in,p.lateAfter),st=lm>0?"Late":"Present";
if(rec.status!==st||(rec.lateMin||0)!==lm){await DB.setAttendance(p.id,sid,{status:st,late_minutes:lm});rec.status=st;rec.lateMin=lm}}}

// ---------- Students page: filters, row menu, dialogs ----------
let fl={q:"",course:"",year:"",role:"",status:"current"};
const DOTS='<svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true"><circle cx="3" cy="9" r="1.6"/><circle cx="9" cy="9" r="1.6"/><circle cx="15" cy="9" r="1.6"/></svg>';

function toast(t){let e=$("#toast");if(!e){e=document.createElement("div");e.id="toast";e.setAttribute("role","status");document.body.appendChild(e)}
e.textContent=t;e.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>{e.hidden=true},3500)}

function dialog(html,mount){
let d=$("#dlg");if(!d){d=document.createElement("dialog");d.id="dlg";document.body.appendChild(d);d.onclick=e=>{if(e.target===d)d.close()}}
d.innerHTML=html;if(!d.open)d.showModal();if(mount)mount(d);return d}

// The "..." menu on each student row
function openMenu(btn,id){
if(role!=="admin")return;
closeMenu();
const x=students.find(v=>v.id==id),m=document.createElement("div");
m.id="rm";m.setAttribute("role","menu");
m.innerHTML=`<button role="menuitem" data-a="edit">View or edit details</button>
<button role="menuitem" data-a="sbo">${x.checker?"Remove SBO officer":"Make SBO officer"}</button>
${x.checker?`<button role="menuitem" data-a="lead">${x.lead?"Remove lead status":"Make lead officer"}</button>`:""}
<button role="menuitem" data-a="reset">${x.pw?"Reset password":"New activation code"}</button><hr>
<button role="menuitem" data-a="${x.active?"off":"on"}" ${x.active?'class="danger"':""}>${x.active?"Deactivate account":"Reactivate account"}</button>`;
document.body.appendChild(m);
const r=btn.getBoundingClientRect();
m.style.top=Math.max(8,Math.min(r.bottom+4,innerHeight-m.offsetHeight-8))+"px";
m.style.left=Math.max(8,r.right-m.offsetWidth)+"px";
m.querySelectorAll("button").forEach(b=>b.onclick=()=>{closeMenu();rowAction(b.dataset.a,x)});
m.querySelector("button").focus();
}
function closeMenu(){const m=$("#rm");if(m)m.remove()}
document.addEventListener("click",e=>{if(!e.target.closest("#rm"))closeMenu()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeMenu()});
window.addEventListener("scroll",closeMenu,true);

async function rowAction(a,x){
if(role!=="admin")return;
const fail=()=>toast("Couldn’t save that change. Check the internet connection and try again.");
if(a==="edit")return studentDialog(x);
if(a==="sbo"){const on=!x.checker;try{await DB.setStudent(x.id,on?{checker:true}:{checker:false,lead:false});x.checker=on;if(!on)x.lead=false;views.students();toast(x.name+(on?" is now an SBO officer.":" is no longer an SBO officer."))}catch(e){fail()}return}
if(a==="lead"){const on=!x.lead;try{await DB.setStudent(x.id,{lead:on,checker:true});x.lead=on;x.checker=true;views.students();toast(x.name+(on?" is now a lead officer.":" is no longer a lead officer."))}catch(e){fail()}return}
if(a==="on"){try{await DB.setStudent(x.id,{active:true,inactive_reason:null});x.active=true;x.inactive_reason=null;views.students();toast(x.name+"’s account is active again.")}catch(e){fail()}return}
if(a==="off")return dialog(`<form class="dform"><h2>Deactivate account</h2>
<p>${x.name} won’t be able to sign in or be scanned. Their attendance history is kept, and you can reactivate the account later.</p>
<label>Reason<select id="d-r"><option>Graduated</option><option>Dropped out</option><option>Transferred</option><option>Other</option></select></label>
<div class="dbtn"><button type="button" class="btn alt" id="d-c">Cancel</button><button type="submit" class="btn warn">Deactivate</button></div></form>`,d=>{
$("#d-c").onclick=()=>d.close();
d.querySelector("form").onsubmit=async e=>{e.preventDefault();const r=$("#d-r").value;
try{await DB.setStudent(x.id,{active:false,inactive_reason:r});x.active=false;x.inactive_reason=r;d.close();views.students();toast(x.name+" was deactivated ("+r.toLowerCase()+").")}catch(err){fail()}}});
if(a==="reset")return dialog(`<form class="dform"><h2>${x.pw?"Reset password":"New activation code"}</h2>
<p>${x.pw?`${x.name}’s current password will stop working. They will get a new activation code and choose a new password.`:`This replaces ${x.name}’s activation code. The old code will stop working.`}</p>
<div class="dbtn"><button type="button" class="btn alt" id="r-c">Cancel</button><button type="submit" class="btn">${x.pw?"Reset password":"Create new code"}</button></div></form>`,d=>{
$("#r-c").onclick=()=>d.close();
d.querySelector("form").onsubmit=async e=>{e.preventDefault();
try{const c=newCode();await DB.setStudent(x.id,{pw:null,claim_code:c,must_change_pw:false,recovery_hash:null});x.pw=null;x.claim_code=c;x.must_change_pw=false;x.recovery_hash=null;views.students();showCode(d,x,"New activation code")}catch(err){fail()}}});
}

// Add a student, or view and edit one
function studentDialog(x){
if(role!=="admin")return;
const edit=Boolean(x),v=k=>edit?esc(x[k]||""):"";
dialog(`<form class="dform" id="sf"><h2>${edit?"Student details":"Add student"}</h2>
<div class="two"><label>First name<input id="f-first" value="${v("first_name")}"></label><label>Last name<input id="f-last" value="${v("last_name")}"></label></div>
<div class="two"><label>Student number<input id="f-no" placeholder="e.g. 2026-0101" value="${v("no")}" ${edit?"disabled":""}></label><label>Course<input id="f-course" placeholder="e.g. BSIT" value="${v("course")}"></label></div>
<div class="two"><label>Year level<select id="f-year">${[1,2,3,4].map(y=>`<option ${edit&&x.year===y?"selected":""}>${y}</option>`).join("")}</select></label>
<label>Email (optional)<input id="f-email" type="email" value="${v("email")}"></label></div>
<p class="hint">The email is used only for verification codes and attendance receipts. Leave it empty if the student hasn’t agreed to share it.</p>
${edit?`<p class="hint">The student number can’t be changed after the account is created.</p>`:`<label>Role<select id="f-role"><option value="student">Student</option><option value="sbo">SBO officer</option><option value="lead">Lead officer</option></select></label>
<p class="hint">Lead officers can scan as soon as attendance opens and scan other officers in. SBO officers can scan once they have been scanned in.</p>
<p class="hint">The student gets an activation code to choose their own password. You’ll see the code right after you add them.</p>`}
<p class="err" id="f-err" role="alert"></p>
<div class="dbtn"><button type="button" class="btn alt" id="f-cancel">Cancel</button><button type="submit" class="btn">${edit?"Save changes":"Add student"}</button></div></form>`,d=>{
const err=t=>{$("#f-err").textContent=t};
$("#f-cancel").onclick=()=>d.close();
$("#sf").onsubmit=async e=>{e.preventDefault();
const first=$("#f-first").value.trim(),last=$("#f-last").value.trim(),no=edit?x.no:$("#f-no").value.trim(),course=$("#f-course").value.trim().toUpperCase(),year=+$("#f-year").value,email=$("#f-email").value.trim();
if(!first||!last||!no||!course)return err("Enter the first name, last name, student number, and course.");
if(email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return err("That email address doesn’t look right.");
if(!edit&&students.some(v=>v.no===no))return err("A student with number "+no+" already exists.");
const name=first+" "+last,f={first_name:first,last_name:last,name,course,year,email:email||null};
try{
if(edit){await DB.setStudent(x.id,f);Object.assign(x,f);toast("Saved changes for "+name+".")}
else{let token;do{token="NCBI-"+Math.random().toString(16).slice(2,8).toUpperCase()}while(students.some(v=>v.token===token));
const row=await DB.addStudent({...f,no,token,active:true,checker:$("#f-role").value!=="student",lead:$("#f-role").value==="lead",claim_code:newCode()});
students.push(row);views.students();return showCode(d,row,"Account created")}
d.close();views.students();
}catch(er){err("Couldn’t save. Check the internet connection and try again.")}}});
}

// ---------- Activation codes ----------
function newCode(used){
const A="ABCDEFGHJKMNPQRSTUVWXYZ23456789";let c;   // no 0/O or 1/I/L, so codes are easy to read aloud
do{const t=Array.from(crypto.getRandomValues(new Uint8Array(8)),x=>A[x%31]).join("");c=t.slice(0,4)+"-"+t.slice(4)}
while(students.some(x=>x.claim_code===c)||(used&&used.has(c)));
if(used)used.add(c);return c}

function showCode(d,x,title){
d.innerHTML=`<div class="dform"><h2>${title}</h2><p>Give this code to ${x.name}, through the class representative:</p><p class="cred">${x.claim_code}</p>
<p class="hint">The student opens the site, chooses “Activate your account”, and enters their student number (${x.no}) and this code to choose a password.</p>
<div class="dbtn"><button type="button" class="btn" id="c-ok">Done</button></div></div>`;
$("#c-ok").onclick=()=>{d.close();views.students()}}

// ---------- CSV import ----------
const EMAIL=/^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TEMPLATE="student_number,first_name,last_name,course,year,email\n2026-0101,Maria,Santos,BSIT,1,\n2026-0102,Juan,Dela Cruz,BSED,2,juan.delacruz@example.com\n";
const COLS={student_number:"no",student_no:"no",number:"no",id_number:"no",id:"no",first_name:"first",firstname:"first",given_name:"first",last_name:"last",lastname:"last",surname:"last",course:"course",program:"course",year:"year",year_level:"year",email:"email",email_address:"email"};
const COLNAME={no:"student_number",first:"first_name",last:"last_name",course:"course",year:"year"};
let lastCSV="";

function parseCSV(text){
text=text.replace(/^\uFEFF/,"");
const head=text.split(/\r?\n/)[0],delim=[",",";","\t"].sort((a,b)=>head.split(b).length-head.split(a).length)[0];
const rows=[];let row=[],cell="",q=false;
for(let i=0;i<text.length;i++){const c=text[i];
if(q){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++}else q=false}else cell+=c}
else if(c==='"')q=true;
else if(c===delim){row.push(cell);cell=""}
else if(c==="\n"||c==="\r"){if(c==="\r"&&text[i+1]==="\n")i++;row.push(cell);cell="";rows.push(row);row=[]}
else cell+=c}
if(cell!==""||row.length){row.push(cell);rows.push(row)}
return rows.filter(r=>r.some(v=>v.trim()!==""))}

function readStudents(text){
const rows=parseCSV(text);
if(rows.length<2)return{error:"The file needs a header row and at least one student. Download the template to see the layout."};
const cols=rows[0].map(h=>COLS[h.trim().toLowerCase().replace(/[^a-z]+/g,"_").replace(/^_|_$/g,"")]||null);
for(const k of Object.keys(COLNAME))if(!cols.includes(k))return{error:"The file has no “"+COLNAME[k]+"” column. Download the template to see the columns."};
const seen=new Set(),out=[];
rows.slice(1).forEach((r,i)=>{
const o={};cols.forEach((k,j)=>{if(k)o[k]=(r[j]||"").trim()});
const y=Number(o.year),problems=[];
if(!o.no)problems.push("missing student number");
if(!o.first)problems.push("missing first name");
if(!o.last)problems.push("missing last name");
if(!o.course)problems.push("missing course");
if(!Number.isInteger(y)||y<1||y>6)problems.push("year must be a number from 1 to 6");
if(o.email&&!EMAIL.test(o.email))problems.push("email doesn’t look right");
if(o.no&&seen.has(o.no))problems.push("student number appears twice in the file");
let state=problems.length?"error":students.some(x=>x.no===o.no)?"exists":"new";
if(o.no)seen.add(o.no);
out.push({line:i+2,o,y,problems,state})});
return{rows:out}}

function importDialog(){
if(role!=="admin")return;
dialog(`<div class="dform"><h2>Import students</h2>
<p>Upload a CSV file with one student per row. Nothing is saved until you review it on the next screen.</p>
<p class="hint">Columns: student_number, first_name, last_name, course, year, and email (email is optional).</p>
<div class="row"><button type="button" class="btn alt" id="i-tpl">Download template</button><label>CSV file<input type="file" id="i-file" accept=".csv,text/csv"></label></div>
<label>Or paste the rows here<textarea id="i-text" rows="5" placeholder="student_number,first_name,last_name,course,year,email"></textarea></label>
<p class="err" id="i-err" role="alert"></p>
<div class="dbtn"><button type="button" class="btn alt" id="i-cancel">Cancel</button><button type="button" class="btn" id="i-next">Review</button></div></div>`,d=>{
$("#i-text").value=lastCSV;
$("#i-cancel").onclick=()=>d.close();
$("#i-tpl").onclick=()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([TEMPLATE],{type:"text/csv"}));a.download="students-template.csv";a.click()};
$("#i-file").onchange=async e=>{const f=e.target.files[0];if(f)$("#i-text").value=await f.text()};
$("#i-next").onclick=()=>{lastCSV=$("#i-text").value;const r=readStudents(lastCSV);if(r.error)return $("#i-err").textContent=r.error;reviewImport(d,r.rows)}})}

function reviewImport(d,rows){
const fresh=rows.filter(r=>r.state==="new"),exist=rows.filter(r=>r.state==="exists"),bad=rows.filter(r=>r.state==="error");
d.innerHTML=`<div class="dform"><h2>Review before adding</h2>
<div class="chips"><span class="tag Present">${fresh.length} new</span><span class="tag Late">${exist.length} already in the system</span><span class="tag Absent">${bad.length} need fixing</span></div>
<p class="hint">Only the new students are added. Rows with problems are skipped: fix them in your file and import again.</p>
<div class="tablewrap" style="max-height:260px;overflow:auto"><table><tr><th>Row</th><th>Student</th><th>Result</th></tr>
${rows.slice(0,50).map(r=>`<tr><td>${r.line}</td><td>${esc(r.o.first||"")} ${esc(r.o.last||"")}<br><small>${esc(r.o.no||"")}, ${esc(r.o.course||"")} ${esc(r.o.year||"")}</small></td><td>${r.state==="new"?"Will be added":r.state==="exists"?"Already in the system, skipped":"Skipped: "+r.problems.join(", ")}</td></tr>`).join("")}</table></div>
${rows.length>50?`<p class="hint">Showing the first 50 of ${rows.length} rows.</p>`:""}
<p class="err" id="i-err" role="alert"></p>
<div class="dbtn"><button type="button" class="btn alt" id="i-back">Back</button><button type="button" class="btn" id="i-go" ${fresh.length?"":"disabled"}>Add ${fresh.length} student${fresh.length==1?"":"s"}</button></div></div>`;
$("#i-back").onclick=importDialog;
$("#i-go").onclick=async()=>{
const tokens=new Set(students.map(x=>x.token)),codes=new Set();
const list=fresh.map(r=>{let token;do{token="NCBI-"+Math.random().toString(16).slice(2,8).toUpperCase()}while(tokens.has(token));tokens.add(token);
return{no:r.o.no,name:r.o.first+" "+r.o.last,first_name:r.o.first,last_name:r.o.last,course:r.o.course.toUpperCase(),year:r.y,email:r.o.email||null,token,active:true,checker:false,claim_code:newCode(codes)}});
try{const added=await DB.addStudents(list);students.push(...added);lastCSV="";views.students();
d.innerHTML=`<div class="dform"><h2>Done</h2><p>Added ${added.length} student${added.length==1?"":"s"}. Each one now needs an activation code to choose a password.</p>
<div class="dbtn"><button type="button" class="btn alt" id="i-close">Close</button><button type="button" class="btn" id="i-print">Print activation codes</button></div></div>`;
$("#i-close").onclick=()=>d.close();$("#i-print").onclick=printDialog}
catch(e){$("#i-err").textContent="Couldn’t add the students. Check the internet connection and try again."}}}

// ---------- Printable activation sheets (one per class) ----------
function printDialog(){
if(role!=="admin")return;
const all=()=>students.filter(x=>x.active);
if(!all().length)return toast("There are no current students yet.");
const courses=[...new Set(all().map(x=>x.course))].sort(),years=[...new Set(all().map(x=>x.year))].sort((a,b)=>a-b);
dialog(`<div class="dform"><h2>Print activation codes</h2>
<p>Choose a class, then print its sheet for the class representative. Each sheet has a box to tick when a student receives their code.</p>
<div class="two"><label>Course<select id="p-c"><option value="">All courses</option>${courses.map(c=>`<option>${c}</option>`).join("")}</select></label>
<label>Year<select id="p-y"><option value="">All years</option>${years.map(y=>`<option value="${y}">Year ${y}</option>`).join("")}</select></label></div>
<label>Include<select id="p-w"><option value="pending">Only students who haven’t activated yet</option><option value="all">Everyone in the class</option></select></label>
<p class="hint">Students who already activated are marked “Activated” on the sheet, and their code no longer works. To give someone a brand new code, use Reset password on their row.</p>
<p class="hint" id="p-n"></p>
<div class="dbtn"><button type="button" class="btn alt" id="p-x">Close</button><button type="button" class="btn" id="p-go">Print sheet</button></div></div>`,d=>{
$("#p-w").value=all().some(x=>!x.pw)?"pending":"all";
const pick=()=>all().filter(x=>(!$("#p-c").value||x.course===$("#p-c").value)&&(!$("#p-y").value||String(x.year)===$("#p-y").value)&&($("#p-w").value==="all"||!x.pw));
const upd=()=>{const n=pick().length;$("#p-n").textContent=n+" student"+(n==1?"":"s")+" on this sheet.";$("#p-go").disabled=!n};
$("#p-c").onchange=upd;$("#p-y").onchange=upd;$("#p-w").onchange=upd;upd();
$("#p-x").onclick=()=>d.close();
$("#p-go").onclick=()=>printSheet(pick())})}

function printSheet(list){
const groups={};list.forEach(x=>{const g=x.course+", year "+x.year;(groups[g]=groups[g]||[]).push(x)});
const site=location.href.split("#")[0],old=$("#sheet");if(old)old.remove();
const sh=document.createElement("div");sh.id="sheet";
sh.innerHTML=Object.keys(groups).sort().map(g=>`<section class="sheet-sec"><h2>${g}</h2>
<p>Activation codes for the class representative. Give each student their code. To activate: open <b>${site}</b>, choose “Activate your account”, enter your student number and your code, then choose a password. Keep your code private. Students marked “Activated” already have their password.</p>
<table><tr><th>Student no.</th><th>Name</th><th>Activation code</th><th>Received</th></tr>
${groups[g].sort((a,b)=>a.name.localeCompare(b.name)).map(x=>`<tr><td>${x.no}</td><td>${x.name}</td><td><b>${x.claim_code||"none"}</b></td><td>${x.pw?"Activated":`<span class="box"></span>`}</td></tr>`).join("")}</table></section>`).join("");
document.body.appendChild(sh);
window.addEventListener("afterprint",()=>{document.body.classList.remove("printing");sh.remove()},{once:true});
document.body.classList.add("printing");
try{window.print()}catch(e){document.body.classList.remove("printing");sh.remove();toast("Printing isn’t available here. Open the site in its own browser tab and try again.")}}

// ---------- Scan logic ----------
async function doScan(token){
if(!token)return;
const p=programs.find(x=>x.id==$("#sp").value),s=students.find(x=>x.token===token.toUpperCase()||(role==="admin"&&x.no===token)),t=now();
const mode=p&&p.type==="inout"?scanMode:"in";   // check-in only programs always check in
let r;
try{
const why=role==="checker"?await DB.scanAccess(p.id,me.id,mode):null;
if(why){stopCam();r={cls:"bad",title:"Scanning not allowed",msg:why}}
else if(role==="checker"&&s&&s.id===me.id)r={cls:"bad",title:"You can’t scan your own ID",msg:"Ask another officer to scan you."}
else if(!s)r={cls:"bad",title:"Invalid QR code",msg:"No student matches this code."};
else if(!s.active)r={cls:"bad",title:"Student account inactive",msg:s.name};
else if(p.status!=="Ongoing"&&!(mode==="out"&&outGrace(p)))r={cls:"bad",title:"Program is not accepting attendance",msg:closedReason(p)};
else{
const rec=att[p.id][s.id];
if(mode==="out"){
if(!rec)r={cls:"bad",title:"Not checked in yet",msg:s.name+" must be checked in first.",s};
else if(rec.out)r={cls:"bad",title:"Student already checked out",msg:s.name+" at "+rec.out,s};
else{await DB.saveOut(p.id,s.id,t);rec.out=t;r={cls:"ok",title:"Check-out recorded",msg:s.name,s,act:"Time out",t,p}}}
else if(!rec){
const lm=lateMin(t,p.lateAfter),late=lm>0,row={in:t,status:late?"Late":"Present",lateMin:lm,by:role==="admin"?"admin":me.no};
if(await DB.saveIn(p.id,s.id,row)){att[p.id][s.id]=row;r={cls:late?"late":"ok",title:late?"Recorded as late":"Attendance recorded",msg:late?s.name+": "+fmtLate(lm):s.name,s,act:"Time in",t,p}}
else r={cls:"bad",title:"Student already checked in",msg:s.name}}
else r={cls:"bad",title:"Student already checked in",msg:s.name+" at "+rec.in,s}}
}catch(e){r={cls:"bad",title:"Couldn’t save attendance",msg:"Check the internet connection and scan again."}}
r.name=s?s.name:"Unknown";r.time=now();log.unshift(r);lastResult=r;showRes(r);paintLog();
if(navigator.vibrate)navigator.vibrate(r.cls=="bad"?[80,60,80]:60);
}

// ---------- Camera scanner ----------
let cam=null,lastCode="",lastAt=0;
async function toggleCam(){
if(cam)return stopCam();
if(!window.Html5Qrcode)return alert("The camera library didn’t load. Check the internet connection.");
$("#reader").classList.remove("hide");
cam=new Html5Qrcode("reader");
try{
await cam.start({facingMode:"environment"},{fps:10,qrbox:{width:220,height:220}},code=>{
if(code===lastCode&&Date.now()-lastAt<3000)return; // ignore repeat reads of the same card
lastCode=code;lastAt=Date.now();doScan(code.trim())},()=>{});
$("#cam").textContent="Stop camera";
}catch(e){cam=null;$("#reader").classList.add("hide");alert("Can’t open the camera. Allow camera access, and open the site over https.")}
}
function stopCam(){
if(!cam)return;
const c=cam;cam=null;c.stop().then(()=>c.clear()).catch(()=>{});
const r=$("#reader"),b=$("#cam");if(r)r.classList.add("hide");if(b)b.textContent="Start camera";
}
function showRes(r){const e=$("#res");if(!e)return;e.className="result "+r.cls;
e.innerHTML=`<h3>${r.title}</h3><p>${r.msg}</p>${r.s?`<p class="big">${r.s.no} · ${r.s.course}</p>`:""}${r.act?`<p class="big">${r.p.name} · ${r.act} at ${r.t}</p>`:""}`}
function paintLog(){const l=$("#lg");if(!l)return;
l.innerHTML=log.length?`<tr><th>Time</th><th>Student</th><th>Result</th></tr>`+log.slice(0,8).map(r=>`<tr><td>${r.time}</td><td>${r.name}</td><td>${r.title}</td></tr>`).join(""):`<tr><td>No scans yet. Scan a student to start.</td></tr>`}
// ---------- Sign in (demo only: real accounts need server-side checks) ----------
const err=m=>{$("#le").textContent=m};
const ready=(DB.on?DB.load():Promise.all(students.map(async s=>{if(!s.claim_code)s.pw=await hashPw(s.no,"student123");if(s.no==="2023-0142")s.recovery_hash=await hashPw(s.no,"K7M29QXAW4TB")}))).catch(()=>err("Can’t reach the database. Check js/config.js."));
// Pull in changes made on other devices (only redraw screens with nothing to type into)
setInterval(async()=>{if(!role)return;try{await DB.load()}catch{return}
programs.forEach(p=>p.status=autoStatus(p));
if(me)me=students.find(x=>x.id===me.id)||me;
if(["dash","sdash","shist","attend"].includes(page)||(role==="checker"&&page==="scan"&&!$("#sp")))render()},5000);
function logout(){role=null;me=null;closeMenu();const dl=$("#dlg");if(dl&&dl.open)dl.close();showForm("in");$("#lf").reset();err("");$("#app").classList.add("hide");$("#login").classList.remove("hide")}
$("#lf").onsubmit=async e=>{e.preventDefault();await ready;const u=$("#lu").value.trim(),p=$("#lp").value;
if(u.toLowerCase()==="admin"&&p==="admin123"){role="admin";me=null;page="dash"}
else{const s=students.find(x=>x.no===u);
if(s&&!s.pw)return err("This account isn’t activated yet. Choose “Activate your account” below and enter the code from your class representative.");
if(!s||await hashPw(s.no,p)!==s.pw)return err("Student number or password is incorrect.");
if(!s.active)return err("This account is inactive. Ask an administrator to reactivate it.");
me=s;role=s.checker?"checker":"student";page=s.must_change_pw?"spw":s.checker?"scan":"sdash"}
err("");$("#login").classList.add("hide");$("#app").classList.remove("hide");render()};

// ---------- Recovery codes ----------
function newRecovery(){
const A="ABCDEFGHJKMNPQRSTUVWXYZ23456789",t=Array.from(crypto.getRandomValues(new Uint8Array(12)),x=>A[x%31]).join("");
return t.slice(0,4)+"-"+t.slice(4,8)+"-"+t.slice(8)}
const clean=c=>c.replace(/[\s-]/g,"").toUpperCase();

// A signed-in student creates (or replaces) their own recovery code
function recoveryDialog(){
dialog(`<form class="dform"><h2>${me.recovery_hash?"New recovery code":"Create your recovery code"}</h2>
<p>For your safety, enter your current password.${me.recovery_hash?" Your old recovery code will stop working.":""}</p>
<label>Current password<input id="rc-pw" type="password" autocomplete="current-password"></label>
<p class="err" id="rc-err" role="alert"></p>
<div class="dbtn"><button type="button" class="btn alt" id="rc-c">Cancel</button><button type="submit" class="btn">Continue</button></div></form>`,d=>{
$("#rc-c").onclick=()=>d.close();
d.querySelector("form").onsubmit=async e=>{e.preventDefault();
if(await hashPw(me.no,$("#rc-pw").value)!==me.pw)return $("#rc-err").textContent="That password isn’t correct.";
try{const code=newRecovery(),h=await hashPw(me.no,clean(code));await DB.setStudent(me.id,{recovery_hash:h});me.recovery_hash=h;
d.innerHTML=`<div class="dform"><h2>Your recovery code</h2><p>Save it now: take a screenshot or write it down. It is shown only once.</p><p class="cred">${code}</p>
<p class="hint">If you forget your password, choose “Forgot your password?” on the sign-in page and enter this code to choose a new one.</p>
<div class="dbtn"><button type="button" class="btn" id="rc-ok">I’ve saved it</button></div></div>`;
$("#rc-ok").onclick=()=>{d.close();render()}}
catch(er){$("#rc-err").textContent="Couldn’t save. Check the internet connection and try again."}}})}

// ---------- Sign-in page: sign in, activate, forgot password ----------
const FORMS={in:"#lf",act:"#af",forgot:"#ff",rc:"#rc"};
function showForm(which){
Object.keys(FORMS).forEach(k=>$(FORMS[k]).classList.toggle("hide",k!==which));
err("");$("#a-err").textContent="";$("#f-err").textContent=""}
function enter(x){
me=x;role=x.checker?"checker":"student";page=x.must_change_pw?"spw":x.checker?"scan":"sdash";
err("");$("#login").classList.add("hide");$("#app").classList.remove("hide");render()}
const merge=x=>{const l=students.find(v=>v.id===x.id);if(l)Object.assign(l,x);else students.push(x);return l||x};
// After activating or resetting, show the new recovery code once, then sign the student in
function showRecovery(x,code){
$("#rc").innerHTML=`<h1>Save your recovery code</h1>
<p>If you ever forget your password, this code lets you choose a new one yourself, without asking anyone.</p>
<p class="cred">${code}</p><p class="hint">Take a screenshot or write it down. It is shown only once.</p>
<label class="check"><input type="checkbox" id="rc-ck"> I’ve saved my recovery code</label>
<button class="btn" id="rc-go" disabled>Continue</button>`;
showForm("rc");
$("#rc-ck").onchange=e=>{$("#rc-go").disabled=!e.target.checked};
$("#rc-go").onclick=()=>{$("#rc").innerHTML="";enter(x)}}
function checkNewPassword(no,pw,pw2){
if(pw.length<6)return "Choose a password with at least 6 characters.";
if(pw===no)return "Choose a password that is different from your student number.";
if(pw!==pw2)return "The two passwords don’t match.";
return ""}

$("#to-act").onclick=()=>showForm("act");
$("#to-forgot").onclick=()=>showForm("forgot");
$("#to-in").onclick=()=>showForm("in");
$("#to-in2").onclick=()=>showForm("in");

// Activate: a student's first time, with the code from the class representative
$("#af").onsubmit=async e=>{e.preventDefault();await ready;
const aerr=t=>{$("#a-err").textContent=t};
const no=$("#a-no").value.trim(),code=clean($("#a-code").value),pw=$("#a-pw").value;
if(!no||!code||!pw)return aerr("Fill in every box.");
const bad=checkNewPassword(no,pw,$("#a-pw2").value);if(bad)return aerr(bad);
let x;try{x=await DB.findStudent(no)}catch(er){return aerr("Can’t reach the system. Check your internet connection and try again.")}
if(!x)return aerr("We can’t find that student number. Check it and try again.");
if(!x.active)return aerr("This account is inactive. Please ask the administrator.");
if(x.pw)return aerr("This account is already activated. Go back and sign in. If you forgot your password, choose “Forgot your password?”.");
if(!x.claim_code||clean(x.claim_code)!==code)return aerr("That activation code doesn’t match. Check it with your class representative.");
try{const rc=newRecovery(),h=await hashPw(x.no,pw),rh=await hashPw(x.no,clean(rc));
await DB.setStudent(x.id,{pw:h,recovery_hash:rh});x.pw=h;x.recovery_hash=rh;
const l=merge(x);$("#af").reset();showRecovery(l,rc)}
catch(er){aerr("Couldn’t save your password. Try again.")}};

// Forgot password: reset it yourself with the recovery code from when you activated
$("#ff").onsubmit=async e=>{e.preventDefault();await ready;
const ferr=t=>{$("#f-err").textContent=t};
const no=$("#f-no").value.trim(),code=clean($("#f-code").value),pw=$("#f-pw").value;
if(!no||!code||!pw)return ferr("Fill in every box.");
const bad=checkNewPassword(no,pw,$("#f-pw2").value);if(bad)return ferr(bad);
let x;try{x=await DB.findStudent(no)}catch(er){return ferr("Can’t reach the system. Check your internet connection and try again.")}
if(!x)return ferr("We can’t find that student number. Check it and try again.");
if(!x.active)return ferr("This account is inactive. Please ask the administrator.");
if(!x.pw)return ferr("This account hasn’t been activated yet. Go back and choose “Activate your account” instead.");
if(!x.recovery_hash)return ferr("This account has no recovery code. As a last resort, ask the administrator for a new activation code.");
if(await hashPw(x.no,code)!==x.recovery_hash)return ferr("That recovery code doesn’t match. Check it and try again.");
try{const rc=newRecovery(),h=await hashPw(x.no,pw),rh=await hashPw(x.no,clean(rc));
await DB.setStudent(x.id,{pw:h,recovery_hash:rh});x.pw=h;x.recovery_hash=rh;
const l=merge(x);$("#ff").reset();showRecovery(l,rc)}
catch(er){ferr("Couldn’t save your new password. Try again.")}};
