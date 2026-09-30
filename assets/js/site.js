// Shared chrome and helpers for every Donis Clubhouse page.
(function () {
  const C = window.DONIS_CONFIG || {};
  const D = (window.Donis = {});

  D.demo = !C.apiBase;
  D.config = C;

  D.esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  D.money = (pence) => "£" + (pence / 100).toFixed(pence % 100 === 0 ? 0 : 2);

  D.json = async (path) => {
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error(path + " " + res.status);
    return res.json();
  };

  D.api = async (path, opts = {}) => {
    const res = await fetch(C.apiBase.replace(/\/$/, "") + path, {
      ...opts,
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(body.error || "Request failed"), { status: res.status, body });
    return body;
  };

  // Live scores come from the scores feed. The copy bundled with the site is only used if
  // the feed has never loaded on this visit, so a blip never swaps live scores for stale ones.
  let scoresSeen = false;
  D.scores = async () => {
    const feed = C.scores && C.scores.feed;
    if (feed) {
      try { const d = await D.json(`${feed.replace(/\/$/, "")}/fixtures.json`); scoresSeen = true; return d; }
      catch (e) { if (scoresSeen) throw e; }
    }
    return D.json("/data/fixtures.json");
  };

  // Browser storage can throw (private mode, blocked site data). Never let it break a page.
  D.store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  };

  const edition = [
    ["/london-26/", "Overview"],
    ["/london-26/games/", "Games"],
    ["/london-26/the-sound/", "The Sound"],
    ["/london-26/legends/", "Legends"],
  ];
  const links = [["/london-26/", "London 26"], ...edition.slice(1), ["/#merch", "Merch"]];

  // Tab strip across the London 26 pages, so the next page is one tap away on a phone
  // where the main nav sits behind the menu button.
  function renderEditionNav() {
    const host = document.querySelector("[data-edition-nav]");
    if (!host) return;
    host.outerHTML = `<nav class="ednav" aria-label="London 26"><div class="wrap ednav__in">
      <span class="mono ednav__label">London 26</span>
      ${edition.map(([h, t]) => `<a href="${h}" ${h === location.pathname ? 'aria-current="page"' : ""}>${t}</a>`).join("")}
    </div></nav>`;
  }

  function renderNav() {
    const host = document.querySelector("[data-nav]");
    if (!host) return;
    const here = location.pathname;
    host.outerHTML = `
      <a class="skip" href="#main">Skip to content</a>
      <header class="nav">
        <div class="wrap nav__in">
          <a class="nav__brand" href="/" aria-label="Donis Clubhouse home">
            <img class="wm" src="/assets/brand/donis-wordmark-white.png" alt="Donis" width="98" height="28">
            <span class="x">&times;</span>
            <img class="shot" src="/assets/brand/shot-logo.png" alt="SHOT" width="34" height="22">
          </a>
          <button class="nav__toggle" aria-expanded="false" aria-controls="nav-links" aria-label="Menu">
            <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true"><path d="M0 1h20M0 7h20M0 13h20" stroke="currentColor" stroke-width="2"/></svg>
          </button>
          <nav class="nav__links" id="nav-links" aria-label="Main">
            ${links.map(([h, t]) => `<a href="${h}" ${h === here ? 'aria-current="page"' : ""}>${t}</a>`).join("")}
            <a class="btn btn--orange btn--sm" href="${C.eventbrite}" target="_blank" rel="noopener">Get tickets</a>
          </nav>
        </div>
      </header>`;
    const btn = document.querySelector(".nav__toggle");
    const nav = document.getElementById("nav-links");
    btn.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", String(open));
    });
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) nav.classList.remove("is-open"); });
  }

  function renderFooter() {
    const host = document.querySelector("[data-footer]");
    if (!host) return;
    host.outerHTML = `
      <footer class="foot">
        <div class="wrap">
          <div class="foot__grid">
            <div>
              <img src="/assets/brand/donis-wordmark-white.png" alt="Donis" width="180" height="51" style="height:44px;width:auto">
              <p class="serif-caps muted" style="font-size:12px;margin:18px 0 0">Welcome to our culture</p>
              <div class="foot__partner">
                <span class="mono muted">Digital Clubhouse by</span>
                <a href="${C.shot}" aria-label="SHOT Clubhouse" style="padding:0"><img src="/assets/brand/shot-logo.png" alt="SHOT" width="46" height="30"></a>
              </div>
            </div>
            <div>
              <p class="mono">Editions</p>
              <a href="/london-26/">London 26</a>
              <a href="/#editions">Bristol · Nov 26</a>
              <a href="/#editions">Essex · Dec 26</a>
              <a href="/#editions">Sand &amp; Snow · 27</a>
            </div>
            <div>
              <p class="mono">Donis</p>
              <a href="${C.eventbrite}" target="_blank" rel="noopener">Tickets on Eventbrite</a>
              <a href="${C.instagram}" rel="noopener">Instagram</a>
              <a href="${C.donis}" rel="noopener">donis.uk</a>
            </div>
          </div>
          <div class="foot__base mono">
            <span>Club Donis Futebol &middot; Sun Sea Sand Snow Style Sound</span>
            <span>Powered by <a href="${C.shot}" style="display:inline;color:var(--bone)">SHOT Clubhouse</a></span>
          </div>
        </div>
      </footer>`;
  }

  D.reveal = () => {
    const els = document.querySelectorAll(".rv:not(.in)");
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    els.forEach((e) => io.observe(e));
  };

  D.marquees = () => {
    document.querySelectorAll(".marquee__track").forEach((t) => {
      if (t.dataset.dup) return;
      t.innerHTML += t.innerHTML; t.dataset.dup = "1";
      t.querySelectorAll("span").forEach((s, i) => { if (i >= t.children.length / 2) s.setAttribute("aria-hidden", "true"); });
    });
  };

  D.countdown = (el, iso) => {
    if (!el) return;
    const target = new Date(iso).getTime();
    const cells = { d: el.querySelector("[data-d]"), h: el.querySelector("[data-h]"), m: el.querySelector("[data-m]"), s: el.querySelector("[data-s]") };
    const pad = (n) => String(n).padStart(2, "0");
    const tick = () => {
      let diff = Math.max(0, target - Date.now());
      const d = Math.floor(diff / 864e5); diff -= d * 864e5;
      const h = Math.floor(diff / 36e5); diff -= h * 36e5;
      const m = Math.floor(diff / 6e4); diff -= m * 6e4;
      const s = Math.floor(diff / 1e3);
      cells.d.textContent = pad(d); cells.h.textContent = pad(h); cells.m.textContent = pad(m); cells.s.textContent = pad(s);
      if (target - Date.now() <= 0) { el.dataset.live = "1"; clearInterval(timer); }
    };
    tick();
    const timer = setInterval(tick, 1000);
  };

  // Pause background video for people who asked for less motion, and off-screen to save battery.
  D.videos = () => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.querySelectorAll("video[data-bg]").forEach((v) => {
      v.muted = true;
      if (reduce) { v.removeAttribute("autoplay"); v.pause(); return; }
      if (!("IntersectionObserver" in window)) return;
      new IntersectionObserver(([en]) => { en.isIntersecting ? v.play().catch(() => {}) : v.pause(); }).observe(v);
    });
  };

  document.addEventListener("DOMContentLoaded", () => {
    renderNav(); renderEditionNav(); renderFooter(); D.marquees(); D.reveal(); D.videos();
  });
})();
