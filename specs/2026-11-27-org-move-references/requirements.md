# Repository references after the move to MerQify/shoplocal (requirements / acceptance criteria)

Points the live code links and current docs at `MerQify/shoplocal` and `MerQify/image-hub` after
the 2026-11-27 transfers, and leaves the dated record alone (`plan.md`, issue #1771).

R1. `git grep -E "sriahead/(merqify|aheed-online-store)"` matches no file outside `specs/20*/`,
    `specs/roadmap.md`, `CHANGELOG.md`, the generated `app/(admin)/staff/runbook/docs.ts` content
    that mirrors those files, and the operator runbook's note naming the old repositories (R3).
R2. `components/staff/PricingDashboardSections.tsx` links issues to
    `https://github.com/MerQify/shoplocal/issues/<n>`, and `kms/site-internal/app/layout.tsx` sets
    `docsRepositoryBase` to `https://github.com/MerQify/shoplocal`.
R3. `docs/developer-portal/sdd/operator-runbook.md` states the repository's home
    (`MerQify/shoplocal`), the old names that redirect to it, that none may ever be recreated, and
    that Project #2 remains on the `sriahead` account.
R4. `kms:validate`, `kms:build-index` (no diff after commit), `kms:check-generated`,
    `kms:assemble:internal` and a `kms/site-internal` Next build succeed.
R5. `CHANGELOG.md` updated (Gate 4).
R6. `lint`, `typecheck`, `test`, `format:check` all remain green after this slice.
