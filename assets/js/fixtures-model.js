// Shared rules for data/fixtures.json, used by the scorer page before it saves and by
// the test suite in CI, so a bad save fails the deploy instead of reaching the site.
(function (root) {
  const STATES = ["scheduled", "live", "ft"];
  const FIELDS = ["time", "home", "away", "homeScore", "awayScore", "state", "stage"];
  const isScore = (n) => Number.isInteger(n) && n >= 0 && n <= 99;
  const HTTPS = /^https:\/\/[^\s"'<>]+$/;

  // The live stream the Games page shows. YouTube links become an embedded player; any other
  // https link (Veo, Facebook...) becomes a button. Off, missing or unsafe means nothing shows.
  function streamInfo(s) {
    if (!s || s.on !== true || typeof s.url !== "string" || !HTTPS.test(s.url)) return null;
    let u;
    try { u = new URL(s.url); } catch (e) { return null; }
    const host = u.hostname.replace(/^(www|m)\./, "");
    const label = typeof s.label === "string" ? s.label : "";
    if (host === "youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com") {
      const id = host === "youtu.be" ? u.pathname.slice(1) : u.searchParams.get("v") || (u.pathname.match(/^\/(?:live|embed|shorts)\/([^/?#]+)/) || [])[1];
      if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return { kind: "youtube", id, url: s.url, host: "YouTube", label };
    }
    const names = { "veo.co": "Veo", "app.veo.co": "Veo", "veo.com": "Veo", "live.veo.co": "Veo", "facebook.com": "Facebook", "fb.watch": "Facebook", "twitch.tv": "Twitch", "instagram.com": "Instagram", "youtube.com": "YouTube" };
    return { kind: "link", url: s.url, host: names[host] || host, label };
  }

  function validate(d) {
    const errs = [];
    if (!d || !Array.isArray(d.divisions) || !d.divisions.length) return ["divisions missing"];
    if (!Array.isArray(d.fixtures)) return ["fixtures missing"];
    const divs = {};
    d.divisions.forEach((v) => {
      if (!v.id || divs[v.id]) errs.push(`division ${v.id}: missing or duplicate id`);
      if (typeof v.name !== "string") errs.push(`division ${v.id}: name missing`);
      if (!Array.isArray(v.teams)) errs.push(`division ${v.id}: teams missing`);
      const ids = new Set();
      (v.teams || []).forEach((t) => {
        if (!t.id || ids.has(t.id)) errs.push(`division ${v.id}: team ${t.id} missing or duplicate id`);
        if (t.name !== null && typeof t.name !== "string") errs.push(`team ${t.id}: name must be text or null`);
        if (t.group !== undefined && (typeof t.group !== "string" || !t.group.trim() || t.group.length > 12)) errs.push(`team ${t.id}: group must be a short name`);
        ids.add(t.id);
      });
      divs[v.id] = { ...v, ids };
    });
    if (d.stream !== undefined && d.stream !== null) {
      const st = d.stream;
      if (typeof st !== "object") errs.push("stream must be an object");
      else {
        if (typeof st.on !== "boolean") errs.push("stream: on must be true or false");
        if (st.url !== null && st.url !== undefined && !(typeof st.url === "string" && HTTPS.test(st.url))) errs.push("stream: link must start https:// and have no spaces or quotes");
        if (st.on === true && !st.url) errs.push("stream: add a link before switching it on");
        if (st.label !== undefined && (typeof st.label !== "string" || st.label.length > 80)) errs.push("stream: label must be 80 characters or fewer");
      }
    }
    if (d.mvp !== undefined && d.mvp !== null) {
      const m = d.mvp;
      if (typeof m !== "object" || !Array.isArray(m.nominees)) errs.push("mvp: needs a nominees list");
      else {
        if (typeof m.open !== "boolean") errs.push("mvp: open must be true or false");
        if (m.nominees.length > 8) errs.push("mvp: eight nominees at most");
        if (m.open === true && m.nominees.length < 2) errs.push("mvp: add at least two nominees before opening the vote");
        const ids = new Set();
        m.nominees.forEach((n) => {
          if (!n || typeof n.id !== "string" || !/^[a-z0-9-]{1,24}$/.test(n.id) || ids.has(n.id)) errs.push(`mvp: nominee ${n && n.id} has a missing or duplicate id`);
          else ids.add(n.id);
          if (!n || typeof n.name !== "string" || !n.name.trim() || n.name.length > 40) errs.push(`mvp: nominee ${n && n.id} needs a name of 40 characters or fewer`);
          if (n && n.team !== undefined && (typeof n.team !== "string" || n.team.length > 40)) errs.push(`mvp: nominee ${n.id} team must be 40 characters or fewer`);
        });
      }
    }
    const seen = new Set();
    d.fixtures.forEach((f) => {
      const at = `game ${f.id}`;
      if (!f.id || seen.has(f.id)) errs.push(`${at}: missing or duplicate id`);
      seen.add(f.id);
      const div = divs[f.division];
      if (!div) { errs.push(`${at}: unknown division ${f.division}`); return; }
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(f.time || "")) errs.push(`${at}: time must be HH:MM`);
      if (!STATES.includes(f.state)) errs.push(`${at}: state must be ${STATES.join(", ")}`);
      if (!f.home || !f.away || typeof f.home !== "string" || typeof f.away !== "string") errs.push(`${at}: both sides needed`);
      else if (f.home === f.away) errs.push(`${at}: a team cannot play itself`);
      // Group games must use real teams; a knockout game may hold a placeholder ("1st in table") until the group is done.
      if (div.format === "round-robin" && !f.stage && (!div.ids.has(f.home) || !div.ids.has(f.away))) errs.push(`${at}: teams must come from ${div.name}`);
      if (f.stage !== undefined && (typeof f.stage !== "string" || !f.stage.trim() || f.stage.length > 30)) errs.push(`${at}: stage must be a short name like Final`);
      const hasH = f.homeScore !== null && f.homeScore !== undefined, hasA = f.awayScore !== null && f.awayScore !== undefined;
      if (hasH !== hasA) errs.push(`${at}: both scores or neither`);
      if ((hasH && !isScore(f.homeScore)) || (hasA && !isScore(f.awayScore))) errs.push(`${at}: scores must be whole numbers 0 to 99`);
      if (f.state === "ft" && !hasH) errs.push(`${at}: full time needs a score`);
    });
    return errs;
  }

  // What the scorer changed between the copy they loaded (base) and their edits (work).
  function changes(base, work) {
    const out = [];
    const bf = Object.fromEntries(base.fixtures.map((f) => [f.id, f]));
    const wf = new Set(work.fixtures.map((f) => f.id));
    work.fixtures.forEach((f) => {
      const b = bf[f.id];
      if (!b) { out.push({ op: "add", fixture: { ...f } }); return; }
      const fields = {};
      FIELDS.forEach((k) => { if (f[k] !== b[k]) fields[k] = f[k]; });
      if (Object.keys(fields).length) out.push({ op: "set", id: f.id, fields });
    });
    base.fixtures.forEach((f) => { if (!wf.has(f.id)) out.push({ op: "remove", id: f.id }); });
    work.divisions.forEach((v) => {
      const bv = base.divisions.find((x) => x.id === v.id);
      (v.teams || []).forEach((t) => {
        const bt = bv && (bv.teams || []).find((x) => x.id === t.id);
        if (bt && bt.name !== t.name) out.push({ op: "team", division: v.id, id: t.id, name: t.name });
      });
    });
    if (JSON.stringify(base.stream || null) !== JSON.stringify(work.stream || null)) out.push({ op: "stream", stream: work.stream ? { ...work.stream } : null });
    if (JSON.stringify(base.mvp || null) !== JSON.stringify(work.mvp || null)) out.push({ op: "mvp", mvp: work.mvp ? JSON.parse(JSON.stringify(work.mvp)) : null });
    return out;
  }

  // Replays those changes on top of the latest saved copy, so two scorers editing
  // different games never overwrite each other. Never mutates its input.
  function apply(latest, ch) {
    const d = JSON.parse(JSON.stringify(latest));
    ch.forEach((c) => {
      if (c.op === "set") { const f = d.fixtures.find((x) => x.id === c.id); if (f) Object.assign(f, c.fields); }
      else if (c.op === "remove") d.fixtures = d.fixtures.filter((x) => x.id !== c.id);
      else if (c.op === "add") { if (!d.fixtures.some((x) => x.id === c.fixture.id)) d.fixtures.push({ ...c.fixture }); }
      else if (c.op === "stream") d.stream = c.stream ? { ...c.stream } : null;
      else if (c.op === "mvp") d.mvp = c.mvp ? JSON.parse(JSON.stringify(c.mvp)) : null;
      else if (c.op === "team") {
        const v = d.divisions.find((x) => x.id === c.division);
        const t = v && (v.teams || []).find((x) => x.id === c.id);
        if (t) t.name = c.name;
      }
    });
    return d;
  }

  const STATE_LABEL = { scheduled: "scheduled", live: "live", ft: "FT" };
  function summary(ch, data) {
    const parts = ch.map((c) => {
      if (c.op === "set") {
        const f = data.fixtures.find((x) => x.id === c.id) || c.fields;
        const sc = f.homeScore == null ? "" : ` ${f.homeScore}-${f.awayScore}`;
        return `${c.id}${sc} ${STATE_LABEL[f.state] || ""}`.trim();
      }
      if (c.op === "team") return `${c.id} is ${c.name || "TBC"}`;
      if (c.op === "stream") return `stream ${c.stream && c.stream.on ? "on" : "off"}`;
      if (c.op === "mvp") return `MVP vote ${c.mvp && c.mvp.open ? "open" : "closed"}, ${c.mvp ? c.mvp.nominees.length : 0} nominees`;
      if (c.op === "add") return `added ${c.fixture.id} ${c.fixture.time}`;
      return `removed ${c.id}`;
    });
    return parts.length ? parts.slice(0, 4).join(", ") + (parts.length > 4 ? ` +${parts.length - 4} more` : "") : "no changes";
  }

  // Pretty JSON, but one line per game, so each save is a readable one-line diff.
  function format(d) {
    const line = (o) => "{ " + Object.entries(o).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(", ") + " }";
    const { fixtures, ...rest } = d;
    const head = JSON.stringify({ ...rest, fixtures: "\u0000" }, null, 2);
    const fx = "[\n" + fixtures.map((f) => "    " + line(f)).join(",\n") + "\n  ]";
    return head.replace('"\\u0000"', fx) + "\n";
  }

  // The GitHub contents API speaks base64; team names can contain any character.
  function toBase64(s) {
    const bytes = new TextEncoder().encode(s);
    let bin = "";
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin);
  }
  function fromBase64(b64) {
    const bin = atob(String(b64).replace(/\s/g, ""));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  }

  const api = { validate, changes, apply, summary, format, toBase64, fromBase64, streamInfo, STATES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FixturesModel = api;
})(this);
