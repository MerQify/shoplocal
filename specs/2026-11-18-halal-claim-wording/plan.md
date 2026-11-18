---
id: 2026-11-18-halal-claim-wording
title: "Halal claim wording — gate the homepage HMC pill, stop the product-page overclaim (plan)"
audience: [dev]
type: spec
status: draft
version: "1.0.0"
updated: 2026-11-18
visibility: internal
summary: Stops the homepage claiming "100% Certified HMC Halal" for every vendor and stops product pages claiming certification for halal products that carry none (#1658).
tags: [storefront, halal, trust, copy, p10]
---

# Halal claim wording (plan)

Found while answering where a halal certificate could be shown (2026-11-18), after the trust audit
flagged the certification claims (#1654). Two claims outrun their data:

- `app/(landing)/page.tsx` rendered a literal "100% Certified HMC Halal" hero pill for every vendor.
  Verified live on `srimart-staging.merqify.com` (electronics) and `www.aheedfoodcentre.co.uk`.
- `app/(storefront)/products/[slug]/page.tsx` said "100% Halal Verified — Certified halal supply
  chain and handling" for any `isHalal` product, certified or not.

**Goal:** no storefront states halal certification unless the vendor or product data supports it.

**Scope (this slice):**
- Hero pill gated on `profile.showHalalLabel && profile.showHmcCertification`; text "HMC certified
  halal". These are the only vendor-level halal/HMC signals that exist; `/help` already gates its
  halal line on `showHalalLabel` (precedent).
- Product page: `isHmcCertified` → "HMC certified halal / Certified by the Halal Monitoring
  Committee." (reference already renders below); otherwise `isHalal` → "Halal / Sold as halal. Ask
  us if you need certification details."

**Deliberately excluded:**
- Shop-level certificate proof (body, number, expiry, HMC directory link, image) — planned under
  #1654, gated on the owner confirming certification.
- The header `bannerNote` ("100% Certified HMC") is vendor data in `/staff/storefront`, not code.
