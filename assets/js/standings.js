// League table for a round-robin division. Only full-time results count.
// Win 3, draw 1, loss 0. Sorted by points, goal difference, goals scored, then slot order.
(function (root) {
  function standings(teams, fixtures) {
    const rows = teams.map((t, i) => ({ id: t.id, name: t.name, slot: i, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 }));
    const by = Object.fromEntries(rows.map((r) => [r.id, r]));
    fixtures.forEach((f) => {
      if (f.stage) return; // knockout games are not part of the group table
      if (f.state !== "ft" || f.homeScore == null || f.awayScore == null) return;
      const h = by[f.home], a = by[f.away];
      if (!h || !a) return;
      const hs = Number(f.homeScore), as = Number(f.awayScore);
      h.p++; a.p++; h.gf += hs; h.ga += as; a.gf += as; a.ga += hs;
      if (hs > as) { h.w++; a.l++; h.pts += 3; }
      else if (hs < as) { a.w++; h.l++; a.pts += 3; }
      else { h.d++; a.d++; h.pts++; a.pts++; }
    });
    rows.forEach((r) => (r.gd = r.gf - r.ga));
    return rows.sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.slot - y.slot);
  }
  // Which side won a full-time game: the higher score, or the penalty winner when level.
  function winnerOf(f) {
    if (!f || f.state !== "ft" || f.homeScore == null || f.awayScore == null) return null;
    const h = Number(f.homeScore), a = Number(f.awayScore);
    if (h !== a) return h > a ? "home" : "away";
    return f.pens === "home" || f.pens === "away" ? f.pens : null;
  }

  // Knockout sides fill themselves in from the scores, so the scorer only ever enters results.
  // "1st Group A" becomes a team once every game in group A is full time; "Winner Semi-final 1"
  // once that game is decided. A place that is level on points, goal difference and goals
  // scored is never guessed: it stays a placeholder for the organisers to pick on the scorer page.
  const PLACES = { "1st": 0, "2nd": 1, "3rd": 2, "4th": 3 };
  function resolve(div, fixtures, ref, depth) {
    const teams = div.teams || [];
    if (teams.some((t) => t.id === ref)) return ref;
    if (typeof ref !== "string" || (depth || 0) > 4) return null;
    const rows = fixtures.filter((f) => f.division === div.id);
    let m = ref.match(/^(1st|2nd|3rd|4th) (?:in table|Group (\S+))$/i);
    if (m) {
      const pos = PLACES[m[1].toLowerCase()];
      const pool = m[2] ? teams.filter((t) => String(t.group).toLowerCase() === m[2].toLowerCase()) : teams;
      const ids = new Set(pool.map((t) => t.id));
      const games = rows.filter((f) => !f.stage && ids.has(f.home) && ids.has(f.away));
      if (!games.length || games.some((f) => f.state !== "ft") || pos >= pool.length) return null;
      const t = standings(pool, games);
      const same = (x, y) => x && y && x.pts === y.pts && x.gd === y.gd && x.gf === y.gf;
      return same(t[pos], t[pos - 1]) || same(t[pos], t[pos + 1]) ? null : t[pos].id;
    }
    m = ref.match(/^(Winner|Loser) (.+)$/i);
    if (m) {
      const g = rows.find((f) => f.stage && f.stage.toLowerCase() === m[2].toLowerCase());
      const w = winnerOf(g);
      if (!w) return null;
      const side = (m[1].toLowerCase() === "winner") === (w === "home") ? g.home : g.away;
      return resolve(div, fixtures, side, (depth || 0) + 1);
    }
    return null;
  }

  // Who has won a division, if anyone yet. A decided knockout final beats everything;
  // otherwise a fully played round robin crowns the table leader.
  function champion(div, fixtures) {
    const rows = fixtures.filter((f) => f.division === div.id);
    const fin = rows.find((f) => f.stage && /final/i.test(f.stage) && !/semi|third|3rd/i.test(f.stage));
    const w = winnerOf(fin);
    if (w) {
      const ref = w === "home" ? fin.home : fin.away;
      const level = Number(fin.homeScore) === Number(fin.awayScore);
      return { ref: resolve(div, fixtures, ref) || ref, how: level ? "Won the final on penalties" : "Won the final" };
    }
    if (fin) return null; // there is a final still to decide
    const group = rows.filter((f) => !f.stage);
    if (div.format === "round-robin" && group.length && group.every((f) => f.state === "ft")) {
      const t = standings(div.teams, group);
      if (t.length && t[0].p > 0) return { ref: t[0].id, how: "Top of the table" };
    }
    return null;
  }

  const api = { standings, champion, resolve, winnerOf };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DonisStandings = api;
})(this);
