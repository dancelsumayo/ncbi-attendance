/* Data layer: talks to Supabase (hosted PostgreSQL) over its REST API.
   Without keys in js/config.js it does nothing and the app uses its sample data.
   Note: reads the globals `students`, `programs` and `att` defined in app.js. */
const DB = (() => {
  const cfg = window.NCBI_CONFIG || {};
  const BASE = (cfg.SUPABASE_URL || "").trim().replace(/\/+$/, "");  // no trailing slash
  const KEY = (cfg.SUPABASE_KEY || "").trim();
  const on = Boolean(BASE && KEY);

  async function req(path, method = "GET", body, prefer = "return=minimal") {
    const res = await fetch(`${BASE}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: KEY,
        // older "anon" keys are JWTs (start with eyJ) and also go in Authorization;
        // newer "publishable" keys (sb_publishable_...) go in apikey only
        ...(KEY.startsWith("eyJ") ? { Authorization: `Bearer ${KEY}` } : {}),
        "Content-Type": "application/json",
        Prefer: prefer
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw Object.assign(new Error(await res.text()), { status: res.status });
    return method === "GET" || prefer.includes("representation") ? res.json() : null;
  }

  const toProgram = r => ({
    id: r.id, name: r.name, date: r.date, type: r.type,
    lateAfter: r.late_after, status: r.status, venue: r.venue, scanning: Boolean(r.scanning), paused: Boolean(r.paused),
    open: r.open_time, start: r.start_time, end: r.end_time
  });

  return {
    on,

    // Copy everything from the database into the in-memory lists the screens use
    async load() {
      if (!on) return;
      const [s, p, a] = await Promise.all([
        req("students?order=id"), req("programs?order=id"), req("attendance")
      ]);
      students.splice(0, students.length, ...s);
      programs.splice(0, programs.length, ...p.map(toProgram));
      programs.forEach(x => (x.status = autoStatus(x)));  // status follows the clock
      Object.keys(att).forEach(k => delete att[k]);
      programs.forEach(x => (att[x.id] = {}));
      a.forEach(r => {
        if (att[r.program_id]) {
          att[r.program_id][r.student_id] = { in: r.time_in, out: r.time_out, status: r.status, lateMin: r.late_minutes || 0, by: r.scanned_by };
        }
      });
    },

    // Returns false if another device already recorded this student's time in
    async saveIn(pid, sid, row) {
      if (!on) return true;
      try {
        await req("attendance", "POST",
          { program_id: pid, student_id: sid, time_in: row.in, status: row.status, late_minutes: row.lateMin || 0, scanned_by: row.by || null });
        return true;
      } catch (e) {
        if (e.status === 409) return false;
        throw e;
      }
    },

    async saveOut(pid, sid, time) {
      if (on) await req(`attendance?program_id=eq.${pid}&student_id=eq.${sid}`, "PATCH", { time_out: time });
    },

    async addProgram(p) {
      if (!on) return { ...p, id: programs.length + 1 };
      const [row] = await req("programs", "POST",
        { name: p.name, date: p.date, type: p.type, late_after: p.lateAfter, status: p.status,
          open_time: p.open, start_time: p.start, end_time: p.end },
        "return=representation");
      return toProgram(row);
    },

    async addStudent(st) {
      if (!on) return { ...st, id: Math.max(0, ...students.map(v => v.id)) + 1 };
      const [row] = await req("students", "POST", st, "return=representation");
      return row;
    },

    async removeAttendance(pid, sid) {
      if (on) await req(`attendance?program_id=eq.${pid}&student_id=eq.${sid}`, "DELETE");
    },

    // Checked against the database on every scan by an SBO officer.
    // Returns null if the officer may scan, otherwise the reason they may not.
    //   Lead officers can scan as soon as the event is open (unless scanned out).
    //   Other officers can scan once someone has scanned them in.
    async scanAccess(pid, officerId, mode) {
      let p, st, a;
      if (on) {
        [p] = await req(`programs?id=eq.${pid}&select=*`);
        if (p) p = toProgram(p);
        [st] = await req(`students?id=eq.${officerId}&select=active,checker,lead`);
        [a] = await req(`attendance?program_id=eq.${pid}&student_id=eq.${officerId}&select=time_in,time_out`);
      } else {
        p = programs.find(x => x.id == pid);
        st = students.find(x => x.id === officerId);
        a = (att[pid] || {})[officerId];
        a = a && { time_in: a.in, time_out: a.out };
      }
      if (!st || !st.active || !st.checker) return "Your SBO officer access was removed. Ask the administrator.";
      if (!p) return "This program wasn’t found.";
      p = { ...p, status: autoStatus(p) };
      if (p.status !== "Ongoing" && !(mode === "out" && outGrace(p))) return closedReason(p);
      if (p.paused) return "Scanning is paused by the administrator. Please wait.";
      if (st.lead) return a && a.time_out ? "You were scanned out of this program, so you can’t scan anymore." : null;
      if (!a || !a.time_in || a.time_out) return "A lead officer needs to scan your ID first. Once you’re scanned in, you can start scanning.";
      return null;
    },

    async updateProgram(id, f) {
      if (on) await req(`programs?id=eq.${id}`, "PATCH", {
        name: f.name, date: f.date, type: f.type, late_after: f.lateAfter,
        open_time: f.open, start_time: f.start, end_time: f.end
      });
    },

    async setAttendance(pid, sid, fields) {
      if (on) await req(`attendance?program_id=eq.${pid}&student_id=eq.${sid}`, "PATCH", fields);
    },

    // Several students at once (CSV import)
    async addStudents(list) {
      if (!on) { let n = Math.max(0, ...students.map(v => v.id)); return list.map(st => ({ ...st, id: ++n })); }
      return req("students", "POST", list, "return=representation");
    },

    // Look one student up by number, straight from the database (used when activating an account)
    async findStudent(no) {
      if (!on) return students.find(v => v.no === no) || null;
      const [row] = await req(`students?no=eq.${encodeURIComponent(no)}`);
      return row || null;
    },

    async setProgram(id, fields) { if (on) await req(`programs?id=eq.${id}`, "PATCH", fields); },
    async setStudent(id, fields) { if (on) await req(`students?id=eq.${id}`, "PATCH", fields); }
  };
})();
