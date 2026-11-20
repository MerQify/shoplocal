# Client Setup: Receiving Addresses Dual Listbox Transfer Picker & Inline Edit

Closes #1682. Upgrades Client Setup's receiving address management by replacing the single-select dropdown with a Dual Listbox Transfer Picker (supporting drag-and-drop and 1-click transfer) and introducing an inline Edit action for existing receiving addresses so admins can modify destinations without deletion or duplicate address errors.

## Requirements & Acceptance Criteria

### Dual Listbox Transfer Picker (R1–R3)

R1. Accessible, responsive Dual Listbox Transfer component:
- Two lists: **Available Mailboxes** (left) and **Forward To Recipients** (right).
- Shows all verified Cloudflare destination addresses in the Available list (unless already transferred to Selected).
- Unverified/pending mailboxes show an "(awaiting verification)" indicator.
- Drag-and-drop support: items are draggable between Available and Selected lists using native HTML5 drag events with visual drop feedback.
- Accessible click actions: `Add →`, `← Remove`, `Add all →`, `← Clear all`, and double-click / quick-click to transfer.
- Ability to add a custom/other email mailbox directly into the Selected list.
- Renders a hidden `<input name="forwardTo">` holding the normalized comma-separated list of selected mailboxes, integrating seamlessly with Server Actions.

R2. `AddInboundAddressForm` integration:
- Uses the `DualListboxTransferPicker` for picking destinations instead of the nested `<select>` dropdown.
- Defaults to platform default forward inbox (if set and verified).

### Inline Edit for Receiving Addresses (R4–R7)

R4. `lib/repositories/inbound-address.ts`:
- Exports `updateInboundAddress(prisma, vendorId, id, { forwardTo, purpose? })`.
- Updates `forwardTo` (normalized) and optional `purpose` for the vendor's receiving address row.
- Returns `{ ok: true, row }` or `{ ok: false, reason: "not-found" }`.

R5. `lib/client-setup-service.ts`:
- Exports `updateInboundAddress(vendorId, id, { forwardTo, purpose? })`.
- Checks for email routing loops: rejects if any forward-to target equals the receiving address or any existing receiving address.
- Returns `{ ok: true }` or `{ ok: false, reason: "loop" | "not-found" }`.

R6. `app/(admin)/staff/platform/client-setup/actions.ts`:
- Exports `updateInboundAddressAction(_prev, formData)`:
  - Protected by `requireVendorRole("ADMIN")` with `auth.via === "platform-admin"`.
  - Validates `vendorId`, `id`, `forwardTo`, and optional `purpose` via `updateInboundAddressSchema`.
  - Calls `updateInboundAddress`.
  - Revalidates `/staff/platform/client-setup`.

R7. Inbound Address Row UI:
- Each receiving address in `/staff/platform/client-setup` provides an **Edit** button alongside **Remove**.
- Clicking **Edit** reveals an inline editing card:
  - Displays the receiving address as read-only.
  - Allows toggling purpose (`ORDERS` / `SUPPORT`).
  - Embeds the `DualListboxTransferPicker` prefilled with the address's current destinations.
  - Offers **Save** (submits `updateInboundAddressAction`) and **Cancel** (reverts to row display).
