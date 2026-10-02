// Fan MVP vote on the Games page, under the live stream. The nominees and the open switch are
// set on the scorer page; votes and live percentages come from the donis-mvp Worker.
document.addEventListener("DOMContentLoaded", () => {
  const box = document.querySelector("[data-mvp]");
  const API = window.DONIS_CONFIG && window.DONIS_CONFIG.mvpApi;
  if (!box || !API) return;
  const E = Donis.esc;
  const KEY = "donis-mvp-voted";
  let t = null, pick = null, sending = false, msg = "", ok = false;
  let voted = Donis.store.get(KEY);

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

  function render() {
    // Before there are nominees the box still holds its place, so fans know the vote is coming.
    if (!t || t.nominees.length < 2) {
      box.hidden = false;
      box.innerHTML = `<div class="mvpbox__head"><span class="tag">Coming up</span><h2 class="display mvpbox__title">Pick the MVPs</h2></div>
        <p class="mvpbox__lede">Nominees from the games go up here during the day. Vote for your favourite, and the two players with the most votes join the legends at 19:00.</p>`;
      return;
    }
    const lead = places(t.nominees);
    const closed = !t.open;
    // Keep what the fan has typed when the percentages refresh underneath them.
    const form = box.querySelector("form");
    const keep = form ? { email: form.email.value, over13: form.over13.checked, join: form.join.checked } : null;
    box.hidden = false;
    box.innerHTML = `
      <div class="mvpbox__head"><span class="tag ${closed ? "tag--orange" : "tag--live"}">${closed ? "Voting closed" : "Fan vote"}</span>
        <h2 class="display mvpbox__title">${closed ? "Your MVPs" : "Pick the MVPs"}</h2></div>
      <p class="mvpbox__lede">${closed ? "The two players with the most votes join the Legends game at 19:00." : "The two players with the most votes play in the Legends game at 19:00. One vote each, and you can change it while voting is open."}</p>
      <div class="mvpbox__list" role="${closed ? "list" : "radiogroup"}" aria-label="Nominees">
        ${t.nominees.map((n) => {
          const on = pick === n.id, mine = voted === n.id, star = closed && lead.star.includes(n.id), tied = closed && lead.tied.includes(n.id);
          const inner = `<span class="mvpbox__bar" style="width:${n.pct}%"></span>
            <span class="mvpbox__who"><b>${E(n.name)}</b><small>${E(n.team)}</small></span>
            <span class="mvpbox__pct">${t.total ? n.pct + "%" : ""}${mine ? `<small>Your vote</small>` : ""}${star ? `<small>Plays with the legends</small>` : ""}${tied ? `<small>Tied · organisers decide</small>` : ""}</span>`;
          return closed ? `<div class="mvpbox__opt ${star ? "is-star" : ""}" role="listitem">${inner}</div>`
            : `<button type="button" class="mvpbox__opt ${on ? "is-on" : ""} ${mine ? "is-mine" : ""}" role="radio" aria-checked="${on}" data-pick="${E(n.id)}">${inner}</button>`;
        }).join("")}
      </div>
      <p class="mvpbox__total mono muted">${t.total} vote${t.total === 1 ? "" : "s"}${closed ? "" : " · updates every 30 seconds"}</p>
      ${closed ? "" : `<form class="mvpbox__form" novalidate ${pick ? "" : "hidden"}>
        <div class="join__field"><label for="mvp-email">Your email</label><input id="mvp-email" name="email" type="email" autocomplete="email" maxlength="160" required></div>
        <div class="join__trap" aria-hidden="true"><label for="mvp-website">Leave this empty</label><input id="mvp-website" name="website" tabindex="-1" autocomplete="off"></div>
        <label class="join__check"><input type="checkbox" name="over13"> <span>I'm 13 or over.</span></label>
        <label class="join__check"><input type="checkbox" name="join"> <span>Tell me about future Donis events and the Donis Clubhouse (optional).</span></label>
        <button class="btn btn--orange" type="submit" ${sending ? "disabled" : ""}>${voted ? "Change my vote" : "Vote"} <span class="arrow">&rarr;</span></button>
        <p class="join__msg ${ok ? "is-ok" : ""}" role="status" aria-live="polite" ${msg ? "" : "hidden"}>${E(msg)}</p>
        <p class="join__privacy muted"><a href="/london-26/faq/#vote-email">How we use your email</a></p>
      </form>`}`;
    const f = box.querySelector("form");
    if (f && keep) { f.email.value = keep.email; f.over13.checked = keep.over13; f.join.checked = keep.join; }
  }

  async function load() {
    try {
      const r = await fetch(API + "/tally", { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      t = await r.json();
      if (pick && !t.nominees.some((n) => n.id === pick)) pick = null;
      render();
    } catch (e) { /* keep the last good view */ }
  }

  box.addEventListener("click", (e) => {
    const b = e.target.closest("[data-pick]");
    if (!b) return;
    pick = b.dataset.pick; msg = ""; ok = false;
    render();
    const f = box.querySelector("form");
    if (f && !f.email.value) f.email.focus({ preventScroll: true });
  });

  box.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const email = f.email.value.trim();
    if (!pick) { msg = "Tap a player first."; render(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg = "Add a valid email address."; render(); box.querySelector("form").email.focus(); return; }
    if (!f.over13.checked) { msg = "Voting is for people aged 13 and over."; render(); return; }
    sending = true; ok = false; msg = "Sending your vote…"; render();
    try {
      const r = await fetch(API + "/vote", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, nominee: pick, over13: true, join: f.join.checked, website: f.website.value }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "That didn't go through.");
      if (d.voted) { voted = d.voted; Donis.store.set(KEY, voted); }
      t = { open: d.open, total: d.total, nominees: d.nominees };
      const who = t.nominees.find((n) => n.id === voted);
      msg = who ? `Vote counted for ${who.name}.` : "Vote counted."; ok = true;
    } catch (err) {
      msg = err.message && !/fetch/i.test(err.message) ? err.message : "That didn't go through. Check your connection and try again.";
    }
    sending = false;
    render();
  });

  render();
  load();
  setInterval(() => { if (!document.hidden && !sending) load(); }, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
});
