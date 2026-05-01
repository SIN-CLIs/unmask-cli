# Security Policy

## Reporting a vulnerability

**Do not** file public issues for security problems.

Use GitHub's private vulnerability reporting:

- https://github.com/SIN-CLIs/playstealth-cli/security/advisories/new
- https://github.com/SIN-CLIs/unmask-cli/security/advisories/new

We aim to acknowledge within **72 hours** and ship a fix or mitigation within **14 days**
for critical issues.

## Supported versions

| Version               | Supported     |
| --------------------- | ------------- |
| `main`                | yes (rolling) |
| latest tagged release | yes           |
| anything older        | no            |

## Scope

- Code in this repository
- CI/CD configuration in `.github/`
- Published packages with the same name

Out of scope:

- Third-party services we link to
- Vulnerabilities requiring an attacker to already control your machine

## Hardening commitments

- Secret scanning via `gitleaks` on every push and PR.
- Static analysis via CodeQL on every push and PR.
- Branch protection on `main`: signed reviews, status checks, no force-push, no direct push.
- Dependabot weekly with auto-grouping.
- All releases via `release-please` with provenance attestations where supported.
