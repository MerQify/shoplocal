# Checkout recovery: staff-controlled abandoned-basket recovery (validation)

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
| R1  | Unit | `grep -n -A10 "enum CheckoutRecoveryStatus\|enum CheckoutRecoveryEventKind\|model CheckoutRecovery " prisma/schema.prisma` shows every value and field named in R1. |
| R2  | Unit | `grep -n -A6 "enum DiscountKind" prisma/schema.prisma` includes `FREE_DELIVERY`; `restrictedToUserId` with `onDelete: Cascade` in `model DiscountCode`. |
| R3  | Integration | Read the migration: header cites #895; `INSERT … SELECT` from `"AbandonedCheckoutReminder"` into both new tables before `DROP TABLE "AbandonedCheckoutReminder"`; `grep -c DROP` = 1. After CI applies it on staging, `/staff/abandoned-checkouts` shows previously reminded checkouts as "Email sent". |
| R4  | Unit | Repository test: the list `where` filters on the five origins and the 30-day window; `grep -rn ABANDONED_NOTE_PREFIX lib app` finds no selection use. |
| R5  | Unit + E2E | View-model test for each field incl. "Bought later"; staging page shows them (R25). |
| R6  | Unit | Availability helper test: inactive → unavailable, deleted product → unavailable, tracked stock < qty → "Only N left", untracked → available; price-change display. |
| R7  | Unit | Status derivation test over every stored status, no record, and both expiry cases at the boundaries. |
| R8  | Unit | Action test: PENDING → REVIEWED + event; non-admin refused. |
| R9  | Unit | Suppress/unsuppress tests; send and restore refused while suppressed. |
| R10 | Unit | Allocation tests: code fields (single-use, per-customer 1, restricted user, end date), bounds refused, guest refused, replace deactivates old code + events. |
| R11 | Unit | Bundle-eligibility test: all items present at quantity → listed; one short → not. |
| R12 | Unit | `evaluateCode` tests: restricted to another user → refused with the new reason; guest → refused; own user → ok. |
| R13 | Unit | `evaluateCode` tests: free delivery equals the fee; collection / zero fee refused; headroom cap respected. |
| R14 | Unit | `npm run typecheck` exits 0; discount list renders "Free delivery". |
| R15 | Unit + E2E | Preview service returns the same subject/HTML as the send builder for the same inputs; staging page shows the iframe. |
| R16 | Unit | Email builder test: image, current price, unavailable marker, total, free-delivery text, locked sentence, CTA href = restore link, opt-out footer; no "only"/"left"/countdown text. |
| R17 | Unit | Eligibility tests for suppressed and recovered added to the existing ones. |
| R18 | Unit | Send tests: first send fields + event; second refused without confirmation; with it → EMAIL_RESENT + new token; concurrent compare-and-set → one email. |
| R19 | Unit | Token test: stored value is the SHA-256 hash, raw token absent from every write. |
| R20 | Unit + E2E | GET page performs no write (repository double asserts no update); neutral page for unknown/expired/suppressed/other-vendor. |
| R21 | Unit | Restore action test: lines via `restoredLines`, event, `restoredAt`, redirect carries notice + code. |
| R22 | Unit | `confirmPayment` tests with the transaction double: match → RECOVERED + event; guest/no match → unchanged; already processed → unchanged. |
| R23 | Unit | `tests/staff-nav-parity.test.ts`, `tests/page-container.test.ts` and the refusal tests pass; the link is present in the staff orders page source. |
| R24 | Unit | `grep` the two guides for "restore link" / "Recovered"; `npm run kms:validate` exits 0. |
| R25 | E2E | Owner runs the journey on staging after merge and reports each step. |
| R26 | Unit | `git diff origin/staging -- CHANGELOG.md` cites #1732 and #1733. |
| R27 | Unit | `npm run lint`, `npm run typecheck`, `npm run format:check` exit 0; `npx vitest run --maxWorkers=4` alone exits 0. |
