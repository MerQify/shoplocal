# Image library — reject an approved image (validation)

> **Testing Strategy (Lean 80/20 Model)**
> The change is one card's controls and one error mapping. Component tests with the actions mocked
> cover them. One live pass on staging proves the hub's real `in_use` refusal reaches the card.

## Validation Steps

| Req | How to verify |
|---|---|
| R1 | `npx vitest run tests/image-library-client.test.tsx`: the approved-admin, approved-staff and pending cases pass. |
| R2 | Same file: the empty-reason case (no action call) and the call-with-reason case pass. |
| R3 | Same file: after a successful reject, the card shows "Rejected: <reason>" and has no Assign… or Reject… button. |
| R4 | Same file: the `in_use` case shows the exact R4 sentence in `role="alert"`. |
| R5 | The tests above exist and pass. |
| R6 | `grep -n "after approving" docs/staff-playbook/staff-tabs-guide.md` finds the sentence, which traces to the R1 control. |
| R7 | On staging as `demo-admin@merqify.com`: (a) upload and approve a test image, then Reject… with a reason → "Rejected". (b) Approve a second test image, assign it to a product with no image, then Reject… → the R4 message, and the image stays Approved. Remove it from the product, Reject → "Rejected". |
| R8 | `git diff origin/staging -- CHANGELOG.md` shows the #1682 entry. |
| R9 | `npm run lint && npm run typecheck && npm run format:check && npx vitest run --maxWorkers=4 && npm run build` all exit 0. CI on the PR is green. |

## Results (2026-11-20)

Validated in the **same session and on the same model that built it (Opus 5.5)**, at the owner's
choice, so this is **not independent**.

- **Pre-flight on `e5d89d86`:** all pass.
  - lint, typecheck and format:check
  - `npx vitest run --maxWorkers=4`: 493 files and 7163 tests passed
  - `build`, with check-client-syntax parsing 185 files
- **R1–R6, R8: pass.**
  - R1–R4: four `#1682` tests, plus the pre-existing pending-card test, all passing.
  - R6: the guide sentence traces to the **Reject…** control (R1).
  - R8: the CHANGELOG entry is present.
- **Server gate:** `rejectImageLibraryAsset` is `ADMIN_ONLY`, so a staff user calling the action
  directly is refused too. The only UI caller is `LibraryCard`.
- **Hub behaviour the card relies on:**
  - `POST /v1/assets/{id}/reject` returns 409 `in_use` when the asset has usages
    (`src/routes/assets.ts`, `hasUsages`).
  - It rejected APPROVED assets live at #1678's ship clean-up.
- **R7 (live): unverified** until staging. It runs at Ship.
- **R9's CI half: unverified** until the PR runs.
