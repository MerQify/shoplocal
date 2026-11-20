---
id: multi-forward-destination-verification-plan
title: "Client Setup — multi-forward receiving addresses & in-dashboard destination verification (plan)"
audience: [dev]
type: spec
status: draft
version: "1.0.0"
updated: 2026-11-20
visibility: internal
summary: "Enables stores to forward incoming customer enquiries to multiple team members simultaneously without Google Groups, and lets platform admins send Cloudflare Email Routing destination verification emails directly from /staff/platform/client-setup."
tags: [email, client-setup, inbound-email, platform-admin, p10]
related: [architecture]
---

# Implementation Plan: Multi-Forward & Destination Verification

**Issue:** #1680  
**Branch:** `feature/1680-multi-forward-destination-verification`  
**Base:** `staging`  

## Step 1: Destination Verification API & Tests
* File: `lib/email/destinations.ts`
  * Add `createDestinationAddress(credentials, email, fetchImpl)` to call `POST .../email/routing/addresses`.
* File: `tests/email-destinations.test.ts`
  * Add unit tests for successful creation, 401/403 forbidden, already-exists error, and network failure.

## Step 2: Server Actions & Inbound Address Repository
* File: `lib/repositories/inbound-address.ts`
  * Add `normaliseForwardToList(forwardTo: string): string` to handle comma-separated emails.
* File: `app/(admin)/staff/platform/client-setup/actions.ts`
  * Add `sendDestinationVerificationAction(prevState, formData)`.
  * Update `addInboundAddressAction` to accept and validate multiple forward-to addresses against verified destinations.

## Step 3: Client Setup UI
* File: `components/staff/client-setup/EmailSetupForms.tsx`
  * Add `AddDestinationAddressForm` (input for email + button to dispatch verification).
  * Update `AddInboundAddressForm` with multi-select checkboxes for verified destinations.
* File: `lib/client-setup/inbound-groups.ts`
  * Update `groupAddressesByForwardTo` and `forwardTargetsVerified` to support comma-separated multi-recipient forward strings.
* File: `app/(admin)/staff/platform/client-setup/page.tsx`
  * Mount `AddDestinationAddressForm` in the Email section.

## Step 4: Inbound Worker Multi-Forwarding
* File: `workers/inbound-email/src/index.ts`
  * Update `handleInboundEmail` to split `resolution.forwardTo` and loop calls to `message.forward()`.
* File: `tests/inbound-email-worker.test.ts`
  * Add unit test asserting multiple `message.forward()` calls for comma-separated resolutions.

## Step 5: Verification & Validation
* Run test suite: `npx vitest run tests/email-destinations.test.ts tests/client-setup-*.test.ts tests/inbound-email-worker.test.ts`.
* Run full quality gates: `npm run lint`, `npm run typecheck`.
