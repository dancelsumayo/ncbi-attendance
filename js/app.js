/* NCBI Program Attendance - app logic (front-end demo)
   Sections: sample data -> navigation -> admin views -> student views -> scan logic -> sign in
   Replace the sample data with calls to the Express/PostgreSQL backend later. */

// ---------- Sample data (replace with API calls to the Express backend) ----------
const students=[
{id:1,no:"2023-0142",name:"Maria Clara Dela Cruz",course:"BSIT",year:3,token:"NCBI-7F3A91",active:true},
{id:2,no:"2023-0157",name:"Jose Rizal Santos",course:"BSIT",year:3,token:"NCBI-2B84C0",active:true,checker:true},
{id:3,no:"2024-0033",name:"Ana Lim Reyes",course:"BSED",year:2,token:"NCBI-91D5E7",active:true},
{id:4,no:"2024-0068",name:"Paolo Garcia",course:"BSBA",year:2,token:"NCBI-C3A612",active:true},
{id:5,no:"2022-0210",name:"Liza Mendoza",course:"BSHM",year:4,token:"NCBI-5E07B9",active:false},
{id:6,no:"2025-0012",name:"Ramon Cabahug",course:"BSIT",year:1,token:"NCBI-A41F68",active:true}];
const programs=[
{id:1,name:"Foundation Day",date:"2026-01-15",type:"in",lateAfter:"08:00",status:"Completed",venue:"School Gym"},
{id:2,name:"Intramurals",date:"2026-02-10",type:"in",lateAfter:"08:00",status:"Completed",venue:"Sports Field"},
{id:3,name:"General Assembly",date:"2026-03-05",type:"inout",lateAfter:"08:30",status:"Completed",venue:"Auditorium"},
{id:4,name:"Career Orientation",date:"2026-11-15",type:"inout",lateAfter:"08:30",status:"Ongoing",venue:"Auditorium"},
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
function status(p,s){const r=(att[p.id]||{})[s.id];if(r)return r.status;return p.status==="Completed"?"Absent":"—"}

// ---------- Navigation ----------
const menus={admin:[["dash","Dashboard"],["scan","QR scanner"],["attend","Attendance"],["programs","Programs"],["students","Students"],["ctrl","Scan control"]],
student:[["sdash","My summary"],["sqr","My QR code"],["shist","My attendance"],["spw","Change password"]],
checker:[["scan","QR scanner"],["sdash","My summary"],["sqr","My QR code"],["shist","My attendance"],["spw","Change password"]]};
function nav(){
$("#nav").innerHTML=`<div class="brand"><b>North Coast Bohol Institute</b><span>Program attendance</span></div>`+
menus[role].map(([k,l])=>`<button class="${k===page?"on":""}" data-k="${k}">${l}</button>`).join("")+
`<div class="role"><b>${role=="admin"?"Administrator":me.name}</b><br>${role=="admin"?"Full access":role=="checker"?"SBO officer":"Student"}<button id="out" style="margin-top:8px;border:1px solid #dcb57c;display:block;text-align:center;width:100%">Sign out</button></div>`;
document.querySelectorAll("#nav [data-k]").forEach(b=>b.onclick=()=>{page=b.dataset.k;render()});
$("#out").onclick=logout;
}
function render(){stopCam();nav();views[page]();}

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
const list=role==="admin"?programs.filter(p=>p.status!=="Cancelled"):programs.filter(p=>p.status==="Ongoing"&&p.scanning&&isPresent(p.id,me.id));
const open=list.filter(p=>p.status==="Ongoing");
if(role!=="admin"&&!list.length){$("#view").innerHTML=`<h1>QR scanner</h1><div class="panel"><h2>Scanning isn’t available</h2><p>You can scan only while an event is ongoing, scanning is turned on, and the administrator has marked you present. Ask the administrator, then reload this page.</p></div>`;return}
$("#view").innerHTML=`<h1>QR scanner</h1><p class="sub">Choose a program, then scan a student’s ID.</p>
<div class="scan"><div class="panel"><h2>Scan</h2>
<div class="row"><label>Program<select id="sp">${list.map(p=>`<option value="${p.id}" ${open[0]&&p.id==open[0].id?"selected":""}>${p.name} (${p.status})</option>`).join("")}</select></label></div>
<div class="row"><label style="flex:1">QR code value<input id="tok" placeholder="e.g. NCBI-7F3A91" autocomplete="off"></label><button class="btn" id="go">Record scan</button></div>
<div id="reader" class="hide"></div>
<div class="row"><button class="btn" id="cam">Start camera</button></div>
<p class="sub" style="margin:0 0 6px">No camera? Type a code above or pick a student to simulate a scan:</p>
<div class="row">${students.map(s=>`<button class="btn alt" data-t="${s.token}">${s.name.split(" ")[0]}</button>`).join("")}<button class="btn alt" data-t="NCBI-XXXXXX">Bad code</button></div></div>
<div><div class="result" id="res" aria-live="polite"><h3>Ready to scan</h3><p class="big">Results appear here.</p></div></div></div>
<div class="panel"><h2>Recent scans</h2><div class="tablewrap"><table id="lg"></table></div></div>`;
document.querySelectorAll("[data-t]").forEach(b=>b.onclick=()=>doScan(b.dataset.t));
$("#go").onclick=()=>doScan($("#tok").value.trim());
$("#cam").onclick=toggleCam;
$("#tok").onkeydown=e=>{if(e.key==="Enter")doScan(e.target.value.trim())};
paintLog();if(lastResult)showRes(lastResult);
},
programs(){
const ed=programs.find(p=>p.id===editId)||{name:"",date:"",type:"in",open:"09:00",lateAfter:"09:50",start:"10:00",end:"12:00"};
$("#view").innerHTML=`<h1>Programs</h1><p class="sub">Set when attendance opens, when the program starts and ends, and the cutoff for being on time.</p>
<div class="panel"><h2>${editId?"Edit program":"New program"}</h2>
<div class="row"><label style="flex:1;min-width:200px">Name<input id="pn" value="${esc(ed.name)}"></label>
<label>Date<input type="date" id="pd" value="${ed.date}"></label>
<label>Attendance<select id="pt"><option value="in" ${ed.type=="in"?"selected":""}>Login only</option><option value="inout" ${ed.type=="inout"?"selected":""}>Login and logout</option></select></label></div>
<div class="row"><label>Attendance opens<input type="time" id="po" value="${ed.open}"></label>
<label>On time until<input type="time" id="pl" value="${ed.lateAfter}"></label>
<label>Program starts<input type="time" id="ps" value="${ed.start}"></label>
<label>Program ends<input type="time" id="pe" value="${ed.end}"></label></div>
<p class="sub" style="margin:0 0 10px">Students scanned after the “on time until” time are still recorded, but marked late, with how late they were.</p>
<div class="row"><button class="btn" id="add">${editId?"Save changes":"Create program"}</button>${editId?`<button class="btn alt" id="canc">Discard changes</button>`:""}</div>
<p class="sub" id="pg-msg" style="margin:0" role="alert"></p></div>
<div class="panel"><h2>All programs</h2><div class="tablewrap"><table><tr><th>Program</th><th>Date</th><th>Opens</th><th>On time until</th><th>Starts</th><th>Ends</th><th>Status</th><th></th></tr>
${programs.map(p=>`<tr><td>${p.name}</td><td>${p.date}</td><td>${fmtTime(p.open)}</td><td>${fmtTime(p.lateAfter)}</td><td>${fmtTime(p.start)}</td><td>${fmtTime(p.end)}</td><td>${tag(p.status)}</td><td>${p.status!=="Cancelled"?`<button class="btn alt" data-e="${p.id}">Edit</button> <button class="btn alt" data-s="${p.id}:Cancelled">Cancel</button>`:""}</td></tr>`).join("")}</table></div></div>`;
$("#add").onclick=saveProgram;
if(editId)$("#canc").onclick=()=>{editId=null;render()};
document.querySelectorAll("[data-e]").forEach(b=>b.onclick=()=>{editId=+b.dataset.e;render();window.scrollTo(0,0)});
document.querySelectorAll("[data-s]").forEach(b=>b.onclick=async()=>{const [id,st]=b.dataset.s.split(":");await DB.setProgram(id,{status:st});programs.find(p=>p.id==id).status=st;render()});
},
students(){
$("#view").innerHTML=`<h1>Students</h1><p class="sub">Create, search, and manage student accounts. Only administrators can create accounts.</p>
<div class="panel"><h2>Create account</h2>
<div class="row">
<label>Student number<input id="ns-no" placeholder="e.g. 2026-0101"></label>
<label style="flex:1;min-width:200px">Full name<input id="ns-name"></label>
<label>Course<input id="ns-course" placeholder="e.g. BSIT" size="8"></label>
<label>Year<select id="ns-year"><option>1</option><option>2</option><option>3</option><option>4</option></select></label>
<label>Account type<select id="ns-role"><option value="student">Student</option><option value="checker">SBO officer</option></select></label>
<label>Starting password<input id="ns-pw" value="${genPw()}" size="12" autocomplete="off"></label>
<button class="btn" id="ns-add">Create account</button></div>
<p class="sub" id="ns-msg" style="margin:0" role="status"></p></div>
<div class="panel"><div class="row"><label style="flex:1">Search<input id="q" placeholder="Name or student number"></label>
<label>Course<select id="cf"><option value="">All</option>${[...new Set(students.map(s=>s.course))].map(c=>`<option>${c}</option>`).join("")}</select></label></div>
<div class="tablewrap"><table id="st"></table></div></div>`;
const draw=()=>{const q=$("#q").value.toLowerCase(),c=$("#cf").value;
$("#st").innerHTML=`<tr><th>Student no.</th><th>Name</th><th>Course</th><th>Year</th><th>Account</th><th>Role</th><th></th></tr>`+
students.filter(s=>(s.name+s.no).toLowerCase().includes(q)&&(!c||s.course==c)).map(s=>`<tr><td>${s.no}</td><td>${s.name}</td><td>${s.course}</td><td>${s.year}</td><td>${tag(s.active?"Present":"Absent").replace(/Present|Absent/,s.active?"Active":"Inactive")}</td><td>${s.checker?"SBO officer":"Student"}</td><td><button class="btn alt" data-a="${s.id}">${s.active?"Deactivate":"Activate"}</button> <button class="btn alt" data-r="${s.id}">${s.checker?"Remove SBO officer":"Make SBO officer"}</button> <button class="btn alt" data-p="${s.id}">Reset password</button></td></tr>`).join("");
document.querySelectorAll("[data-a]").forEach(b=>b.onclick=async()=>{const s=students.find(x=>x.id==b.dataset.a);s.active=!s.active;await DB.setStudent(s.id,{active:s.active});draw()});document.querySelectorAll("[data-r]").forEach(b=>b.onclick=async()=>{const s=students.find(x=>x.id==b.dataset.r);s.checker=!s.checker;await DB.setStudent(s.id,{checker:s.checker});draw()});
document.querySelectorAll("[data-p]").forEach(b=>b.onclick=async()=>{const s=students.find(x=>x.id==b.dataset.p),pw=genPw(),m=$("#ns-msg");
try{const h=await hashPw(s.no,pw);await DB.setStudent(s.id,{pw:h});s.pw=h;m.textContent="New password for "+s.name+" ("+s.no+"): "+pw+"  Give it to the student."}
catch(e){m.textContent="Couldn’t reset the password. Try again."}
m.scrollIntoView({block:"center"})})};
$("#q").oninput=draw;$("#cf").onchange=draw;draw();
$("#ns-add").onclick=createAccount;
},
attend(){
const ps=programs.filter(p=>p.status!=="Cancelled");
if(!ps.length){$("#view").innerHTML=`<h1>Attendance</h1><div class="panel">No programs yet.</div>`;return}
if(!ps.some(p=>p.id==attProg))attProg=(ps.find(p=>p.status==="Ongoing")||ps[ps.length-1]).id;
const p=programs.find(x=>x.id==attProg),rows=students.filter(s=>s.active),cnt=k=>rows.filter(s=>status(p,s)===k).length;
$("#view").innerHTML=`<h1>Attendance</h1><p class="sub">See who attended, who was late, and by how much.</p>
<div class="panel"><div class="row"><label>Program<select id="ap">${ps.map(x=>`<option value="${x.id}" ${x.id==p.id?"selected":""}>${x.name} (${x.date})</option>`).join("")}</select></label></div>
<p class="sub" style="margin:0 0 12px">Attendance opens ${fmtTime(p.open)}. On time until ${fmtTime(p.lateAfter)}. Starts ${fmtTime(p.start)}. Ends ${fmtTime(p.end)}.</p>
<div class="grid"><div class="stat"><b>${cnt("Present")}</b><span>On time</span></div><div class="stat"><b>${cnt("Late")}</b><span>Late</span></div><div class="stat"><b>${cnt("Absent")}</b><span>Absent</span></div></div>
<div class="tablewrap"><table><tr><th>Student no.</th><th>Name</th><th>Course</th><th>Time in</th><th>Time out</th><th>Status</th><th>Late by</th></tr>
${rows.map(s=>{const r=(att[p.id]||{})[s.id]||{},st=status(p,s);return `<tr><td>${s.no}</td><td>${s.name}</td><td>${s.course}</td><td>${r.in||"—"}</td><td>${p.type=="in"?"n/a":r.out||"—"}</td><td>${st=="—"?"Not yet scanned":tag(st)}</td><td>${r.status==="Late"&&r.lateMin>0?fmtDur(r.lateMin):"—"}</td></tr>`}).join("")}</table></div></div>`;
$("#ap").onchange=e=>{attProg=+e.target.value;render()};
},
ctrl(){
const officers=students.filter(s=>s.checker&&s.active);
const progs=programs.filter(p=>p.status==="Ongoing"||p.status==="Upcoming");
$("#view").innerHTML=`<h1>Scan control</h1><p class="sub">SBO officers can scan only while scanning is on for the program and you have marked them present. You can always scan from the QR scanner page.</p>`+
(progs.map(p=>`<div class="panel"><div class="row" style="justify-content:space-between;align-items:center"><div><h2>${p.name}</h2>${p.date} ${tag(p.status)}</div>
<button class="btn ${p.scanning?"":"alt"}" data-sw="${p.id}">Scanning: ${p.scanning?"On":"Off"}</button></div>
<div class="tablewrap"><table><tr><th>SBO officer</th><th>At this program</th><th></th></tr>
${officers.map(o=>{const here=isPresent(p.id,o.id);return `<tr><td>${o.name}</td><td>${here?tag("Present"):"Not marked present"}</td><td><button class="btn alt" data-m="${p.id}:${o.id}">${here?"Mark absent":"Mark present"}</button></td></tr>`}).join("")||`<tr><td colspan="3">No SBO officers yet. Make one on the Students page.</td></tr>`}</table></div></div>`).join("")||`<div class="panel">No upcoming or ongoing programs.</div>`);
document.querySelectorAll("[data-sw]").forEach(b=>b.onclick=async()=>{const p=programs.find(x=>x.id==b.dataset.sw);p.scanning=!p.scanning;await DB.setProgram(p.id,{scanning:p.scanning});render()});
document.querySelectorAll("[data-m]").forEach(b=>b.onclick=async()=>{
const [pid,sid]=b.dataset.m.split(":").map(Number),p=programs.find(x=>x.id===pid),rec=att[pid][sid];
if(isPresent(pid,sid)){await DB.removeAttendance(pid,sid);delete att[pid][sid]}
else if(rec){await DB.saveOut(pid,sid,null);rec.out=null}
else{const t=now(),lm=p.status==="Ongoing"?lateMin(t,p.lateAfter):0,row={in:t,status:lm>0?"Late":"Present",lateMin:lm};if(await DB.saveIn(pid,sid,row))att[pid][sid]=row}
render()});
},
// ---------- Student views ----------
spw(){
$("#view").innerHTML=`<h1>Change password</h1><p class="sub">Your administrator gave you a starting password. You can keep it or choose your own.</p>
<div class="panel" style="max-width:420px"><div class="row" style="flex-direction:column;align-items:stretch">
<label>Current password<input id="pw0" type="password" autocomplete="current-password"></label>
<label>New password (at least 6 characters)<input id="pw1" type="password" autocomplete="new-password"></label>
<label>Confirm new password<input id="pw2" type="password" autocomplete="new-password"></label>
<button class="btn" id="pw-save">Save new password</button></div><p class="sub" id="pw-msg" style="margin:0" role="status"></p></div>`;
$("#pw-save").onclick=async()=>{const m=t=>{$("#pw-msg").textContent=t};
if(await hashPw(me.no,$("#pw0").value)!==me.pw)return m("Your current password is incorrect.");
const n=$("#pw1").value;if(n.length<6)return m("Use at least 6 characters.");
if(n!==$("#pw2").value)return m("The two new passwords don’t match.");
try{const h=await hashPw(me.no,n);await DB.setStudent(me.id,{pw:h});me.pw=h;["#pw0","#pw1","#pw2"].forEach(i=>$(i).value="");m("Password changed. Use it the next time you sign in.")}
catch(e){m("Couldn’t save the new password. Check the internet connection and try again.")}}
},
sdash(){
const done=programs.filter(p=>p.status==="Completed"),st=done.map(p=>status(p,me));
const lateTotal=done.reduce((a,p)=>a+(((att[p.id]||{})[me.id]||{}).lateMin||0),0);
const pres=st.filter(x=>x=="Present").length,late=st.filter(x=>x=="Late").length,abs=st.filter(x=>x=="Absent").length;
const pct=done.length?Math.round((pres+late)/done.length*100):0;
$("#view").innerHTML=`<h1>${me.name}</h1><p class="sub">${me.no} · ${me.course}, year ${me.year}</p>
<div class="grid"><div class="stat"><b>${done.length}</b><span>Programs held</span></div><div class="stat"><b>${pres+late}</b><span>Attended</span></div>
<div class="stat"><b>${late}</b><span>Late</span></div><div class="stat"><b>${fmtDur(lateTotal)}</b><span>Total time late</span></div><div class="stat"><b>${abs}</b><span>Absent</span></div></div>
<div class="panel"><h2>Attendance rate: ${pct}%</h2><div class="bar"><i style="width:${pct}%"></i></div></div>`;
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
${programs.filter(p=>p.status!=="Cancelled"&&p.status!=="Upcoming").map(p=>{const r=(att[p.id]||{})[me.id]||{};return `<tr><td>${p.name}</td><td>${p.date}</td><td>${r.in||"—"}</td><td>${p.type=="in"?"n/a":r.out||"—"}</td><td>${status(p,me)=="—"?"Not yet recorded":tag(status(p,me))+(lateText(r)?" "+lateText(r):"")}</td></tr>`}).join("")}</table></div></div>`;
}};

// ---------- Program details: validate, save, re-mark ----------
let editId=null,attProg=null;
function checkProgram(f){
if(!f.name||!f.date||!f.open||!f.lateAfter||!f.start||!f.end)return "Fill in the name, the date, and all four times.";
if(f.open>=f.start)return "Attendance must open before the program starts.";
if(f.end<=f.start)return "The program must end after it starts.";
if(f.lateAfter<f.open||f.lateAfter>f.start)return "“On time until” must be between the time attendance opens and the time the program starts.";
return ""}
async function saveProgram(){
const m=t=>{$("#pg-msg").textContent=t};
const f={name:$("#pn").value.trim(),date:$("#pd").value,type:$("#pt").value,open:$("#po").value,lateAfter:$("#pl").value,start:$("#ps").value,end:$("#pe").value};
const bad=checkProgram(f);if(bad)return m(bad);
try{
if(editId){
const p=programs.find(x=>x.id===editId),n=Object.keys(att[p.id]||{}).length;
const cutoffChanged=f.lateAfter!==p.lateAfter||f.date!==p.date;
if(cutoffChanged&&n&&!confirm(n+" attendance record(s) already exist. They will be re-marked on time or late using the new cutoff. Continue?"))return;
await DB.updateProgram(p.id,f);Object.assign(p,f);p.status=autoStatus(p);
if(cutoffChanged)await remark(p);
editId=null;
}else{
const p=await DB.addProgram({...f,status:"Upcoming"});p.status=autoStatus(p);programs.push(p);att[p.id]={};
}
render();
}catch(e){m("Couldn’t save the program. Check the internet connection and try again.")}
}
// After the cutoff changes, re-mark each record from the time the student was scanned
async function remark(p){
for(const [sid,rec] of Object.entries(att[p.id]||{})){
const lm=lateMin(rec.in,p.lateAfter),st=lm>0?"Late":"Present";
if(rec.status!==st||(rec.lateMin||0)!==lm){await DB.setAttendance(p.id,sid,{status:st,late_minutes:lm});rec.status=st;rec.lateMin=lm}}}

// ---------- Create account (administrators only) ----------
async function createAccount(){
if(role!=="admin")return;
const msg=t=>{$("#ns-msg").textContent=t};
const no=$("#ns-no").value.trim(),name=$("#ns-name").value.trim(),course=$("#ns-course").value.trim().toUpperCase();
if(!no||!name||!course)return msg("Enter the student number, full name, and course.");
const pw=$("#ns-pw").value;if(pw.length<6)return msg("The starting password needs at least 6 characters.");
if(students.some(x=>x.no===no))return msg("An account with student number "+no+" already exists.");
let token;do{token="NCBI-"+Math.random().toString(16).slice(2,8).toUpperCase()}while(students.some(x=>x.token===token));
try{
const row=await DB.addStudent({no,name,course,pw:await hashPw(no,pw),year:+$("#ns-year").value,token,active:true,checker:$("#ns-role").value==="checker"});
students.push(row);
views.students();$("#ns-msg").textContent="Created the account for "+name+". Student number: "+no+"  Password: "+pw+"  Give these to the student. The password isn’t shown again.";
}catch(e){msg("Couldn’t create the account. Check the internet connection and try again.")}
}

// ---------- Scan logic ----------
async function doScan(token){
if(!token)return;
const p=programs.find(x=>x.id==$("#sp").value),s=students.find(x=>x.token===token.toUpperCase()),t=now();
let r;
try{
const why=role==="checker"?await DB.scanAccess(p.id,me.id):null;
if(why){stopCam();r={cls:"bad",title:"Scanning not allowed",msg:why}}
else if(!s)r={cls:"bad",title:"Invalid QR code",msg:"No student matches this code."};
else if(!s.active)r={cls:"bad",title:"Student account inactive",msg:s.name};
else if(p.status!=="Ongoing")r={cls:"bad",title:"Program is not accepting attendance",msg:closedReason(p)};
else{
const rec=att[p.id][s.id];
if(!rec){
const lm=lateMin(t,p.lateAfter),late=lm>0,row={in:t,status:late?"Late":"Present",lateMin:lm};
if(await DB.saveIn(p.id,s.id,row)){att[p.id][s.id]=row;r={cls:late?"late":"ok",title:late?"Recorded as late":"Attendance recorded",msg:late?s.name+": "+fmtLate(lm):s.name,s,act:"Time in",t,p}}
else r={cls:"bad",title:"Student already checked in",msg:s.name}}
else if(p.type==="in")r={cls:"bad",title:"Student already checked in",msg:s.name+" at "+rec.in,s}
else if(!rec.out){await DB.saveOut(p.id,s.id,t);rec.out=t;r={cls:"ok",title:"Time out recorded",msg:s.name,s,act:"Time out",t,p}}
else r={cls:"bad",title:"Student already checked out",msg:s.name+" at "+rec.out,s}}
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
const ready=(DB.on?DB.load():Promise.all(students.map(async s=>{s.pw=await hashPw(s.no,"student123")}))).catch(()=>err("Can’t reach the database. Check js/config.js."));
// Pull in changes made on other devices (only redraw screens with nothing to type into)
setInterval(async()=>{if(!role)return;try{await DB.load()}catch{return}
programs.forEach(p=>p.status=autoStatus(p));
if(me)me=students.find(x=>x.id===me.id)||me;
if(["dash","sdash","shist","attend"].includes(page))render()},5000);
function logout(){role=null;me=null;$("#lf").reset();err("");$("#app").classList.add("hide");$("#login").classList.remove("hide")}
$("#lf").onsubmit=async e=>{e.preventDefault();await ready;const u=$("#lu").value.trim(),p=$("#lp").value;
if(u.toLowerCase()==="admin"&&p==="admin123"){role="admin";me=null;page="dash"}
else{const s=students.find(x=>x.no===u);
if(!s||!s.pw||await hashPw(s.no,p)!==s.pw)return err("Student number or password is incorrect.");
if(!s.active)return err("This account is inactive. Ask an administrator to reactivate it.");
me=s;role=s.checker?"checker":"student";page=s.checker?"scan":"sdash"}
err("");$("#login").classList.add("hide");$("#app").classList.remove("hide");render()};
