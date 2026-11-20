---
id: receiving-address-transfer-list-edit-plan
title: "Client Setup — receiving addresses dual listbox transfer picker & inline edit (plan)"
audience: [dev]
type: spec
status: draft
version: "1.0.0"
updated: 2026-11-20
visibility: internal
summary: "Replaces single-select dropdown with an accessible HTML5 dual listbox transfer picker for managing forward destinations, and introduces inline edit mode for existing receiving addresses."
tags: [email, client-setup, inbound-email, transfer-picker, p10]
related: [multi-forward-destination-verification-plan, architecture]
---

# Implementation Plan: Receiving Addresses Dual Listbox Transfer Picker & Inline Edit

## 1. Schema & Repository Layer
- In `lib/repositories/inbound-address.ts`:
  - Implement and export `updateInboundAddress(prisma, vendorId, id, input)`.
  - Pure function taking `prisma` explicitly, no request context.

## 2. Service & Validation Layer
- In `lib/client-setup/form-state.ts`:
  - Add `updateInboundAddressSchema` validating `vendorId`, `id`, `forwardTo`, `purpose`.
- In `lib/client-setup-service.ts`:
  - Implement and export `updateInboundAddress(vendorId, id, input)`.
  - Enforce loop prevention and target existence.

## 3. Server Action Layer
- In `app/(admin)/staff/platform/client-setup/actions.ts`:
  - Implement and export `updateInboundAddressAction(_prev, formData)`.
  - Gated by platform-admin check.
  - Call `revalidatePath('/staff/platform/client-setup')`.

## 4. UI Components Layer
- In `components/staff/client-setup/DualListboxTransferPicker.tsx`:
  - Create interactive dual listbox with drag-and-drop, quick-transfer buttons, and custom mailbox input.
- In `components/staff/client-setup/EmailSetupForms.tsx`:
  - Update `AddInboundAddressForm` to use the new transfer picker.
  - Create `InboundAddressRow` component providing inline edit toggling, `UpdateInboundAddressForm`, and `RemoveInboundAddressButton`.
- In `app/(admin)/staff/platform/client-setup/page.tsx`:
  - Render `InboundAddressRow` for each receiving address.

## 5. Testing & Verification
- Unit test repository `updateInboundAddress` in `tests/repositories/inbound-address.test.ts` (or `tests/client-setup.test.ts`).
- Unit test service `updateInboundAddress` and server action `updateInboundAddressAction`.
- Component tests for `DualListboxTransferPicker` and `InboundAddressRow`.
- Full test suite, linter, and typecheck passes.
