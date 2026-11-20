# Image library — reject an approved image (requirements / acceptance criteria)

Closes #1682. `/staff/image-library` lets store admins reject an **Approved** image through the
existing `rejectLibraryAction`. An image still in use is refused by the hub (409 `in_use`), and the
card explains what to do. "Staging" means `aheed-staging.merqify.com` after merge.

R1. In `components/staff/ImageLibraryClient.tsx`, an **Approved** card with `canReview` true renders
    a **Reject…** button. A Pending card still renders Approve and Reject exactly as before. With
    `canReview` false, neither an Approved nor a Pending card renders Approve, Reject or Reject….
R2. Clicking **Reject…** reveals a reason input (labelled "Reason for rejecting") and a **Reject**
    button. **Reject** with an empty reason shows "Give a reason for rejecting it." and does not call
    the action. With a reason, it calls `rejectLibraryAction(assetId, reason)`.
R3. On success the card shows the returned asset: status "Rejected" with "Rejected: <reason>", and no
    **Assign…** or **Reject…** button.
R4. When the action returns `{ ok: false, code: "in_use" }`, the card shows, in a `role="alert"`
    element: "This image is used on a product or category. Remove it there first, then reject it."
    Any other failure shows the returned `message`, as today.
R5. `tests/image-library-client.test.tsx` covers R1–R4 with the actions mocked.
R6. `docs/staff-playbook/staff-tabs-guide.md` (Image library) says that a store admin can also reject
    an image after approving it, unless it is in use on a product or category.
R7. Live (staging, demo store admin):
    - Rejecting an approved image that is not in use turns it Rejected.
    - Rejecting one assigned to a product shows the R4 message and leaves it Approved.
    - Test data is cleaned up afterwards.
R8. `CHANGELOG.md` updated (Gate 4).
R9. `npm run lint`, `typecheck`, `format:check`, `npx vitest run --maxWorkers=4` and `build` are
    green, as is CI on the PR.
