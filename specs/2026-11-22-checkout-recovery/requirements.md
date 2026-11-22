# Checkout recovery: staff-controlled abandoned-basket recovery (requirements / acceptance criteria)

Slices B (#1732) and C (#1733) of the checkout-recovery brief, re-scoped against #1554's existing
`/staff/abandoned-checkouts`. Builds on slice A's `OrderStatusEvent.cancellationOrigin` (#1730).
See `plan.md` for what already exists, the reasoning and the exclusions. No automated sending,
reminders or discounts.

## Data
R1. `prisma/schema.prisma` adds `enum CheckoutRecoveryStatus { PENDING REVIEWED EMAIL_SENT RECOVERED
    EXPIRED SUPPRESSED }`, `enum CheckoutRecoveryEventKind { REVIEWED INCENTIVE_ALLOCATED
    INCENTIVE_REMOVED EMAIL_SENT EMAIL_RESENT RESTORED RECOVERED SUPPRESSED UNSUPPRESSED }`,
    model `CheckoutRecovery` (vendor, unique `orderId`, `status`, `emailCount Int @default(0)`,
    `lastEmailedAt`, nullable unique `discountCodeId`, nullable unique `tokenHash`,
    `tokenExpiresAt`, `restoredAt`, nullable unique `recoveredOrderId`, `recoveredAt`,
    `suppressReason`, timestamps) and model `CheckoutRecoveryEvent` (recovery, vendor, kind,
    nullable actor user, nullable `discountCode` text snapshot, nullable `note`, `createdAt`).
R2. `DiscountKind` gains `FREE_DELIVERY`; `DiscountCode` gains nullable `restrictedToUserId`
    (relation to `User`, `onDelete: Cascade`).
R3. One hand-authored migration (header cites #895) creates the above, copies every
    `AbandonedCheckoutReminder` row into a `CheckoutRecovery` (`status EMAIL_SENT`,
    `emailCount 1`, `lastEmailedAt = sentAt`) plus an `EMAIL_SENT` event (actor, code, time
    preserved), then drops `AbandonedCheckoutReminder`; it contains no other `DROP`.

## Listing and availability
R4. The abandoned-checkout list selects orders whose latest CANCELLED event has
    `cancellationOrigin` in `CHECKOUT_CHANGED`, `CHECKOUT_ABANDONED`, `PAYMENT_EXPIRED`,
    `PAYMENT_FAILED`, `PROVIDER_UNAVAILABLE`, placed in the last 30 days; `STAFF` and `NULL` never
    appear; `ABANDONED_NOTE_PREFIX` is no longer used to select.
R5. Each row shows: customer name or "Guest", email, abandonment date, reason label, items with
    quantities, basket value, original order number (linked to its staff order page), status, and
    "Bought later" with the order number when the same signed-in customer has a paid order placed after
    the abandonment.
R6. Each line shows its availability — "Available", "Only N left" (tracked stock below the basket
    quantity), or "No longer available" (product inactive or deleted) — and its current unit price
    beside the original when they differ.
R7. A row's status reads: the stored status; "Pending" with no record; "Expired" when unsent and
    more than 7 days past abandonment, or sent and its token has expired without recovery (derived
    at read time, never written by a job); `SUPPRESSED` and `RECOVERED` always show as stored.

## Staff actions (store admins only; each refuses for anyone else)
R8. **Mark reviewed** creates or updates the record to `REVIEWED` (only from `PENDING`) and records a
    `REVIEWED` event.
R9. **Don't contact** sets `SUPPRESSED` with an optional reason and a `SUPPRESSED` event; **Allow
    contact** returns it to `REVIEWED` with an `UNSUPPRESSED` event. A suppressed checkout cannot be
    emailed and its restore link stops working.
R10. **Allocate incentive** creates a `DiscountCode` with `remainingRedemptions 1`,
    `maxPerCustomer 1`, `restrictedToUserId` = the customer, kind percentage (1-50%), fixed amount
    (£0.50 up to the basket value) or free delivery (delivery orders only), optional minimum spend
    and optional end date (default 14 days); links it to the recovery and records
    `INCENTIVE_ALLOCATED`. Allowed only for a signed-in customer's checkout. Replacing or removing
    it deactivates the old code and records `INCENTIVE_REMOVED`. Allocating to a guest checkout is
    refused.
R11. The preview lists active bundles whose every `BundleItem` product is in the basket at no less
    than the bundle quantity; nothing is created from it.

## Discount evaluation
R12. `evaluateCode` refuses a code whose `restrictedToUserId` is set and differs from the
    checkout's user (new refusal reason with customer-facing text), and refuses it for a guest.
R13. A `FREE_DELIVERY` code is worth exactly the checkout's delivery fee, capped by the existing
    minimum-payable headroom; on a collection order, or with a zero delivery fee, it is refused with
    a clear reason; it never reduces goods.
R14. Every `Record<DiscountKind, …>` and kind label in the staff discount pages handles
    `FREE_DELIVERY` ("Free delivery"); `typecheck` proves it.

## Preview and email
R15. **Preview** renders, without sending, the exact subject and HTML the send would produce,
    including recipient, incentive and restore-link placeholder, in a sandboxed `iframe`.
R16. The recovery email lists each line with its product image (when it has one), quantity and
    current price, marks unavailable lines, shows the current total, the incentive (including
    "Free delivery"), the locked sentence "Your payment wasn't completed, so you haven't been
    charged.", and a button to the restore link; it keeps the existing opt-out footer and consent
    reason, and contains no countdown or scarcity claim.
R17. Sending keeps #1554's eligibility (signed-in, verified email, current consent for this store,
    within 7 days of abandonment) and additionally refuses a suppressed or recovered checkout.
R18. The first send sets `EMAIL_SENT`, `emailCount 1`, `lastEmailedAt`, a fresh token
    (`tokenExpiresAt` 14 days) and an `EMAIL_SENT` event. A further send is refused unless the
    form carries an explicit "send again" confirmation; then it records `EMAIL_RESENT` and issues
    a fresh token. Both use a compare-and-set on `emailCount`, so two concurrent sends produce one
    email; a test proves it.

## Restore link
R19. The token is 32 random bytes (base64url) and only its SHA-256 hash is stored; a test proves the
    raw token is never persisted.
R20. `GET /recover/<token>` changes nothing and shows the basket with current prices and
    availability and a **Restore my basket** button; an unknown, expired, suppressed or
    other-vendor token shows one neutral "This link has expired" page.
R21. The restore action re-validates the token, adds the available lines to the visitor's current
    basket via `restoredLines`, records `RESTORED` and `restoredAt`, and redirects to `/cart` with
    the restore notice (listing unavailable or short lines) and, when an incentive exists, its code.
    Restoring twice adds nothing the second time beyond what the cart already holds (merge
    semantics), and records one `RESTORED` event per use.

## Recovered tracking
R22. Inside `confirmPayment`'s transaction, after its compare-and-set succeeds: the paying user's
    newest `EMAIL_SENT` recovery (same vendor) emailed within 14 days becomes `RECOVERED` with
    `recoveredOrderId`, `recoveredAt` and a `RECOVERED` event; a guest order or no match changes
    nothing; a repeated confirm (already processed) changes nothing. Tests cover all three.

## Staff order management and docs
R23. `/staff/orders`' "Show unpaid checkouts" line links to `/staff/abandoned-checkouts`; the
    abandoned-checkouts page stays registered once in `components/staff/nav-items.ts`, refuses
    non-admins with `PanelRefusal`, and uses `PageContainer`.
R24. The store-admin guide documents the recovery page (statuses, reasons, availability,
    incentives, preview, sending and resending, restore link, recovered); the shopper guide's
    basket-reminder line mentions the restore link and that payment wasn't taken.
R25. Against staging after merge, the owner confirms: a listed checkout shows reason, availability
    and status; allocate free delivery → preview shows it; send to a consented demo customer → the
    email arrives with images and the restore link; the link restores the basket; paying it marks
    the checkout **Recovered** with the new order number.
R26. `CHANGELOG.md` updated (Gate 4).
R27. `lint`, `typecheck`, `test`, `format:check` all remain green after this slice.
