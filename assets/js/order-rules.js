// One set of order rules for the browser form and the API. The API re-runs these on
// every request and prices from its own copy of the event data, so nothing the browser
// sends about price or eligibility is trusted.
// Donis London 26 is 13+ for the day and 18+ for the afterparty from 8pm. The payer is
// 18+ and is the parent or guardian of anyone under 18 on the booking. Players are 16+.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DonisRules = api;
})(typeof self !== "undefined" ? self : this, function () {
  const AGE_BANDS = ["13-15", "16-17", "18+"];
  // Players in the cage must be 16+ (Donis to confirm); spectators can be 13+.
  const PLAYER_BANDS = ["16-17", "18+"];
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const clean = (v, max) =>
    String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, max);

  function validateOrder(input, event) {
    const errors = {};
    const src = input && typeof input === "object" ? input : {};
    const type = src.type === "team" ? "team" : src.type === "ticket" ? "ticket" : null;
    if (!type) return { ok: false, errors: { type: "Choose tickets or team entry." } };

    const buyerIn = src.buyer || {};
    const buyer = {
      name: clean(buyerIn.name, 80),
      email: clean(buyerIn.email, 120).toLowerCase(),
      mobile: clean(buyerIn.mobile, 24),
      isAdult: buyerIn.isAdult === true,
    };
    if (buyer.name.length < 2) errors["buyer.name"] = "Add your full name.";
    if (!EMAIL.test(buyer.email)) errors["buyer.email"] = "Add a valid email. Your passes go here.";
    if (!buyer.isAdult) errors["buyer.isAdult"] = "The person paying must be 18 or over. Under-18s need a parent or guardian to book.";

    const consent = {
      terms: (src.consent || {}).terms === true,
      filming: (src.consent || {}).filming === true,
      marketing: (src.consent || {}).marketing === true,
    };
    if (!consent.terms) errors["consent.terms"] = "Please accept the terms to continue.";
    if (!consent.filming) errors["consent.filming"] = "Please confirm you know the day is filmed.";

    const order = { type, event: event.id, buyer, consent, people: [] };
    const list = type === "ticket" ? src.attendees : src.players;
    const key = type === "ticket" ? "attendees" : "players";
    const people = Array.isArray(list) ? list : [];

    if (type === "ticket") {
      const max = event.pricing.ticket.maxPerOrder;
      if (people.length < 1) errors.attendees = "Add at least one person.";
      if (people.length > max) errors.attendees = `Up to ${max} tickets per order.`;
    } else {
      const t = src.team || {};
      order.team = { name: clean(t.name, 40), division: t.division };
      if (order.team.name.length < 2) errors["team.name"] = "Give your team a name.";
      if (!event.divisions.some((d) => d.id === order.team.division)) errors["team.division"] = "Choose a division.";
      if (!/^[+0-9 ()-]{7,24}$/.test(buyer.mobile)) errors["buyer.mobile"] = "Add a mobile number for matchday.";
      const { min, max } = event.squad;
      if (people.length < min || people.length > max) errors.players = `A squad is ${min} to ${max} players.`;
    }

    const cap = type === "ticket" ? event.pricing.ticket.maxPerOrder : event.squad.max;
    const bands = type === "ticket" ? AGE_BANDS : PLAYER_BANDS;
    people.slice(0, cap).forEach((a, i) => {
      const p = { firstName: clean(a && a.firstName, 40), ageBand: a && a.ageBand, role: type === "ticket" ? "guest" : "player" };
      if (p.firstName.length < 1) errors[`${key}.${i}.firstName`] = "Add a first name.";
      if (!bands.includes(p.ageBand)) errors[`${key}.${i}.ageBand`] = type === "ticket" ? "Choose an age group. The event is 13+." : "Players must be 16 or over.";
      order.people.push({ firstName: p.firstName, ageBand: bands.includes(p.ageBand) ? p.ageBand : null, role: p.role });
    });

    const ok = Object.keys(errors).length === 0;
    return ok ? { ok, order } : { ok, errors };
  }

  function priceOrder(order, event) {
    const P = event.pricing;
    if (order.type === "ticket") {
      const qty = order.people.length;
      return { currency: P.currency, lines: [{ label: `${event.edition} · ${P.ticket.label}`, unitPence: P.ticket.pence, qty }], totalPence: P.ticket.pence * qty };
    }
    return { currency: P.currency, lines: [{ label: `${event.edition} · ${P.team.label}`, unitPence: P.team.pence, qty: 1 }], totalPence: P.team.pence };
  }

  // Sport Head ID linking for London 26 is 16+. Under-16s keep a pass that works at the
  // gate, but nothing is issued to a Sport Head ID for them: the guardian-consent route
  // isn't built for this edition.
  function canLinkSporthead(ageBand) {
    return ageBand === "16-17" || ageBand === "18+";
  }

  function passNumber(prefix, seq) {
    return `${prefix}-${String(seq).padStart(4, "0")}`;
  }

  return { AGE_BANDS, PLAYER_BANDS, validateOrder, priceOrder, canLinkSporthead, passNumber, clean };
});
