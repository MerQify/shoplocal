# Unpaid checkout cancellations told apart from real cancellations (validation)

> **Testing Strategy (Lean 80/20 Model)**
> Provide enough testing to give confidence without creating unnecessary or duplicate tests. Avoid testing the same behaviour multiple times at different levels unless doing so provides additional confidence.
>
> **The Main Principle:**
> - **Build:** Did we build the component correctly?
> - **Validate:** Does the feature work correctly in the real system?
> - **Release:** Is the complete system safe, reliable, and ready for users?

## Validation Steps

| Req | Testing Area | How to verify |
|-----|--------------|---------------|
| R1  | Unit | `grep -n -A8 "enum CancellationOrigin" prisma/schema.prisma` lists the six values; `grep -n "cancellationOrigin CancellationOrigin?" prisma/schema.prisma` matches inside `model OrderStatusEvent`. |
| R2  | Integration | The new migration file exists, its header names #895, and `grep -c DROP <file>` prints `0`. `env -u DIRECT_URL -u DATABASE_URL npx prisma migrate status` against dev (host read first, per CLAUDE.md) lists it as the only pending migration before apply. |
| R3  | Integration | Read the migration's `UPDATE` statements: seven exact-match `note = '…'` clauses mapping to the origins in `plan.md`, one `cancellationReason IS NOT NULL` → `STAFF`, no `LIKE`, no catch-all. After applying to dev, `SELECT "cancellationOrigin", count(*) FROM "OrderStatusEvent" WHERE status='CANCELLED' GROUP BY 1` shows `NULL` only for notes outside the table (spot-check three). |
| R4  | Unit | `npx vitest run --maxWorkers=4 tests/cancel-order-action.test.ts tests/payment-sweep.test.ts` and the webhook/place-order tests assert each caller passes the origin from the table; `npm run typecheck` fails if any `releaseOrder` call omits it. |
| R5  | Unit | A test of `cancelConfirmedOrder` asserts the created event has `cancellationOrigin: "STAFF"`. |
| R6  | Unit | Test of the exported fragment: matches CANCELLED + no payment, CANCELLED + `FAILED`/`PENDING` payment; never matches CANCELLED + `SUCCEEDED`, CANCELLED + `REFUNDED`, or any non-CANCELLED order. |
| R7  | Unit | Test of `listOrdersForUser`'s query `where`: excludes the R6 fragment, returns `PENDING_PAYMENT`; `grep -n "Deliberately NOT filtered" lib/repositories/orders.ts` no longer matches and the replacement comment cites #1730. |
| R8  | E2E | `npm run preview`: open an unpaid checkout at each of the three pages (guest lookup with its token); each shows "Payment not completed" and "Payment not completed. You haven't been charged."; page text search for "Cancelled" finds nothing. |
| R9  | E2E | `npm run preview`: a paid order cancelled from `/staff/orders/[orderNumber]` shows "Cancelled" and its #1691 sentence on the same three pages. |
| R10 | E2E | `npm run preview`, signed in as staff: `/staff/orders?status=CANCELLED` omits the unpaid checkout; `/staff/orders?status=CANCELLED&unpaid=1` lists it; the "Show unpaid checkouts" control toggles between the two URLs. |
| R11 | E2E | On the same pages, each seeded origin shows its label; an event with `NULL` origin shows "Reason not recorded". |
| R12 | Integration | A test runs `releaseOrder` twice on one order (real compare-and-set via the WebSocket client against dev, or the repository's existing transaction double) and asserts one event, one origin, inventory incremented once. |
| R13 | Unit | `grep -n -i "unpaid checkouts" docs/staff-playbook/staff-tabs-guide.md docs/shopper-help/shopping-guide.md` matches in both; the staff guide lists all seven labels. `npm run kms:validate` exits 0. |
| R14 | E2E | The full journey in R14's sentence, run against `npm run preview` with the dev database, each step observed. |
| R15 | Unit | `git diff origin/staging -- CHANGELOG.md` shows an entry citing #1730. |
| R16 | Unit | `npm run lint`, `npm run typecheck`, `npm run format:check` exit 0; `npx vitest run --maxWorkers=4` run alone exits 0. |
