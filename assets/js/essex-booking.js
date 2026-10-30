// Illustrative ticket totals only. No checkout request, storage or reservation.
document.addEventListener("DOMContentLoaded", () => {
  const quantity = document.getElementById("ticket-quantity");
  const button = document.querySelector("[data-payment-preview]");
  const preview = document.getElementById("payment-preview");
  if (!quantity || !button || !preview) return;
  // The price changes at midnight UK time on 1 December (GMT).
  const early = Date.now() < Date.parse("2026-12-01T00:00:00Z");
  const price = early ? 15 : 20;
  const update = () => {
    const count = Number(quantity.value);
    document.querySelector("[data-ticket-summary]").textContent = `${count} ${early ? "early bird" : "standard"} ticket${count === 1 ? "" : "s"} × £${price}`;
    document.querySelector("[data-ticket-total]").textContent = `£${count * price}`;
  };
  quantity.addEventListener("change", update);
  button.addEventListener("click", () => {
    preview.hidden = false;
    button.setAttribute("aria-expanded", "true");
    preview.focus();
  });
  update();
});
