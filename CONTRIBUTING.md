# Contributing

This project follows a strict **single-`main`-branch** policy after the 2026-04-28 CEO audit.
Long-lived feature branches are not allowed. Use short-lived topic branches that are deleted on merge.

## Workflow

1. Open or claim an issue. Every PR must reference one.
2. Branch from `main` as `topic/<issue-number>-short-slug`.
3. Keep PRs small. < 400 lines diff is the target.
4. Squash-merge to `main`. Delete the branch on merge.

## Conventional Commits (required)

We use Conventional Commits so `release-please` can ship automatically:

- `feat: ...` — new feature (minor bump)
- `fix: ...` — bug fix (patch bump)
- `feat!: ...` or `BREAKING CHANGE:` footer — major bump
- `docs:`, `chore:`, `ci:`, `refactor:`, `test:`, `perf:`, `build:` — no version bump
- `clone:` — a clone-and-combine import (must include upstream + license)

## Cloning competitors (Clone-the-Best-Combine-Win)

See `COMPETITIVE_STRATEGY.md`. TL;DR:

- Permissive license (MIT/Apache-2.0/BSD/ISC): code import is OK, attribute in `THIRD_PARTY_NOTICES.md`.
- Copyleft (GPL/AGPL/MPL): **idea-only**, reimplement from public spec.
- Proprietary: do not use.
- Open a "Clone research" issue first.

## Tests & coverage

- Coverage gate: 75% overall, 90% on new code in changed files.
- Every imported module from a competitor must ship with at least one test that pins our adapted behavior.

## Security

- No secrets in commits, ever. `gitleaks` runs in CI and via pre-commit.
- Report vulnerabilities privately via `SECURITY.md` — never as a public issue.

## Definition of Done

A PR is mergeable when:

- [ ] CI green (lint, type-check, tests, gitleaks, codeql)
- [ ] Linked issue checked off
- [ ] Docs updated
- [ ] Reviewer approved
- [ ] No `TODO` without an issue link
