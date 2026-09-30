// Sport Head ID for the Donis pass: sign-in (authorisation code + PKCE, public client)
// and the hosted pass panel from sporthead.id (ADR-0017). The access token stays in
// sessionStorage for this tab only; the Donis API verifies it itself (aud=donis).
(function () {
  const C = window.DONIS_CONFIG || {};
  const KEY = "donis:sporthead";
  const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const random = (n) => b64url(crypto.getRandomValues(new Uint8Array(n)));
  const redirectUri = () => `${location.origin}/pass/callback/`;
  const ss = {
    get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { sessionStorage.removeItem(k); } catch (e) {} },
  };

  async function startSignIn({ p, t }) {
    const verifier = random(48);
    const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
    const state = random(16);
    if (!ss.set(KEY + ":pkce", { verifier, state, p, t })) throw new Error("This browser is blocking storage. Try another browser.");
    const q = new URLSearchParams({
      response_type: "code", client_id: C.sportheadClientId, redirect_uri: redirectUri(),
      scope: "openid profile", state, code_challenge: challenge, code_challenge_method: "S256",
    });
    location.href = `${C.sportheadIssuer}/authorize?${q}`;
  }

  // Runs on /pass/callback/: checks state, swaps the code for a token, and returns
  // the pass it belongs to. Throws with a message fit to show the holder.
  async function completeSignIn() {
    const q = new URLSearchParams(location.search);
    history.replaceState(null, "", location.pathname); // keep the code out of history
    const saved = ss.get(KEY + ":pkce");
    ss.del(KEY + ":pkce");
    if (q.get("error")) throw new Error("Sign-in was cancelled.");
    if (!saved || !q.get("code") || q.get("state") !== saved.state) throw new Error("That sign-in link has expired. Go back to your pass and try again.");
    const res = await fetch(`${C.sportheadIssuer}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code: q.get("code"), redirect_uri: redirectUri(), client_id: C.sportheadClientId, code_verifier: saved.verifier }),
    });
    const tok = await res.json().catch(() => ({}));
    if (!res.ok || !tok.access_token) throw new Error("Sport Head ID didn't complete the sign-in. Try again.");
    ss.set(KEY + ":token", { accessToken: tok.access_token, at: Date.now() });
    return { accessToken: tok.access_token, p: saved.p, t: saved.t };
  }

  // A token is only useful to the embed for its 15-minute life; after that the panel
  // still renders from the credential id.
  function currentToken() {
    const s = ss.get(KEY + ":token");
    return s && Date.now() - s.at < 14 * 60 * 1000 ? s.accessToken : null;
  }

  // Frames sporthead.id/embed/pass for one credential and answers its handshake.
  // Messages are only accepted from, and only sent to, the sporthead.id origin.
  function mountPass(host, { cid, claims }) {
    const origin = new URL(C.sportheadEmbed).origin;
    const frame = document.createElement("iframe");
    frame.src = `${C.sportheadEmbed}?cid=${encodeURIComponent(cid)}`;
    frame.title = "Your Sport Head ID pass";
    frame.loading = "lazy";
    frame.style.cssText = "width:100%;border:0;min-height:420px;display:block;background:transparent";
    const onMsg = (e) => {
      if (e.origin !== origin || e.source !== frame.contentWindow || !e.data) return;
      if (e.data.type === "sporthead-embed:ready") {
        frame.contentWindow.postMessage({ type: "sporthead-embed:init", accessToken: currentToken(), claims: claims || {} }, origin);
      } else if (e.data.type === "sporthead-embed:height" && Number(e.data.height) > 0) {
        clearTimeout(fallback);
        frame.style.height = Math.min(Number(e.data.height), 1200) + "px";
      }
    };
    window.addEventListener("message", onMsg);
    // If the panel can't load (blocked framing, offline), say so instead of leaving a hole.
    const fallback = setTimeout(() => {
      if (!frame.style.height) host.insertAdjacentHTML("beforeend", `<p class="mono muted" style="font-size:11px">Can't see your Sport Head pass? <a class="acid" href="${C.sportheadId}/pass/" rel="noopener">Open it on sporthead.id</a>. Your Donis pass above still gets you in.</p>`);
    }, 8000);
    host.appendChild(frame);
  }

  window.DonisSporthead = { startSignIn, completeSignIn, mountPass, currentToken };
})();
