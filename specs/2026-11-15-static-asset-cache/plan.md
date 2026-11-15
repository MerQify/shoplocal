---
id: 2026-11-15-static-asset-cache-plan
title: "Cache hashed static assets for a year (plan)"
audience: [dev]
type: spec
status: draft
version: "1.0.0"
updated: 2026-11-15
visibility: internal
summary: "#1624. /_next/static files were served with a 4-hour must-revalidate header. A public/_headers rule makes these content-hashed files cacheable for a year; pages stay no-store."
tags: [performance, caching, cloudflare]
related: [sdd-workflow]
---

# Cache hashed static assets for a year (plan)

Issue `#1624`. It was found while answering the owner's "is it slow because of no caching?" on
2026-11-15.

The owner changed two dashboard settings:
- `merqify.com` → Browser Cache TTL set to **Respect Existing Headers**;
- a 1-year Cache Rule for the image hosts.

Images now serve `max-age=31536000`. The JS and CSS under `/_next/static/*` still serve
`public, max-age=14400, must-revalidate`, even on an uncached `MISS`. That proves the header comes
from the Worker's static-assets serving, not from the zone. The repo has no `public/_headers`.

**Goal:** a returning visitor's browser reuses JS and CSS without re-checking them.

**Scope:**
- Add `public/_headers` with
  `/_next/static/* → Cache-Control: public, max-age=31536000, immutable`.
- OpenNext copies `public/` into `.open-next/assets`, the `[assets]` directory in `wrangler.toml`,
  where Workers Static Assets applies it.

**Why it is safe:** Next.js content-hashes every `/_next/static` file name, so a URL's contents
never change; a deploy produces new names.

**Deliberately excluded:**
- **Page HTML caching.** Pages are personalised (cart count, postcode, sign-in), so they stay
  `no-store`. Making catalogue pages edge-cacheable is a larger change for after go-live.
- **Link-prefetch limiting and server-side data caching.** Also after go-live, as discussed with the
  owner.

**Open items carried forward:** none.
