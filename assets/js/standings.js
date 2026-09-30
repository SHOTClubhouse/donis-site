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
  // Who has won a division, if anyone yet. A decided knockout final beats everything;
  // otherwise a fully played round robin crowns the table leader.
  function champion(div, fixtures) {
    const rows = fixtures.filter((f) => f.division === div.id);
    const fin = rows.find((f) => f.stage && /final/i.test(f.stage) && !/semi|third|3rd/i.test(f.stage));
    if (fin && fin.state === "ft" && fin.homeScore != null && Number(fin.homeScore) !== Number(fin.awayScore)) {
      return { ref: Number(fin.homeScore) > Number(fin.awayScore) ? fin.home : fin.away, how: "Won the final" };
    }
    if (fin) return null; // there is a final still to decide
    const group = rows.filter((f) => !f.stage);
    if (div.format === "round-robin" && group.length && group.every((f) => f.state === "ft")) {
      const t = standings(div.teams, group);
      if (t.length && t[0].p > 0) return { ref: t[0].id, how: "Top of the table" };
    }
    return null;
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { standings, champion };
  else root.DonisStandings = { standings, champion };
})(this);
