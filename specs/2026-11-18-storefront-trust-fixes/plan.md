---
id: 2026-11-18-storefront-trust-fixes
title: "Storefront trust fixes — staff content off /help, refund policy, consumer terms (plan)"
audience: [dev]
type: spec
status: draft
version: "1.0.0"
updated: 2026-11-18
visibility: internal
summary: Removes staff-only material from the public Help page and rewrites the terms' refund and platform clauses so a first-time shopper sees a finished, trustworthy shop before card payments go live (#1652).
tags: [storefront, trust, help, terms, p10]
---

# Storefront trust fixes (plan)

A trust audit of the live AFC site on 2026-11-18 (issue `#1652`) found storefront content that
makes the shop look unfinished to a new customer, just before live card payments (`#113`). This
slice fixes the code-side items. The owner approved the scope in chat ("fix the obvious things for
now").

**Goal:** an anonymous shopper on `/help` and `/terms` sees only shopper-facing content, a refund
policy they can act on, and terms written for them.

**Scope (this slice):**
- `app/(storefront)/help/page.tsx` — the "Staff & Store Email Setup" section and its "Staff Email
  Setup" jump chip render only for authenticated staff (`isStaff`). Its hard-coded
  `info@aheedfoodcentre.co.uk` fallback goes (vendor-copy rule).
- `components/help/RoleJourneyMaps.tsx` — gains a `roles` prop. `/help` passes only the roles the
  viewer holds or sits above: an anonymous shopper sees the customer journey alone, with no role
  tabs and a shopper heading; staff see customer + staff; a store admin adds store-admin; a
  platform admin sees all four (today's behaviour). The jump chip reads "How shopping works" for a
  shopper.
- `app/(storefront)/terms/page.tsx` — section 4 (`#refunds`) rewritten in plain language: how to
  report a problem with an order, how and when refunds are paid, the statutory 14-day cancellation
  right and its exemption for goods that deteriorate rapidly (Consumer Contracts Regulations 2013,
  reg. 28) — worded vendor-neutrally because SriMart shares the page. Section 5's Merqify/merchant
  VAT-liability allocation is replaced by a short "who you are buying from" clause. "Last updated"
  becomes November 18, 2026.

**Deliberately excluded:**
- **The "Aheed Super Store" banner.** It is the vendor's own `bannerHeadline`, edited in
  `/staff/storefront` — a data change, not code. The owner confirmed the trading name stays Aheed
  Food Centre until a planned rebrand; the handover is to clear that field on both AFC
  environments.
- A fixed reporting deadline (e.g. "within 48 hours"). That is the vendor's policy call and
  differs between a grocer and an electronics shop; the copy asks for prompt reporting instead.
  A per-vendor refund policy setting would be its own `/propose`.
- Where the removed clause 5 text lives next. No merchant agreement exists in the repo; the text
  stays recoverable from git history and is noted on `#1652`.
- Allergens (`#1653`), halal proof / privacy / reviews (`#1654`).
