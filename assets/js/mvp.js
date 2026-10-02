// Fan MVP vote on the Games page, under the live stream. While a game is live, fans see both
// teams' players and tap one to vote: one vote per phone per game, changeable until that
// game's vote locks a minute after full time. Votes add up across the day, and the top two
// play in the Legends game. Everything comes from the donis-mvp Worker's /tally.
document.addEventListener("DOMContentLoaded", () => {
  const box = document.querySelector("[data-mvp]");
  const API = window.DONIS_CONFIG && window.DONIS_CONFIG.mvpApi;
  if (!box || !API) return;
  const E = Donis.esc;
  const MINE = "donis-mvp-mine", ID = "donis-voter", AGE = "donis-mvp-13";
  let t = null, sending = null, msg = "", ok = false, ask = null, deadlines = {};
  let over13 = Donis.store.get(AGE) === "yes";
  let mine = {};
  try { mine = JSON.parse(Donis.store.get(MINE) || "{}") || {}; } catch (e) { mine = {}; }

  function voterId() {
    let id = Donis.store.get(ID);
    if (!id || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) {
      const b = new Uint8Array(16);
      if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(b); else b.forEach((_, i) => (b[i] = Math.random() * 256));
      id = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
      Donis.store.set(ID, id);
    }
    return id;
  }

  // Top two once voting is over; anyone level on second place is shown as tied, never picked by order.
  function places(ls) {
    if (!ls.length) return { star: [], tied: [] };
    const cut = ls.length > 1 ? ls[1].votes : ls[0].votes;
    const top = ls.filter((p) => p.votes >= cut);
    if (top.length <= 2) return { star: top.map((p) => p.id), tied: [] };
    return { star: ls.filter((p) => p.votes > cut).map((p) => p.id), tied: ls.filter((p) => p.votes === cut).map((p) => p.id) };
  }

  const secsLeft = (g) => (deadlines[g.id] ? Math.max(0, Math.ceil((deadlines[g.id] - Date.now()) / 1000)) : null);

  function gameCard(g) {
    const left = secsLeft(g);
    const locked = g.state === "ft" && left === 0;
    const meta = [g.state === "live" ? '<b class="acid">LIVE</b>' : "FT", E(g.division), g.stage ? E(g.stage) : g.group ? E(g.group) : "", E(g.time)].filter(Boolean).join(" · ");
    const when = g.state === "ft" ? (locked ? "Voting for this game has closed" : `Vote closes in <span data-lock="${E(g.id)}">${left}</span>s`) : "Tap a player to vote";
    const side = (s) => `<div class="mvpg__side"><span class="mvpg__team">${E(s.team)}</span>${s.players.length
      ? s.players.map((p) => `<button type="button" class="mvpg__p ${mine[g.id] === p.id ? "is-mine" : ""}" data-game="${E(g.id)}" data-player="${E(p.id)}" ${locked || sending ? "disabled" : ""} aria-pressed="${mine[g.id] === p.id}">${E(p.name)}${mine[g.id] === p.id ? "<small>Your vote</small>" : ""}</button>`).join("")
      : `<span class="mvpg__none">Players to come</span>`}</div>`;
    const asking = ask && ask.game === g.id ? `<div class="mvpg__ask"><label class="join__check"><input type="checkbox" data-age> <span>I'm 13 or over.</span></label>
      <button type="button" class="btn btn--orange" data-confirm>Vote for ${E(ask.name)} <span class="arrow">&rarr;</span></button></div>` : "";
    return `<div class="mvpg ${g.state === "live" ? "mvpg--live" : ""}"><p class="mvpg__meta mono">${meta}</p><p class="mvpg__when mono">${when}</p>
      <div class="mvpg__sides">${g.sides.map(side).join('<span class="mvpg__v">v</span>')}</div>${asking}</div>`;
  }

  function render() {
    box.hidden = false;
    if (!t) {
      box.innerHTML = `<div class="mvpbox__head"><span class="tag">Coming up</span><h2 class="display mvpbox__title">Vote for the MVP</h2></div>
        <p class="mvpbox__lede">When a game kicks off, its players appear here. Tap the best one to vote. The top two at the end of the day play in the Legends game at 19:00.</p>`;
      return;
    }
    const done = t.over || !t.open;
    const lead = places(t.leaders);
    const max = t.leaders.length ? t.leaders[0].votes : 0;
    const leaders = t.leaders.slice(0, 8).map((p) => {
      const star = t.over && lead.star.includes(p.id), tied = t.over && lead.tied.includes(p.id);
      return `<div class="mvpbox__opt ${star ? "is-star" : ""}" role="listitem"><span class="mvpbox__bar" style="width:${max ? Math.round((p.votes / max) * 100) : 0}%"></span>
        <span class="mvpbox__who"><b>${E(p.name)}</b><small>${E(p.team)}</small></span>
        <span class="mvpbox__pct">${p.votes}${star ? "<small>Plays with the legends</small>" : tied ? "<small>Tied · organisers decide</small>" : ""}</span></div>`;
    }).join("");
    box.innerHTML = `
      <div class="mvpbox__head"><span class="tag ${t.over ? "tag--orange" : t.open ? "tag--live" : ""}">${t.over ? "Voting closed" : t.open ? "Fan vote" : "Vote paused"}</span>
        <h2 class="display mvpbox__title">${t.over ? "Your MVPs" : "Vote for the MVP"}</h2></div>
      <p class="mvpbox__lede">${t.over ? "Every game is done. The two players with the most votes play in the Legends game at 19:00."
        : !t.open ? "The fan vote is paused for now."
        : "Pick the best player in the game you're watching. One vote per game, and votes add up all day. The top two play in the Legends game at 19:00."}</p>
      ${done ? "" : t.games.length ? t.games.map(gameCard).join("") : `<p class="mvpg__idle mono">No game on right now. The vote opens when the next game kicks off.</p>`}
      <p class="join__msg ${ok ? "is-ok" : ""}" role="status" aria-live="polite" ${msg ? "" : "hidden"}>${E(msg)}</p>
      ${leaders ? `<p class="mvpg__meta mono">${t.over ? "Final votes" : "Leading the vote"}</p><div class="mvpbox__list" role="list" aria-label="Leaderboard">${leaders}</div>` : ""}
      <p class="mvpbox__total mono muted">${t.total} vote${t.total === 1 ? "" : "s"}${done ? "" : " · updates every 10 seconds"} · <a href="/join/">Want Donis news? Join the Clubhouse</a></p>`;
  }

  function take(d) {
    t = d;
    deadlines = {};
    (t.games || []).forEach((g) => { if (g.state === "ft" && g.locksIn != null) deadlines[g.id] = Date.now() + g.locksIn * 1000; });
    if (ask && !t.games.some((g) => g.id === ask.game)) ask = null;
  }

  async function load() {
    try {
      const r = await fetch(API + "/tally", { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      take(await r.json());
      if (!sending) render();
    } catch (e) { /* keep the last good view */ }
  }

  async function vote(game, player, name) {
    sending = game; msg = `Voting for ${name}…`; ok = false; render();
    try {
      const r = await fetch(API + "/vote", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voter: voterId(), game, player, over13: true, website: "" }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "That didn't go through.");
      Donis.store.set(AGE, "yes"); over13 = true;
      if (d.player) { mine[d.game] = d.player; Donis.store.set(MINE, JSON.stringify(mine)); }
      take(d);
      msg = `Vote counted for ${name}.`; ok = true;
      const said = msg;
      setTimeout(() => { if (msg === said) { msg = ""; if (!sending) render(); } }, 5000);
    } catch (err) {
      msg = err.message && !/fetch/i.test(err.message) ? err.message : "That didn't go through. Check your connection and try again.";
    }
    sending = null; ask = null;
    render();
  }

  box.addEventListener("click", (e) => {
    const p = e.target.closest("[data-player]");
    if (p && !p.disabled) {
      const name = p.childNodes[0].textContent.trim();
      if (mine[p.dataset.game] === p.dataset.player) return;
      // The first vote on this phone asks for the 13+ tick once; after that one tap votes.
      if (!over13) { ask = { game: p.dataset.game, player: p.dataset.player, name }; msg = ""; render(); return; }
      vote(p.dataset.game, p.dataset.player, name);
      return;
    }
    if (e.target.closest("[data-confirm]") && ask) {
      if (!box.querySelector("[data-age]").checked) { msg = "Voting is for people aged 13 and over. Tick the box to vote."; ok = false; render(); box.querySelector("[data-age]").focus(); return; }
      vote(ask.game, ask.player, ask.name);
    }
  });

  // The countdown after full time ticks every second; the game locks itself at zero.
  setInterval(() => {
    let relock = false;
    box.querySelectorAll("[data-lock]").forEach((el) => {
      const left = deadlines[el.dataset.lock] ? Math.max(0, Math.ceil((deadlines[el.dataset.lock] - Date.now()) / 1000)) : 0;
      el.textContent = left;
      if (!left) relock = true;
    });
    if (relock && !sending) render();
  }, 1000);

  // Refresh every 10 seconds while the box is on screen; otherwise once a minute.
  let inView = true, last = 0;
  if ("IntersectionObserver" in window) new IntersectionObserver((es) => { inView = es.some((x) => x.isIntersecting); }, { rootMargin: "200px" }).observe(box);
  setInterval(() => {
    if (document.hidden || sending) return;
    // Fast only while there's a game to vote in; between games every 30 seconds is plenty.
    const fast = inView && t && t.open && !t.over && t.games.length > 0;
    if (Date.now() - last >= (fast ? 10000 : inView && t && t.open && !t.over ? 30000 : 60000)) { last = Date.now(); load(); }
  }, 5000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { last = Date.now(); load(); } });

  render();
  last = Date.now();
  load();
});
