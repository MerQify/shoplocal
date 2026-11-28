---
id: image-download-worker-redirect
title: "Staging image imports on Cloudflare Workers (plan)"
audience: [dev]
type: spec
status: approved
version: "1.0.0"
updated: 2026-11-21
visibility: internal
summary: "Provider image downloads use the redirect mode the Workers runtime supports and reject redirect responses, keeping the HTTPS allowlist and image validation (PR #1721)."
tags: [image-hub, images, workers]
related: []
---

# Staging image imports on Cloudflare Workers (plan)

This slice was delivered with a requirements-only spec: `requirements.md` in this folder holds the
scope and acceptance checks. This plan was added afterwards (2026-11-27) as the slice's
KMS index entry, so the slice is discoverable and `npm run sdd:audit` can see it. It records no
decision beyond what `requirements.md` and the merged PR already carry.
