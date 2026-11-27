---
id: storefront-security-controls
title: Storefront security controls
audience: [dev]
type: spec
status: approved
version: "1.0.0"
updated: 2026-11-27
visibility: internal
summary: Reserve authentication attempts under row locks and evaluate script policy on staging.
tags: [authentication, security, staging]
---

# Implementation and evidence

Reserve source and account capacity in the existing attempts table with ordered row locks under PostgreSQL READ COMMITTED. Account keys use a tenant-scoped HMAC. The script policy trial is selected by staging hostname. Browser console violations inform any later enforcement decision.

The local focused run passed 239 checks. The independent PostgreSQL 16 integration run admitted five of twelve concurrent source requests and ten of fourteen concurrent account requests. Production release and signed-in staging sign-off remain separate.
