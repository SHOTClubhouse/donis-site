// Big-screen mode for a venue TV: rotates through the divisions, shows live games,
// the table and the champions, and re-reads /data/fixtures.json every 10 seconds.
document.addEventListener("DOMContentLoaded", () => {
  const E = Donis.esc;
  const $ = (s) => document.querySelector(s);
  let data = null, idx = 0, vote = null;
  const VOTE = { id: "_vote", name: "Fan MVP vote" };
  const API = window.DONIS_CONFIG && window.DONIS_CONFIG.mvpApi;

  // Knockout placeholders show the real team as soon as the scores decide it.
  const label = (div, ref) => {
    const id = (data && window.DonisStandings.resolve(div, data.fixtures, ref)) || ref;
    const t = (div.teams || []).find((x) => x.id === id);
    if (!t) return { text: ref || "TBC", tbc: !ref };
    return t.name ? { text: t.name, tbc: false } : { text: "Team " + t.id.slice(-1), tbc: true };
  };
  // Finished games: "win" or "lose" for a side (green or red); nothing for a draw or an unfinished game.
  const won = (f, side) => { const w = window.DonisStandings.winnerOf(f); return !w ? "" : w === side ? "win" : "lose"; };
  const score = (f) => (f.homeScore == null ? "v" : `${E(f.homeScore)}&ndash;${E(f.awayScore)}`);

  function render() {
    if (!data) return;
    const ds = data.divisions.filter((d) => data.fixtures.some((f) => f.division === d.id) || d.message)
      .concat(vote && vote.nominees.length >= 2 ? [VOTE] : []);
    const div = ds[idx % ds.length];
    // The vote takes the whole screen on its turn in the rotation.
    const onVote = div === VOTE;
    ["[data-games]", "[data-table]"].forEach((s) => ($(s).hidden = onVote));
    $("[data-vote]").hidden = !onVote;
    if (onVote) {
      $("[data-div-name]").textContent = VOTE.name;
      $("[data-dots]").innerHTML = ds.map((d, i) => `<i class="${i === idx % ds.length ? "on" : ""}"></i>`).join("");
      $("[data-live]").hidden = !data.fixtures.some((f) => f.state === "live");
      $("[data-champ]").hidden = true;
      renderVote();
      return;
    }
    const rows = data.fixtures.filter((f) => f.division === div.id).sort((a, b) => a.time.localeCompare(b.time));
    const live = data.fixtures.filter((f) => f.state === "live");
    $("[data-div-name]").textContent = div.name;
    $("[data-dots]").innerHTML = ds.map((d, i) => `<i class="${i === idx % ds.length ? "on" : ""}"></i>`).join("");
    const pill = $("[data-live]");
    pill.hidden = !live.length;
    const sp = $("[data-stream-pill]");
    if (sp) sp.hidden = !(window.FixturesModel && window.FixturesModel.streamInfo(data.stream));

    const champ = window.DonisStandings.champion(div, rows);
    $("[data-champ]").innerHTML = champ ? `<span class="mono">${E(div.name)} champions</span><b class="display">${E(label(div, champ.ref).text)}</b>` : "";
    $("[data-champ]").hidden = !champ;

    // A TV never scrolls: show at most four games, live first, then upcoming, then the latest results.
    const show = rows.filter((f) => f.state === "live")
      .concat(rows.filter((f) => f.state === "scheduled"))
      .concat(rows.filter((f) => f.state === "ft").reverse())
      .slice(0, champ ? 3 : 4)
      .sort((a, b) => a.time.localeCompare(b.time));
    const more = rows.length - show.length;
    $("[data-games]").innerHTML = (show.length ? show.map((f) => `
      <div class="tvg tvg--${E(f.state)}">
        <span class="mono tvg__meta">${E(f.time)}${f.stage ? " · " + E(f.stage) : (() => { const t = (div.teams || []).find((x) => x.id === f.home); return t && t.group ? " · Group " + E(t.group) : ""; })()}${f.state === "live" ? ' · <b class="acid">LIVE</b>' : f.state === "ft" ? " · FT" + (window.DonisStandings.winnerOf(f) && f.homeScore === f.awayScore ? " (pens)" : "") : ""}</span>
        <span class="tvg__line"><b class="${label(div, f.home).tbc ? "tbc" : ""} ${won(f, "home")}">${E(label(div, f.home).text)}</b><span class="tvg__score">${score(f)}</span><b class="${label(div, f.away).tbc ? "tbc" : ""} ${won(f, "away")}">${E(label(div, f.away).text)}</b></span>
      </div>`).join("") : `<p class="mono muted">${E(div.message || "Fixtures to follow.")}</p>`)
      + (more > 0 ? `<p class="mono muted">+ ${more} more on your phone</p>` : "");

    const tableHost = $("[data-table]");
    if (div.format === "round-robin") {
      // Groups sit side by side so a TV never has to scroll.
      const names = [...new Set((div.teams || []).map((t) => t.group).filter(Boolean))];
      const groups = names.length ? names.map((g) => [g, div.teams.filter((t) => t.group === g)]) : [[null, div.teams]];
      tableHost.innerHTML = `<div class="tvgroups" style="--g:${groups.length}">${groups.map(([g, teams]) => {
        const t = window.DonisStandings.standings(teams, rows);
        return `<div>${g ? `<span class="mono lt__group">Group ${E(g)}</span>` : ""}<table class="lt tvlt"><thead><tr><th>#</th><th class="lt__team">Team</th><th>P</th><th>GD</th><th>Pts</th></tr></thead><tbody>${t.map((r, i) => {
          const l = label(div, r.id);
          return `<tr class="${i === 0 && r.p > 0 ? "lead" : ""}"><td>${i + 1}</td><th class="lt__team ${l.tbc ? "tbc" : ""}">${E(l.text)}</th><td>${r.p}</td><td>${r.gd > 0 ? "+" : ""}${r.gd}</td><td><b>${r.pts}</b></td></tr>`;
        }).join("")}</tbody></table></div>`;
      }).join("")}</div>`;
    } else {
      const next = data.fixtures.filter((f) => f.state === "scheduled").sort((a, b) => a.time.localeCompare(b.time))[0];
      const nd = next && data.divisions.find((d) => d.id === next.division);
      tableHost.innerHTML = next ? `<div class="tvnext"><span class="mono muted">Up next · ${E(nd.name)} · ${E(next.time)}</span><b class="display">${E(label(nd, next.home).text)}<i>v</i>${E(label(nd, next.away).text)}</b></div>` : "";
    }
  }

  // Top two once voting closes; anyone level on second place is shown as tied.
  function renderVote() {
    const ns = vote.nominees.slice().sort((a, b) => b.votes - a.votes).slice(0, 8);
    const s = ns.filter((n) => n.votes > 0);
    const cut = s.length > 1 ? s[1].votes : s.length ? s[0].votes : 0;
    const top = s.filter((n) => n.votes >= cut);
    const star = !vote.open ? (top.length <= 2 ? top.map((n) => n.id) : s.filter((n) => n.votes > cut).map((n) => n.id)) : [];
    const tied = !vote.open && top.length > 2 ? s.filter((n) => n.votes === cut).map((n) => n.id) : [];
    $("[data-vote]").innerHTML = `<div class="tvvote__list">${ns.map((n) => `
      <div class="tvvote__row ${star.includes(n.id) ? "is-star" : ""}"><span class="tvvote__bar" style="width:${n.pct}%"></span>
        <span class="tvvote__who"><b>${E(n.name)}</b><small>${E(n.team)}${n.potm ? " · Player of the match" + (n.potm > 1 ? " ×" + n.potm : "") : ""}</small></span>
        <span class="tvvote__pct">${vote.total ? n.pct + "%" : ""}${star.includes(n.id) ? "<small>Plays with the legends</small>" : tied.includes(n.id) ? "<small>Tied</small>" : ""}</span></div>`).join("")}</div>
      <div class="tvvote__side">${vote.open
        ? `<span class="mono">Fan vote${vote.closesAt ? " · closes " + E(vote.closesAt) : ""}</span><b>Scan to vote</b><img src="/assets/img/qr-games.png" alt="QR code for the vote"><p>Top two play with the legends at 19:00</p><span class="mono">${vote.total} vote${vote.total === 1 ? "" : "s"}</span>`
        : `<span class="mono">Voting closed</span><b>Your MVPs</b><p>The top two join the Legends game at 19:00.</p><span class="mono">${vote.total} vote${vote.total === 1 ? "" : "s"}</span>`}</div>`;
  }
  async function loadVote() {
    if (!API) return;
    try { const r = await fetch(API + "/tally", { cache: "no-store" }); if (r.ok) vote = await r.json(); } catch (e) { /* the vote slide just waits */ }
  }

  // The bar laptop runs this unattended, so it must say when it has lost the scores
  // rather than silently showing old ones.
  let lastOk = 0;
  const hhmm = (t) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(t);
  async function load() {
    try { data = await Donis.scores(); lastOk = Date.now(); render(); } catch (e) { /* keep the last good view */ }
    stale();
  }
  function stale() {
    const el = $("[data-stale]");
    const old = !lastOk || Date.now() - lastOk > 90000;
    el.hidden = !old;
    if (old) el.textContent = lastOk ? `Reconnecting · scores from ${hhmm(lastOk)}` : "Connecting…";
  }
  setInterval(stale, 10000);

  // Keep the screen awake all day, and take it back if the tab was hidden.
  let lock = null;
  async function wake() {
    try { if ("wakeLock" in navigator && !document.hidden) lock = await navigator.wakeLock.request("screen"); } catch (e) { lock = null; }
  }
  wake();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { wake(); load(); } });

  // One click (or key) from whoever sets up the laptop puts it full screen.
  const fs = $("[data-fs]");
  const syncFs = () => { fs.hidden = !!document.fullscreenElement || !document.documentElement.requestFullscreen; };
  const goFs = () => { if (!document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); wake(); };
  document.addEventListener("fullscreenchange", syncFs);
  document.addEventListener("click", goFs);
  document.addEventListener("keydown", (e) => { if (e.key === "f" || e.key === "Enter") goFs(); });
  syncFs();

  load();
  loadVote();
  setInterval(load, 10000);
  setInterval(loadVote, 10000);
  setInterval(() => { if (data) { idx++; render(); } }, 12000);
  setInterval(() => { $("[data-clock]").textContent = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(new Date()); }, 1000);
});
