# Repository references after the move to MerQify/shoplocal (validation)

Risk is low: links, comments and docs only, no runtime behaviour. Testing is therefore checks, not
new tests.

| Req | Check | Expected |
| --- | --- | --- |
| R1 | `git grep -l -E "sriahead/(merqify\|aheed-online-store)"` minus `specs/20*`, `specs/roadmap.md`, `CHANGELOG.md`, `runbook/docs.ts`, `operator-runbook.md` | no output |
| R2 | Read `PricingDashboardSections.tsx` and `kms/site-internal/app/layout.tsx` | both name `https://github.com/MerQify/shoplocal` |
| R3 | Read the "Branch strategy and CI — the detail" section of `operator-runbook.md` | home, old names, never recreate, Project #2 on `sriahead` |
| R4 | `kms:validate`, `kms:build-index` then `kms:check-generated`, `kms:assemble:internal`, `next build` in `kms/site-internal` | all exit 0 |
| R5 | `CHANGELOG.md` `[Unreleased]` | entry naming #1771 |
| R6 | CI `gates` on the PR (lint, typecheck, test, format, kms) | green |

## Results (2026-11-27, not independent: same session as the build)

| Req | Result |
| --- | --- |
| R1 | pass: no output |
| R2 | pass |
| R3 | pass |
| R4 | pass: `kms:validate`, `kms:build-index`, `kms:check-generated`, `kms:assemble:internal` (412 docs) and the `kms/site-internal` Next build all exit 0 |
| R5 | pass |
| R6 | local `lint` and `format:check` pass; typecheck/test rely on CI (worktree junction, see build notes) |
