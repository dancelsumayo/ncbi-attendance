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
const att={1:{1:{in:"07:42",status:"Present"},2:{in:"08:15",status:"Late",lateMin:15},3:{in:"07:50",status:"Present"},4:{in:"07:48",status:"Present"},7:{in:"07:55",status:"Present"},10:{in:"08:20",status:"Late",lateMin:20}},
2:{2:{in:"07:55",status:"Present"},4:{in:"07:40",status:"Present"},7:{in:"07:58",status:"Present"},8:{in:"07:52",status:"Present"},10:{in:"07:45",status:"Present"},3:{status:"Excused",remark:"Medical certificate"}},
3:{1:{in:"08:10",out:"16:00",status:"Present"},2:{in:"08:45",out:"15:50",status:"Late",lateMin:15},3:{in:"08:00",out:"16:05",status:"Present"},7:{in:"08:05",out:"16:10",status:"Present"},10:{in:"08:20",status:"Present"}},
4:{},5:{}};
const penalties=[{id:1,student_id:6,term:"2nd Semester 2025-2026",note:"4 hours of community service",slips:4,settled:false,created_at:new Date().toISOString()}];
const changeLog=[{id:1,at:new Date(Date.now()-86400000).toISOString(),program_id:2,student_id:3,action:"Marked excused",old_value:"Absent (no record)",new_value:"Excused: Medical certificate",reason:"Medical certificate",by_user:"Administrator"}];
const photos={};   // student id -> small photo (data URL), or false when the student has none
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
// A program is Ongoing from when attendance opens until it closes:
//   check-in only: it closes at the official end
//   check-in and check-out: it closes 24 hours after the official end, so check-outs can still be scanned
// The admin can close it sooner, or reopen it, which restarts the 24 hours.
function atTime(p,t){return new Date(p.date+"T"+t+":00").getTime()}
function closeAt(p){const end=atTime(p,p.end),day=24*3600000;
return p.type==="inout"?Math.max(end+day,p.reopenedAt?p.reopenedAt+day:0):end}
function isManualClose(p){return Boolean(p.closedAt&&(!p.reopenedAt||p.closedAt>p.reopenedAt))}
function autoStatus(p){
if(p.status==="Cancelled"||!p.open||!p.end)return p.status;
const n=Date.now();
if(n<atTime(p,p.open))return "Upcoming";
if(isManualClose(p))return "Completed";
return n<=closeAt(p)?"Ongoing":"Completed"}
function closeLabel(p){return new Date(closeAt(p)).toLocaleString([],{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}
// Why a scan can't be recorded right now, or null if it can
function scanBlock(p,mode){
if(p.status!=="Ongoing")return closedReason(p);
if(mode==="in"&&Date.now()>atTime(p,p.end))return "Check-in closed when the program ended at "+fmtTime(p.end)+"."+(p.type==="inout"?" Check-out is still open.":"");
return null}
const MINUTES=[0,5,10,15,20,30,45,60];
const hhmm=m=>String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0");
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
return p.status==="Ongoing"&&!p.paused&&(me.lead?!(r&&r.out):isPresent(p.id,me.id))}
function status(p,s){const r=(att[p.id]||{})[s.id];if(r)return r.status;return p.status==="Completed"?"Absent":"—"}

// ---------- Navigation ----------
const menus={admin:[["dash","Dashboard"],["scan","QR scanner"],["attend","Attendance"],["clear","Clearance"],["programs","Programs"],["students","Students"],["ctrl","Scan team"],["hist","History"]],
student:[["sdash","My summary"],["sqr","My QR code"],["shist","My attendance"],["spw","Change password"]],
checker:[["scan","QR scanner"],["sdash","My summary"],["sqr","My QR code"],["shist","My attendance"],["spw","Change password"]]};
function nav(){
$("#nav").innerHTML=`<div class="brand"><b>North Coast Bohol Institute</b><span>Program attendance</span></div>`+
(me&&me.must_change_pw?menus.student.filter(x=>x[0]==="spw"):menus[role]).map(([k,l])=>`<button class="${k===page||(page==="profile"&&k===profBack)?"on":""}" data-k="${k}">${l}</button>`).join("")+
`<div class="role"><b>${role=="admin"?"Administrator":me.name}</b><br>${role=="admin"?"Full access":role=="checker"?"SBO officer":"Student"}<button id="out" style="margin-top:8px;border:1px solid #dcb57c;display:block;text-align:center;width:100%">Sign out</button></div>`;
document.querySelectorAll("#nav [data-k]").forEach(b=>b.onclick=()=>{page=b.dataset.k;render()});
$("#out").onclick=logout;
}
function render(){stopCam();camHandler=null;if(me&&me.must_change_pw)page="spw";nav();views[page]();}

// ---------- Admin views ----------
const views={
dash(){
const tl=termsList(),term=tl.includes(dashTerm)?dashTerm:currentTerm();dashTerm=term;
const active=students.filter(x=>x.active),reps=active.map(x=>({x,r:slipReport(x,term)}));
const finals=finalPrograms(term),groups=groupStats(term).filter(g=>g.expected>0);
const best=groups.filter(g=>g.punct!==null).sort((a,b)=>b.punct-a.punct||b.rate-a.rate)[0],worst=[...groups].sort((a,b)=>a.rate-b.rate)[0];
const nMissing=reps.filter(o=>o.r.status==="Missing slips").length,nPend=penalties.filter(x=>!x.settled&&x.term===term).length,nAct=active.filter(x=>!x.pw).length;
const going=programs.filter(p=>p.status==="Ongoing"),next=programs.filter(p=>p.status==="Upcoming").sort((a,b)=>(a.date+a.open).localeCompare(b.date+b.open))[0];
const attention=reps.filter(o=>o.r.missing.length||o.r.late>=3).sort((a,b)=>b.r.missing.length-a.r.missing.length||b.r.late-a.r.late||a.x.name.localeCompare(b.x.name)).slice(0,6);
const perfect=reps.filter(o=>o.r.attended>0&&o.r.late===0&&o.r.absent===0&&o.r.missing.length===0).sort((a,b)=>b.r.attended-a.r.attended||a.x.name.localeCompare(b.x.name)).slice(0,6);
const sorters={rate:(a,b)=>(b.rate??-1)-(a.rate??-1),punct:(a,b)=>(b.punct??-1)-(a.punct??-1),absent:(a,b)=>b.absent-a.absent,missing:(a,b)=>b.missing-a.missing};
const pc=v=>v===null?"—":Math.round(v*100)+"%";
const person=o=>`<div class="listrow"><div><button class="link" data-pf="${o.x.id}">${esc(o.x.name)}</button><br><small>${o.x.course} year ${o.x.year}</small></div>`;
$("#view").innerHTML=`<div class="head"><div><h1>Dashboard</h1><p class="sub">${active.length} current students. ${finals.length?finals.length+" finished program"+(finals.length==1?"":"s")+" count toward clearance in this term.":"No finished programs count toward clearance in this term yet."}</p></div>
<label>Term<select id="dt">${tl.map(t=>`<option>${esc(t)}</option>`).join("")}</select></label></div>
<div class="panel"><div class="combo"><label>Find a student<input id="dq" role="combobox" aria-expanded="false" aria-controls="dsug" aria-autocomplete="list" autocomplete="off" placeholder="Name or student number"></label><ul id="dsug" class="sug hide" role="listbox"></ul></div>
<p class="hint" style="margin:8px 0 0">Open anyone’s attendance, slips and clearance status.</p></div>
<div class="grid">
<button class="statbtn" data-go="missing"><b>${nMissing}</b><span>Students with missing slips</span></button>
<button class="statbtn" data-go="pending"><b>${nPend}</b><span>Penalties not settled yet</span></button>
<button class="statbtn" data-go="inactive"><b>${nAct}</b><span>Accounts not activated</span></button></div>
<div class="two2"><div class="panel"><h2>Happening now</h2>${going.length?going.map(p=>{const t=progStats(p);return `<div class="listrow"><div><b>${esc(p.name)}</b><br><small>${fmtTime(p.start)} to ${fmtTime(p.end)}</small></div><span>${t.present+t.late} scanned in</span></div>`}).join(""):"<p>No program is open for scanning right now.</p>"}</div>
<div class="panel"><h2>Coming up next</h2>${next?`<div class="listrow"><div><b>${esc(next.name)}</b><br><small>${next.date}, attendance opens ${fmtTime(next.open)}</small></div></div>`:"<p>No upcoming programs.</p>"}</div></div>
${groups.length?`<div class="two2"><div class="panel callout"><small>Most punctual</small><h2>${best?best.name:"Not enough data"}</h2><p>${best?pc(best.punct)+" of scans on time":""}</p></div>
<div class="panel callout bad"><small>Lowest attendance</small><h2>${worst.name}</h2><p>${pc(worst.rate)} attended, ${worst.absent} absence${worst.absent==1?"":"s"}</p></div></div>
<div class="panel"><div class="head"><h2>Course and year</h2><label>Rank by<select id="ds"><option value="rate">Highest attendance</option><option value="punct">Most punctual</option><option value="absent">Most absences</option><option value="missing">Most missing slips</option></select></label></div>
<div class="tablewrap"><table class="rank"><tr><th>Course and year</th><th>Students</th><th>Attendance</th><th>On time</th><th>Absences</th><th>Missing slips</th></tr>
${[...groups].sort(sorters[dashSort]).map(g=>`<tr><td><b>${g.name}</b></td><td>${g.students}</td><td>${pc(g.rate)}<div class="bar"><i style="width:${Math.round((g.rate||0)*100)}%"></i></div></td><td>${pc(g.punct)}</td><td>${g.absent}</td><td>${g.missing}</td></tr>`).join("")}</table></div></div>`:`<div class="panel"><h2>Course and year</h2><p>Rankings appear after the first program of the term finishes.</p></div>`}
<div class="two2"><div class="panel"><h2>Needs attention</h2>${attention.length?attention.map(o=>person(o)+`<span>${o.r.missing.length} missing, ${o.r.late} late</span></div>`).join(""):"<p>No one needs attention right now.</p>"}</div>
<div class="panel"><h2>Perfect record</h2>${perfect.length?perfect.map(o=>person(o)+`<span>${o.r.attended} of ${o.r.attended} on time</span></div>`).join(""):"<p>No one has a perfect record yet.</p>"}</div></div>`;
$("#dt").value=term;$("#dt").onchange=e=>{dashTerm=e.target.value;render()};
if($("#ds")){$("#ds").value=dashSort;$("#ds").onchange=e=>{dashSort=e.target.value;render()}}
document.querySelectorAll("#view [data-pf]").forEach(b=>b.onclick=()=>openProfile(+b.dataset.pf,"dash"));
document.querySelectorAll("#view [data-go]").forEach(b=>b.onclick=()=>{const g=b.dataset.go;
if(g==="inactive"){fl={q:"",course:"",year:"",role:"",status:"pending"};page="students"}
else{cl={term,q:"",course:"",year:"",status:g==="missing"?"Missing slips":"Penalty pending",sort:"name"};page="clear"}
render()});
typeahead("#dq","#dsug",q=>students.map(x=>({x,sc:matchScore(q,x.name+" "+x.no+" "+(x.email||""))})).filter(o=>o.sc>0).sort((a,b)=>b.sc-a.sc||a.x.name.localeCompare(b.x.name)).map(o=>({title:o.x.name,sub:o.x.no+", "+o.x.course+" year "+o.x.year+(o.x.active?"":" (inactive)"),id:o.x.id})),it=>openProfile(it.id,"dash"));
},
scan(){
const list=role==="admin"?programs.filter(p=>p.status==="Ongoing"):programs.filter(officerCan);
const open=list.filter(p=>p.status==="Ongoing");
if(!list.length){
const going=programs.filter(p=>p.status==="Ongoing"),leads=students.filter(x=>x.lead&&x.active).map(x=>x.name).join(", ")||"none set yet, ask the administrator";
const why=role==="admin"?"No program is open for scanning right now. A program opens when its attendance opening time arrives, and you can reopen a finished program on the Programs page.":!going.length?"No event has attendance open right now.":going.every(p=>p.paused)?"Scanning is paused by the administrator.":"A lead officer needs to scan your ID first. Lead officers: "+leads+".";
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
document.querySelectorAll("#view [data-t]").forEach(b=>b.onclick=()=>doScan(b.dataset.t));
$("#go").onclick=()=>doScan($("#tok").value.trim());
$("#cam").onclick=toggleCam;
const syncMode=()=>{const p=programs.find(x=>x.id==$("#sp").value),io=Boolean(p&&p.type==="inout");$("#modebox").classList.toggle("hide",!io);
if(io){document.querySelectorAll("#view [data-mode]").forEach(b=>b.classList.toggle("on",b.dataset.mode===scanMode));
$("#modehint").textContent=scanMode==="in"?"Scanning students as they arrive.":"Scanning students as they leave. Check-out stays open until "+closeLabel(p)+"."}};
$("#sp").onchange=syncMode;document.querySelectorAll("#view [data-mode]").forEach(b=>b.onclick=()=>{scanMode=b.dataset.mode;syncMode()});syncMode();
$("#tok").onkeydown=e=>{if(e.key==="Enter")doScan(e.target.value.trim())};
paintLog();if(lastResult)showRes(lastResult);
},
programs(){
const canReopen=p=>p.status==="Completed"&&(p.type==="inout"||Date.now()<=atTime(p,p.end));
const hint=p=>p.status==="Ongoing"&&p.type==="inout"?"Check-out open until "+closeLabel(p):p.status==="Completed"?(isManualClose(p)?"Closed by admin":p.type==="inout"?"Closed automatically":""):"";
const actions=p=>p.status==="Upcoming"?`<button class="btn alt" data-e="${p.id}">Edit</button> <button class="btn alt" data-x="${p.id}">Cancel</button>`:p.status==="Ongoing"?`<button class="btn alt" data-e="${p.id}">Edit</button> <button class="btn alt" data-c="${p.id}">Close</button> <button class="btn alt" data-x="${p.id}">Cancel</button>`:p.status==="Completed"?`<button class="btn alt" data-e="${p.id}">Edit</button>${canReopen(p)?` <button class="btn alt" data-o="${p.id}">Reopen</button>`:""}`:"";
$("#view").innerHTML=`<div class="head"><div><h1>Programs</h1><p class="sub">Set when attendance opens, when the program starts and ends, and how long students have to arrive on time.</p></div><button class="btn" id="new-pg">New program</button></div>
<div class="panel"><div class="tablewrap"><table><tr><th>Program</th><th>Date</th><th>Attendance</th><th>Opens</th><th>Starts</th><th>Ends</th><th>On time until</th><th>Status</th><th><span class="sr">Actions</span></th></tr>
${[...programs].sort((a,b)=>b.date.localeCompare(a.date)).map(p=>`<tr><td>${esc(p.name)}<br><small>${esc(termOf(p))}${p.counts===false?", <b>not for clearance</b>":""}</small></td><td>${p.date}</td><td>${p.type==="inout"?"Check-in and check-out":"Check-in only"}</td><td>${fmtTime(p.open)}</td><td>${fmtTime(p.start)}</td><td>${fmtTime(p.end)}</td><td>${fmtTime(p.lateAfter)}</td>
<td>${tag(p.status)}${hint(p)?`<br><small>${hint(p)}</small>`:""}</td><td class="nowrap">${actions(p)}</td></tr>`).join("")}</table></div></div>`;
$("#new-pg").onclick=()=>programDialog();
const prog=b=>programs.find(x=>x.id==b.dataset.e||x.id==b.dataset.x||x.id==b.dataset.c||x.id==b.dataset.o);
document.querySelectorAll("#view [data-e]").forEach(b=>b.onclick=()=>programDialog(prog(b)));
document.querySelectorAll("#view [data-x]").forEach(b=>b.onclick=()=>cancelProgram(prog(b)));
document.querySelectorAll("#view [data-c]").forEach(b=>b.onclick=()=>closeProgramDialog(prog(b)));
document.querySelectorAll("#view [data-o]").forEach(b=>b.onclick=()=>reopenDialog(prog(b)));
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
clear(){
const tl=termsList(),term=tl.includes(cl.term)?cl.term:currentTerm();cl.term=term;
const act=students.filter(x=>x.active),finals=finalPrograms(term),courses=[...new Set(act.map(x=>x.course))].sort(),years=[...new Set(act.map(x=>x.year))].sort((a,b)=>a-b);
$("#view").innerHTML=`<div class="head"><div><h1>Clearance</h1><p class="sub">Slips collected by each student in a term. Only finished programs that count for clearance are included.</p></div>
<label>Term<select id="cl-t">${tl.map(t=>`<option>${esc(t)}</option>`).join("")}</select></label></div>
<div class="panel"><h2>Clearance desk</h2><p class="hint" style="margin:0 0 10px">Scan a student’s ID, or type their student number, to see their slips right away.</p>
<div class="row"><label class="grow">Student number or QR code<input id="desk-in" placeholder="e.g. 2023-0142" autocomplete="off"></label><button class="btn" id="desk-go">Find</button><button class="btn alt" id="cam">Start camera</button></div>
<div id="reader" class="hide"></div><div id="desk-res"></div></div>
<div class="panel"><div class="pills" id="cl-sum"></div><div class="filters">
<label class="grow">Search<input id="cl-q" placeholder="Name or student number"></label>
<label>Course<select id="cl-c"><option value="">All courses</option>${courses.map(c=>`<option>${c}</option>`).join("")}</select></label>
<label>Year<select id="cl-y"><option value="">All years</option>${years.map(y=>`<option value="${y}">Year ${y}</option>`).join("")}</select></label>
<label>Status<select id="cl-s"><option value="">All</option><option>Clear</option><option>Missing slips</option><option>Penalty pending</option></select></label>
<label>Sort by<select id="cl-o"><option value="name">Name A to Z</option><option value="missing">Most missing slips</option><option value="late">Most late</option></select></label>
<button class="btn alt" id="cl-x">Clear filters</button><button class="btn alt" id="cl-print">Print list</button></div>
<p class="sub" id="cl-count"></p><div class="tablewrap"><table id="cl-table"></table></div></div>`;
$("#cl-t").value=term;$("#cl-q").value=cl.q;$("#cl-c").value=cl.course;$("#cl-y").value=cl.year;$("#cl-s").value=cl.status;$("#cl-o").value=cl.sort;
camHandler=deskLookup;
let shown=[];
const draw=()=>{
const all=act.map(x=>({x,r:slipReport(x,term)}));
const list=all.filter(o=>matchScore(cl.q,o.x.name+" "+o.x.no)>0&&(!cl.course||o.x.course===cl.course)&&(!cl.year||String(o.x.year)===cl.year)&&(!cl.status||o.r.status===cl.status));
const cmp={name:(a,b)=>a.x.name.localeCompare(b.x.name),missing:(a,b)=>b.r.missing.length-a.r.missing.length||a.x.name.localeCompare(b.x.name),late:(a,b)=>b.r.late-a.r.late||a.x.name.localeCompare(b.x.name)}[cl.sort];
list.sort(cmp);shown=list;
const n=k=>all.filter(o=>o.r.status===k).length;
$("#cl-sum").innerHTML=finals.length?`<span class="pill ok"><b>${n("Clear")}</b> clear</span><span class="pill late"><b>${n("Penalty pending")}</b> penalty pending</span><span class="pill absent"><b>${n("Missing slips")}</b> missing slips</span><span class="by" style="align-self:center">${finals.length} program${finals.length==1?"":"s"} count in this term</span>`:`<span class="by">No finished programs count toward clearance in this term yet.</span>`;
$("#cl-count").textContent="Showing "+list.length+" of "+all.length+" students";
$("#cl-table").innerHTML=list.length?`<tr><th>Student</th><th>Course and year</th><th>Slips</th><th>Late</th><th>Excused</th><th>Status</th><th>Missing</th></tr>`+
list.map(o=>`<tr><td><button class="link" data-pf="${o.x.id}">${esc(o.x.name)}</button><br><small>${o.x.no}</small></td><td>${o.x.course}, year ${o.x.year}</td><td>${slipText(o.r)}</td><td>${o.r.late}</td><td>${o.r.excused}</td><td>${clearTag(o.r.status)}</td>
<td><small>${o.r.missing.length?o.r.missing.slice(0,2).map(m=>esc(m.p.name)+" ("+m.slip+")").join(", ")+(o.r.missing.length>2?" and "+(o.r.missing.length-2)+" more":""):"—"}</small></td></tr>`).join(""):`<tr><td>No students match these filters.</td></tr>`;
document.querySelectorAll("#cl-table [data-pf]").forEach(b=>b.onclick=()=>openProfile(+b.dataset.pf,"clear"))};
$("#cl-t").onchange=e=>{cl.term=e.target.value;render()};
$("#cl-q").oninput=e=>{cl.q=e.target.value;draw()};
$("#cl-c").onchange=e=>{cl.course=e.target.value;draw()};
$("#cl-y").onchange=e=>{cl.year=e.target.value;draw()};
$("#cl-s").onchange=e=>{cl.status=e.target.value;draw()};
$("#cl-o").onchange=e=>{cl.sort=e.target.value;draw()};
$("#cl-x").onclick=()=>{cl={term,q:"",course:"",year:"",status:"",sort:"name"};render()};
$("#cl-print").onclick=()=>shown.length?printClearanceList(shown,term):toast("There is nobody in the list to print.");
$("#desk-go").onclick=()=>deskLookup($("#desk-in").value);
$("#desk-in").onkeydown=e=>{if(e.key==="Enter")deskLookup(e.target.value)};
$("#cam").onclick=toggleCam;
draw();
},

hist(){
$("#view").innerHTML=`<h1>History</h1><p class="sub">Every manual correction, excused absence and penalty, with what changed and why.</p>
<div class="panel"><div class="filters"><label class="grow">Search<input id="h-q" placeholder="Student, program, or reason"></label>
<label>Type<select id="h-t"><option value="">All changes</option><option value="att">Attendance corrections</option><option value="pen">Penalties</option></select></label>
<label>From<input type="date" id="h-from"></label><label>To<input type="date" id="h-to"></label><button class="btn alt" id="h-x">Clear</button></div>
<p class="sub" id="h-count"></p><div class="tablewrap"><table id="h-table"></table></div><p><button class="btn alt hide" id="h-more">Show more</button></p></div>`;
$("#h-q").value=hf.q;$("#h-t").value=hf.type;$("#h-from").value=hf.from;$("#h-to").value=hf.to;
const draw=()=>{
const rows=changeLog.filter(e=>{const x=students.find(v=>v.id===e.student_id),p=programs.find(v=>v.id===e.program_id),d=e.at?new Date(e.at).toLocaleDateString("en-CA"):"";
return matchScore(hf.q,[x&&x.name,x&&x.no,p&&p.name,e.action,e.old_value,e.new_value,e.reason].join(" "))>0&&(!hf.type||(hf.type==="pen")===/^Penalty/.test(e.action))&&(!hf.from||d>=hf.from)&&(!hf.to||d<=hf.to)}).sort((a,b)=>(b.at||"").localeCompare(a.at||""));
$("#h-count").textContent="Showing "+Math.min(rows.length,hf.shown)+" of "+rows.length+" changes";
$("#h-table").innerHTML=rows.length?`<tr><th>When</th><th>Student</th><th>Program</th><th>Change</th><th>Reason</th><th>By</th></tr>`+rows.slice(0,hf.shown).map(e=>{const x=students.find(v=>v.id===e.student_id),p=programs.find(v=>v.id===e.program_id);
return `<tr><td class="nowrap">${e.at?new Date(e.at).toLocaleString([],{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):"—"}</td><td>${x?`<button class="link" data-pf="${x.id}">${esc(x.name)}</button>`:"—"}</td><td>${p?esc(p.name):"—"}</td>
<td><b>${esc(e.action)}</b><br><small>${e.old_value?esc(e.old_value)+" → ":""}${esc(e.new_value||"")}</small></td><td>${esc(e.reason||"—")}</td><td>${esc(e.by_user||"—")}</td></tr>`}).join(""):`<tr><td>No changes match.</td></tr>`;
$("#h-more").classList.toggle("hide",rows.length<=hf.shown);
document.querySelectorAll("#h-table [data-pf]").forEach(b=>b.onclick=()=>openProfile(+b.dataset.pf,"hist"))};
$("#h-q").oninput=e=>{hf.q=e.target.value;hf.shown=25;draw()};
$("#h-t").onchange=e=>{hf.type=e.target.value;hf.shown=25;draw()};
$("#h-from").onchange=e=>{hf.from=e.target.value;draw()};
$("#h-to").onchange=e=>{hf.to=e.target.value;draw()};
$("#h-more").onclick=()=>{hf.shown+=25;draw()};
$("#h-x").onclick=()=>{hf={q:"",type:"",from:"",to:"",shown:25};views.hist()};
draw();
DB.loadLog().then(()=>{if(page==="hist"&&$("#h-table"))draw()}).catch(()=>{});
},

profile(){
const s=students.find(x=>x.id===profId);if(!s){page=profBack||"dash";return render()}
const tl=termsList(),term=tl.includes(profTerm)?profTerm:currentTerm();profTerm=term;
const rep=slipReport(s,term),rows=termRows(s,term),pens=penalties.filter(x=>x.student_id===s.id&&x.term===term);
const roleBadge=s.lead?`<span class="tag Completed">Lead officer</span>`:s.checker?`<span class="tag Present">SBO officer</span>`:`<span class="tag Excused">Student</span>`;
const acct=!s.active?`<span class="tag Absent">Inactive${s.inactive_reason?" ("+esc(s.inactive_reason)+")":""}</span>`:s.pw?`<span class="tag Present">Active</span>`:`<span class="tag Late">Not activated</span>`;
$("#view").innerHTML=`<button class="link back" id="pf-back">← Back</button>
<div class="profhead">${avatarHtml(s.id,"xl")}<div><h1>${esc(s.name)}</h1><p class="sub" style="margin:0 0 6px">${s.no}, ${s.course} year ${s.year}${s.email?", "+esc(s.email):""}</p><p style="margin:0">${roleBadge} ${acct}</p></div>
<div class="btns"><button class="btn alt" id="pf-edit">Edit details</button><button class="btn alt" id="pf-print">Print clearance slip</button></div></div>
<div class="head"><h2>Term</h2><label><span class="sr">Term</span><select id="pf-term">${tl.map(t=>`<option>${esc(t)}</option>`).join("")}</select></label></div>
<div class="grid"><div class="stat"><b>${slipText(rep)}</b><span>Slips collected</span></div><div class="stat"><b>${rep.late}</b><span>Late${rep.lateMin?" ("+fmtDur(rep.lateMin)+" in total)":""}</span></div><div class="stat"><b>${rep.absent}</b><span>Programs missed</span></div><div class="stat"><b>${rep.excused}</b><span>Excused</span></div><div class="stat"><b>${clearTag(rep.status)}</b><span>Clearance</span></div></div>
<div class="panel"><h2>Missing slips</h2>${rep.missing.length?`<ul class="plain">${rep.missing.map(m=>`<li>${esc(m.p.name)}, ${m.slip} (${m.p.date})</li>`).join("")}</ul>${rep.settled?`<p class="hint">${rep.settled} slip${rep.settled==1?"":"s"} covered by settled penalties.</p>`:""}`:"<p>No missing slips for this term.</p>"}</div>
<div class="panel"><div class="head"><h2>Penalties</h2>${rep.unresolved>0?`<button class="btn" id="pf-pen">Record a penalty</button>`:""}</div>${pens.length?pens.map(x=>`<div class="listrow"><div>${esc(x.note)}<br><small>Covers ${x.slips} slip${x.slips==1?"":"s"}, ${x.settled?"settled":"not settled yet"}</small></div><button class="btn alt" data-pt="${x.id}">${x.settled?"Mark not settled":"Mark settled"}</button></div>`).join(""):"<p>No penalties recorded for this term.</p>"}</div>
<div class="panel"><h2>Programs</h2><div class="tablewrap"><table><tr><th>Program</th><th>Check-in</th><th>Check-out</th><th>Result</th><th>Note</th><th><span class="sr">Actions</span></th></tr>
${rows.length?rows.map(x=>`<tr><td>${esc(x.p.name)}<br><small>${x.p.date}${x.p.counts===false?", not counted":""}</small></td><td>${x.inT}</td><td>${x.outT}</td><td>${resTag(x.result)}</td><td>${x.r&&x.r.remark?esc(x.r.remark):""}</td><td class="nowrap"><button class="btn alt" data-k="${x.p.id}">Correct</button></td></tr>`).join(""):`<tr><td colspan="6">No finished or running programs in this term yet.</td></tr>`}</table></div></div>`;
$("#pf-term").value=term;$("#pf-term").onchange=e=>{profTerm=e.target.value;render()};
$("#pf-back").onclick=()=>{page=profBack||"dash";render();window.scrollTo(0,0)};
$("#pf-edit").onclick=()=>studentDialog(s);
$("#pf-print").onclick=()=>printSlip(s,term);
if($("#pf-pen"))$("#pf-pen").onclick=()=>penaltyDialog(s,term,()=>views.profile());
document.querySelectorAll("#view [data-pt]").forEach(b=>b.onclick=()=>togglePenalty(penalties.find(x=>x.id==b.dataset.pt),()=>views.profile()));
document.querySelectorAll("#view [data-k]").forEach(b=>b.onclick=()=>correctDialog(programs.find(x=>x.id==b.dataset.k),s,()=>views.profile()));
hydratePhotos($("#view"));
},

attend(){
if(attProg&&programs.some(x=>x.id==attProg))return attendDetail(programs.find(x=>x.id==attProg));
attProg=null;
const hay=programHay;
$("#view").innerHTML=`<h1>Attendance</h1><p class="sub">Find a program, then open it to see who attended, who was late, and who scanned them.</p>
<div class="panel"><div class="filters">
<div class="combo grow"><label>Search programs<input id="aq" role="combobox" aria-expanded="false" aria-controls="asug" aria-autocomplete="list" autocomplete="off" placeholder="Name or date, e.g. foundation or december"></label><ul id="asug" class="sug hide" role="listbox"></ul></div>
<label>From<input type="date" id="af-from"></label><label>To<input type="date" id="af-to"></label>
<label>Status<select id="af-st"><option value="">All</option><option>Ongoing</option><option>Completed</option><option>Upcoming</option></select></label>
<label>Sort by<select id="af-so"><option value="new">Newest first</option><option value="old">Oldest first</option><option value="az">Name A to Z</option><option value="za">Name Z to A</option></select></label>
<button class="btn alt" id="af-x">Clear</button></div></div>
<p class="sub" id="acount"></p><div id="alist"></div>`;
$("#aq").value=af.q;$("#af-from").value=af.from;$("#af-to").value=af.to;$("#af-st").value=af.status;$("#af-so").value=af.sort;
const drawList=()=>{
const list=programs.filter(p=>p.status!=="Cancelled"&&(!af.from||p.date>=af.from)&&(!af.to||p.date<=af.to)&&(!af.status||p.status===af.status)&&matchScore(af.q,hay(p))>0);
const cmp={new:(a,b)=>b.date.localeCompare(a.date)||(b.start||"").localeCompare(a.start||""),old:(a,b)=>a.date.localeCompare(b.date)||(a.start||"").localeCompare(b.start||""),az:(a,b)=>a.name.localeCompare(b.name),za:(a,b)=>b.name.localeCompare(a.name)}[af.sort];
list.sort(cmp);
$("#acount").textContent="Showing "+Math.min(list.length,af.shown)+" of "+list.length+" programs";
$("#alist").innerHTML=list.length?list.slice(0,af.shown).map(programCard).join("")+(list.length>af.shown?`<button class="btn alt" id="a-more">Show more programs</button>`:""):`<div class="panel">No programs match. Try fewer words, or check the spelling.</div>`;
document.querySelectorAll("#view [data-v]").forEach(b=>b.onclick=()=>{attProg=+b.dataset.v;ad={q:"",course:"",year:"",status:"",out:"",sort:"name"};render();window.scrollTo(0,0)});
const more=$("#a-more");if(more)more.onclick=()=>{af.shown+=10;drawList()}};
// Suggestions that appear while typing (they allow small typos and partial words)
let sug=[],act=-1;
const closeSug=()=>{if(!$("#asug"))return;$("#asug").classList.add("hide");$("#aq").setAttribute("aria-expanded","false");$("#aq").removeAttribute("aria-activedescendant");act=-1};
const drawSug=()=>{
if(!af.q.trim())return closeSug();
sug=programs.filter(p=>p.status!=="Cancelled").map(p=>({p,sc:matchScore(af.q,hay(p))})).filter(x=>x.sc>0).sort((a,b)=>b.sc-a.sc||b.p.date.localeCompare(a.p.date)).slice(0,6);
if(!sug.length)return closeSug();
$("#asug").innerHTML=sug.map((x,i)=>`<li role="option" id="so${i}" data-i="${i}" aria-selected="${i===act}">${esc(x.p.name)}<small>${x.p.date}, ${x.p.status}</small></li>`).join("");
$("#asug").classList.remove("hide");$("#aq").setAttribute("aria-expanded","true");
if(act>=0)$("#aq").setAttribute("aria-activedescendant","so"+act);
document.querySelectorAll("#asug li").forEach(li=>li.onmousedown=e=>{e.preventDefault();pickSug(+li.dataset.i)})};
const pickSug=i=>{const x=sug[i];if(!x)return;af.q=x.p.name;af.shown=10;$("#aq").value=af.q;closeSug();drawList()};
$("#aq").oninput=e=>{af.q=e.target.value;af.shown=10;act=-1;drawList();drawSug()};
$("#aq").onkeydown=e=>{
if(e.key==="ArrowDown"&&sug.length){e.preventDefault();act=(act+1)%sug.length;drawSug()}
else if(e.key==="ArrowUp"&&sug.length){e.preventDefault();act=(act-1+sug.length)%sug.length;drawSug()}
else if(e.key==="Enter"){if(act>=0){e.preventDefault();pickSug(act)}else closeSug()}
else if(e.key==="Escape")closeSug()};
$("#aq").onblur=()=>setTimeout(closeSug,150);
$("#af-from").onchange=e=>{af.from=e.target.value;af.shown=10;drawList()};
$("#af-to").onchange=e=>{af.to=e.target.value;af.shown=10;drawList()};
$("#af-st").onchange=e=>{af.status=e.target.value;af.shown=10;drawList()};
$("#af-so").onchange=e=>{af.sort=e.target.value;drawList()};
$("#af-x").onclick=()=>{af={q:"",from:"",to:"",status:"",sort:"new",shown:10};views.attend()};
drawList();
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
document.querySelectorAll("#view [data-pz]").forEach(b=>b.onclick=async()=>{const p=programs.find(x=>x.id==b.dataset.pz);
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
const tl=termsList(),term=tl.includes(stTerm)?stTerm:currentTerm();stTerm=term;
const r=slipReport(me,term),pens=penalties.filter(x=>x.student_id===me.id&&x.term===term);
$("#view").innerHTML=`<div class="profhead">${avatarHtml(me.id,"xl")}<div><h1>${esc(me.name)}</h1><p class="sub" style="margin:0">${me.no}, ${me.course}, year ${me.year}</p></div></div>
${me.recovery_hash?"":`<div class="notice">Set up your recovery code so you can reset your own password if you forget it. <button class="link" id="go-rc">Set it up</button></div>`}
<div class="notice hide" id="ph-nudge">Add your photo so officers can see you when you are scanned. <button class="link" id="go-ph">Add it on the My QR code page</button></div>
<div class="head"><h2>Term</h2><label><span class="sr">Term</span><select id="st-t">${tl.map(t=>`<option>${esc(t)}</option>`).join("")}</select></label></div>
<div class="grid"><div class="stat"><b>${slipText(r)}</b><span>Slips collected</span></div><div class="stat"><b>${r.late}</b><span>Late</span></div><div class="stat"><b>${fmtDur(r.lateMin)}</b><span>Total time late</span></div><div class="stat"><b>${r.absent}</b><span>Programs missed</span></div><div class="stat"><b>${r.excused}</b><span>Excused</span></div></div>
<div class="panel"><h2>Clearance: ${clearTag(r.status)}</h2>${r.missing.length?`<p>You are missing these slips:</p><ul class="plain">${r.missing.map(m=>`<li>${esc(m.p.name)}, ${m.slip} (${m.p.date})</li>`).join("")}</ul><p class="hint">Talk to the administrator if one of these is a mistake.</p>`:`<p>${r.programs?"You have every slip for this term.":"No programs have finished in this term yet."}</p>`}
${pens.map(x=>`<p>Penalty: ${esc(x.note)} (${x.slips} slip${x.slips==1?"":"s"}), ${x.settled?"settled":"not settled yet"}.</p>`).join("")}</div>`;
$("#st-t").value=term;$("#st-t").onchange=e=>{stTerm=e.target.value;render()};
const g=$("#go-rc");if(g)g.onclick=()=>{page="spw";render()};
$("#go-ph").onclick=()=>{page="sqr";render()};
fetchPhoto(me.id).then(u=>{const n=$("#ph-nudge");if(!u&&n&&page==="sdash")n.classList.remove("hide")});
hydratePhotos($("#view"));
},
sqr(){
$("#view").innerHTML=`<h1>My QR code</h1><p class="sub">Show this to the scanner if you don’t have your school ID.</p>
<div class="panel"><h2>Your photo</h2>${photoControl(me.id,true)}</div>
<div class="panel" style="text-align:center"><div class="qrbox" id="qr"></div><p><b>${me.name}</b><br>${me.no}</p>
<button class="btn" id="dl">Download QR code</button></div>`;
bindPhoto(me.id);hydratePhotos($("#view"));
new QRCode($("#qr"),{text:me.token,width:200,height:200});
$("#dl").onclick=()=>{const c=$("#qr canvas"),i=$("#qr img"),a=document.createElement("a");a.href=c?c.toDataURL("image/png"):i.src;a.download="ncbi-qr-"+me.no+".png";a.click()};
},
shist(){
$("#view").innerHTML=`<h1>My attendance</h1><p class="sub">Every program and how you were recorded. You can’t edit these records.</p>
<div class="panel"><div class="tablewrap"><table><tr><th>Program</th><th>Date</th><th>Time in</th><th>Time out</th><th>Status</th></tr>
${programs.filter(p=>p.status!=="Cancelled"&&p.status!=="Upcoming").map(p=>{const r=(att[p.id]||{})[me.id]||{};return `<tr><td>${p.name}</td><td>${p.date}</td><td>${r.in||"—"}</td><td>${p.type=="in"?"n/a":r.out||(r.in&&p.status==="Completed"?"No check-out":"—")}</td><td>${status(p,me)=="—"?"Not yet recorded":tag(status(p,me))+(lateText(r)?" "+lateText(r):"")}</td></tr>`}).join("")}</table></div></div>`;
}};

// ---------- Attendance helpers ----------
let af={q:"",from:"",to:"",status:"",sort:"new",shown:10};
let ad={q:"",course:"",year:"",status:"",out:"",sort:"name"};
const norm=t=>String(t||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
function lev(a,b){const m=a.length,n=b.length,d=Array.from({length:m+1},(_,i)=>[i]);for(let j=1;j<=n;j++)d[0][j]=j;
for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[m][n]}
// How well a search matches some text (0 means no match). Handles partial words, small typos, and any word order.
function matchScore(q,text){
q=norm(q).trim();if(!q)return 1;
const hay=norm(text),toks=hay.split(/[^a-z0-9]+/).filter(Boolean);let total=0;
for(const w of q.split(/\s+/)){
if(toks.some(t=>t.startsWith(w))){total+=3;continue}
if(hay.includes(w)){total+=2;continue}
if(w.length>=4&&toks.some(t=>lev(w,t.slice(0,w.length))<=(w.length>=7?2:1))){total+=1;continue}
return 0}
return total}
const programHay=p=>[p.name,p.date,new Date(p.date+"T00:00:00").toLocaleDateString("en",{weekday:"long",month:"long",day:"numeric",year:"numeric"}),p.status,p.type==="inout"?"check-in check-out":"check-in"].join(" ");
const byName=by=>by==="admin"?"Administrator":(students.find(v=>v.no===by)||{}).name||by;
function progStats(p){
const recs=att[p.id]||{},scanners={};let present=0,late=0,noOut=0,excused=0;
Object.values(recs).forEach(r=>{if(r.status==="Excused")excused++;else if(r.status==="Late")late++;else present++;if(p.type==="inout"&&r.in&&!r.out)noOut++;if(r.by)scanners[r.by]=(scanners[r.by]||0)+1});
const missing=students.filter(x=>x.active&&!recs[x.id]).length;
return{present,late,excused,noOut,absent:p.status==="Completed"?missing:0,notYet:p.status==="Completed"?0:missing,scanners}}
function pills(p,t){
return `<span class="pill ok"><b>${t.present}</b> on time</span><span class="pill late"><b>${t.late}</b> late</span>`+(t.excused?`<span class="pill"><b>${t.excused}</b> excused</span>`:"")+
(p.status==="Completed"?`<span class="pill absent"><b>${t.absent}</b> absent</span>`:`<span class="pill"><b>${t.notYet}</b> not yet scanned</span>`)+
(p.type==="inout"?`<span class="pill"><b>${t.noOut}</b> ${p.status==="Completed"?"no check-out":"still inside"}</span>`:"")}
function scannedBy(t){
const e=Object.entries(t.scanners).sort((a,b)=>b[1]-a[1]);
return e.length?"Scanned by: "+e.map(([k,n])=>esc(byName(k))+" ("+n+")").join(", "):"No scanner information recorded."}
function programCard(p){const t=progStats(p);
return `<div class="panel pcard"><div class="head"><div><h3>${p.name}</h3><p class="sub" style="margin:0">${p.date}, ${p.type==="inout"?"check-in and check-out":"check-in only"}, ${fmtTime(p.start)} to ${fmtTime(p.end)}</p></div>
<div class="btns">${tag(p.status)}<button class="btn" data-v="${p.id}">View attendance</button></div></div>
<div class="pills">${pills(p,t)}</div><p class="by">${scannedBy(t)}</p></div>`}

function attendDetail(p){
const recs=att[p.id]||{},people=students.filter(x=>x.active||recs[x.id]),io=p.type==="inout";
const st=x=>{const r=recs[x.id];return r?r.status:p.status==="Completed"?"Absent":"none"};
const courses=[...new Set(people.map(x=>x.course))].sort(),years=[...new Set(people.map(x=>x.year))].sort((a,b)=>a-b);
$("#view").innerHTML=`<button class="link back" id="a-back">← All programs</button>
<div class="head"><div><h1>${p.name}</h1><p class="sub">${p.date}, ${io?"check-in and check-out":"check-in only"}. Opens ${fmtTime(p.open)}, starts ${fmtTime(p.start)}, ends ${fmtTime(p.end)}, on time until ${fmtTime(p.lateAfter)}. ${tag(p.status)}</p></div></div>
<div class="panel"><div class="pills">${pills(p,progStats(p))}</div><p class="by">${scannedBy(progStats(p))}</p></div>
<div class="panel"><div class="filters">
<label class="grow">Search students<input id="d-q" placeholder="Name or student number"></label>
<label>Course<select id="d-c"><option value="">All courses</option>${courses.map(c=>`<option>${c}</option>`).join("")}</select></label>
<label>Year<select id="d-y"><option value="">All years</option>${years.map(y=>`<option value="${y}">Year ${y}</option>`).join("")}</select></label>
<label>Status<select id="d-s"><option value="">All</option><option value="Present">On time</option><option value="Late">Late</option><option value="Absent">Absent</option><option value="Excused">Excused</option>${p.status!=="Completed"?`<option value="none">Not yet scanned</option>`:""}</select></label>
${io?`<label>Check-out<select id="d-o"><option value="">All</option><option value="out">Checked out</option><option value="noout">No check-out</option></select></label>`:""}
<label>Sort by<select id="d-so"><option value="name">Name A to Z</option><option value="namez">Name Z to A</option><option value="in">Time in, earliest</option><option value="inz">Time in, latest</option><option value="late">Most late</option></select></label>
<button class="btn alt" id="d-x">Clear filters</button></div>
<p class="sub" id="d-count"></p><div class="tablewrap"><table id="d-table"></table></div></div>`;
$("#d-q").value=ad.q;$("#d-c").value=ad.course;$("#d-y").value=ad.year;$("#d-s").value=ad.status;if(io)$("#d-o").value=ad.out;$("#d-so").value=ad.sort;
const draw=()=>{
const R=x=>recs[x.id]||{},T=x=>R(x).in||"",L=x=>R(x).lateMin||0;
const rows=people.filter(x=>matchScore(ad.q,x.name+" "+x.no)>0&&(!ad.course||x.course===ad.course)&&(!ad.year||String(x.year)===ad.year)&&(!ad.status||st(x)===ad.status)&&(!ad.out||(ad.out==="out"?Boolean(R(x).out):Boolean(R(x).in&&!R(x).out))));
const cmp={name:(a,b)=>a.name.localeCompare(b.name),namez:(a,b)=>b.name.localeCompare(a.name),in:(a,b)=>(T(a)||"99:99").localeCompare(T(b)||"99:99")||a.name.localeCompare(b.name),inz:(a,b)=>T(b).localeCompare(T(a))||a.name.localeCompare(b.name),late:(a,b)=>L(b)-L(a)||a.name.localeCompare(b.name)}[ad.sort];
rows.sort(cmp);
$("#d-count").textContent="Showing "+rows.length+" of "+people.length+" students";
$("#d-table").innerHTML=rows.length?`<tr><th>Student</th><th>Course and year</th><th>Time in</th>${io?"<th>Time out</th>":""}<th>Status</th><th>Late by</th><th>Scanned by</th><th><span class="sr">Actions</span></th></tr>`+
rows.map(x=>{const r=R(x),s=st(x);return `<tr><td><button class="link" data-pf="${x.id}">${esc(x.name)}</button><br><small>${x.no}</small></td><td>${x.course}, year ${x.year}</td><td>${r.in||"—"}</td>${io?`<td>${r.out||(r.in&&p.status==="Completed"?"No check-out":"—")}</td>`:""}<td>${s==="none"?"Not yet scanned":tag(s)}</td><td>${r.status==="Late"&&r.lateMin>0?fmtDur(r.lateMin):"—"}</td><td>${r.by?esc(byName(r.by)):"—"}</td><td class="nowrap">${p.status==="Upcoming"?"":`<button class="btn alt" data-k="${x.id}">Correct</button>`}</td></tr>`}).join(""):`<tr><td>No students match these filters.</td></tr>`;
document.querySelectorAll("#d-table [data-k]").forEach(b=>b.onclick=()=>correctDialog(p,students.find(v=>v.id==b.dataset.k),()=>attendDetail(p)));
document.querySelectorAll("#d-table [data-pf]").forEach(b=>b.onclick=()=>openProfile(+b.dataset.pf,"attend"))};
$("#d-q").oninput=e=>{ad.q=e.target.value;draw()};
$("#d-c").onchange=e=>{ad.course=e.target.value;draw()};
$("#d-y").onchange=e=>{ad.year=e.target.value;draw()};
$("#d-s").onchange=e=>{ad.status=e.target.value;draw()};
if(io)$("#d-o").onchange=e=>{ad.out=e.target.value;draw()};
$("#d-so").onchange=e=>{ad.sort=e.target.value;draw()};
$("#d-x").onclick=()=>{ad={q:"",course:"",year:"",status:"",out:"",sort:"name"};attendDetail(p)};
$("#a-back").onclick=()=>{attProg=null;render();window.scrollTo(0,0)};
draw()}

// ---------- Terms, slips and clearance ----------
// A "slip" is one scan: a check-in for every program, plus a check-out for check-out programs.
// Late still counts as collected. Excused removes the program from what the student needs.
function guessTerm(d){const y=+d.slice(0,4),m=+d.slice(5,7);return m>=8?"1st Semester "+y+"-"+(y+1):m<=5?"2nd Semester "+(y-1)+"-"+y:"Summer "+y}
const termOf=p=>p.term||guessTerm(p.date);
function termsList(){const last={};programs.forEach(p=>{const t=termOf(p);if(!last[t]||p.date>last[t])last[t]=p.date});return Object.keys(last).sort((a,b)=>last[b].localeCompare(last[a]))}
const finalPrograms=term=>programs.filter(p=>termOf(p)===term&&p.counts!==false&&p.status==="Completed").sort((a,b)=>a.date.localeCompare(b.date));
function currentTerm(){const tl=termsList();return tl.find(t=>finalPrograms(t).length)||tl[0]||""}
function slipReport(s,term){
const progs=finalPrograms(term),missing=[];let required=0,collected=0,attended=0,onTime=0,late=0,lateMin=0,absent=0,excused=0;
progs.forEach(p=>{
const r=(att[p.id]||{})[s.id],io=p.type==="inout";
if(r&&r.status==="Excused"){excused++;return}
required+=io?2:1;
if(r&&r.in){collected++;attended++;if(r.status==="Late"){late++;lateMin+=r.lateMin||0}else onTime++}
else{absent++;missing.push({p,slip:"check-in"})}
if(io){if(r&&r.out)collected++;else missing.push({p,slip:"check-out"})}});
const mine=penalties.filter(x=>x.student_id===s.id&&x.term===term);
const settled=mine.filter(x=>x.settled).reduce((a,x)=>a+x.slips,0),pending=mine.filter(x=>!x.settled);
const unresolved=Math.max(0,missing.length-settled);
const status=pending.length?"Penalty pending":unresolved>0?"Missing slips":"Clear";
return{required,collected,attended,onTime,late,lateMin,absent,excused,missing,settled,pending,unresolved,status,programs:progs.length}}
const slipText=r=>r.required?r.collected+" of "+r.required:"No slips yet";
const clearTag=t=>`<span class="tag ${t==="Clear"?"Present":t==="Missing slips"?"Absent":"Late"}">${t}</span>`;
const resTag=t=>t==="Excused"?`<span class="tag Excused">Excused</span>`:t.startsWith("Late")?`<span class="tag Late">${t}</span>`:t==="On time"?`<span class="tag Present">On time</span>`:t==="Absent"?`<span class="tag Absent">Absent</span>`:t;
// Every program of the term the student could have a result for (finished or running)
function termRows(s,term){return programs.filter(p=>termOf(p)===term&&(p.status==="Completed"||p.status==="Ongoing")).sort((a,b)=>a.date.localeCompare(b.date)).map(p=>{
const r=(att[p.id]||{})[s.id];
const result=r&&r.status==="Excused"?"Excused":r&&r.in?(r.status==="Late"?"Late"+(r.lateMin?" ("+fmtDur(r.lateMin)+")":""):"On time"):p.status==="Completed"?"Absent":"Not yet scanned";
return{p,r,result,inT:r&&r.in?r.in:"—",outT:p.type!=="inout"?"n/a":r&&r.out?r.out:(r&&r.in&&p.status==="Completed"?"No check-out":"—")}})}
function groupStats(term){const g={};
students.filter(x=>x.active).forEach(s=>{const k=s.course+" year "+s.year,r=slipReport(s,term),o=g[k]||(g[k]={name:k,students:0,attended:0,expected:0,onTime:0,absent:0,missing:0,clear:0});
o.students++;o.attended+=r.attended;o.expected+=r.attended+r.absent;o.onTime+=r.onTime;o.absent+=r.absent;o.missing+=r.missing.length;if(r.status==="Clear")o.clear++});
return Object.values(g).map(o=>({...o,rate:o.expected?o.attended/o.expected:null,punct:o.attended?o.onTime/o.attended:null}))}
let dashTerm="",dashSort="rate",profId=null,profBack="dash",profTerm="",stTerm="",cl={term:"",q:"",course:"",year:"",status:"",sort:"name"},hf={q:"",type:"",from:"",to:"",shown:25};
function openProfile(id,back){profId=id;profBack=back||page;page="profile";render();window.scrollTo(0,0)}
function afterStudentChange(){if(page==="students")views.students();else render()}

// Suggestions that appear under a search box while typing
function typeahead(input,list,items,onPick){
let cur=[],act=-1;const li=list.slice(1);
const close=()=>{const l=$(list),i=$(input);if(!l||!i)return;l.classList.add("hide");i.setAttribute("aria-expanded","false");i.removeAttribute("aria-activedescendant");act=-1};
const draw=()=>{const l=$(list),i=$(input);if(!l||!i)return;cur=i.value.trim()?items(i.value).slice(0,6):[];if(!cur.length)return close();
l.innerHTML=cur.map((x,n)=>`<li role="option" id="${li}-${n}" data-i="${n}" aria-selected="${n===act}">${esc(x.title)}<small>${esc(x.sub)}</small></li>`).join("");
l.classList.remove("hide");i.setAttribute("aria-expanded","true");if(act>=0)i.setAttribute("aria-activedescendant",li+"-"+act);
l.querySelectorAll("li").forEach(el=>el.onmousedown=e=>{e.preventDefault();pick(+el.dataset.i)})};
const pick=n=>{const x=cur[n];if(!x)return;close();onPick(x)};
const inp=$(input);
inp.addEventListener("input",()=>{act=-1;draw()});
inp.addEventListener("keydown",e=>{
if(e.key==="ArrowDown"&&cur.length){e.preventDefault();act=(act+1)%cur.length;draw()}
else if(e.key==="ArrowUp"&&cur.length){e.preventDefault();act=(act-1+cur.length)%cur.length;draw()}
else if(e.key==="Enter"){if(act>=0){e.preventDefault();pick(act)}else if(cur.length===1){e.preventDefault();pick(0)}else close()}
else if(e.key==="Escape")close()});
inp.addEventListener("blur",()=>setTimeout(close,150))}

// Clearance desk: look a student up by QR code or student number
function deskLookup(code){
const q=String(code||"").trim(),box=$("#desk-res");if(!box)return;
const x=students.find(v=>v.token===q.toUpperCase()||v.no===q);
if(!x){box.innerHTML=`<p class="err" role="alert">No student matches “${esc(q)}”.</p>`;return}
stopCam();
const term=cl.term||currentTerm(),r=slipReport(x,term);
box.innerHTML=`<div class="deskcard">${avatarHtml(x.id,"lg")}<div><h3>${esc(x.name)}</h3><small>${x.no}, ${x.course} year ${x.year}</small>
<p style="margin:8px 0 4px"><b>${slipText(r)} slips</b> ${clearTag(r.status)}</p>
<p style="margin:0 0 10px">${r.missing.length?"Missing: "+r.missing.map(m=>esc(m.p.name)+" ("+m.slip+")").join(", "):"No missing slips."}</p>
<button class="btn" id="desk-open">Open profile</button></div></div>`;
hydratePhotos(box);$("#desk-open").onclick=()=>openProfile(x.id,"clear")}

// ---------- Photos: small, square, and shrunk on the device before saving ----------
const AVATAR='<svg viewBox="0 0 64 64" role="img" aria-label="No photo yet"><rect width="64" height="64" fill="#dcb57c"/><circle cx="32" cy="25" r="11" fill="#3c0120"/><path d="M10 64c0-14 10-22 22-22s22 8 22 22z" fill="#3c0120"/></svg>';
const avatarHtml=(id,cls)=>{const u=photos[id];return `<span class="avatar ${cls||""}" data-ph="${id}">${u?`<img src="${u}" alt="">`:AVATAR}</span>`};
async function fetchPhoto(id){if(id in photos)return photos[id];try{photos[id]=(await DB.getPhoto(id))||false}catch(e){photos[id]=false}return photos[id]}
function hydratePhotos(root){(root||document).querySelectorAll("[data-ph]").forEach(async el=>{const u=await fetchPhoto(+el.dataset.ph);if(u&&el.isConnected)el.innerHTML=`<img src="${u}" alt="">`})}
function loadImage(file){return new Promise((ok,no)=>{const u=URL.createObjectURL(file),i=new Image();i.onload=()=>{URL.revokeObjectURL(u);ok(i)};i.onerror=()=>{URL.revokeObjectURL(u);no(new Error("unreadable"))};i.src=u})}
async function processPhoto(file){
const bad=m=>Object.assign(new Error(m),{friendly:true});
if(!file||!/^image\//.test(file.type))throw bad("Choose an image file, such as a JPG or PNG.");
if(file.size>15*1024*1024)throw bad("That file is too large. Choose a photo under 15 MB.");
let img;try{img=await loadImage(file)}catch(e){throw bad("That file isn’t a photo we can read. Try a JPG or PNG.")}
const S=256,c=document.createElement("canvas");c.width=c.height=S;
const g=c.getContext("2d"),side=Math.min(img.naturalWidth,img.naturalHeight);
g.fillStyle="#fff";g.fillRect(0,0,S,S);
g.drawImage(img,(img.naturalWidth-side)/2,(img.naturalHeight-side)/2,side,side,0,0,S,S);
let q=.85,url=c.toDataURL("image/jpeg",q);
while(url.length>80000&&q>.35){q-=.1;url=c.toDataURL("image/jpeg",q)}
if(url.length>120000)throw bad("That photo is too detailed to shrink enough. Try a different one.");
return url}
const photoControl=(id,mine)=>`<div class="photo-ctl">${avatarHtml(id,"xl")}<div><button type="button" class="btn alt" id="ph-btn">Upload photo</button><input type="file" id="ph-file" accept="image/*" class="hide">
<p class="hint">Use a clear photo of ${mine?"your":"the student’s"} face. It is shrunk to a small square (256 pixels), so it takes very little space.</p><p class="err" id="ph-err" role="alert"></p></div></div>`;
function bindPhoto(id){
$("#ph-btn").onclick=()=>$("#ph-file").click();
$("#ph-file").onchange=async e=>{const f=e.target.files[0];e.target.value="";if(!f)return;
const er=t=>{$("#ph-err").textContent=t};er("");
try{const u=await processPhoto(f);await DB.setPhoto(id,u);photos[id]=u;document.querySelectorAll('[data-ph="'+id+'"]').forEach(el=>{el.innerHTML=`<img src="${u}" alt="">`});toast("Photo saved.")}
catch(x){er(x.friendly?x.message:"Couldn’t save the photo. Check the internet connection and try again.")}}}

// ---------- History log, corrections, penalties ----------
async function logChange(p,s,action,oldV,newV,reason){
const e={program_id:p?p.id:null,student_id:s.id,action,old_value:oldV,new_value:newV,reason,by_user:"Administrator",at:new Date().toISOString()};
const row=await DB.addLog(e);changeLog.unshift({...e,...(row||{})})}
function describeRec(p,r){
if(!r)return p.status==="Completed"?"Absent (no record)":"No record";
if(r.status==="Excused")return "Excused"+(r.remark?": "+r.remark:"");
return (r.status==="Late"?"Late":"On time")+", in "+r.in+(r.lateMin>0?" ("+fmtDur(r.lateMin)+" late)":"")+(r.out?", out "+r.out:"")}

// Fix one student's result for one program. A reason is always required, and the change is logged.
function correctDialog(p,s,after){
if(role!=="admin"||!p||!s)return;
const r=(att[p.id]||{})[s.id]||null,io=p.type==="inout",start=r&&r.status==="Excused"?"excused":"attended";
dialog(`<form class="dform"><h2>Correct attendance</h2>
<p><b>${esc(s.name)}</b>, ${esc(p.name)} (${p.date})<br><small>Now: ${esc(describeRec(p,r))}</small></p>
<label>Result<select id="cr-res"><option value="attended">Attended</option><option value="excused">Excused absence</option><option value="absent">Absent (no attendance)</option></select></label>
<div id="cr-att"><div class="two"><label>Time in<input type="time" id="cr-in"></label>${io?`<label>Time out (optional)<input type="time" id="cr-out"></label>`:""}</div>
<p class="hint" id="cr-late"></p><label class="check hide" id="cr-wl"><input type="checkbox" id="cr-waive"> Don’t count the lateness</label></div>
<label>Reason (required)<input id="cr-reason" placeholder="e.g. Phone battery died, student was at the venue" autocomplete="off"></label>
<p class="err" id="cr-err" role="alert"></p>
<div class="dbtn"><button type="button" class="btn alt" id="cr-c">Cancel</button><button type="submit" class="btn">Save correction</button></div></form>`,d=>{
$("#cr-res").value=r?(r.status==="Excused"?"excused":r.in?"attended":"attended"):"attended";
$("#cr-in").value=r&&r.in?r.in:p.start;if(io&&r&&r.out)$("#cr-out").value=r.out;
const err=t=>{$("#cr-err").textContent=t};
const sync=()=>{const att_=$("#cr-res").value==="attended";$("#cr-att").classList.toggle("hide",!att_);
if(att_){const t=$("#cr-in").value,lm=t?lateMin(t,p.lateAfter):0;
$("#cr-late").textContent=!t?"":lm>0?"That is "+fmtDur(lm)+" after the on-time cutoff, so it will be marked Late.":"That is on time.";
$("#cr-wl").classList.toggle("hide",lm<=0)}};
$("#cr-res").onchange=sync;$("#cr-in").oninput=sync;sync();
$("#cr-c").onclick=()=>d.close();
d.querySelector("form").onsubmit=async e=>{e.preventDefault();
const res=$("#cr-res").value,reason=$("#cr-reason").value.trim(),old=describeRec(p,r);
if(reason.length<3)return err("Enter a reason so the change can be explained later.");
let row=null,action;
if(res==="attended"){
const tin=$("#cr-in").value,tout=io?$("#cr-out").value:"";
if(!tin)return err("Enter the time the student checked in.");
if(tout&&tout<tin)return err("The check-out time can’t be before the check-in time.");
const lm=$("#cr-waive").checked?0:lateMin(tin,p.lateAfter);
row={in:tin,out:tout||null,status:lm>0?"Late":"Present",lateMin:lm,by:(r&&r.by)||"admin",remark:reason};action="Corrected attendance"}
else if(res==="excused"){row={in:null,out:null,status:"Excused",lateMin:0,by:"admin",remark:reason};action="Marked excused"}
else{if(!r)return err("This student already has no attendance record for this program.");action="Marked absent"}
try{
if(row){await DB.upsertAttendance(p.id,s.id,row);att[p.id][s.id]=row}
else{await DB.removeAttendance(p.id,s.id);delete att[p.id][s.id]}
await logChange(p,s,action,old,describeRec(p,row),reason);
d.close();toast("Saved. The change is in the history log.");if(after)after()}
catch(er){err("Couldn’t save the correction. Check the internet connection and try again.")}}})}

function penaltyDialog(s,term,after){
if(role!=="admin")return;
const rep_=slipReport(s,term);
dialog(`<form class="dform"><h2>Record a penalty</h2>
<p><b>${esc(s.name)}</b>, ${esc(term)}<br><small>${rep_.unresolved} missing slip${rep_.unresolved==1?"":"s"} not yet covered by a settled penalty.</small></p>
<label>Penalty decided<input id="pn-note" placeholder="e.g. 2 hours of community service" autocomplete="off"></label>
<label>Missing slips it covers<input type="number" id="pn-slips" min="1" value="${Math.max(1,rep_.unresolved)}"></label>
<p class="err" id="pn-err" role="alert"></p>
<div class="dbtn"><button type="button" class="btn alt" id="pn-c">Cancel</button><button type="submit" class="btn">Record penalty</button></div></form>`,d=>{
$("#pn-c").onclick=()=>d.close();
d.querySelector("form").onsubmit=async e=>{e.preventDefault();
const note=$("#pn-note").value.trim(),slips=+$("#pn-slips").value;
if(!note)return $("#pn-err").textContent="Describe the penalty.";
if(!Number.isInteger(slips)||slips<1)return $("#pn-err").textContent="Enter how many missing slips it covers.";
try{const row=await DB.addPenalty({student_id:s.id,term,note,slips,settled:false});penalties.push(row);
await logChange(null,s,"Penalty recorded","",note+" ("+slips+" slip"+(slips==1?"":"s")+")","Term: "+term);
d.close();toast("Penalty recorded.");if(after)after()}
catch(er){$("#pn-err").textContent="Couldn’t save the penalty. Check the internet connection and try again."}}})}
async function togglePenalty(pen,after){
const s=students.find(x=>x.id===pen.student_id),on=!pen.settled;
try{await DB.setPenalty(pen.id,{settled:on,settled_at:on?new Date().toISOString():null});pen.settled=on;
await logChange(null,s,on?"Penalty settled":"Penalty reopened","",pen.note,"Term: "+pen.term);
toast(on?"Marked as settled.":"Marked as not settled.");if(after)after()}
catch(er){toast("Couldn’t save that change. Try again.")}}

// ---------- Printing ----------
function printHtml(inner){
const old=$("#sheet");if(old)old.remove();
const sh=document.createElement("div");sh.id="sheet";sh.innerHTML=inner;document.body.appendChild(sh);
window.addEventListener("afterprint",()=>{document.body.classList.remove("printing");sh.remove()},{once:true});
document.body.classList.add("printing");
try{window.print()}catch(e){document.body.classList.remove("printing");sh.remove();toast("Printing isn’t available here. Open the site in its own browser tab and try again.")}}
function printSlip(s,term){
const r=slipReport(s,term),rows=termRows(s,term);
printHtml(`<section class="sheet-sec"><h2>Clearance slip</h2><p><b>${esc(s.name)}</b>, ${s.no}, ${s.course} year ${s.year}<br>Term: ${esc(term)}</p>
<table><tr><th>Program</th><th>Date</th><th>Check-in</th><th>Check-out</th><th>Result</th></tr>
${rows.map(x=>`<tr><td>${esc(x.p.name)}${x.p.counts===false?" (not counted)":""}</td><td>${x.p.date}</td><td>${x.inT}</td><td>${x.outT}</td><td>${x.result}</td></tr>`).join("")}</table>
<p><b>Slips: ${slipText(r)}.</b> ${r.excused?r.excused+" excused. ":""}Status: ${r.status}${r.settled&&!r.unresolved&&r.missing.length?" (penalty settled)":""}.</p>
<p>Admin signature: ______________________ &nbsp;&nbsp; Date: ______________</p></section>`)}
function printClearanceList(items,term){
const g={};items.forEach(o=>{const k=o.x.course+", year "+o.x.year;(g[k]=g[k]||[]).push(o)});
printHtml(Object.keys(g).sort().map(k=>`<section class="sheet-sec"><h2>Clearance list: ${k}</h2><p>${esc(term)}</p>
<table><tr><th>Student no.</th><th>Name</th><th>Slips</th><th>Missing</th><th>Status</th><th>Signature</th></tr>
${g[k].sort((a,b)=>a.x.name.localeCompare(b.x.name)).map(o=>`<tr><td>${o.x.no}</td><td>${esc(o.x.name)}</td><td>${slipText(o.r)}</td><td>${o.r.missing.length?o.r.missing.map(m=>esc(m.p.name)+" ("+m.slip+")").join(", "):"—"}</td><td>${o.r.status}</td><td></td></tr>`).join("")}</table></section>`).join(""))}

// ---------- Program details: validate, save, re-mark ----------
let attProg=null;
function checkProgram(f){
if(!f.name||!f.date||!f.open||!f.lateAfter||!f.start||!f.end)return "Fill in the name, the date, and the three times.";
if(f.open>=f.start)return "Attendance must open before the program starts.";
if(f.end<=f.start)return "The program must end after it starts.";
if(f.lateAfter<f.open||f.lateAfter>f.start)return "“On time until” must be between the time attendance opens and the time the program starts.";
return ""}
// One popup for creating a program and for editing it.
//   Upcoming: everything can be changed.   Started: name, end time, on-time cutoff, term, clearance.
//   Finished: only the term and whether it counts toward clearance.
function programDialog(p){
if(role!=="admin")return;
const edit=Boolean(p),live=edit&&p.status==="Ongoing",done=edit&&p.status==="Completed",lock=(live||done)?"disabled":"",lockAll=done?"disabled":"";
const ed=p||{name:"",date:"",type:"in",open:"09:00",start:"10:00",end:"12:00",lateAfter:"09:50",term:termsList()[0]||"",counts:true};
let minutes=Math.max(0,mins(ed.start)-mins(ed.lateAfter)),confirmed=false,termTouched=edit;   // minutes before the start that still count as on time
const options=MINUTES.includes(minutes)?MINUTES:[...MINUTES,minutes].sort((a,b)=>a-b);
dialog(`<form class="dform" id="pf"><h2>${edit?"Edit program":"New program"}</h2>
${live?`<p class="notice">This program has started, so some details can no longer be changed.</p>`:""}${done?`<p class="notice">This program is finished, so you can only change its term and whether it counts toward clearance.</p>`:""}
<label>Name<input id="pg-name" value="${esc(ed.name)}" placeholder="e.g. Christmas party" ${lockAll}></label>
<label>Date<input type="date" id="pg-date" value="${ed.date}" ${lock}></label>
<fieldset class="modes" ${lock}><legend>How is attendance taken?</legend>
<label class="radio"><input type="radio" name="pg-type" value="in" ${ed.type==="in"?"checked":""}><span><b>Check-in only</b> (recommended)<br><small>One scan when students arrive. Fast, with shorter lines.</small></span></label>
<label class="radio"><input type="radio" name="pg-type" value="inout" ${ed.type==="inout"?"checked":""}><span><b>Check-in and check-out</b><br><small>Also scan when students leave. Use it when staying until the end matters.</small></span></label></fieldset>
<div class="three"><label>Attendance opens<input type="time" id="pg-open" value="${ed.open}" ${lock}></label>
<label>Program starts<input type="time" id="pg-start" value="${ed.start}" ${lock}></label>
<label>Program ends<input type="time" id="pg-end" value="${ed.end}" ${lockAll}></label></div>
<div class="field"><span class="lbl">On time if students scan up to this long before the program starts</span>
<div class="carousel"><button type="button" class="car-btn" id="car-l" aria-label="Show shorter times">‹</button>
<div class="chipscroll" id="pg-chips" role="radiogroup" aria-label="Minutes before the program starts">${options.map(m=>`<button type="button" role="radio" class="chip" data-m="${m}">${m?m+" min":"At start"}</button>`).join("")}</div>
<button type="button" class="car-btn" id="car-r" aria-label="Show longer times">›</button></div>
<p class="hint" id="pg-sum"></p></div>
<div class="two"><label>School term<input id="pg-term" list="pg-terms" value="${esc(edit?termOf(p):ed.term)}" placeholder="e.g. 1st Semester 2026-2027" autocomplete="off"><datalist id="pg-terms">${termsList().map(t=>`<option value="${esc(t)}">`).join("")}</datalist></label>
<label class="check" style="align-self:end"><input type="checkbox" id="pg-counts" ${ed.counts!==false?"checked":""}> Counts toward clearance</label></div>
<p class="hint">Clearance covers one term at a time. Turn off “Counts toward clearance” for optional events, so students aren’t marked as missing slips for them.</p>
<p class="err" id="pg-err" role="alert"></p>
<div class="dbtn"><button type="button" class="btn alt" id="pg-cancel">Cancel</button><button type="submit" class="btn" id="pg-save">${edit?"Save changes":"Create program"}</button></div></form>`,d=>{
const chips=[...d.querySelectorAll(".chip")],err=t=>{$("#pg-err").textContent=t};
const resetConfirm=()=>{if(confirmed){confirmed=false;$("#pg-save").textContent=edit?"Save changes":"Create program";err("")}};
const refresh=()=>{
const st=$("#pg-start").value,op=$("#pg-open").value,ok=m=>Boolean(st&&op)&&mins(st)-m>=mins(op);
if(!done&&!ok(minutes)){const valid=chips.map(c=>+c.dataset.m).filter(ok),smaller=valid.filter(v=>v<=minutes);if(valid.length)minutes=smaller.length?Math.max(...smaller):Math.min(...valid)}
chips.forEach(c=>{const m=+c.dataset.m;c.disabled=done||!ok(m);c.setAttribute("aria-checked",String(m===minutes));c.classList.toggle("on",m===minutes)});
$("#pg-sum").textContent=ok(minutes)?"Students scanned up to "+fmtTime(hhmm(mins(st)-minutes))+" are on time. Anyone after that is still recorded, but marked late, with how late they were.":"Set the times the program opens and starts first."};
chips.forEach(c=>c.onclick=()=>{minutes=+c.dataset.m;resetConfirm();refresh()});
$("#pg-open").oninput=()=>{resetConfirm();refresh()};$("#pg-start").oninput=()=>{resetConfirm();refresh()};
$("#pg-date").oninput=()=>{const v=$("#pg-date").value;if(!termTouched&&v)$("#pg-term").value=guessTerm(v)};
$("#pg-term").oninput=()=>{termTouched=true};
$("#car-l").onclick=()=>$("#pg-chips").scrollBy({left:-180,behavior:"smooth"});
$("#car-r").onclick=()=>$("#pg-chips").scrollBy({left:180,behavior:"smooth"});
$("#pg-cancel").onclick=()=>d.close();
refresh();
$("#pf").onsubmit=async e=>{e.preventDefault();
const f={name:$("#pg-name").value.trim(),date:$("#pg-date").value,type:(d.querySelector('input[name="pg-type"]:checked')||{}).value||"in",open:$("#pg-open").value,start:$("#pg-start").value,end:$("#pg-end").value,counts:$("#pg-counts").checked};
f.lateAfter=f.start?hhmm(Math.max(0,mins(f.start)-minutes)):"";
f.term=$("#pg-term").value.trim()||(f.date?guessTerm(f.date):"");
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

function closeProgramDialog(p){
if(role!=="admin"||!p)return;
dialog(`<form class="dform"><h2>Close program</h2><p>Close “${esc(p.name)}” now? It will be marked completed and nobody can scan for it any more. If you close it by mistake, you can reopen it.</p>
<div class="dbtn"><button type="button" class="btn alt" id="cl-no">Keep open</button><button type="submit" class="btn warn">Close program</button></div></form>`,d=>{
$("#cl-no").onclick=()=>d.close();
d.querySelector("form").onsubmit=async e=>{e.preventDefault();const t=Date.now();
try{await DB.setProgram(p.id,{closed_at:new Date(t).toISOString()});p.closedAt=t;p.status=autoStatus(p);d.close();views.programs();toast(p.name+" is closed and marked completed.")}
catch(er){toast("Couldn’t close the program. Try again.")}}})}

function reopenDialog(p){
if(role!=="admin"||!p)return;
const t=Date.now(),inout=p.type==="inout",until=inout?new Date(Math.max(atTime(p,p.end)+864e5,t+864e5)).toLocaleString([],{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):fmtTime(p.end);
dialog(`<form class="dform"><h2>Reopen program</h2>
<p>${inout?`Reopen “${esc(p.name)}”? It goes back to Ongoing and check-outs are accepted again. The 24-hour countdown starts over: it closes by itself on <b>${until}</b>, unless you close it sooner.`:`Reopen “${esc(p.name)}”? It goes back to Ongoing and check-in scanning resumes until the program ends at <b>${until}</b>.`}</p>
<div class="dbtn"><button type="button" class="btn alt" id="ro-no">Cancel</button><button type="submit" class="btn">Reopen program</button></div></form>`,d=>{
$("#ro-no").onclick=()=>d.close();
d.querySelector("form").onsubmit=async e=>{e.preventDefault();
try{await DB.setProgram(p.id,{reopened_at:new Date(t).toISOString()});p.reopenedAt=t;p.status=autoStatus(p);d.close();views.programs();toast(p.name+" is open again.")}
catch(er){toast("Couldn’t reopen the program. Try again.")}}})}

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
if(!rec.in||rec.status==="Excused")continue;
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
m.innerHTML=`<button role="menuitem" data-a="stats">View stats and clearance</button>
<button role="menuitem" data-a="edit">View or edit details</button>
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
if(a==="stats")return openProfile(x.id,"students");
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
<div class="two"><label>First name<input id="sd-first" value="${v("first_name")}"></label><label>Last name<input id="sd-last" value="${v("last_name")}"></label></div>
<div class="two"><label>Student number<input id="sd-no" placeholder="e.g. 2026-0101" value="${v("no")}" ${edit?"disabled":""}></label><label>Course<input id="sd-course" placeholder="e.g. BSIT" value="${v("course")}"></label></div>
<div class="two"><label>Year level<select id="sd-year">${[1,2,3,4].map(y=>`<option ${edit&&x.year===y?"selected":""}>${y}</option>`).join("")}</select></label>
<label>Email (optional)<input id="sd-email" type="email" value="${v("email")}"></label></div>
<p class="hint">The email is used only for verification codes and attendance receipts. Leave it empty if the student hasn’t agreed to share it.</p>
${edit?photoControl(x.id,false)+`<p class="hint">The student number can’t be changed after the account is created.</p>`:`<label>Role<select id="sd-role"><option value="student">Student</option><option value="sbo">SBO officer</option><option value="lead">Lead officer</option></select></label>
<p class="hint">Lead officers can scan as soon as attendance opens and scan other officers in. SBO officers can scan once they have been scanned in.</p>
<p class="hint">The student gets an activation code to choose their own password. You’ll see the code right after you add them.</p>`}
<p class="err" id="sd-err" role="alert"></p>
<div class="dbtn"><button type="button" class="btn alt" id="sd-cancel">Cancel</button><button type="submit" class="btn">${edit?"Save changes":"Add student"}</button></div></form>`,d=>{
const err=t=>{$("#sd-err").textContent=t};
if(edit){bindPhoto(x.id);hydratePhotos(d)}
$("#sd-cancel").onclick=()=>d.close();
$("#sf").onsubmit=async e=>{e.preventDefault();
const first=$("#sd-first").value.trim(),last=$("#sd-last").value.trim(),no=edit?x.no:$("#sd-no").value.trim(),course=$("#sd-course").value.trim().toUpperCase(),year=+$("#sd-year").value,email=$("#sd-email").value.trim();
if(!first||!last||!no||!course)return err("Enter the first name, last name, student number, and course.");
if(email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return err("That email address doesn’t look right.");
if(!edit&&students.some(v=>v.no===no))return err("A student with number "+no+" already exists.");
const name=first+" "+last,f={first_name:first,last_name:last,name,course,year,email:email||null};
try{
if(edit){await DB.setStudent(x.id,f);Object.assign(x,f);toast("Saved changes for "+name+".")}
else{let token;do{token="NCBI-"+Math.random().toString(16).slice(2,8).toUpperCase()}while(students.some(v=>v.token===token));
const row=await DB.addStudent({...f,no,token,active:true,checker:$("#sd-role").value!=="student",lead:$("#sd-role").value==="lead",claim_code:newCode()});
students.push(row);afterStudentChange();return showCode(d,row,"Account created")}
d.close();afterStudentChange();
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
const site=location.href.split("#")[0];
printHtml(Object.keys(groups).sort().map(g=>`<section class="sheet-sec"><h2>${g}</h2>
<p>Activation codes for the class representative. Give each student their code. To activate: open <b>${site}</b>, choose “Activate your account”, enter your student number and your code, then choose a password. Keep your code private. Students marked “Activated” already have their password.</p>
<table><tr><th>Student no.</th><th>Name</th><th>Activation code</th><th>Received</th></tr>
${groups[g].sort((a,b)=>a.name.localeCompare(b.name)).map(x=>`<tr><td>${x.no}</td><td>${x.name}</td><td><b>${x.claim_code||"none"}</b></td><td>${x.pw?"Activated":`<span class="box"></span>`}</td></tr>`).join("")}</table></section>`).join(""))}

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
else if(scanBlock(p,mode))r={cls:"bad",title:"Program is not accepting attendance",msg:scanBlock(p,mode)};
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
let cam=null,camHandler=null,lastCode="",lastAt=0;
async function toggleCam(){
if(cam)return stopCam();
if(!window.Html5Qrcode)return alert("The camera library didn’t load. Check the internet connection.");
$("#reader").classList.remove("hide");
cam=new Html5Qrcode("reader");
try{
await cam.start({facingMode:"environment"},{fps:10,qrbox:{width:220,height:220}},code=>{
if(code===lastCode&&Date.now()-lastAt<3000)return; // ignore repeat reads of the same card
lastCode=code;lastAt=Date.now();(camHandler||doScan)(code.trim())},()=>{});
$("#cam").textContent="Stop camera";
}catch(e){cam=null;$("#reader").classList.add("hide");alert("Can’t open the camera. Allow camera access, and open the site over https.")}
}
function stopCam(){
if(!cam)return;
const c=cam;cam=null;c.stop().then(()=>c.clear()).catch(()=>{});
const r=$("#reader"),b=$("#cam");if(r)r.classList.add("hide");if(b)b.textContent="Start camera";
}
function showRes(r){const e=$("#res");if(!e)return;e.className="result "+r.cls;
e.innerHTML=`<div class="resrow">${r.s?avatarHtml(r.s.id,"lg"):`<span class="avatar lg">${AVATAR}</span>`}<div><h3>${r.title}</h3><p>${r.msg}</p>${r.s?`<p class="big">${r.s.no} · ${r.s.course}, year ${r.s.year}</p>`:""}${r.act?`<p class="big">${r.p.name} · ${r.act} at ${r.t}</p>`:""}</div></div>`;
if(r.s)hydratePhotos(e)}
function paintLog(){const l=$("#lg");if(!l)return;
l.innerHTML=log.length?`<tr><th>Time</th><th>Student</th><th>Result</th></tr>`+log.slice(0,8).map(r=>`<tr><td>${r.time}</td><td>${r.name}</td><td>${r.title}</td></tr>`).join(""):`<tr><td>No scans yet. Scan a student to start.</td></tr>`}
// ---------- Sign in (demo only: real accounts need server-side checks) ----------
const err=m=>{$("#le").textContent=m};
const ready=(DB.on?DB.load():Promise.all(students.map(async s=>{if(!s.claim_code)s.pw=await hashPw(s.no,"student123");if(s.no==="2023-0142")s.recovery_hash=await hashPw(s.no,"K7M29QXAW4TB")}))).catch(()=>err("Can’t reach the database. Check js/config.js."));
// Pull in changes made on other devices (only redraw screens with nothing to type into)
setInterval(async()=>{if(!role)return;try{await DB.load()}catch{return}
programs.forEach(p=>p.status=autoStatus(p));
if(me)me=students.find(x=>x.id===me.id)||me;
if(["sdash","shist"].includes(page)||(["dash","attend"].includes(page)&&!/INPUT|SELECT|TEXTAREA/.test((document.activeElement||{}).tagName||""))||(page==="scan"&&!$("#sp")))render()},5000);
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
