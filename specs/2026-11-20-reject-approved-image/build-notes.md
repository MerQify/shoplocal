# Image library — reject an approved image (build notes)

Worktree `E:\GitRepositories\aheed-wt-1671`, branch `feature/1682-reject-approved`, from
`origin/staging` (`c1903674`) with `origin/docs/1678-post-ship` merged in under the carry-forward
rule. That branch's #1678 roadmap row, handoff update, sanity guide, `CLAUDE.md` curl note and the
restored "Local development (`dev`)" heading ride this PR.

## What changed and why

- `components/staff/ImageLibraryClient.tsx`, `LibraryCard`:
  - The reason input and **Reject** button are now one `rejectControls` fragment. Pending cards
    keep Approve plus that fragment.
  - Approved cards get **Reject…** for `canReview` users. It reveals the fragment
    (`rejectingApproved` state).
  - `reject()` maps `code === "in_use"` to `IN_USE_MESSAGE`. It passes other messages through.
- Four tests in `tests/image-library-client.test.tsx` (R1–R4). The staff tabs guide gains one
  sentence. CHANGELOG entry added.

## Decisions taken during the build

- **The reject controls on an approved card are folded behind "Reject…".** The card already
  carries **Assign…**, and an always-open reason box on every approved card would clutter the grid
  and invite accidental rejects.
- **Reject's `in_use` is the hub's own 409 code.** The store client passes hub codes through
  unchanged, so no service change was needed.

## Deviations from the spec

- None.

## Known-shaky areas

- R7 (live): the real hub `in_use` refusal reaching the card is proven only on staging.
