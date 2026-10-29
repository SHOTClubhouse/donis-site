document.addEventListener("DOMContentLoaded", async () => {
  const host = document.querySelector("[data-editions]");
  if (!host) return;
  try {
    const { editions } = await Donis.json("/data/editions.json");
    const upcoming = editions.filter((e) => e.id !== "london-26");
    host.insertAdjacentHTML("beforeend", upcoming.map((e) => `
      ${e.href ? `<a href="${Donis.esc(e.href)}" class="edition edition--soon rv" style="--ac:var(--${Donis.esc(e.colour)})">` : `<div class="edition edition--soon rv" style="--ac:var(--${Donis.esc(e.colour)})">`}
        <div class="edition__body">
          <span class="tag tag--soon">${e.status === "preview" ? "Event preview" : "Coming soon"}</span>
          <h3 class="gothic">${Donis.esc(e.name)}</h3>
          <p class="mono">${Donis.esc(e.when)} · ${Donis.esc(e.where)}</p>
        </div>
      ${e.href ? "</a>" : "</div>"}`).join(""));
    Donis.reveal();
  } catch (e) {
    // The London archive card is static HTML, so the page still works without the data file.
  }
});
