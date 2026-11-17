---
id: specs-fix-master-excel-export-download-plan
title: "Plan: Serve Master and Stock Excel Exports via Static Assets (#1642)"
type: spec
status: approved
created: 2026-11-17
updated: 2026-11-17
version: "1.0.0"
---

# Plan: Serve Master and Stock Excel Exports via Static Assets

Fixes #1642. Requirements: `requirements.md`.

## Changes

1. **`components/staff/platform-stock-export/PlatformExportHub.tsx`:**
   - Change Master Excel download button href to `/templates/aheed-food-centre-master-stock-export.xlsx`.
   - Change Universal Stock Export Excel link href to `/templates/aheed-food-centre-stock-export.xlsx`.

2. **`app/(admin)/staff/platform/stock-export/export/route.ts`:**
   - Remove `node:fs` and `node:path` imports.
   - For `format === "xlsx"`, map `type` to the static asset URL and return `Response.redirect(new URL(staticPath, request.url), 302)`.
   - For `type === "universal"` and `type === "essential"` CSVs, use `generateBlankUniversalCsv()` and `generateBlankEssentialCsv()` in memory.

3. **`tests/platform-stock-export-rbac.test.ts`:**
   - Add test verifying `302` redirect to static asset URL when `format === "xlsx"`.
