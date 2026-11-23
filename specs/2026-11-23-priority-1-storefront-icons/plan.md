---
id: priority-1-storefront-icons
title: Priority 1 storefront icons (plan)
audience: [dev]
type: spec
status: approved
version: "1.0.0"
updated: 2026-11-23
visibility: internal
summary: Improve recognition of favourites, basket controls and checkout states using the existing semantic icon registry.
tags: [storefront, icons, accessibility]
related: [adr-008-icon-system]
---

# Priority 1 storefront icons

Tracking issue [#1744](https://github.com/sriahead/merqify/issues/1744).

Use functional Lucide variants for the controls and compact messages in the requirements. Add entries to the semantic registry and regenerate bundled SVG data through the existing build command. Keep decorative registry entries available for artwork and vendor overrides.

Use the app's contrast-clamped semantic colours. Keep status labels visible, including the existing distinction between a cancelled order and a failed payment. Use the visible label Basket on the floating trigger from the small breakpoint and preserve the current count and subtotal.

Staff navigation, department artwork and checkout behaviour are outside this slice.
