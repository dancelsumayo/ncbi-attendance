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
    lateAfter: r.late_after, status: r.status, venue: r.venue
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
      Object.keys(att).forEach(k => delete att[k]);
      programs.forEach(x => (att[x.id] = {}));
      a.forEach(r => {
        if (att[r.program_id]) {
          att[r.program_id][r.student_id] = { in: r.time_in, out: r.time_out, status: r.status };
        }
      });
    },

    // Returns false if another device already recorded this student's time in
    async saveIn(pid, sid, row) {
      if (!on) return true;
      try {
        await req("attendance", "POST",
          { program_id: pid, student_id: sid, time_in: row.in, status: row.status });
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
        { name: p.name, date: p.date, type: p.type, late_after: p.lateAfter, status: p.status },
        "return=representation");
      return toProgram(row);
    },

    async setProgram(id, fields) { if (on) await req(`programs?id=eq.${id}`, "PATCH", fields); },
    async setStudent(id, fields) { if (on) await req(`students?id=eq.${id}`, "PATCH", fields); }
  };
})();
