# Storefront trust fixes (requirements / acceptance criteria)

Closes the code side of `#1652`: an anonymous visitor to `/help` sees no staff instructions, and
`/terms` carries an actionable refund policy and shopper-facing platform wording. See `plan.md`.

R1. `/help` rendered for an unauthenticated visitor contains no "Staff & Store Email Setup" section
    (no element `#staff-email`), no "Staff Email Setup" jump link, and no "App Password" text.
R2. `/help` rendered for an authenticated staff member still contains the `#staff-email` section
    and its jump link.
R3. `app/(storefront)/help/page.tsx` contains no literal `aheedfoodcentre` string.
R4. `RoleJourneyMaps` accepts a `roles` prop and renders a tab only for each listed role; with a
    single role it renders no `tablist`.
R5. `/help` for an unauthenticated visitor shows the customer journey only: no "Store Staff",
    "Store Admin" or "Platform Admin" text, and no `role="tablist"`. A platform admin still sees
    all four roles.
R6. `/help` keeps the `#delivery` anchor (footer "Delivery areas & slots" link).
R7. `/terms` section `#refunds` states: how to report a damaged, missing or wrong item; that
    refunds go to the original payment method and an indicative timescale; the 14-day cancellation
    right; and its exemption for goods liable to deteriorate or expire rapidly.
R8. `/terms` no longer contains "Tax Responsibility" or the VAT-liability allocation; it names the
    vendor as the seller and Merqify Ltd as the software provider.
R9. `/terms` shows "Last updated: November 18, 2026".
R10. Neither page introduces a vendor name, trade or grocery example into copy (vendor name comes
     only from the profile).
R11. `CHANGELOG.md` updated (Gate 4).
R12. `lint`, `typecheck`, `test`, `format:check` all remain green after this slice.
