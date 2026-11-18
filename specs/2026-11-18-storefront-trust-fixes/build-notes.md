# Storefront trust fixes (build notes)

Worktree: `E:\GitRepositories\aheed-wt-1652` (branch `feature/storefront-trust-fixes-1652`), with
`node_modules` junctioned to the main checkout — `rmdir` the junction before `git worktree remove`.

## What changed and why

- `app/(storefront)/help/page.tsx` — staff email guide and its jump chip wrapped in `isStaff`;
  journey roles computed from the viewer's role (customer only → +staff → +store-admin → all four)
  and passed to `RoleJourneyMaps`. The roles list is built in the server page, not exported from
  the `"use client"` component, because a server component cannot call a client module's function.
- `components/help/RoleJourneyMaps.tsx` — `roles` prop (default `["customer"]`, so any other caller
  is safe by default); filters tabs to `roles`; a single role hides the tablist and uses a shopper
  heading ("How shopping works").
- `app/(storefront)/terms/page.tsx` — section 4 rewritten into four short sub-sections; section 5
  replaced; date bumped.

## Decisions taken during the build

- No fixed reporting deadline in the refund copy ("as soon as possible after you receive it"): the
  page is shared by a grocer and an electronics shop, and the deadline is each vendor's decision.
- The cancellation exemption quotes the statutory wording (goods "liable to deteriorate or expire
  rapidly", sealed hygiene goods) instead of grocery examples, per the vendor-copy rule.
- "5 to 10 working days" for refunds to appear is the card-network norm Stripe documents; it is
  framed as "normally", "depending on your bank".
- Clause 5's removed VAT-allocation text has no home in the repo (no merchant agreement exists);
  it remains in git history.

## Deviations from the spec

None.

## Known-shaky areas

- The refund wording is a plain-language summary of UK consumer law, not legal advice; the client's
  owner should read it before go-live.
- Pre-existing `profile?.name ?? "Aheed Food Centre"` fallbacks in `terms/page.tsx` (metadata and
  body) were left as they were — out of scope; they only fire with no vendor profile.
- Local full run (`--maxWorkers=4`): 4 files fail identically on clean `staging` and are not touched
  here — `aheed-stock-import-safeguards`, `concurrency-slot-booking`, `express-sla`,
  `slot-capacity`. CI is the ground truth.
- `tests/role-journey-maps.test.tsx` was updated: its tests assumed every role renders by default,
  which is the behaviour this slice removes; they now pass `roles` explicitly.
