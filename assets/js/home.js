document.addEventListener("DOMContentLoaded", async () => {
  const host = document.querySelector("[data-editions]");
  if (!host) return;
  try {
    const { editions } = await Donis.json("/data/editions.json");
    const soon = editions.filter((e) => e.status === "soon");
    host.insertAdjacentHTML("beforeend", soon.map((e) => `
      <div class="edition edition--soon rv" style="--ac:var(--${Donis.esc(e.colour)})">
        <div class="edition__body">
          <span class="tag tag--soon">Coming soon</span>
          <h3 class="gothic">${Donis.esc(e.name)}</h3>
          <p class="mono">${Donis.esc(e.when)} · ${Donis.esc(e.where)}</p>
        </div>
      </div>`).join(""));
    Donis.reveal();
  } catch (e) {
    // The live London card is static HTML, so the page still works without the data file.
  }
});
