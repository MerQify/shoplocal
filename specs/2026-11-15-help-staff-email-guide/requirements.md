# Staff & Store Email Setup Guide on /help (requirements / acceptance criteria)

Closes `#1619`. Adds step-by-step guidance for store admins and staff to configure personal Gmail ("Send mail as") and understand Google Groups email routing and Staff Panel alternatives on `/help`.

R1. The `/help` page (`app/(storefront)/help/page.tsx`) features a quick jump navigation chip labeled "Staff Email Setup" linking smoothly to `#staff-email`.
R2. The `/help` page renders a dedicated section `#staff-email` with:
    - Step 1: Generating a 16-character Google App Password with link to Google Security Settings.
    - Step 2: Adding the store sender address to Gmail desktop Settings ("Send mail as") with SMTP server `smtp.gmail.com`, port `587`, TLS, and App Password.
    - An explanatory note clarifying that Google Groups handles inbound distribution to all members automatically, but outbound replies from personal Gmail require individual App Password setup.
    - A callout linking to the zero-setup Staff Panel Enquiries Inbox (`/staff/enquiries`) where staff can reply directly as the store.
R3. The Store Admin Guide (`docs/store-admin-guide/admin-tabs-guide.md`) and Staff Playbook (`docs/staff-playbook/staff-tabs-guide.md`) document the Gmail setup and Google Groups mechanics.
R4. All quality gates (`typecheck`, `lint`) pass without error.
