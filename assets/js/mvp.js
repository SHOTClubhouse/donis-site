// Fan MVP vote on the Games page, under the live stream. Nominees, the open switch and the
// closing time are set on the scorer page; votes and live percentages come from the donis-mvp
// Worker. One vote per phone: the page keeps a random voter id, and voting again moves the vote.
document.addEventListener("DOMContentLoaded", () => {
  const box = document.querySelector("[data-mvp]");
  const API = window.DONIS_CONFIG && window.DONIS_CONFIG.mvpApi;
  if (!box || !API) return;
  const E = Donis.esc;
  const KEY = "donis-mvp-voted", ID = "donis-voter", AGE = "donis-mvp-13";
  let t = null, pick = null, sending = false, msg = "", ok = false, news = false;
  let voted = Donis.store.get(KEY);
  let over13 = Donis.store.get(AGE) === "yes";

  function voterId() {
    let id = Donis.store.get(ID);
    if (!id || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) {
      const b = new Uint8Array(16);
      (window.crypto || {}).getRandomValues ? crypto.getRandomValues(b) : b.forEach((_, i) => (b[i] = Math.random() * 256));
      id = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
      Donis.store.set(ID, id);
    }
    return id;
  }

  // Who is through once voting closes. Two places; anyone level on the second place's votes is
  // marked tied rather than picked by list order, so a draw is never decided by accident.
  function places(ns) {
    const s = ns.filter((n) => n.votes > 0).sort((a, b) => b.votes - a.votes);
    if (!s.length) return { star: [], tied: [] };
    const cut = s.length > 1 ? s[1].votes : s[0].votes;
    const atOrAbove = s.filter((n) => n.votes >= cut);
    if (atOrAbove.length <= 2) return { star: atOrAbove.map((n) => n.id), tied: [] };
    return { star: s.filter((n) => n.votes > cut).map((n) => n.id), tied: s.filter((n) => n.votes === cut).map((n) => n.id) };
  }

  // "Closes at 18:30 · 42 min left", in London time, from the event date on the scores feed.
  function closing() {
    if (!t || !t.closesAt) return "";
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
    const today = `${p.year}-${p.month}-${p.day}`;
    if (t.date && today !== t.date) return `Voting closes at ${t.closesAt}`;
    const [ch, cm] = t.closesAt.split(":").map(Number);
    const mins = ch * 60 + cm - (Number(p.hour) * 60 + Number(p.minute));
    if (mins <= 0) return "";
    const left = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m left` : `${mins} min left`;
    return `Voting closes at ${t.closesAt} · ${left}`;
  }

  function render() {
    // Before there are nominees the box still holds its place, so fans know the vote is coming.
    if (!t || t.nominees.length < 2) {
      box.hidden = false;
      box.innerHTML = `<div class="mvpbox__head"><span class="tag">Coming up</span><h2 class="display mvpbox__title">Pick the MVPs</h2></div>
        <p class="mvpbox__lede">Players of the match go up here through the day. Tap your favourite to vote, and the two players with the most votes join the legends at 19:00.</p>`;
      return;
    }
    const lead = places(t.nominees);
    const closed = !t.open;
    const keep = box.querySelector("form") ? box.querySelector("form").email.value : "";
    box.hidden = false;
    const when = closed ? "" : closing();
    box.innerHTML = `
      <div class="mvpbox__head"><span class="tag ${closed ? "tag--orange" : "tag--live"}">${closed ? "Voting closed" : "Fan vote"}</span>
        <h2 class="display mvpbox__title">${closed ? "Your MVPs" : "Pick the MVPs"}</h2></div>
      <p class="mvpbox__lede">${closed ? "The two players with the most votes join the Legends game at 19:00." : "Tap a player to vote. The two with the most votes play in the Legends game at 19:00. One vote per phone, and you can change it until voting closes."}</p>
      ${when ? `<p class="mvpbox__when mono">${E(when)}</p>` : ""}
      <div class="mvpbox__list" role="${closed ? "list" : "radiogroup"}" aria-label="Nominees">
        ${t.nominees.map((n) => {
          const on = pick === n.id, mine = voted === n.id, star = closed && lead.star.includes(n.id), tied = closed && lead.tied.includes(n.id);
          const potm = n.potm > 1 ? `Player of the match ×${n.potm}` : n.potm === 1 ? "Player of the match" : "";
          const inner = `<span class="mvpbox__bar" style="width:${n.pct}%"></span>
            <span class="mvpbox__who"><b>${E(n.name)}</b><small>${E(n.team)}${potm ? ` · ${potm}` : ""}</small></span>
            <span class="mvpbox__pct">${t.total ? n.pct + "%" : ""}${mine ? `<small>Your vote</small>` : ""}${star ? `<small>Plays with the legends</small>` : ""}${tied ? `<small>Tied · organisers decide</small>` : ""}</span>`;
          return closed ? `<div class="mvpbox__opt ${star ? "is-star" : ""}" role="listitem">${inner}</div>`
            : `<button type="button" class="mvpbox__opt ${on ? "is-on" : ""} ${mine ? "is-mine" : ""}" role="radio" aria-checked="${on}" data-pick="${E(n.id)}">${inner}</button>`;
        }).join("")}
      </div>
      <p class="mvpbox__total mono muted">${t.total} vote${t.total === 1 ? "" : "s"}${closed ? "" : " · updates every 10 seconds"}</p>
      ${closed ? "" : `<form class="mvpbox__form" novalidate ${pick && pick !== voted ? "" : "hidden"}>
        <div class="join__trap" aria-hidden="true"><label for="mvp-website">Leave this empty</label><input id="mvp-website" name="website" tabindex="-1" autocomplete="off"></div>
        <label class="join__check"><input type="checkbox" name="over13" ${over13 ? "checked" : ""}> <span>I'm 13 or over.</span></label>
        <label class="join__check"><input type="checkbox" name="join" ${news ? "checked" : ""}> <span>Send me news about future Donis events and the Donis Clubhouse (optional).</span></label>
        <div class="join__field" ${news ? "" : "hidden"}><label for="mvp-email">Your email</label><input id="mvp-email" name="email" type="email" autocomplete="email" maxlength="160"></div>
        <button class="btn btn--orange" type="submit" ${sending ? "disabled" : ""}>${voted ? "Change my vote" : "Vote"} <span class="arrow">&rarr;</span></button>
        <p class="join__privacy muted"><a href="/london-26/faq/#vote-email">Do I need to give my email?</a></p>
      </form>`}
      <p class="join__msg ${ok ? "is-ok" : ""}" role="status" aria-live="polite" ${msg ? "" : "hidden"}>${E(msg)}</p>`;
    const f = box.querySelector("form");
    if (f) f.email.value = keep;
  }

  async function load() {
    try {
      const r = await fetch(API + "/tally", { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      t = await r.json();
      if (pick && !t.nominees.some((n) => n.id === pick)) pick = null;
      if (!sending) render();
    } catch (e) { /* keep the last good view */ }
  }

  box.addEventListener("click", (e) => {
    const b = e.target.closest("[data-pick]");
    if (!b) return;
    pick = b.dataset.pick; msg = ""; ok = false;
    render();
    const f = box.querySelector("form");
    if (f && !f.hidden) f.querySelector("button[type=submit]").scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
  box.addEventListener("change", (e) => {
    if (e.target.name === "join") { news = e.target.checked; render(); if (news) box.querySelector("#mvp-email").focus(); }
    if (e.target.name === "over13") over13 = e.target.checked;
  });

  box.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const email = news ? f.email.value.trim() : "";
    if (!pick) { msg = "Tap a player first."; render(); return; }
    if (!f.over13.checked) { msg = "Voting is for people aged 13 and over. Tick the box to vote."; render(); return; }
    if (news && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg = "Add a valid email address for Donis news, or untick the box."; render(); box.querySelector("#mvp-email").focus(); return; }
    sending = true; ok = false; msg = "Sending your vote…"; render();
    try {
      const r = await fetch(API + "/vote", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voter: voterId(), nominee: pick, over13: true, join: news, email, website: f.website.value }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "That didn't go through.");
      Donis.store.set(AGE, "yes"); over13 = true;
      if (d.voted) { voted = d.voted; Donis.store.set(KEY, voted); }
      t = { ...t, ...d };
      const who = t.nominees.find((n) => n.id === voted);
      msg = who ? `Vote counted for ${who.name}.` : "Vote counted."; ok = true; news = false;
    } catch (err) {
      msg = err.message && !/fetch/i.test(err.message) ? err.message : "That didn't go through. Check your connection and try again.";
    }
    sending = false;
    render();
  });

  // Refresh every 10 seconds while the vote is open and on screen; otherwise once a minute.
  let inView = true, last = 0;
  if ("IntersectionObserver" in window) new IntersectionObserver((es) => { inView = es.some((x) => x.isIntersecting); }, { rootMargin: "200px" }).observe(box);
  setInterval(() => {
    if (document.hidden || sending) return;
    const fast = inView && t && t.open;
    if (Date.now() - last >= (fast ? 10000 : 60000)) { last = Date.now(); load(); }
  }, 5000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { last = Date.now(); load(); } });

  render();
  last = Date.now();
  load();
});
