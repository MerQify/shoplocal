---
id: 2026-11-18-help-own-website
title: "Help content names the store's own website (plan)"
audience: [dev]
type: spec
status: draft
version: "1.0.0"
updated: 2026-11-18
visibility: internal
summary: Removes aheed.merqify.com and srimart.merqify.com storefront examples from Aheed's help content; /help shows the store's own canonical host (#1662).
tags: [storefront, help, docs, copy, p10]
---

# Help content names the store's own website (plan)

Requested by the user 2026-11-18. Aheed's help used other storefronts as examples: the old platform subdomain `aheed.merqify.com`, and `srimart.merqify.com`, another client's shop.

- `components/help/RoleJourneyMaps.tsx`: the shopper journey's starting point is shown on every store's `/help`. It now renders the store's own `VendorProfile.canonicalHost`, passed from `app/(storefront)/help/page.tsx`. Without one it says "This store's homepage." Nothing is hardcoded (vendor-neutral copy rule).
- `docs/client-help-centre/` (Aheed's client docs) now say `www.aheedfoodcentre.co.uk`. The staff sign-in example is neutral.
- `lib/vendor-readiness-service.ts`: the "Host Domain Mapping" reference value was `aheed.merqify.com` for every store. It now reads "The store's own domain".

Out of scope: `lib/client-setup/sender-suggestion.ts`, `docs/platform-admin-guide/`, `docs/developer-portal/env-setup.md`, where the platform subdomain is the mechanism being described, plus test fixtures. No migration.
