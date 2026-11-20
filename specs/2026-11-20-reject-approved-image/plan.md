---
id: reject-approved-image-plan
title: "Image library — reject an approved image (plan)"
audience: [dev]
type: spec
status: draft
version: "1.0.0"
updated: 2026-11-20
visibility: internal
summary: "Lets store admins reject an already-approved Image Hub image from /staff/image-library, with a plain-words refusal when the image is still used on a product or category."
tags: [image-hub, images, staff, p10]
related: [image-hub-gallery-plan]
---

# Image library — reject an approved image (plan)

**Goal:** a store admin can withdraw an image after approving it. Closes #1682 (part of #1669),
which the owner asked for on 2026-11-20.

**Why it is small:** the hub already accepts `POST /v1/assets/{id}/reject` on an approved image,
and refuses one that is in use (409 `in_use`) so a live product photo cannot be pulled out from
under the shop. The store already has `rejectLibraryAction` (admin only). Only the card in
`components/staff/ImageLibraryClient.tsx` hides it, by showing review controls on Pending cards
only.

**Scope:**
- On an **Approved** card, store admins (the existing `canReview` prop) see a **Reject…** button.
  Clicking it reveals the same reason box and **Reject** button that Pending cards have. A rejected
  image's card then shows "Rejected" and its reason, as today.
- When the hub answers `in_use`, the card shows: "This image is used on a product or category.
  Remove it there first, then reject it."
- The staff tabs guide says admins can reject an approved image that isn't in use.

**Deliberately excluded:**
- Re-approving a rejected image.
- Bulk reject.
- Listing where an image is used: the hub's `usages` are not shown on the card.
- Any hub change.
