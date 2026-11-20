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
