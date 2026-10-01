// Donis Clubhouse pre-registration. The site has no server, so the form posts to a Make
// webhook (config.joinHook) that stores each sign-up in a Make data store, keyed by email.
(function (root) {
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  // What a person types into a phone box: digits, spaces, +, brackets, dashes. 7 to 15 digits.
  const phoneOk = (v) => /^[\d\s+()-]+$/.test(v) && (v.match(/\d/g) || []).length >= 7 && (v.match(/\d/g) || []).length <= 15;

  function check(f) {
    const v = (k) => (typeof f[k] === "string" ? f[k].trim() : "");
    const errs = {};
    if (!v("name")) errs.name = "Add your name.";
    else if (v("name").length > 120) errs.name = "That name is too long.";
    if (!phoneOk(v("phone"))) errs.phone = "Add a mobile number we can reach you on.";
    if (!EMAIL.test(v("email"))) errs.email = "Add a valid email address.";
    if (!v("sport")) errs.sport = "Tell us your sport.";
    else if (v("sport").length > 60) errs.sport = "Keep it short.";
    if (f.over13 !== true) errs.over13 = "The Clubhouse is for people aged 13 and over.";
    if (f.consent !== true) errs.consent = "Tick this so we can tell you when it opens.";
    return errs;
  }

  if (typeof module !== "undefined" && module.exports) { module.exports = { check }; return; }

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("[data-join]");
    if (!form) return;
    const msg = form.querySelector("[data-join-msg]");
    const done = document.querySelector("[data-join-done]");
    const btn = form.querySelector('button[type="submit"]');
    const say = (t) => { msg.textContent = t; msg.hidden = !t; };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const f = { name: fd.get("name"), phone: fd.get("phone"), email: fd.get("email"), sport: fd.get("sport"),
        over13: form.over13.checked, consent: form.consent.checked };
      form.querySelectorAll("[aria-invalid]").forEach((n) => n.removeAttribute("aria-invalid"));
      const errs = check(f);
      const first = Object.keys(errs)[0];
      if (first) {
        const el = form.elements[first];
        el.setAttribute("aria-invalid", "true");
        el.focus();
        say(errs[first]);
        return;
      }
      if (fd.get("website")) { form.hidden = true; done.hidden = false; return; } // a bot filled the hidden field
      btn.disabled = true;
      say("Sending…");
      const body = new URLSearchParams({ name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim(), sport: f.sport.trim(),
        over13: "true", consent: "true", website: "", source: location.pathname });
      try {
        const res = await fetch(window.DONIS_CONFIG.joinHook, { method: "POST", body });
        if (!res.ok) throw new Error(String(res.status));
        form.hidden = true;
        done.hidden = false;
        done.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch (err) {
        btn.disabled = false;
        say("That didn't go through. Check your connection and try again.");
      }
    });
  });
})(this);
