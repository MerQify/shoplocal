---
id: homepage-critical-path
title: "Storefront homepage critical path (plan)"
audience: [dev]
type: spec
status: approved
version: "1.0.0"
updated: 2026-11-21
visibility: internal
summary: "Shares the storefront chrome, header and cart session reads within a render, runs independent reads concurrently, stops the optional rewards launcher blocking render and trims Tailwind sources (PR #1722)."
tags: [storefront, performance, homepage]
related: []
---

# Storefront homepage critical path (plan)

This slice was delivered with a requirements-only spec: `requirements.md` in this folder holds the
scope and acceptance checks. This plan was added afterwards (2026-11-27) as the slice's
KMS index entry, so the slice is discoverable and `npm run sdd:audit` can see it. It records no
decision beyond what `requirements.md` and the merged PR already carry.
