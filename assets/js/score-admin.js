// Scorer page. Reads and writes fixtures.json in the scores repo through the GitHub contents
// API. The key can reach that repo only, and scorers never see it: they type a passcode
// that unlocks it (keybox.js). Every save is a commit, so any mistake can be rolled back.
document.addEventListener("DOMContentLoaded", () => {
  const M = window.FixturesModel;
  const E = Donis.esc;
  const S = Donis.config.scores;
  const FEED = S.feed.replace(/\/$/, "");
  const REPO = `https://api.github.com/repos/${S.repo}/contents/`;
  const API = REPO + S.path;
  const KEY = "donis.scorerKey", DRAFT = "donis.scorerDraft";
  const SAVE_DELAY = 4000;
  const $ = (s) => document.querySelector(s);
  const el = { status: $("[data-status]"), signin: $("[data-signin]"), app: $("[data-app]"), publish: $("[data-publish]"),
    tabs: $("[data-tabs]"), games: $("[data-games]"), teams: $("[data-team-list]"), teamsPanel: $("[data-teams]"),
    addHome: $("[data-add-home]"), addAway: $("[data-add-away]"), addErr: $("[data-add-err]") };

  let key = Donis.store.get(KEY);
  let base = null, work = null, current = null;
  let timer = null, busy = false, again = false, watch = null;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const pending = () => (base && work ? M.changes(base, work) : []);
  const now = () => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(new Date());

  function status(text, tone) {
    el.status.textContent = text;
    el.status.dataset.tone = tone || "";
  }

  async function gh(method, body, url = API) {
    let res;
    try {
      res = await fetch(method === "GET" ? `${url}?ref=${encodeURIComponent(S.branch)}` : url, {
        method, cache: "no-store",
        headers: { Authorization: `Bearer ${key}`, Accept: "application/vnd.github+json", ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new Error("No connection. Changes are kept on this phone; tap Save now when you have signal.");
    }
    const json = await res.json().catch(() => ({}));
    return { res, json };
  }

  async function latest() {
    const { res, json } = await gh("GET");
    if (res.status === 401) throw Object.assign(new Error("Scoring access has expired or been reset. Ask Liam for the new passcode."), { auth: true });
    if (res.status === 403 || res.status === 404) throw Object.assign(new Error("This access can't open the Donis scores. Ask Liam to check the setup."), { auth: true });
    if (!res.ok) throw new Error(`GitHub said ${res.status}. Try again in a moment.`);
    return { data: JSON.parse(M.fromBase64(json.content)), sha: json.sha };
  }

  // ---- Draft kept on the phone, so a dropped signal or a reload loses nothing ----
  const saveDraft = () => Donis.store.set(DRAFT, { base, work });
  function restoreDraft(fresh) {
    const d = Donis.store.get(DRAFT);
    if (!d || !d.base || !d.work) return fresh;
    const ch = M.changes(d.base, d.work);
    return ch.length ? M.apply(fresh, ch) : fresh;
  }

  // ---- Saving ----
  function schedule(delay = SAVE_DELAY) {
    clearTimeout(timer);
    saveDraft();
    const n = pending().length;
    el.publish.hidden = !n;
    if (!n) return;
    status(navigator.onLine === false ? "Offline. Changes are kept on this phone and save when you're back online." : `${n} change${n > 1 ? "s" : ""} waiting · saving in a few seconds`, navigator.onLine === false ? "warn" : "busy");
    timer = setTimeout(publish, delay);
  }

  async function publish() {
    clearTimeout(timer);
    if (busy) { again = true; return; }
    const snap = clone(work);
    const ch = M.changes(base, snap);
    if (!ch.length) return;
    busy = true;
    status("Saving…", "busy");
    try {
      let saved = null;
      for (let attempt = 0; attempt < 3 && !saved; attempt++) {
        const top = await latest();
        const merged = M.apply(top.data, ch);
        merged.updated = now();
        merged.rev = (top.data.rev || 0) + 1;
        const errs = M.validate(merged);
        if (errs.length) throw new Error(`Not saved: ${errs[0]}`);
        const { res, json } = await gh("PUT", {
          message: `Scores: ${M.summary(ch, merged)}`,
          content: M.toBase64(M.format(merged)),
          sha: top.sha,
          branch: S.branch,
        });
        if (res.status === 409 || res.status === 422) continue; // someone else saved first: reload and replay
        if (res.status === 401 || res.status === 403 || res.status === 404) throw Object.assign(new Error("This phone can't save any more. Ask Liam for the new passcode."), { auth: true });
        if (!res.ok) throw new Error(json.message || `GitHub said ${res.status}`);
        saved = merged;
      }
      if (!saved) throw new Error("Another scorer kept saving at the same time. Tap Save now.");
      const during = M.changes(snap, work);
      base = saved;
      work = M.apply(saved, during);
      saveDraft();
      render();
      status(`Saved ${saved.updated} · going live on the site…`, "ok");
      watchLive(saved.rev, saved.updated);
    } catch (e) {
      status(e.message || "Not saved. Check signal and tap Save now.", "warn");
      el.publish.hidden = false;
      if (e.auth) signOut(e.message);
    } finally {
      busy = false;
      if (again || pending().length) { again = false; if (pending().length) schedule(1500); }
    }
  }

  // Confirms the public page is actually showing this save, not just that GitHub took it.
  function watchLive(rev, at) {
    clearInterval(watch);
    const started = Date.now();
    watch = setInterval(async () => {
      if (Date.now() - started > 5 * 60000) { clearInterval(watch); status(`Saved ${at}. The site is slow to update; it will catch up.`, "warn"); return; }
      try {
        const pub = await Donis.json(`${FEED}/fixtures.json?r=${rev}-${Date.now()}`);
        if ((pub.rev || 0) >= rev) { clearInterval(watch); if (!busy && !pending().length) status(`Live on the site · ${at}`, "ok"); }
      } catch (e) { /* keep waiting */ }
    }, 10000);
  }

  // ---- Editing ----
  const divOf = (id) => work.divisions.find((d) => d.id === id);
  const label = (div, ref) => {
    const t = (div.teams || []).find((x) => x.id === ref);
    if (!t) return { text: ref, tbc: false };
    return t.name ? { text: t.name, tbc: false } : { text: "Team " + t.id.slice(-1), tbc: true };
  };
  const fx = (id) => work.fixtures.find((f) => f.id === id);

  function edit(fn) { fn(); render(); schedule(); }

  el.games.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-act]"); if (!b) return;
    const f = fx(b.closest("[data-id]").dataset.id); if (!f) return;
    const side = b.dataset.side === "away" ? "awayScore" : "homeScore";
    const act = b.dataset.act;
    if (act === "inc" || act === "dec") edit(() => {
      if (f.homeScore == null) { f.homeScore = 0; f.awayScore = 0; }
      f[side] = Math.max(0, Math.min(99, f[side] + (act === "inc" ? 1 : -1)));
      if (f.state === "scheduled") f.state = "live";
    });
    else if (act === "state") {
      const to = b.dataset.state;
      if (to === "ft" && f.homeScore == null) { f.homeScore = 0; f.awayScore = 0; }
      if (to === "scheduled" && f.homeScore != null && !confirm("Clear the score and set this game back to not started?")) return;
      edit(() => { f.state = to; if (to === "scheduled") { f.homeScore = null; f.awayScore = null; } });
    } else if (act === "remove") {
      if (!confirm(`Remove the ${f.time} game?`)) return;
      edit(() => { work.fixtures = work.fixtures.filter((x) => x.id !== f.id); });
    }
  });
  el.games.addEventListener("change", (e) => {
    const s = e.target.closest("select[data-sidepick]");
    if (s) { const f = fx(s.closest("[data-id]").dataset.id); if (f) edit(() => (f[s.dataset.sidepick] = s.value)); return; }
    const t = e.target.closest("input[type=time]"); if (!t || !t.value) return;
    const f = fx(t.closest("[data-id]").dataset.id); if (f) edit(() => (f.time = t.value));
  });
  el.teams.addEventListener("change", (e) => {
    const i = e.target.closest("input[data-team]"); if (!i) return;
    const t = (divOf(current).teams || []).find((x) => x.id === i.dataset.team);
    if (t) edit(() => (t.name = i.value.trim() || null));
  });
  el.tabs.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { current = b.dataset.div; render(); } });
  $("[data-add-go]").addEventListener("click", () => {
    const div = divOf(current);
    const time = $("#add-time").value, home = $("#add-home").value.trim(), away = $("#add-away").value.trim(), stage = $("#add-stage").value;
    const game = { id: div.id.charAt(0).toUpperCase() + Date.now().toString(36).slice(-5), division: div.id, ...(stage ? { stage } : {}), time, home, away, homeScore: null, awayScore: null, state: "scheduled" };
    const errs = M.validate({ ...work, fixtures: [...work.fixtures, game] }).filter((m) => m.includes(game.id));
    el.addErr.hidden = !errs.length;
    if (errs.length) { el.addErr.textContent = errs[0].replace(`game ${game.id}: `, ""); return; }
    edit(() => work.fixtures.push(game));
    if (!div.teams.length) { $("#add-home").value = ""; $("#add-away").value = ""; }
  });
  // ---- Live stream ----
  const streamUrl = $("#stream-url"), streamLabel = $("#stream-label"), streamErr = $("[data-stream-err]");
  const cur = () => work.stream || { url: null, on: false };
  const streamError = (m) => { streamErr.textContent = m || ""; streamErr.hidden = !m; };
  streamUrl.addEventListener("change", () => {
    const v = streamUrl.value.trim();
    if (v && !M.streamInfo({ url: v, on: true })) { streamError("That link won't work. It must start https:// (copy it from the YouTube or Veo share button)."); return; }
    streamError("");
    edit(() => { work.stream = { ...cur(), url: v || null }; if (!v) work.stream.on = false; });
  });
  streamLabel.addEventListener("change", () => {
    const v = streamLabel.value.trim();
    edit(() => { const s = { ...cur() }; if (v) s.label = v; else delete s.label; work.stream = s; });
  });
  $("[data-stream-toggle]").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const on = b.dataset.on === "true";
    if (on && !M.streamInfo({ ...cur(), on: true })) { streamError("Paste a working stream link first."); return; }
    streamError("");
    edit(() => { work.stream = { ...cur(), on }; });
  });
  function renderStreamPanel() {
    const s = cur();
    if (document.activeElement !== streamUrl) streamUrl.value = s.url || "";
    if (document.activeElement !== streamLabel) streamLabel.value = s.label || "";
    document.querySelectorAll("[data-stream-toggle] button").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.on === "true") === !!s.on)));
    const info = M.streamInfo({ ...s, on: true });
    $("[data-stream-note]").textContent = !s.url ? "No stream link yet."
      : info && info.kind === "youtube" ? `YouTube video found. ${s.on ? "Playing on the Games page." : "Switch on to show it on the Games page."}`
      : info ? `Shows as a "Watch on ${info.host}" button. ${s.on ? "It's on." : "Switch on to show it."}`
      : "";
  }

  el.publish.addEventListener("click", publish);
  $("[data-signout]").addEventListener("click", () => { if (!pending().length || confirm("You have unsaved changes. Sign out anyway?")) signOut(); });
  window.addEventListener("online", () => pending().length && schedule(500));
  window.addEventListener("beforeunload", (e) => { if (pending().length) { e.preventDefault(); e.returnValue = ""; } });
  // Pick up another scorer's saves when this phone wakes, if nothing is waiting here.
  document.addEventListener("visibilitychange", async () => {
    if (document.hidden || !key || busy || pending().length) return;
    try { const top = await latest(); base = top.data; work = clone(top.data); render(); } catch (e) { /* next tap will retry */ }
  });

  // ---- Rendering ----
  function render() {
    if (!work) return;
    renderStreamPanel();
    if (!divOf(current)) current = work.divisions[0].id;
    const div = divOf(current);
    el.tabs.innerHTML = work.divisions.map((d) => `<button type="button" role="tab" data-div="${E(d.id)}" aria-selected="${d.id === current}" style="flex:1">${E(d.name)}</button>`).join("");
    const rows = work.fixtures.filter((f) => f.division === current).sort((a, b) => a.time.localeCompare(b.time));
    el.games.innerHTML = rows.length ? rows.map((f) => card(f, div)).join("") : `<p class="sc-note">No games in ${E(div.name)} yet. Add one below.</p>`;
    const teams = div.teams || [];
    el.teamsPanel.hidden = !teams.length;
    el.teams.innerHTML = teams.map((t) => `<div class="sc-field"><label for="t-${E(t.id)}">Team ${E(t.id.slice(-1))}</label><input id="t-${E(t.id)}" data-team="${E(t.id)}" value="${E(t.name || "")}" placeholder="Team ${E(t.id.slice(-1))}" autocomplete="off"></div>`).join("");
    const pick = (id) => teams.length
      ? `<select id="${id}">${sideOptions(div)}</select>`
      : `<input id="${id}" autocomplete="off" placeholder="Team name">`;
    el.addHome.innerHTML = pick("add-home");
    el.addAway.innerHTML = pick("add-away");
    if (teams.length > 1) $("#add-away").selectedIndex = 1;
  }

  // Teams first, then placeholders a knockout game can hold until the group is decided.
  const PLACEHOLDERS = ["1st in table", "2nd in table", "3rd in table", "4th in table", "Winner Semi-final 1", "Winner Semi-final 2", "Loser Semi-final 1", "Loser Semi-final 2"];
  function sideOptions(div, selected) {
    const opts = (div.teams || []).map((t) => [t.id, label(div, t.id).text]).concat(PLACEHOLDERS.map((p) => [p, p]));
    if (selected && !opts.some(([v]) => v === selected)) opts.push([selected, selected]);
    return opts.map(([v, t]) => `<option value="${E(v)}" ${v === selected ? "selected" : ""}>${E(t)}</option>`).join("");
  }

  function card(f, div) {
    const h = label(div, f.home), a = label(div, f.away);
    const sides = f.stage && (div.teams || []).length
      ? `<div class="sc-sides"><select data-sidepick="home" aria-label="Home side">${sideOptions(div, f.home)}</select><select data-sidepick="away" aria-label="Away side">${sideOptions(div, f.away)}</select></div>`
      : "";
    const st = (s, t) => `<button type="button" data-act="state" data-state="${s}" aria-pressed="${f.state === s}">${t}</button>`;
    const row = (side, l, n) => `<div class="sc-row">
      <span class="sc-name ${l.tbc ? "tbc" : ""}">${E(l.text)}</span>
      <button type="button" class="sc-btn" data-act="dec" data-side="${side}" aria-label="${E(l.text)} minus one">&minus;</button>
      <output class="sc-num" aria-label="${E(l.text)} score">${n == null ? "&ndash;" : E(n)}</output>
      <button type="button" class="sc-btn sc-btn--plus" data-act="inc" data-side="${side}" aria-label="${E(l.text)} goal">+</button>
    </div>`;
    return `<article class="sc-card sc-card--${E(f.state)}" data-id="${E(f.id)}">
      <div class="sc-card__head">
        <input type="time" value="${E(f.time)}" aria-label="Kick-off time">
        ${f.stage ? `<span class="sc-card__stage">${E(f.stage)}</span>` : `<span class="sc-card__id">${E(f.id)}</span>`}
        <div class="seg seg--sm">${st("scheduled", "Not started")}${st("live", "Live")}${st("ft", "FT")}</div>
      </div>
      ${sides}
      ${row("home", h, f.homeScore)}
      ${row("away", a, f.awayScore)}
      ${f.state === "scheduled" && f.homeScore == null ? `<div class="sc-foot"><button type="button" class="sc-link" data-act="remove">Remove game</button></div>` : ""}
    </article>`;
  }

  // ---- Sign in and out ----
  function signOut(msg) {
    Donis.store.set(KEY, null);
    key = null;
    el.app.hidden = true; el.publish.hidden = true; el.signin.hidden = false;
    status(msg || "Signed out.", msg ? "warn" : "");
  }

  async function start() {
    el.signin.hidden = true;
    status("Loading the games…", "busy");
    try {
      const top = await latest();
      base = top.data;
      work = restoreDraft(clone(top.data));
      current = current || work.divisions[0].id;
      el.app.hidden = false;
      render();
      if (pending().length) schedule(1000);
      else status(`Ready · last saved ${base.updated || "not yet today"}`, "ok");
    } catch (e) {
      if (e.auth) signOut(e.message);
      else status(e.message || "Could not load the games. Check signal and refresh.", "warn");
    }
  }

  // Scorer: the passcode unlocks the key from the published, locked box.
  $("[data-signin-form]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("[data-signin-err]");
    const btn = e.target.querySelector("button");
    err.hidden = true; btn.disabled = true;
    status("Checking the passcode…", "busy");
    try {
      const box = await Donis.json(`${FEED}/${S.keyFile}?t=${Date.now()}`).catch(() => null);
      if (!box) throw new Error("Scoring isn't set up yet. Ask Liam to run setup.");
      key = await Keybox.open(box, e.target.elements.pass.value);
      Donis.store.set(KEY, key);
      e.target.reset();
      start();
    } catch (x) {
      err.textContent = x.message; err.hidden = false;
      status(x.message, "warn");
    } finally { btn.disabled = false; }
  });

  // Liam, once: paste the GitHub key, get a passcode. Only the locked box is saved.
  $("[data-setup-form]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("[data-setup-err]");
    const btn = e.target.querySelector("button");
    err.hidden = true; btn.disabled = true;
    status("Checking the key can reach the scores…", "busy");
    try {
      key = e.target.elements.token.value.trim();
      await latest(); // proves the key can read the scores repo before anything is saved
      const pass = Keybox.passcode();
      status("Locking the key…", "busy");
      const box = await Keybox.seal(key, pass);
      const cur = await gh("GET", null, REPO + S.keyFile);
      const { res, json } = await gh("PUT", {
        message: "Scorer passcode set up",
        content: M.toBase64(JSON.stringify(box, null, 2) + "\n"),
        ...(cur.res.ok ? { sha: cur.json.sha } : {}),
        branch: S.branch,
      }, REPO + S.keyFile);
      if (!res.ok) throw new Error(res.status === 403 || res.status === 404 ? "That key can read but not save. Give it Contents: Read and write." : json.message || `GitHub said ${res.status}`);
      Donis.store.set(KEY, key);
      e.target.reset();
      e.target.hidden = true;
      $("[data-setup-pass]").textContent = pass;
      $("[data-setup-done]").hidden = false;
      status("Scoring is set up. Write the passcode down.", "ok");
    } catch (x) {
      key = null;
      err.textContent = x.auth ? "That key can't reach the donis-scores repo. Check it was made for that repo with Contents: Read and write." : x.message;
      err.hidden = false;
      status(err.textContent, "warn");
    } finally { btn.disabled = false; }
  });

  if (new URLSearchParams(location.search).has("setup")) { $("[data-setup]").hidden = false; status("Setup: paste the GitHub key.", ""); }
  else if (key) start();
  else { el.signin.hidden = false; status("Sign in to score.", ""); }
});
