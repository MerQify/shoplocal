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
