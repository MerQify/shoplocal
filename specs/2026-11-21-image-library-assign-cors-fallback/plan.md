---
id: image-library-assign-cors-fallback
title: "Image Library Assign and Product Image Storage Fallback (requirements) (plan)"
audience: [dev]
type: spec
status: approved
version: "1.0.0"
updated: 2026-11-21
visibility: internal
summary: "Same-origin upload route that staff image assignment and product uploads fall back to when a direct presigned storage PUT is blocked by CORS (PR #1709)."
tags: [images, storage, staff]
related: []
---

# Image Library Assign and Product Image Storage Fallback (requirements) (plan)

This slice was delivered with a requirements-only spec: `requirements.md` in this folder holds the
scope and acceptance checks. This plan was added afterwards (2026-11-27) as the slice's
KMS index entry, so the slice is discoverable and `npm run sdd:audit` can see it. It records no
decision beyond what `requirements.md` and the merged PR already carry.
