---
id: 2026-11-27-org-move-references
title: "Repository references after the move to MerQify/shoplocal (plan)"
audience: [dev]
type: spec
status: approved
version: "1.0.0"
updated: 2026-11-27
visibility: internal
summary: Points the live code links and current docs at MerQify/shoplocal and MerQify/image-hub after the 2026-11-27 transfers, leaving the dated historical record unchanged.
tags: [github, repository, docs, merqify]
related: []
---

# Repository references after the move to MerQify/shoplocal (plan)

Issue [#1771](https://github.com/MerQify/shoplocal/issues/1771).

On 2026-11-27 this repository was transferred from `sriahead/merqify` to `MerQify/shoplocal`, and
the Image Hub from `sriahead/merqify-image-hub` to `MerQify/image-hub`. GitHub redirects both old
names (and the older `sriahead/aheed-online-store`), so nothing broke. The redirects last only while
nobody creates a new repository under an old name, so the live code and the docs people follow
should name the real home.

**Goal:** every *current* reference names `MerQify/shoplocal` or `MerQify/image-hub`; the operator
runbook records where the repository lives and why the old names must never be recreated.

**Scope (this slice):**
- Code: the issue link in `components/staff/PricingDashboardSections.tsx`, `docsRepositoryBase` in
  `kms/site-internal/app/layout.tsx`, and the comments in `lib/config.ts` and
  `lib/image-hub/client.ts`.
- Living docs: `docs/developer-portal/env-setup.md`, `docs/developer-portal/sdd/operator-runbook.md`,
  `docs/developer-portal/pre-launch-application-audit.md`, `specs/architecture.md`,
  `specs/tech-stack.md`, and the current-state lines of `docs/model-handoff.md`.
- Regenerated: `ARTIFACT_INDEX.md`, `app/(admin)/staff/runbook/docs.ts`.

**Deliberately excluded:**
- Dated slice folders under `specs/20*`, the `specs/roadmap.md` change log and `CHANGELOG.md`: they
  record what was true when written, and the redirects resolve their links.
- `--owner sriahead` in board commands: Project #2 stays on the `sriahead` account.
- `MerQify/image-hub`'s own docs: a separate PR in that repository.
- The stale `shoplocal.merqify.com` value in local `secrets/merqify-*.vars`: a configuration
  question, not a reference.
- Git history: never rewritten.
