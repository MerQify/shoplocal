# Live Excel Stock Exports Behind Auth (validation)

> **Testing Strategy (Lean 80/20 Model)**
> Provide enough testing to give confidence without creating unnecessary or duplicate tests. Avoid testing the same behaviour multiple times at different levels unless doing so provides additional confidence.
>
> **The Main Principle:**
> - **Build:** Did we build the component correctly?
> - **Validate:** Does the feature work correctly in the real system?
> - **Release:** Is the complete system safe, reliable, and ready for users?

## Testing Areas

This slice touches **auth** (an access-control gap) and a **Workers runtime** path (an in-memory
workbook on the isolate). Security checks therefore run before release, and R12 runs on the real
staging Worker against the full AFC catalogue. Unit tests cover the pure builders. Route tests mock
`requireVendorRole` and the fetch functions, following the existing
`tests/platform-stock-export-rbac.test.ts`.

Run every command from the worktree root. Use `--maxWorkers=4` on vitest (`CLAUDE.md`).

---

## Validation Steps

| Req | Testing Area | How to verify |
|-----|--------------|---------------|
| R1  | Unit | Open `lib/spreadsheet/workbook.ts` and confirm the named exports. Then `grep -nE "from \"node:|require\\(\"node:|\\bBuffer\\b" lib/spreadsheet/workbook.ts` prints nothing. |
| R2  | Unit | `npx vitest run --maxWorkers=4 tests/spreadsheet-workbook.test.ts` passes. Read the test and confirm it asserts the `PK` signature, the sheet names in order, an `autoFilter` on each multi-row sheet, and `<dataValidation type="list"` with the given `sqref`. It must inspect the unzipped XML, not just the byte length. |
| R3  | Unit | `grep -nE "XLSX\\.write\|zipSync\|dataValidations" scripts/lib/read-spreadsheet.ts` prints nothing. Read `writeWorkbook` and confirm its body is a `writeFileSync` of `buildWorkbook(sheets)`. `grep -nE "^export (const\|function) (UNIVERSAL_DROPDOWN_RULES\|ESSENTIAL_DROPDOWN_RULES\|columnIndexToLetter\|buildColumnValidations)" scripts/lib/read-spreadsheet.ts` prints nothing: any such name is a re-export only. |
| R4  | Unit | `npx vitest run --maxWorkers=4 tests/product-workbook-sheets.test.ts` passes. It asserts the Master sheet names and order exactly as R4 lists them, and that the Stock and Essential header rows equal `UNIVERSAL_COLUMNS` and `ESSENTIAL_COLUMNS`. `grep -nE "getPrisma\|getPrismaWs\|@prisma" lib/product-templates/workbook-sheets.ts` prints nothing. |
| R5  | Unit | `grep -n "join(outDirPublic" scripts/product-templates/export-all-stock.ts`: every hit names a file ending in `-template.csv` or `-template.xlsx`, and none contains `-export.`. `grep -nE "buildStockSheets\|buildEssentialSheets\|buildMasterSheets" scripts/product-templates/export-all-stock.ts` shows all three in use. |
| R6  | Integration | `npx vitest run --maxWorkers=4 tests/platform-stock-export-rbac.test.ts` passes. For each of `stock`, `essential` and `master` with `format=xlsx` as a platform admin, it asserts status 200, the exact xlsx `content-type`, `cache-control: no-store`, the R6 filename pattern, and a body starting with `PK`. `grep -n "Response.redirect" "app/(admin)/staff/platform/stock-export/export/route.ts"` appears only in the blank-template branch (`universal`, `universal-template`, `essential-template`). |
| R7  | Integration | Same test file. It asserts the exact arguments passed to `fetchStockRecordsForExport` (`{ status: "all", category: "rice" }` for `?status=all&category=rice`, and `{ status: "active", category: undefined }` for no query), and that `type=master` passes `{ status }` to the four operational fetchers and calls `fetchFiltersForExport` with the vendor id. |
| R8  | Security | Same test file. `type=master&format=xlsx` returns 401 for `{ ok: false, status: 401 }` and 403 for a `via: "vendor-membership"` admin, and asserts zero calls on every fetch mock in both cases. |
| R9  | Security | `git ls-files public/templates` lists no `*-export.*` file. `ls public/templates` shows only `*-template.csv` / `*-template.xlsx`. `npx vitest run --maxWorkers=4 tests/public-no-generated-exports.test.ts` passes. Then prove the guard bites: `touch public/templates/x-export.csv`, re-run (it must FAIL), then `rm public/templates/x-export.csv`. |
| R10 | Unit | `grep -nE "aheed-food-centre-\|/templates/[^\"]*-export\\." components/staff/platform-stock-export/PlatformExportHub.tsx` prints nothing. Read the file and confirm the three xlsx links use `/staff/platform/stock-export/export?type=…&format=xlsx` plus the query suffix, and that the Master card text describes the filter behaviour R10 states. Then, under `npm run preview` signed in as `demo-platform-admin` (the curl sign-in recipe in `docs/developer-portal/local-dev-playbook.md`: `Host` header plus cookie jar), fetch `/staff/platform/stock-export` and confirm the rendered HTML contains `type=master&amp;format=xlsx&amp;status=active` or the equivalent. |
| R11 | Performance | Run each side in its own clean checkout of the same machine. On `origin/staging`: `npx opennextjs-cloudflare build && npx wrangler deploy --dry-run --env staging`, and record the `gzip:` figure from `Total Upload`. Repeat on this branch. Branch minus base must be ≤ 600 KiB, and the branch figure < 10240 KiB. Both numbers go in `build-notes.md`. If either check fails, R11 fails. Do not raise the cap; take the `fflate` fallback in `plan.md`. |
| R12 | E2E / Security | **At Ship, after the staging deploy.** Sign in on the staging AFC host as the platform admin (curl and cookie jar per the playbook) and run `curl -sS -b jar -o master.xlsx -w "%{http_code} %{time_total}" "https://<staging-afc-host>/staff/platform/stock-export/export?type=master&format=xlsx&status=all"`. Use `MSYS_NO_PATHCONV=1` on Git Bash, and read the status with `-i` if `-w` misbehaves. Expect `200` and a time under 30. Open the file with `python -I -c` and `zipfile`: 7 sheets in R4's order. Products data rows equal the line count minus 1 of the `type=stock&format=csv&status=all` download, and `Is Active` holds both `TRUE` and `FALSE`. The same URL without the cookie returns `401`. Each R9 filename under `/templates/` returns `404`. |
| R13 | Unit / Security | `npx vitest run --maxWorkers=4 tests/health-route.test.ts` passes. With `getPrisma` mocked to throw `new Error("connect ECONNREFUSED ep-secret-host-123.neon.tech")`, it asserts: response status 503; `body.db` equals `{ ok: false, error: "database unavailable" }`; `JSON.stringify(body)` does not contain `ep-secret-host-123`; and `console.error` was called with the message. A second case does the same for a throwing `getReferenceStatus` and `"reference status unavailable"`. |
| R14 | Gate 4 | `git diff origin/staging -- CHANGELOG.md` shows an `[Unreleased]` entry naming #1714. |
| R15 | Gate 3 | `npm run lint`, `npm run typecheck`, `npm run format:check`, `npx vitest run --maxWorkers=4` (run alone) and `npm run build` all exit 0. On Windows, check a formatter complaint about an untouched file against `git show HEAD:<file>` before acting. |
