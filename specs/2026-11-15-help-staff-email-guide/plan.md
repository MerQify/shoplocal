---
id: 2026-11-15-help-staff-email-guide-plan
title: "Staff & Store Email Setup Guide on /help (plan)"
audience: [dev]
type: spec
status: draft
version: "1.0.0"
updated: 2026-11-15
visibility: internal
summary: "#1619. Add clear, self-service email instructions to the storefront Help Centre (/help) for store staff and administrators to reply as the store via personal Gmail or Google Groups."
tags: [help, email, staff]
related: [sdd-workflow]
---

# Staff & Store Email Setup Guide on /help (plan)

Issue `#1619`.

## Summary
Add clear, self-service email instructions to the storefront Help Centre (`/help`) for store staff and administrators who receive customer enquiries forwarded to personal Gmail or Google Groups, allowing them to send replies as `info@aheedfoodcentre.co.uk`.

## Changes
1. `app/(storefront)/help/page.tsx`:
   - Add `#staff-email` jump chip in header.
   - Add `#staff-email` section with two-step card layout and Google Groups / Staff Panel callout.
2. `docs/store-admin-guide/admin-tabs-guide.md`:
   - Add "Replying and sending as your store from personal Gmail" section.
3. `docs/staff-playbook/staff-tabs-guide.md`:
   - Reference the Gmail setup guide in the `/staff/enquiries` section.
4. Update `CHANGELOG.md` with entry referencing `#1619`.
