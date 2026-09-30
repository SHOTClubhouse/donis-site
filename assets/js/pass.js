// Pass page. Sources, in order: a Stripe return (?session_id), a direct pass link
// (?p=&t=), a preview order (?demo=), or passes already saved on this device.
// The Donis pass (signed gate QR) is what gets people in. The Sport Head ID panel is the
// portable identity layer: it's never treated as proof of entry.
document.addEventListener("DOMContentLoaded", async () => {
  const E = Donis.esc;
  const C = Donis.config;
  const SH = window.DonisSporthead;
  const q = new URLSearchParams(location.search);
  const $ = (s) => document.querySelector(s);
  const sub = $("[data-sub]");

  const kitShadow = ["", "pcard--teal", "pcard--pink", "pcard--claret"];

  function qrSvg(text) {
    if (typeof qrcode !== "function") return `<span class="mono" style="color:#0a0a0a">${E(text)}</span>`;
    const qr = qrcode(0, "M"); qr.addData(text); qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  }

  function card(p, i, order) {
    const role = p.role === "player" ? ["Player", "pcard__badge--team"] : ["Guest", "pcard__badge--guest"];
    const qrText = p.verifyUrl || `DONIS:${p.passNumber}:${order.demo ? "PREVIEW" : p.passId}`;
    const linked = p.claimStatus === "claimed";
    return `<article class="pcard pcard--real ${kitShadow[i % 4]}" aria-label="Pass ${E(p.passNumber)}">
      <div class="pcard__top"><img src="/assets/brand/donis-wordmark-white.png" alt="Donis" width="120" height="34"><span class="mono">London 26</span></div>
      <div class="pcard__name">${E(p.firstName)}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <span class="pcard__badge ${role[1]}">${role[0]}</span>
        ${order.team ? `<span class="pcard__badge">${E(order.team.name)}</span>` : ""}
        ${p.ageBand ? `<span class="pcard__badge pcard__badge--guest">${E(p.ageBand)}</span>` : ""}
        ${p.ageBand && p.ageBand !== "18+" ? `<span class="pcard__badge pcard__badge--guest">Out by 8pm</span>` : ""}
      </div>
      <div class="pcard__qr">${qrSvg(qrText)}</div>
      <div class="pcard__num display" style="font-size:44px;text-align:center">${E(p.passNumber)}</div>
      <div class="pcard__row mono"><span>Sat 03.10.26</span><span>Doors 10:30</span></div>
      <div class="pcard__row mono"><span>Riverside East</span><span>Stratford E20</span></div>
      <div class="pcard__foot mono"><span>${order.demo ? "Preview pass · not valid for entry" : linked ? "On Sport Head ID · @" + E(p.sportheadHandle || "") : "Gate pass"}</span><img src="/assets/brand/shot-logo.png" alt="SHOT" width="30" height="20"></div>
    </article>`;
  }

  function previewPanel() {
    return `<div class="sh__preview" aria-label="Preview of the Sport Head ID pass">
      <span class="mono acid">Preview</span>
      <div class="who"><div class="av"></div><div><b class="display" style="font-size:22px">@yourhandle</b><div class="mono muted" style="font-size:11px">Football Sport Head</div></div></div>
      <div class="qr">Live code<br>refreshes every 5s</div>
      <p class="muted" style="margin:0;font-size:13px">Once payments are live, this is where your pass from sporthead.id appears. It's the same live pass you see on sporthead.id/pass.</p>
    </div>`;
  }

  function sportHead(order) {
    const box = $("[data-sh]"), actions = $("[data-sh-actions]"), panel = $("[data-sh-panel]"), msg = $("[data-sh-msg]");
    box.hidden = false;
    const only = order.people.length === 1 ? order.people[0] : null;

    if (order.demo) {
      actions.innerHTML = `<button class="btn btn--acid" type="button" disabled aria-disabled="true">Add to my Sport Head ID</button>`;
      panel.innerHTML = previewPanel();
      return;
    }
    // A whole order (straight after payment): each person links their own pass, since a
    // pass binds to one Sport Head. Send them to their own pass link.
    if (!only) {
      $("[data-sh-copy]").textContent = "Each pass links to one person's Sport Head ID. Open each pass from your email (or forward it to its holder) and add it from there.";
      panel.innerHTML = previewPanel().replace("Preview", "How it looks");
      return;
    }
    if (!DonisRules.canLinkSporthead(only.ageBand)) {
      $("[data-sh-copy]").textContent = "Sport Head ID linking is 16+ for London 26. This pass still gets you in, and it unlocks the Donis Clubhouse below.";
      panel.innerHTML = "";
      return;
    }
    if (only.claimStatus === "claimed" && only.credentialId) {
      $("[data-sh-copy]").textContent = `On @${only.sportheadHandle}'s Sport Head ID. It's also on sporthead.id/pass, wherever you sign in.`;
      actions.innerHTML = `<a class="btn btn--ghost btn--sm" href="${E(C.sportheadId)}/pass/" rel="noopener">Open on sporthead.id</a>`;
      SH.mountPass(panel, { cid: only.credentialId, claims: { handle: only.sportheadHandle } });
      return;
    }
    actions.innerHTML = `
      <button class="btn btn--acid" type="button" data-sh-go>Add to my Sport Head ID <span class="arrow">&rarr;</span></button>
      <span class="mono muted" style="font-size:11px;align-self:center">No Sport Head yet? You can make one on the next screen. It's free.</span>`;
    panel.innerHTML = previewPanel().replace("Preview", "How it looks");
    $("[data-sh-go]").addEventListener("click", async (e) => {
      e.currentTarget.setAttribute("aria-disabled", "true");
      try { await SH.startSignIn({ p: only.passId, t: only.token }); }
      catch (err) { msg.textContent = err.message; e.currentTarget.removeAttribute("aria-disabled"); }
    });
    if (q.get("sh") === "error") msg.textContent = q.get("m") || "That didn't link. Try again.";
  }

  function render(order) {
    $("[data-passes]").innerHTML = order.people.map((p, i) => card(p, i, order)).join("");
    const n = order.people.length;
    sub.textContent = order.team
      ? `${order.team.name} is in. ${n} player passes are below, one per player. Forward each one to its player.`
      : order.buyer.email
        ? `You're in. ${n === 1 ? "Your pass is" : n + " passes are"} below and in your inbox at ${order.buyer.email}.`
        : "Your London 26 pass. Show it at the gate.";

    sportHead(order);
    $("[data-code]").textContent = C.clubhouseCode;
    $('[data-app="ios"]').href = C.appStore;
    $('[data-app="android"]').href = C.playStore;
    $('[data-app="web"]').href = C.clubhouseWeb;
    $("[data-next]").hidden = false;

    // Remember holder status on this device so cap drops unlock without logging in.
    const saved = Donis.store.get("donis:passes") || [];
    order.people.forEach((p) => { if (!saved.some((s) => s.passNumber === p.passNumber)) saved.push({ passNumber: p.passNumber, passId: p.passId, token: p.token || null, demo: !!order.demo }); });
    Donis.store.set("donis:passes", saved);
    Donis.reveal();
  }

  function empty(msg) {
    $("[data-title]").innerHTML = 'No pass<br><span class="orange">yet</span>';
    sub.innerHTML = `${E(msg)} <a href="/london-26/register/" class="acid">Get yours</a>.`;
  }

  try {
    if (q.get("demo")) {
      const order = Donis.store.get("donis:order:" + q.get("demo"));
      if (!order) return empty("That preview pass isn't on this device.");
      $("[data-kicker]").textContent = "Preview pass";
      return render(order);
    }
    if (q.get("session_id") && !Donis.demo) {
      // The webhook usually lands within a second or two of the redirect. Poll briefly.
      for (let i = 0; i < 12; i++) {
        try {
          const order = await Donis.api("/api/order?session_id=" + encodeURIComponent(q.get("session_id")));
          if (order.status === "paid") return render(order);
        } catch (e) { if (e.status && e.status !== 404) throw e; }
        sub.textContent = "Confirming your payment…";
        await new Promise((r) => setTimeout(r, 1500));
      }
      return empty("Payment is still confirming. Your passes will arrive by email in the next few minutes.");
    }
    if (q.get("p") && q.get("t") && !Donis.demo) {
      const order = await Donis.api(`/api/pass?p=${encodeURIComponent(q.get("p"))}&t=${encodeURIComponent(q.get("t"))}`);
      return render(order);
    }
    const saved = Donis.store.get("donis:passes") || [];
    if (saved.length) {
      sub.innerHTML = `This device holds ${saved.length} pass${saved.length === 1 ? "" : "es"}: ${saved.map((s) => E(s.passNumber)).join(", ")}. Open the link in your email to see the full pass.`;
      return;
    }
    empty("You don't have a pass on this device.");
  } catch (e) {
    empty("We couldn't load that pass. Check the link in your email.");
  }
});
