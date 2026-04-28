# Sprint 1 — Foundation Results

**Period:** 2026-04-28
**Status:** Closed
**Audit reference:** `PLAN.md`, `ROADMAP.md`

## Delivered

### Branch & repo hygiene
- Single-main policy enforced via branch protection
- `delete_branch_on_merge: true`, squash-only merges, auto-merge enabled
- Stale branches removed (PS: `v0/infoplay2015-1241-af8b70e7`, UM: `migrate-branches-to-main`)
- Obsolete PR closed (PS #30, 22 commits behind, conflicting)

### CI / Security pipeline
- `ci.yml` — lint, type-check, tests on Python 3.10/3.11/3.12, Docker build, repo hygiene
- `codeql.yml` — SAST on Python
- `secret-scan-pr.yml` — gitleaks on PR diff only (**blocking**)
- `gitleaks.yml` — full-history scan (**informational**, weekly + push) until Issue #9 closes
- `release-please.yml` — Conventional-Commits → auto-release
- `stale.yml` — issue/PR auto-triage
- `dependabot.yml` — weekly grouped updates

### Governance
- `CODEOWNERS`, PR template, three issue templates (bug, feature, clone)
- `pre-commit-config.yaml` (ruff + mypy + gitleaks-binary + standard hygiene)
- `CONTRIBUTING.md`, `SECURITY.md`, `THIRD_PARTY_NOTICES.md`

### Code
- **PS PR #54** — Sprint 1 foundation (demo bug fix, gitleaks license workaround, pre-commit hook)
- **PS PR #55** — Docker `ENTRYPOINT` so `docker run image --help` works
- **PS PR #51** — Dependabot bump release-please-action v4→v5 (verifies pipeline E2E)
- **PS Issue #31** — corrected false claim, retitled to coverage-gate scope

## Verified end-to-end
1. Branch protection blocks force-push and direct commits to `main`. ✅
2. PRs require CODEOWNERS approval. ✅
3. CI required checks block merge until green. ✅
4. Admin-merge with `gh api` works (used to merge own automation PRs). ✅
5. `Secret scan` now scans only PR diff and passes for clean PRs. ✅
6. Squash-merge auto-deletes head branch. ✅

## Setup pre-commit locally (developer)

```bash
# one-time per clone
pip install pre-commit
pre-commit install
pre-commit install --hook-type commit-msg

# verify
pre-commit run --all-files
```

This wires ruff, mypy, gitleaks (binary, not the action), and standard hooks into your local commits. Without this, gitleaks only runs in CI and you'll discover leaks too late.

## Open from Sprint 1 (carry over to Sprint 2)
- **PS #9** — NVIDIA API key history rewrite (P0, blocked on owner running `git filter-repo` + force-push)
- **PS #31** — coverage-gate + integration tests (rescoped)
- **PS #32** — Stealth-Benchmark in CI (CreepJS/SannySoft)

## Sprint 2 entry condition
- All P0 audit issues closed or actively in progress
- First clone-issue PR opened (PS-CLONE-1: playwright-stealth code import OR UM-CLONE-1: Browser-Use DOM serializer idea-only)
- README updated with truthful capability matrix
