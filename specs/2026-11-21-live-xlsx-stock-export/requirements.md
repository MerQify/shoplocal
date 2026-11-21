# Live Excel Stock Exports Behind Auth (requirements / acceptance criteria)

Closes #1714. The platform stock-export hub's xlsx downloads were 302 redirects to workbooks
committed under `public/templates/`. Those were public static assets: unauthenticated, a stale
2026-11-17 snapshot, and blind to the hub's filters. This slice builds them live behind the existing
platform-admin check, removes the generated files from `public/`, guards against their return, and
stops `/api/health` echoing raw error text. Narrative and exclusions: `plan.md`.

"Route" below means `app/(admin)/staff/platform/stock-export/export/route.ts`. "Platform admin" means
`requireVendorRole("ADMIN")` returned `ok: true` with `via: "platform-admin"`.

R1. `lib/spreadsheet/workbook.ts` exists and exports:
    - `buildWorkbook(sheets: SheetDefinition[]): Uint8Array`;
    - the types `SheetDefinition` and `SheetDataValidation`;
    - `UNIVERSAL_DROPDOWN_RULES`, `ESSENTIAL_DROPDOWN_RULES`, `columnIndexToLetter` and
      `buildColumnValidations`.

    The file imports nothing from `node:fs`, `node:path` or any other `node:` module, and does not
    reference `Buffer`.
R2. For a two-sheet input in which one sheet carries a list validation, the bytes returned by
    `buildWorkbook`:
    - start with the ZIP signature `PK`;
    - contain `xl/workbook.xml`, naming both sheets in input order;
    - carry an `autoFilter` element on each sheet with more than one row;
    - carry a `<dataValidation type="list"` element with the given `sqref` on the validated sheet.

    A vitest unit test asserts all four.
R3. `scripts/lib/read-spreadsheet.ts`'s `writeWorkbook(path, sheets)` writes exactly the bytes
    returned by `buildWorkbook(sheets)`. It no longer contains its own `XLSX.write`, `zipSync` or
    data-validation injection code. Any name it still exports from R1's list is a re-export from
    `lib/spreadsheet/workbook.ts`, not a second definition.
R4. `lib/product-templates/workbook-sheets.ts` exports three pure functions taking already-fetched
    records (no database access): `buildStockSheets`, `buildEssentialSheets` and
    `buildMasterSheets`.
    - `buildStockSheets` and `buildEssentialSheets` each return one sheet named `Products`. Its
      first row equals `UNIVERSAL_COLUMNS` or `ESSENTIAL_COLUMNS` respectively, and it has one
      further row per product.
    - `buildMasterSheets` returns exactly these sheet names, in this order: `Products`,
      `Categories`, `Bundles`, `Promotions`, `Discount Codes`, `Filters & Attributes`,
      `Field Instructions`.

    A vitest unit test asserts the names, the order and the header rows.
R5. `scripts/product-templates/export-all-stock.ts` builds every workbook it writes through R4's
    functions and R1's `buildWorkbook` (directly or via `writeWorkbook`). Every `join(outDirPublic, …)`
    in the file names a file ending in `-template.csv` or `-template.xlsx`. No generated export is
    written under `public/`.
R6. For `format=xlsx` with `type` equal to `stock`, `essential` or `master`, the route returns
    status `200` with these headers:
    - `content-type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`;
    - `cache-control: no-store`;
    - a `content-disposition` of `attachment; filename="<name>"`, where `<name>` is
      `stock-<status>-export-<YYYY-MM-DD>.xlsx`, `stock-essential-<status>-export-<YYYY-MM-DD>.xlsx`
      or `master-<status>-export-<YYYY-MM-DD>.xlsx` respectively.

    The body is a workbook built from records the route fetched for the caller's `vendorId`. For
    these three types it never returns a 3xx.
R7. The xlsx branch passes the same `{ status, category }` to `fetchStockRecordsForExport` as the
    CSV branch does for the same query string:
    - `status` is `active` unless the query says `all` or `archived`;
    - `category` is omitted when absent or `all`.

    For `type=master` the route also passes `{ status }` to `fetchCategoriesForExport`,
    `fetchBundlesForExport`, `fetchPromotionsForExport` and `fetchDiscountsForExport`, and calls
    `fetchFiltersForExport(vendorId)`. A vitest test with those functions mocked asserts the
    arguments for `?status=all&category=rice`, and for no query string.
R8. For `format=xlsx` the route returns `401` when unauthenticated, and `403` when authenticated but
    not a platform admin, before calling any fetch function. A vitest test asserts both statuses for
    `type=master&format=xlsx`, and that no fetch mock was called.
R9. These five files no longer exist under `public/templates/`:
    - `aheed-food-centre-master-stock-export.xlsx`
    - `aheed-food-centre-stock-export.xlsx`
    - `aheed-food-centre-stock-export.csv`
    - `aheed-food-centre-essential-export.xlsx`
    - `aheed-food-centre-essential-export.csv`

    A vitest guard test fails if any tracked or untracked file under `public/` has `-export.` in
    its name, or if `public/templates/` contains a file not matching `-template\.(csv|xlsx)$`.
    It passes on this branch.
R10. `components/staff/platform-stock-export/PlatformExportHub.tsx` contains no `href` or `download`
     naming `aheed-food-centre-` or `-export.xlsx` / `-export.csv` under `/templates/`. The Master,
     Universal xlsx and Essential xlsx links point at
     `/staff/platform/stock-export/export?type=<master|stock|essential>&format=xlsx`, followed by the
     same status/category query suffix the CSV links use. The hub's Master card says that Products
     follows the status and category filters, the other sheets follow status only, and
     Filters & Attributes is unfiltered.
R11. The Worker upload's gzip size, as reported by `npx wrangler deploy --dry-run --env staging`
     after `npx opennextjs-cloudflare build`, grows by no more than **600 KiB** over `origin/staging`
     measured the same way, and stays under **10240 KiB**. Both figures are recorded in
     `build-notes.md`.
R12. After the staging deploy, a platform-admin session on the staging AFC host gets `200` from
     `GET /staff/platform/stock-export/export?type=master&format=xlsx&status=all` within 30 s. The
     body opens as a workbook with seven sheets. Its Products sheet has as many data rows as the
     `type=stock&format=csv&status=all` download, and a non-empty `Is Active` column containing at
     least one `TRUE` and one `FALSE`. An unauthenticated `GET` of the same URL returns `401`. Every
     R9 filename returns `404` on the staging host. (Verified at Ship, on staging, because only
     staging has the full AFC catalogue and the real Worker CPU limits.)
R13. When the database or reference read throws, `/api/health`:
     - returns `db.error` and `reference.error` as the fixed strings `"database unavailable"` and
       `"reference status unavailable"`;
     - never includes the thrown message in the body;
     - keeps `status`, `db.ok`, `reference.configured`, `reference.reachable` and the 200/503 status
       code behaviour unchanged.

     The thrown message is passed to `console.error`. A vitest test with a throwing client whose
     message contains a hostname asserts that the hostname is absent from the JSON body.
R14. `CHANGELOG.md` updated (Gate 4).
R15. `npm run lint`, `npm run typecheck`, `npx vitest run --maxWorkers=4`, `npm run format:check` and
     `npm run build` all remain green after this slice.
