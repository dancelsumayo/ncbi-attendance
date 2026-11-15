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
// att[programId][studentId] = {in,out,status}
const att={1:{1:{in:"07:42",status:"Present"},2:{in:"08:15",status:"Late"},3:{in:"07:50",status:"Present"}},
2:{2:{in:"07:55",status:"Present"},4:{in:"07:40",status:"Present"}},
3:{1:{in:"08:10",out:"16:00",status:"Present"},2:{in:"08:45",out:"15:50",status:"Late"},3:{in:"08:00",out:"16:05",status:"Present"}},
4:{},5:{}};
const $=s=>document.querySelector(s),pname=id=>programs.find(p=>p.id==id).name;
let role=null,page="dash",me=null,log=[],lastResult=null;
const now=()=>{const d=new Date();return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0")};
const tag=s=>`<span class="tag ${s}">${s}</span>`;
function status(p,s){const r=(att[p.id]||{})[s.id];if(r)return r.status;return p.status==="Completed"?"Absent":"—"}

// ---------- Navigation ----------
const menus={admin:[["dash","Dashboard"],["scan","QR scanner"],["programs","Programs"],["students","Students"]],
student:[["sdash","My summary"],["sqr","My QR code"],["shist","My attendance"]],
checker:[["scan","QR scanner"],["sdash","My summary"],["sqr","My QR code"],["shist","My attendance"]]};
function nav(){
$("#nav").innerHTML=`<div class="brand"><b>North Coast Bohol Institute</b><span>Program attendance</span></div>`+
menus[role].map(([k,l])=>`<button class="${k===page?"on":""}" data-k="${k}">${l}</button>`).join("")+
`<div class="role"><b>${role=="admin"?"Administrator":me.name}</b><br>${role=="admin"?"Full access":role=="checker"?"Attendance checker":"Student"}<button id="out" style="margin-top:8px;border:1px solid #dcb57c;display:block;text-align:center;width:100%">Sign out</button></div>`;
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
const open=programs.filter(p=>p.status==="Ongoing");
$("#view").innerHTML=`<h1>QR scanner</h1><p class="sub">Choose a program, then scan a student’s ID.</p>
<div class="scan"><div class="panel"><h2>Scan</h2>
<div class="row"><label>Program<select id="sp">${programs.filter(p=>p.status!=="Cancelled").map(p=>`<option value="${p.id}" ${open[0]&&p.id==open[0].id?"selected":""}>${p.name} (${p.status})</option>`).join("")}</select></label></div>
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
$("#view").innerHTML=`<h1>Programs</h1><p class="sub">Create programs and set how attendance is taken.</p>
<div class="panel"><h2>New program</h2><div class="row">
<label>Name<input id="pn"></label><label>Date<input type="date" id="pd"></label>
<label>Attendance<select id="pt"><option value="in">Login only</option><option value="inout">Login and logout</option></select></label>
<label>Late after<input type="time" id="pl" value="08:00"></label><button class="btn" id="add">Create program</button></div></div>
<div class="panel"><h2>All programs</h2><div class="tablewrap"><table><tr><th>Program</th><th>Date</th><th>Venue</th><th>Status</th><th></th></tr>
${programs.map(p=>`<tr><td>${p.name}</td><td>${p.date}</td><td>${p.venue||"—"}</td><td>${tag(p.status)}</td><td>${p.status=="Upcoming"?`<button class="btn alt" data-s="${p.id}:Ongoing">Start</button> `:p.status=="Ongoing"?`<button class="btn alt" data-s="${p.id}:Completed">Finish</button> `:""}${p.status=="Upcoming"||p.status=="Ongoing"?`<button class="btn alt" data-s="${p.id}:Cancelled">Cancel</button>`:""}</td></tr>`).join("")}</table></div></div>`;
$("#add").onclick=async()=>{const n=$("#pn").value.trim(),d=$("#pd").value;if(!n||!d)return alert("Enter a program name and date.");
const p=await DB.addProgram({name:n,date:d,type:$("#pt").value,lateAfter:$("#pl").value,status:"Upcoming"});programs.push(p);att[p.id]={};render()};
document.querySelectorAll("[data-s]").forEach(b=>b.onclick=async()=>{const [id,st]=b.dataset.s.split(":");await DB.setProgram(id,{status:st});programs.find(p=>p.id==id).status=st;render()});
},
students(){
$("#view").innerHTML=`<h1>Students</h1><p class="sub">Search, activate, and manage student accounts.</p>
<div class="panel"><div class="row"><label style="flex:1">Search<input id="q" placeholder="Name or student number"></label>
<label>Course<select id="cf"><option value="">All</option>${[...new Set(students.map(s=>s.course))].map(c=>`<option>${c}</option>`).join("")}</select></label></div>
<div class="tablewrap"><table id="st"></table></div></div>`;
const draw=()=>{const q=$("#q").value.toLowerCase(),c=$("#cf").value;
$("#st").innerHTML=`<tr><th>Student no.</th><th>Name</th><th>Course</th><th>Year</th><th>Account</th><th>Role</th><th></th></tr>`+
students.filter(s=>(s.name+s.no).toLowerCase().includes(q)&&(!c||s.course==c)).map(s=>`<tr><td>${s.no}</td><td>${s.name}</td><td>${s.course}</td><td>${s.year}</td><td>${tag(s.active?"Present":"Absent").replace(/Present|Absent/,s.active?"Active":"Inactive")}</td><td>${s.checker?"Attendance checker":"Student"}</td><td><button class="btn alt" data-a="${s.id}">${s.active?"Deactivate":"Activate"}</button> <button class="btn alt" data-r="${s.id}">${s.checker?"Remove checker role":"Make checker"}</button></td></tr>`).join("");
document.querySelectorAll("[data-a]").forEach(b=>b.onclick=async()=>{const s=students.find(x=>x.id==b.dataset.a);s.active=!s.active;await DB.setStudent(s.id,{active:s.active});draw()});document.querySelectorAll("[data-r]").forEach(b=>b.onclick=async()=>{const s=students.find(x=>x.id==b.dataset.r);s.checker=!s.checker;await DB.setStudent(s.id,{checker:s.checker});draw()})};
$("#q").oninput=draw;$("#cf").onchange=draw;draw();
},
// ---------- Student views ----------
sdash(){
const done=programs.filter(p=>p.status==="Completed"),st=done.map(p=>status(p,me));
const pres=st.filter(x=>x=="Present").length,late=st.filter(x=>x=="Late").length,abs=st.filter(x=>x=="Absent").length;
const pct=done.length?Math.round((pres+late)/done.length*100):0;
$("#view").innerHTML=`<h1>${me.name}</h1><p class="sub">${me.no} · ${me.course}, year ${me.year}</p>
<div class="grid"><div class="stat"><b>${done.length}</b><span>Programs held</span></div><div class="stat"><b>${pres+late}</b><span>Attended</span></div>
<div class="stat"><b>${late}</b><span>Late</span></div><div class="stat"><b>${abs}</b><span>Absent</span></div></div>
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
${programs.filter(p=>p.status!=="Cancelled"&&p.status!=="Upcoming").map(p=>{const r=(att[p.id]||{})[me.id]||{};return `<tr><td>${p.name}</td><td>${p.date}</td><td>${r.in||"—"}</td><td>${p.type=="in"?"n/a":r.out||"—"}</td><td>${status(p,me)=="—"?"Not yet recorded":tag(status(p,me))}</td></tr>`}).join("")}</table></div></div>`;
}};

// ---------- Scan logic ----------
async function doScan(token){
if(!token)return;
const p=programs.find(x=>x.id==$("#sp").value),s=students.find(x=>x.token===token.toUpperCase()),t=now();
let r;
try{
if(!s)r={cls:"bad",title:"Invalid QR code",msg:"No student matches this code."};
else if(!s.active)r={cls:"bad",title:"Student account inactive",msg:s.name};
else if(p.status!=="Ongoing")r={cls:"bad",title:"Program is not accepting attendance",msg:p.name+" is "+p.status.toLowerCase()+"."};
else{
const rec=att[p.id][s.id];
if(!rec){
const late=t>p.lateAfter,row={in:t,status:late?"Late":"Present"};
if(await DB.saveIn(p.id,s.id,row)){att[p.id][s.id]=row;r={cls:late?"late":"ok",title:late?"Recorded as late":"Attendance recorded",msg:s.name,s,act:"Time in",t,p}}
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
const ready=DB.load().catch(()=>err("Can’t reach the database. Check js/config.js."));
// Pull in changes made on other devices (only redraw screens with nothing to type into)
setInterval(async()=>{if(!role)return;try{await DB.load()}catch{return}
if(me)me=students.find(x=>x.id===me.id)||me;
if(["dash","sdash","shist"].includes(page))render()},5000);
function logout(){role=null;me=null;$("#lf").reset();err("");$("#app").classList.add("hide");$("#login").classList.remove("hide")}
$("#lf").onsubmit=async e=>{e.preventDefault();await ready;const u=$("#lu").value.trim(),p=$("#lp").value;
if(u.toLowerCase()==="admin"&&p==="admin123"){role="admin";me=null;page="dash"}
else{const s=students.find(x=>x.no===u);
if(!s||p!=="student123")return err("Student number or password is incorrect.");
if(!s.active)return err("This account is inactive. Ask an administrator to reactivate it.");
me=s;role=s.checker?"checker":"student";page=s.checker?"scan":"sdash"}
err("");$("#login").classList.add("hide");$("#app").classList.remove("hide");render()};
