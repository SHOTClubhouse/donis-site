// Runtime config. apiBase empty = demo mode: the whole journey runs in the browser,
// no payment is taken and passes are stored locally only.
// Set apiBase to the Vercel API host (e.g. https://donis-api.vercel.app) to go live.
window.DONIS_CONFIG = {
  apiBase: "",
  clubhouseWeb: "https://app.shotclubhouse.com",
  appStore: "https://apps.apple.com/gb/app/shot-clubhouse/id6757206956",
  playStore: "https://play.google.com/store/apps/details?id=com.shotclubhouse.app",
  sportheadId: "https://sporthead.id",
  // Sport Head ID sign-in (OIDC, PKCE) and the hosted pass panel (ADR-0017).
  // The donis client and the embed allow-list come from SHOTid PR #134.
  sportheadIssuer: "https://id.sporthead.id",
  sportheadClientId: "donis",
  sportheadEmbed: "https://sporthead.id/embed/pass/",
  // All bookings (tickets and team entry) are taken on Eventbrite. The site takes no payments.
  eventbrite: "https://www.eventbrite.co.uk/e/donis-london-2026-2v2-street-football-event-djs-west-ham-legends-match-tickets-1998357098877",
  // Live scores live in their own repo, so the scorer key can only ever change scores.
  // The scorer page saves there; its workflow validates and publishes to `feed` in about
  // a minute. The key is stored at `keyFile`, locked behind a passcode (keybox.js).
  scores: {
    repo: "SHOTClubhouse/donis-scores", path: "fixtures.json", branch: "main",
    feed: "https://shotclubhouse.github.io/donis-scores", keyFile: "scorer-key.json",
  },
  shot: "https://shotclubhouse.com",
  instagram: "https://www.instagram.com/donisclub/",
  donis: "https://donis.uk/",
  // Membership code redeemed in SHOT Clubhouse (Account > Membership). Created by a
  // superadmin at /admin/membership/codes. Placeholder until the real code exists.
  clubhouseCode: "DONIS26"
};
