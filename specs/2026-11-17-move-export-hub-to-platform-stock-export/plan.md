---
id: 2026-11-17-move-export-hub-to-platform-stock-export-plan
title: "Move Templates & Operational Exports to /staff/platform/stock-export (plan)"
audience: [dev]
type: spec
status: approved
version: "1.0.0"
updated: 2026-11-17
visibility: internal
summary: "Relocate the interactive Templates & Operational Exports section, Master Excel workbook download, and operational exports from /staff/products/import to /staff/platform/stock-export."
tags: [catalogue, templates, export, platform-admin, stock-export]
related: [2026-11-17-category-sorting-master-export-archival-plan]
---

# Move Templates & Operational Exports to /staff/platform/stock-export (plan)

Issue #1640. Requirements: `requirements.md`.

## Step 1: Create PlatformExportHub
- Move and adapt `StoreExportHub` into `components/staff/platform-stock-export/PlatformExportHub.tsx`.
- Wire all download links to use `/staff/platform/stock-export/export?type=...` and pre-generated `/templates/...` assets.

## Step 2: Update /staff/platform/stock-export/page.tsx
- Integrate `PlatformExportHub` seamlessly into the Platform Stock Export page.

## Step 3: Clean up /staff/products/import/page.tsx
- Remove `StoreExportHub` from the page body and imports.
- Update header action to link to `/staff/platform/stock-export`.

## Step 4: Update /staff/products/page.tsx
- Update the "Export & Templates" button target to `/staff/platform/stock-export`.

## Step 5: Verification
- Verify typecheck, lint, formatting, tests, KMS build index, and SDD preclear.
