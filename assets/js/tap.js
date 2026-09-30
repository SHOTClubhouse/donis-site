// Cap tap landing. Each NFC cap is written with /tap/?c=CAP-001 ... CAP-200.
// The teaser is public; the exclusive link only ever comes from the API for a valid pass.
document.addEventListener("DOMContentLoaded", async () => {
  const E = Donis.esc;
  const raw = new URLSearchParams(location.search).get("c") || "";
  const m = /^CAP-(\d{1,3})$/i.exec(raw.trim());
  const box = document.querySelector("[data-drop]");
  let data;
  try { data = await Donis.json("/data/drops.json"); } catch (e) { box.innerHTML = '<div class="drop__body"><p class="muted">Could not load this drop. Try tapping again.</p></div>'; return; }

  const run = data.series.run;
  const n = m ? Number(m[1]) : 0;
  if (!m || n < 1 || n > run) {
    document.querySelector("[data-no]").innerHTML = `???<small>/${run}</small>`;
    box.innerHTML = `<div class="drop__body"><p class="muted">This cap code isn't recognised. Tap the cap again, holding your phone flat against the logo.</p></div>`;
    return;
  }
  document.querySelector("[data-no]").innerHTML = `${String(n).padStart(3, "0")}<small>/${run}</small>`;
  document.querySelector("[data-series]").textContent = `${data.series.edition} edition · cap ${String(n).padStart(3, "0")}`;

  // Caps rotate through the drops so a crew wearing different caps unlock different things.
  const drop = data.drops[(n - 1) % data.drops.length];
  const passes = Donis.store.get("donis:passes") || [];
  const holder = passes.find((p) => !p.demo && p.token) || passes[0];

  let unlocked = null;
  if (holder && !Donis.demo && holder.token) {
    try { unlocked = await Donis.api(`/api/drop?c=CAP-${n}&p=${encodeURIComponent(holder.passId)}&t=${encodeURIComponent(holder.token)}`); } catch (e) { unlocked = null; }
  }
  if (!Donis.demo) Donis.api(`/api/tap`, { method: "POST", body: JSON.stringify({ cap: `CAP-${n}` }) }).catch(() => {});

  const lock = `<svg width="28" height="32" viewBox="0 0 28 32" aria-hidden="true"><rect x="2" y="14" width="24" height="16" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 14V9a7 7 0 0114 0v5" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
  const safe = unlocked && /^https:\/\//i.test(unlocked.url || "") ? unlocked.url : null;
  const body = safe
    ? `<a class="btn btn--acid" href="${E(safe)}" rel="noopener">Open the drop <span class="arrow">&rarr;</span></a>`
    : holder && holder.demo
      ? `<div class="drop__locked">${lock}<p><b>Preview pass found.</b> In the live Clubhouse this unlocks straight away.</p></div>`
      : `<div class="drop__locked">${lock}<p>Pass holders only.</p><a class="btn btn--orange btn--sm" href="/london-26/register/">Get your pass</a><a class="mono muted" href="/pass/" style="padding:10px">I have a pass</a></div>`;

  box.innerHTML = `
    <div class="drop__head"><span class="mono acid">${E(drop.kind)}</span><span class="mono muted">From ${E(drop.from)}</span></div>
    <div class="drop__body">
      <h2 class="display h-md" style="margin:0">${E(drop.title)}</h2>
      <p class="muted" style="margin:0">${E(drop.teaser)}</p>
      ${body}
    </div>`;
});
