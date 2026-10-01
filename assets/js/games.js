// London 26 games page: schedule, live scores and league tables from /data/fixtures.json.
// The scorer page saves that file; this page re-reads it every 30 seconds on matchday.
document.addEventListener("DOMContentLoaded", () => {
  const E = Donis.esc;
  const $ = (s) => document.querySelector(s);
  const el = { tabs: $("[data-tabs]"), blurb: $("[data-blurb]"), schedule: $("[data-schedule]"), table: $("[data-table]"),
    view: $("[data-view]"), now: $("[data-now]"), status: $("[data-status]"), updated: $("[data-updated]"), pane: $("[data-pane]") };
  let data = null;
  let current = (location.hash || "").slice(1);
  let view = "schedule";
  const STATE = { scheduled: ["", ""], live: ["Live", "tag--live"], ft: ["FT", "tag--orange"] };
  const byTime = (a, b) => a.time.localeCompare(b.time);

  const divOf = (id) => data.divisions.find((d) => d.id === id);
  const PLACEHOLDER = /^(1st|2nd|3rd|4th|winner|loser|tbc)/i;
  const label = (div, ref) => {
    const t = (div.teams || []).find((x) => x.id === ref);
    if (!t) return { text: ref || "TBC", tbc: !ref || PLACEHOLDER.test(ref) };
    return t.name ? { text: t.name, tbc: false } : { text: "Team " + t.id.slice(-1), tbc: true };
  };
  const result = (f) => {
    if (f.state !== "ft" || f.homeScore == null) return ["", ""];
    return f.homeScore > f.awayScore ? ["win", "lose"] : f.homeScore < f.awayScore ? ["lose", "win"] : ["", ""];
  };
  const scoreHtml = (f) => (f.homeScore == null ? `<span class="gm__v">v</span>` : `${E(f.homeScore)}<i>&ndash;</i>${E(f.awayScore)}`);

  function gameRow(f, div, withDiv) {
    const [s, c] = STATE[f.state] || STATE.scheduled;
    const [rh, ra] = result(f);
    const h = label(div, f.home), a = label(div, f.away);
    return `<li class="gm gm--${E(f.state)}">
      <span class="gm__time">${E(f.time)}${f.stage ? ` <em>${E(f.stage)}</em>` : withDiv ? ` <em>${E(div.name)}</em>` : ""}</span>
      <span class="gm__team ${rh} ${h.tbc ? "tbc" : ""}">${E(h.text)}</span>
      <span class="gm__score">${scoreHtml(f)}</span>
      <span class="gm__team gm__team--away ${ra} ${a.tbc ? "tbc" : ""}">${E(a.text)}</span>
      <span class="gm__state">${s ? `<span class="tag ${c}">${s}</span>` : ""}</span>
    </li>`;
  }

  function renderNow() {
    const all = data.fixtures.slice().sort(byTime);
    const live = all.filter((f) => f.state === "live");
    const next = all.find((f) => f.state === "scheduled");
    const done = all.length && all.every((f) => f.state === "ft");
    const today = new Date().toISOString().slice(0, 10) === data.date;
    if (el.status) {
      const [t, c] = live.length ? ["Live now", "tag--live"] : done ? ["Full time", "tag--orange"] : today ? ["Today", "tag--live"] : ["Sat 03.10.26", ""];
      el.status.className = `tag ${c}`; el.status.textContent = t;
    }
    if (!el.now) return;
    const cards = [];
    live.forEach((f) => cards.push(["Live now", f]));
    if (next) cards.push(["Up next", next]);
    el.now.hidden = !cards.length;
    el.now.innerHTML = cards.map(([k, f]) => {
      const div = divOf(f.division);
      const h = label(div, f.home), a = label(div, f.away);
      return `<a class="now ${f.state === "live" ? "now--live" : ""}" href="#${E(div.id)}" data-go="${E(div.id)}">
        <span class="mono">${k} · ${E(div.name)} · ${E(f.time)}</span>
        <span class="now__line"><b class="${h.tbc ? "tbc" : ""}">${E(h.text)}</b><span class="now__score">${scoreHtml(f)}</span><b class="${a.tbc ? "tbc" : ""}">${E(a.text)}</b></span>
      </a>`;
    }).join("");
  }

  // Live stream, switched on from the scorer page. Only rebuilt when the stream itself changes,
  // so the 30-second score refresh never restarts a video someone is watching.
  const streamBox = $("[data-stream-box]");
  function renderStream() {
    if (!streamBox || !window.FixturesModel) return;
    const s = window.FixturesModel.streamInfo(data.stream);
    // Until the stream is switched on, hold its place so people know to come back here;
    // once every game is full time there is nothing left to wait for.
    const over = data.fixtures.length && data.fixtures.every((f) => f.state === "ft");
    const today = new Date().toISOString().slice(0, 10) === data.date;
    const key = s ? `${s.kind}|${s.id || s.channel || s.url}|${s.label}` : over ? "" : `wait|${today}`;
    if (streamBox.dataset.key === key) return;
    streamBox.dataset.key = key;
    if (!s && over) { streamBox.hidden = true; streamBox.innerHTML = ""; streamBox.className = "streambox"; return; }
    if (!s) {
      streamBox.className = "streambox streambox--wait";
      streamBox.innerHTML = `<span class="tag">${today ? "Later today" : "Sat 03.10.26"}</span><span class="streambox__label">Live from the cage</span>
        <p class="streambox__note">The live stream plays right here on the day. Keep this page open.</p>`;
      streamBox.hidden = false;
      return;
    }
    const title = s.label || "Live from the cage";
    if (s.kind === "youtube") {
      streamBox.className = "streambox";
      streamBox.innerHTML = `<div class="streambox__head"><span class="tag tag--live">Live</span><span class="streambox__label">${E(title)}</span></div>
        <div class="streambox__frame"><iframe src="https://www.youtube-nocookie.com/embed/${E(s.id)}?rel=0&playsinline=1" title="${E(title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
        <a class="streambox__alt" href="https://www.youtube.com/watch?v=${E(s.id)}" target="_blank" rel="noopener">Not playing? Watch on YouTube &rarr;</a>`;
    } else if (s.kind === "twitch") {
      // Twitch only plays on the domains named in parent=, so name the one this page is on.
      streamBox.className = "streambox";
      streamBox.innerHTML = `<div class="streambox__head"><span class="tag tag--live">Live</span><span class="streambox__label">${E(title)}</span></div>
        <div class="streambox__frame"><iframe src="https://player.twitch.tv/?channel=${encodeURIComponent(s.channel)}&parent=${encodeURIComponent(location.hostname)}&muted=true" title="${E(title)}" allow="autoplay; fullscreen" allowfullscreen></iframe></div>
        <a class="streambox__alt" href="https://www.twitch.tv/${encodeURIComponent(s.channel)}" target="_blank" rel="noopener">Not playing? Watch on Twitch &rarr;</a>`;
    } else {
      streamBox.className = "streambox streambox--link";
      streamBox.innerHTML = `<span class="tag tag--live">Live</span><span class="streambox__label">${E(title)}</span>
        <a class="btn btn--acid btn--sm" href="${E(s.url)}" target="_blank" rel="noopener">Watch on ${E(s.host)} <span class="arrow">&rarr;</span></a>`;
    }
    streamBox.hidden = false;
  }

  function renderDiv() {
    const div = divOf(current) || data.divisions[0];
    current = div.id;
    el.tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.div === current)));
    el.blurb.textContent = div.blurb || "";
    const rows = data.fixtures.filter((f) => f.division === div.id).sort(byTime);
    const champ = window.DonisStandings && window.DonisStandings.champion(div, rows);
    const banner = champ ? `<div class="champ"><span class="mono">${E(div.name)} champions · ${E(champ.how)}</span><b class="display">${E(label(div, champ.ref).text)}</b></div>` : "";
    const group = rows.filter((f) => !f.stage), ko = rows.filter((f) => f.stage);
    el.schedule.innerHTML = banner
      + (group.length ? `<ol class="gms">${group.map((f) => gameRow(f, div)).join("")}</ol>` : ko.length ? "" : `<p class="board__empty">${E(div.message || "Fixtures to follow.")}</p>`)
      + (ko.length ? bracketHtml(div, ko) : "");
    const hasTable = div.format === "round-robin" && window.DonisStandings;
    el.pane.classList.toggle("has-table", !!hasTable);
    el.view.hidden = !hasTable;
    if (!hasTable) view = "schedule";
    el.pane.dataset.show = view;
    el.view.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === view)));
    el.table.innerHTML = hasTable ? tableHtml(div, rows) : "";
  }

  // Knockouts as a bracket: one column per round, earliest round first.
  const roundOrder = (s) => (/quarter/i.test(s) ? 0 : /semi/i.test(s) ? 1 : /3rd|third/i.test(s) ? 2 : /final/i.test(s) ? 3 : 1.5);
  function bracketHtml(div, ko) {
    const rounds = {};
    ko.forEach((f) => { const name = f.stage.replace(/\s*\d+$/, ""); (rounds[name] = rounds[name] || []).push(f); });
    const names = Object.keys(rounds).sort((a, b) => roundOrder(a) - roundOrder(b));
    const side = (f, ref, n, won) => { const l = label(div, ref); return `<span class="ko__side ${won ? "win" : f.state === "ft" ? "lose" : ""}"><b class="${l.tbc ? "tbc" : ""}">${E(l.text)}</b><span>${n == null ? "" : E(n)}</span></span>`; };
    return `<div class="ko"><h3 class="mono games__h">Knockouts</h3><div class="ko__rounds">${names.map((n) => `
      <div class="ko__round"><span class="mono ko__name">${E(n)}${rounds[n].length > 1 && !/s$/.test(n) ? "s" : ""}</span>
        ${rounds[n].sort(byTime).map((f) => {
          const [rh, ra] = result(f);
          return `<div class="ko__game ko__game--${E(f.state)}"><span class="mono ko__meta">${E(f.time)} · ${E(f.stage)}${f.state === "live" ? ' · <b class="acid">Live</b>' : f.state === "ft" ? " · FT" : ""}</span>${side(f, f.home, f.homeScore, rh === "win")}${side(f, f.away, f.awayScore, ra === "win")}</div>`;
        }).join("")}
      </div>`).join("")}</div></div>`;
  }

  // A division split into groups gets one table per group.
  const groupsOf = (div) => {
    const names = [...new Set((div.teams || []).map((t) => t.group).filter(Boolean))];
    return names.length ? names.map((g) => [g, div.teams.filter((t) => t.group === g)]) : [[null, div.teams]];
  };
  function tableHtml(div, rows) {
    const groups = groupsOf(div);
    return groups.map(([g, teams]) => (g ? `<h3 class="mono lt__group">Group ${E(g)}</h3>` : "") + oneTable(div, teams, rows, g)).join("")
      + `<p class="lt__key mono muted">Win 3 · Draw 1 · Then goal difference, then goals scored</p>`;
  }
  function oneTable(div, teams, rows, g) {
    const t = window.DonisStandings.standings(teams, rows);
    const played = t.some((r) => r.p > 0);
    return `<table class="lt"><caption class="sr-only">${E(div.name)}${g ? " group " + E(g) : ""} league table</caption>
      <thead><tr><th scope="col">#</th><th scope="col" class="lt__team">Team</th><th scope="col">P</th><th scope="col" class="opt">W</th><th scope="col" class="opt">D</th><th scope="col" class="opt">L</th><th scope="col">GD</th><th scope="col">Pts</th></tr></thead>
      <tbody>${t.map((r, i) => {
        const l = label(div, r.id);
        return `<tr class="${played && i === 0 ? "lead" : ""}"><td>${i + 1}</td><th scope="row" class="lt__team ${l.tbc ? "tbc" : ""}">${E(l.text)}</th><td>${r.p}</td><td class="opt">${r.w}</td><td class="opt">${r.d}</td><td class="opt">${r.l}</td><td>${r.gd > 0 ? "+" : ""}${r.gd}</td><td><b>${r.pts}</b></td></tr>`;
      }).join("")}</tbody></table>`;
  }

  function select(id, push) {
    if (!divOf(id)) return;
    current = id;
    if (push) history.replaceState(null, "", "#" + id);
    renderDiv();
  }

  async function load() {
    try {
      data = await Donis.scores();
    } catch (e) {
      if (!data) el.schedule.innerHTML = '<p class="board__empty">Could not load the games. Refresh to try again.</p>';
      return;
    }
    if (!el.tabs.children.length) {
      el.tabs.innerHTML = data.divisions.map((d) => `<button type="button" role="tab" data-div="${E(d.id)}">${E(d.name)}</button>`).join("");
    }
    renderNow();
    renderStream();
    renderDiv();
    if (el.updated) el.updated.textContent = data.updated ? `Updated ${data.updated} · refreshes by itself` : "Scores go up here on the day.";
  }

  el.tabs.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) select(b.dataset.div, true); });
  el.view.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { view = b.dataset.v; renderDiv(); } });
  if (el.now) el.now.addEventListener("click", (e) => {
    const a = e.target.closest("[data-go]"); if (!a) return;
    e.preventDefault(); select(a.dataset.go, true);
    el.pane.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  window.addEventListener("hashchange", () => select(location.hash.slice(1), false));

  // Pick up new scores without a refresh (every 30s while the page is on screen, any day,
  // so a rehearsal behaves like matchday), and straight away when a phone wakes.
  load();
  setInterval(() => { if (!document.hidden) load(); }, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
});
