// Locks the scorer's GitHub key behind a short passcode, so a scorer is only ever given
// the passcode. AES-256-GCM with a key stretched by PBKDF2 (600,000 rounds), in the
// browser's own crypto. The locked box is public; the passcode never leaves the phone.
(function (root) {
  const ITER = 600000;
  // Crockford base32: no I, L, O or U, so it reads aloud cleanly. 12 characters = 60 bits.
  const ALPHA = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const subtle = () => (root.crypto || globalThis.crypto).subtle;
  const rand = (n) => (root.crypto || globalThis.crypto).getRandomValues(new Uint8Array(n));
  const b64 = (u8) => btoa(String.fromCharCode(...u8));
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  function passcode() {
    const out = [];
    for (const byte of rand(12)) out.push(ALPHA[byte & 31]);
    return [out.slice(0, 4), out.slice(4, 8), out.slice(8, 12)].map((g) => g.join("")).join("-");
  }

  // What people actually type: any case, spaces or dashes, O for 0, I or L for 1.
  const normalise = (p) => String(p).toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");

  async function derive(pass, salt, iter) {
    const base = await subtle().importKey("raw", new TextEncoder().encode(normalise(pass)), "PBKDF2", false, ["deriveKey"]);
    return subtle().deriveKey({ name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }

  async function seal(secret, pass, iter = ITER) {
    const salt = rand(16), iv = rand(12);
    const key = await derive(pass, salt, iter);
    const ct = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(secret)));
    return { v: 1, iter, salt: b64(salt), iv: b64(iv), ct: b64(ct), created: new Date().toISOString() };
  }

  async function open(box, pass) {
    try {
      const key = await derive(pass, unb64(box.salt), box.iter);
      const pt = await subtle().decrypt({ name: "AES-GCM", iv: unb64(box.iv) }, key, unb64(box.ct));
      return new TextDecoder().decode(pt);
    } catch (e) {
      throw new Error("That passcode isn't right.");
    }
  }

  const api = { seal, open, passcode, normalise, ITER };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Keybox = api;
})(this);
