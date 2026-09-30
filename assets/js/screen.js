// Big-screen mode for a venue TV: rotates through the divisions, shows live games,
// the table and the champions, and re-reads /data/fixtures.json every 30 seconds.
document.addEventListener("DOMContentLoaded", () => {
  const E = Donis.esc;
  const $ = (s) => document.querySelector(s);
  let data = null, idx = 0;

  const label = (div, ref) => {
    const t = (div.teams || []).find((x) => x.id === ref);
    if (!t) return { text: ref || "TBC", tbc: !ref };
    return t.name ? { text: t.name, tbc: false } : { text: "Team " + t.id.slice(-1), tbc: true };
  };
  const score = (f) => (f.homeScore == null ? "v" : `${E(f.homeScore)}&ndash;${E(f.awayScore)}`);

  function render() {
    if (!data) return;
    const ds = data.divisions.filter((d) => data.fixtures.some((f) => f.division === d.id) || d.message);
    const div = ds[idx % ds.length];
    const rows = data.fixtures.filter((f) => f.division === div.id).sort((a, b) => a.time.localeCompare(b.time));
    const live = data.fixtures.filter((f) => f.state === "live");
    $("[data-div-name]").textContent = div.name;
    $("[data-dots]").innerHTML = ds.map((d, i) => `<i class="${i === idx % ds.length ? "on" : ""}"></i>`).join("");
    const pill = $("[data-live]");
    pill.hidden = !live.length;

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
        <span class="mono tvg__meta">${E(f.time)}${f.stage ? " · " + E(f.stage) : ""}${f.state === "live" ? ' · <b class="acid">LIVE</b>' : f.state === "ft" ? " · FT" : ""}</span>
        <span class="tvg__line"><b class="${label(div, f.home).tbc ? "tbc" : ""}">${E(label(div, f.home).text)}</b><span class="tvg__score">${score(f)}</span><b class="${label(div, f.away).tbc ? "tbc" : ""}">${E(label(div, f.away).text)}</b></span>
      </div>`).join("") : `<p class="mono muted">${E(div.message || "Fixtures to follow.")}</p>`)
      + (more > 0 ? `<p class="mono muted">+ ${more} more on your phone</p>` : "");

    const tableHost = $("[data-table]");
    if (div.format === "round-robin") {
      const t = window.DonisStandings.standings(div.teams, rows);
      tableHost.innerHTML = `<table class="lt tvlt"><thead><tr><th>#</th><th class="lt__team">Team</th><th>P</th><th>GD</th><th>Pts</th></tr></thead><tbody>${t.map((r, i) => {
        const l = label(div, r.id);
        return `<tr class="${i === 0 && r.p > 0 ? "lead" : ""}"><td>${i + 1}</td><th class="lt__team ${l.tbc ? "tbc" : ""}">${E(l.text)}</th><td>${r.p}</td><td>${r.gd > 0 ? "+" : ""}${r.gd}</td><td><b>${r.pts}</b></td></tr>`;
      }).join("")}</tbody></table>`;
    } else {
      const next = data.fixtures.filter((f) => f.state === "scheduled").sort((a, b) => a.time.localeCompare(b.time))[0];
      const nd = next && data.divisions.find((d) => d.id === next.division);
      tableHost.innerHTML = next ? `<div class="tvnext"><span class="mono muted">Up next · ${E(nd.name)} · ${E(next.time)}</span><b class="display">${E(label(nd, next.home).text)}<i>v</i>${E(label(nd, next.away).text)}</b></div>` : "";
    }
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
  setInterval(load, 30000);
  setInterval(() => { if (data) { idx++; render(); } }, 12000);
  setInterval(() => { $("[data-clock]").textContent = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(new Date()); }, 1000);
});
