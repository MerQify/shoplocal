---
id: 2026-11-28-proprietary-licence
title: "Proprietary licence for the public ShopLocal repository (plan)"
audience: [dev]
type: spec
status: approved
version: "1.0.0"
updated: 2026-11-28
visibility: internal
summary: Adds an all-rights-reserved LICENSE, the UNLICENSED package.json marker and a README note, so the public MerQify/shoplocal repository states plainly that it is not open source.
tags: [licence, legal, github, merqify]
related: [2026-11-27-org-move-references]
---

# Proprietary licence for the public ShopLocal repository (plan)

Issue [#1773](https://github.com/MerQify/shoplocal/issues/1773).

The owner decided on 2026-11-27 to keep `MerQify/shoplocal` public until it earns revenue, under a
proprietary licence. The repository has no licence file. Under copyright law that already means
all rights reserved, but nothing says so, and visitors may assume a public repository is open
source.

**Goal:** the repository states, in the places people and tools look, that the code is proprietary.

**Scope (this slice):**
- `LICENSE` at the root: all rights reserved, © 2026 Srikanth Gedela, trading as MerQify. Viewing
  on GitHub is allowed; copying, modifying, distributing, hosting, or providing a service with the
  code is not, without written permission. Third-party dependencies keep their own licences; client
  names, logos, product data and content belong to their owners.
- `package.json`: `"license": "UNLICENSED"`, npm's marker for proprietary code.
- `README.md`: a short "Licence" section pointing at `LICENSE`.

**Deliberately excluded:**
- Any OSI or source-available licence: an open-source grant cannot be withdrawn for copies already
  taken, which would defeat the later move to private.
- Moving the copyright to a company: MerQify is not yet registered. After registration and an IP
  assignment, the copyright line changes in a one-line follow-up.
- Legal review: the text is a plain all-rights-reserved notice; the owner may have a solicitor
  review it at registration.
