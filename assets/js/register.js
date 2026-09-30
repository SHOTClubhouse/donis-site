// Register page: tickets or team entry, validated with the same rules the API runs.
document.addEventListener("DOMContentLoaded", async () => {
  const E = Donis.esc;
  const form = document.getElementById("reg");
  let ev;
  try { ev = await Donis.json("/data/london-26.json"); } catch (e) {
    document.querySelector("[data-form-err]").textContent = "Could not load the event. Refresh to try again.";
    return;
  }

  const state = {
    type: new URLSearchParams(location.search).get("type") === "team" ? "team" : "ticket",
    attendees: [{ firstName: "", ageBand: "" }],
    players: [{ firstName: "", ageBand: "" }, { firstName: "", ageBand: "" }],
  };
  const MAX = ev.pricing.ticket.maxPerOrder;
  document.querySelector("[data-max]").textContent = MAX;
  document.querySelector("[data-refund-policy]").textContent = ev.refunds.policy;
  document.querySelector("#team-division").insertAdjacentHTML("beforeend", ev.divisions.map((d) => `<option value="${E(d.id)}">${E(d.name)} · ${E(d.window)}</option>`).join(""));
  if (Donis.demo) document.querySelector("[data-demo-note]").hidden = false;

  const bandOpts = (bands, sel) => `<option value="">Age</option>` + bands.map((b) => `<option value="${b}" ${b === sel ? "selected" : ""}>${b}</option>`).join("");


  function renderPeople() {
    document.querySelector("[data-attendees]").innerHTML = state.attendees.map((a, i) => `
      <div class="person">
        <div class="person__head"><span>Pass ${i + 1}</span></div>
        <div class="row3">
          <div class="field"><label for="a${i}-fn">First name</label><input id="a${i}-fn" data-list="attendees" data-i="${i}" data-k="firstName" value="${E(a.firstName)}" maxlength="40" autocomplete="${i === 0 ? "given-name" : "off"}"><div class="err" data-err="attendees.${i}.firstName"></div></div>
          <div class="field"><label for="a${i}-age">Age</label><select id="a${i}-age" data-list="attendees" data-i="${i}" data-k="ageBand">${bandOpts(DonisRules.AGE_BANDS, a.ageBand)}</select><div class="err" data-err="attendees.${i}.ageBand"></div></div>
        </div>
      </div>`).join("");
    document.getElementById("qty").textContent = state.attendees.length;

    const { min, max } = ev.squad;
    document.querySelector("[data-players]").innerHTML = state.players.map((p, i) => `
      <div class="person">
        <div class="person__head"><span>${i < 2 ? "Player " + (i + 1) : "Sub " + (i - 1)}</span>${i >= min ? `<button type="button" data-remove="${i}" aria-label="Remove sub">&times;</button>` : ""}</div>
        <div class="row3">
          <div class="field"><label for="p${i}-fn">First name</label><input id="p${i}-fn" data-list="players" data-i="${i}" data-k="firstName" value="${E(p.firstName)}" maxlength="40"><div class="err" data-err="players.${i}.firstName"></div></div>
          <div class="field"><label for="p${i}-age">Age</label><select id="p${i}-age" data-list="players" data-i="${i}" data-k="ageBand">${bandOpts(DonisRules.PLAYER_BANDS, p.ageBand)}</select><div class="err" data-err="players.${i}.ageBand"></div></div>
        </div>
      </div>`).join("");
    document.querySelector("[data-add-player]").hidden = state.players.length >= max;
  }

  function setType(t) {
    state.type = t;
    document.querySelectorAll(".seg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.type === t)));
    document.querySelectorAll("[data-for]").forEach((n) => (n.hidden = n.dataset.for !== t));
    document.querySelector("[data-buyer-title]").textContent = t === "team" ? "Team captain" : "Your details";
    history.replaceState(null, "", `?type=${t}`);
    clearErrors(); summary();
  }

  function payload() {
    const v = (n) => form.elements[n];
    const base = {
      type: state.type,
      buyer: { name: v("buyer.name").value, email: v("buyer.email").value, mobile: v("buyer.mobile").value, isAdult: v("buyer.isAdult").checked },
      consent: { terms: v("consent.terms").checked, filming: v("consent.filming").checked, marketing: v("consent.marketing").checked },
    };
    if (state.type === "ticket") return { ...base, attendees: state.attendees };
    return { ...base, team: { name: v("team.name").value, division: v("team.division").value }, players: state.players };
  }

  function summary() {
    const body = payload();
    const people = state.type === "ticket" ? state.attendees : state.players;
    const priced = DonisRules.priceOrder({ type: state.type, people }, ev);
    document.querySelector("[data-lines]").innerHTML = priced.lines.map((l) => `
      <div class="summary__line"><span>${E(l.label)} &times; ${l.qty}</span><span>${Donis.money(l.unitPence * l.qty)}</span></div>`).join("") +
      `<div class="summary__line muted"><span>${people.length} numbered pass${people.length === 1 ? "" : "es"}</span><span>Included</span></div>` +
      (state.type === "team" && body.team.name.trim() ? `<div class="summary__line muted"><span>${E(body.team.name.trim())}</span><span></span></div>` : "");
    document.querySelector("[data-total]").textContent = Donis.money(priced.totalPence);
  }

  function clearErrors() {
    form.querySelectorAll("[data-err]").forEach((n) => (n.textContent = ""));
    form.querySelectorAll(".has-err").forEach((n) => n.classList.remove("has-err"));
    document.querySelector("[data-form-err]").textContent = "";
  }

  function showErrors(errors) {
    clearErrors();
    let first = null;
    Object.entries(errors).forEach(([k, msg]) => {
      const slot = form.querySelector(`[data-err="${k}"]`);
      if (slot) { slot.textContent = msg; const f = slot.closest(".field"); if (f) f.classList.add("has-err"); first = first || slot; }
    });
    document.querySelector("[data-form-err]").textContent = "Check the highlighted fields.";
    const target = first && (first.closest(".field")?.querySelector("input,select") || first);
    if (target) { target.scrollIntoView({ behavior: "smooth", block: "center" }); if (target.focus) target.focus({ preventScroll: true }); }
  }

  // Events
  document.querySelector(".seg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setType(b.dataset.type); });
  document.querySelector(".stepper").addEventListener("click", (e) => {
    const b = e.target.closest("[data-step]"); if (!b) return;
    const n = state.attendees.length + Number(b.dataset.step);
    if (n < 1 || n > MAX) return;
    if (n > state.attendees.length) state.attendees.push({ firstName: "", ageBand: "" }); else state.attendees.pop();
    renderPeople(); summary();
  });
  document.querySelector("[data-add-player]").addEventListener("click", () => {
    if (state.players.length < ev.squad.max) { state.players.push({ firstName: "", ageBand: "" }); renderPeople(); summary(); }
  });
  form.addEventListener("click", (e) => {
    const r = e.target.closest("[data-remove]"); if (!r) return;
    state.players.splice(Number(r.dataset.remove), 1); renderPeople(); summary();
  });
  form.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.list) state[t.dataset.list][Number(t.dataset.i)][t.dataset.k] = t.value;
    summary();
  });

  let busy = false;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return; // stops double charges from rapid taps
    const body = payload();
    const check = DonisRules.validateOrder(body, ev);
    if (!check.ok) { showErrors(check.errors); return; }

    const btn = document.querySelector("[data-submit]");
    busy = true; btn.setAttribute("aria-disabled", "true"); btn.firstChild.textContent = "Taking you to payment ";
    try {
      if (Donis.demo) {
        const order = demoOrder(check.order);
        Donis.store.set("donis:order:" + order.id, order);
        location.href = "/pass/?demo=" + encodeURIComponent(order.id);
        return;
      }
      const { url } = await Donis.api("/api/checkout", { method: "POST", body: JSON.stringify(body) });
      location.href = url;
    } catch (err) {
      if (err.body && err.body.errors) showErrors(err.body.errors);
      else document.querySelector("[data-form-err]").textContent = navigator.onLine ? "Payment could not start. Try again in a moment." : "You're offline. Reconnect and try again.";
      busy = false; btn.removeAttribute("aria-disabled"); btn.firstChild.textContent = "Pay and get passes ";
    }
  });

  // Preview mode only: builds passes locally so the journey can be walked end to end.
  function demoOrder(order) {
    const seq = (Donis.store.get("donis:seq") || 0) + 1;
    const people = order.people.map((p, i) => ({
      ...p,
      passNumber: DonisRules.passNumber(ev.passPrefix, seq * 10 + i),
      passId: "demo-" + Math.random().toString(36).slice(2, 10),
    }));
    Donis.store.set("donis:seq", seq);
    return { id: "demo-" + Date.now().toString(36), demo: true, type: order.type, team: order.team, buyer: { name: order.buyer.name, email: order.buyer.email }, people, total: DonisRules.priceOrder(order, ev).totalPence, created: new Date().toISOString() };
  }

  renderPeople(); setType(state.type);
});
