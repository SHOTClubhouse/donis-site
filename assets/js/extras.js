// Partners and the giveaway, from data/london-26.json, so Donis's logos drop in with one data
// edit and a deploy. Nothing shows until the data exists. (The live stream is in the scores feed.)
(function (root) {
  // Only plain web links from our own data; anything else is ignored rather than rendered.
  const safeUrl = (u) => (typeof u === "string" && /^https:\/\/[^\s"'<>]+$/.test(u) ? u : null);
  const sponsorsOf = (ev) => ((ev && ev.sponsors) || []).filter((s) => s && typeof s.name === "string" && s.name.trim());

  if (typeof module !== "undefined" && module.exports) { module.exports = { safeUrl, sponsorsOf }; return; }

  document.addEventListener("DOMContentLoaded", async () => {
    const E = Donis.esc;
    let ev;
    try { ev = await Donis.json("/data/london-26.json"); } catch (e) { return; }
    const sp = sponsorsOf(ev);
    const mark = (s, cls) => {
      const logo = s.logo && /^\/assets\/[\w/.-]+$/.test(s.logo) ? s.logo : null;
      return logo ? `<img class="${cls}__logo" src="${E(logo)}" alt="${E(s.name)}" loading="lazy">` : `<span class="${cls}__word">${E(s.name)}</span>`;
    };
    const wrap = (s, inner) => (safeUrl(s.url) ? `<a href="${E(safeUrl(s.url))}" rel="noopener" target="_blank">${inner}</a>` : inner);

    document.querySelectorAll("[data-sponsor-strip]").forEach((host) => {
      if (!sp.length) { host.hidden = true; return; }
      host.innerHTML = `<span class="mono spx__label">Supported by</span>` + sp.map((s) => wrap(s, mark(s, "spx"))).join("");
      host.hidden = false;
    });

    const page = document.querySelector("[data-sponsors]");
    if (page) {
      page.innerHTML = sp.length ? sp.map((s) => `
        <article class="spcard rv">
          <div class="spcard__mark">${mark(s, "spcard")}</div>
          <div class="spcard__body">
            <span class="mono orange">${E(s.role || "Partner")}</span>
            <h2 class="${s.logo ? "display h-sm" : "sr-only"}">${E(s.name)}</h2>
            ${s.blurb ? `<p class="muted">${E(s.blurb)}</p>` : ""}
            ${safeUrl(s.url) ? `<a class="btn btn--ghost btn--sm" href="${E(safeUrl(s.url))}" rel="noopener" target="_blank">Visit ${E(s.name)} <span class="arrow">&rarr;</span></a>` : ""}
          </div>
        </article>`).join("") : `<p class="muted">Partners to be announced.</p>`;
      Donis.reveal();
    }

    const gv = ev.giveaway;
    document.querySelectorAll("[data-giveaway]").forEach((host) => {
      if (!gv || !gv.prize) { host.hidden = true; return; }
      host.innerHTML = `<span class="mono giveaway__label">${E(gv.label || "Giveaway")}</span>
        <b class="display giveaway__prize">${E(gv.prize)}</b>
        <p class="giveaway__how">${E([gv.how, gv.when].filter(Boolean).join(" "))}</p>`;
      host.hidden = false;
    });

  });
})(this);
