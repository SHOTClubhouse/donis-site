// London 26 overview, The Sound and Legends pages: everything factual renders from /data
// so there is one place to edit. Each block runs only if its page has the hook.
document.addEventListener("DOMContentLoaded", async () => {
  const E = Donis.esc;
  const $ = (s) => document.querySelector(s);
  let ev;
  try {
    ev = await Donis.json("/data/london-26.json");
  } catch (e) {
    document.querySelectorAll("[data-agenda],[data-desk],[data-legends]").forEach((n) => (n.innerHTML = '<p class="muted">Could not load event details. Refresh to try again.</p>'));
    return;
  }

  Donis.countdown($("[data-countdown]"), ev.doorsOpen);

  // Running order
  const typeTag = { football: ["Football", "tag--live"], legends: ["Legends", "tag--orange"], music: ["18+", "tag--orange"], info: ["Doors", ""] };
  const agenda = $("[data-agenda]");
  if (agenda) agenda.innerHTML = ev.agenda.map((a) => {
    const [label, cls] = typeTag[a.type] || ["", ""];
    return `<div class="agenda__row rv" data-type="${E(a.type)}">
      <span class="agenda__time">${E(a.start)}${a.end ? " &rarr; " + E(a.end) : ""}</span>
      <span class="agenda__title">${E(a.title)}</span>
      ${label ? `<span class="tag ${cls}">${label}</span>` : "<span></span>"}
    </div>`;
  }).join("");

  // Legends
  const legends = $("[data-legends]");
  if (legends) legends.innerHTML = ev.legends.map((l, i) => {
    const tagName = l.handle ? "a" : "div";
    const href = l.handle ? ` href="https://www.instagram.com/${E(l.handle)}/" rel="noopener"` : "";
    return `<${tagName} class="legend rv" data-kit="${E(l.kit)}"${href}>
      <span class="legend__no" aria-hidden="true">${i + 1}</span>
      <span class="mono">${l.note ? E(l.note) : "West Ham legend"}</span>
      <h3>${E(l.name).replace(" ", "<br>")}</h3>
      <span class="mono">${l.handle ? "@" + E(l.handle) : "&nbsp;"}</span>
    </${tagName}>`;
  }).join("");

  // The Sound: one channel strip per DJ
  const desk = $("[data-desk]");
  if (desk) {
    desk.innerHTML = ev.djs.map((d, i) => {
      const bars = Array.from({ length: 22 }, (_, k) => `<i style="animation-delay:${((k * 37 + i * 53) % 900) / 1000}s"></i>`).join("");
      const lit = 5 + ((i * 3) % 4);
      const meter = Array.from({ length: 10 }, (_, k) => `<i class="${k < lit ? "on" : ""} ${k >= 8 ? "hot" : ""}"></i>`).join("");
      return `<a class="strip" href="https://www.instagram.com/${E(d.handle)}/" rel="noopener" aria-label="${E(d.name)} on Instagram">
        <div class="strip__img"><img src="/assets/img/${E(d.image)}.webp" alt="${E(d.name)}" loading="lazy" width="300" height="290"></div>
        <div class="strip__label"><span class="ch">CH ${E(d.ch)}</span><span>${E(d.name)}</span></div>
        <div class="strip__body">
          <div class="wave" aria-hidden="true">${bars}</div>
          <div class="fader" style="--pos:${30 + ((i * 17) % 40)}%" aria-hidden="true"></div>
          <div class="meter" aria-hidden="true">${meter}</div>
        </div>
        <div class="strip__name"><span>${E(d.name)}</span><small>@${E(d.handle)}</small></div>
      </a>`;
    }).join("");
    // Everything plays at once when the desk scrolls into view, then settles to hover.
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([en]) => desk.classList.toggle("is-live", en.isIntersecting), { threshold: 0.4 }).observe(desk);
    }
  }

  // FAQ and venue
  const faq = $("[data-faq]");
  if (faq) faq.innerHTML = ev.faq.map((f) => `<details><summary>${E(f.q)}</summary><p>${E(f.a)}</p></details>`).join("");
  const address = $("[data-address]");
  if (address) address.textContent = ev.venue.addressConfirmed ? ev.venue.address : `${ev.venue.area} E20. Full address on your Eventbrite ticket.`;
  const parking = $("[data-parking]");
  if (parking) parking.textContent = ev.venue.parking;

  Donis.reveal();
});
