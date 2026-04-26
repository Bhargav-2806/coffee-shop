# DevSecOps Mindset — Phase 3: CI Pipeline (GitHub Actions)

> **Core Principle:** The CI pipeline is your first automated security gate.  
> Every commit must pass security checks before a single line reaches production.

---

## What We Built

| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | Full CI pipeline — 9 stages |
| `vitest.config.ts` | Test runner + coverage configuration |
| `sonar-project.properties` | SonarQube project config |
| `server/__tests__/` | Backend API unit tests |
| `src/__tests__/` | React component unit tests |

---

## Pipeline Overview

```
Push / PR
    │
    ▼
Stage 1+2 → Build · Unit Tests · Coverage (≥70%)
    │
    ▼
Stage 3 → SCA — Snyk (fail on HIGH/CRITICAL deps)
    │
    ▼
Stage 4+5 → SAST — SonarQube + Quality Gate (fail = stop)
    │
    ▼
Stage 6 → Build Docker Image (multi-stage)
    │
    ▼
Stage 7 → Trivy CVE Scan + SBOM (fail on CRITICAL)
    │
    ▼
Stage 8 → Smoke Test (assert all endpoints 200)
    │
    ▼
Stage 9 → Push to Docker Hub + Cosign Sign  ← main branch only
```

---

## Why This Order Matters (Shift-Left)

The order is deliberate. Cheap, fast checks run first. Expensive, slow checks run later. Security gates stop the pipeline before wasting time on later stages.

| Stage | Why it runs here |
|-------|-----------------|
| Build + Tests first | No point scanning code that doesn't compile or has failing tests |
| SCA before SAST | Dependency vulns are faster to catch than code analysis |
| SAST before Docker build | Fix code issues before baking them into an image |
| Trivy after Docker build | You can only scan an image that exists |
| Smoke test before push | Never push an image that doesn't actually run |
| Push only on main | PRs prove the pipeline works — only merge triggers a real artifact |

---

## Stage 1+2 — Build, Tests & Coverage

### Why Code Coverage Has a Threshold?

Coverage without a threshold is just a vanity metric. We enforce ≥70% lines to ensure untested code cannot silently ship. A developer who skips tests will see the pipeline fail, not just a yellow badge.

**What 70% means in practice:** Core business logic (API routes, data transforms) must be tested. Boilerplate and config files are excluded.

### Why `npm ci` and Not `npm install`?

`npm install` can silently add, update, or resolve packages differently on each run. `npm ci` uses the exact package-lock.json — reproducible on every machine, every time. Critical for security: you know exactly what code you're testing and shipping.

### Why TypeScript Type Check in CI?

TypeScript errors caught locally don't always block a commit. Running `tsc --noEmit` in CI ensures type safety is enforced as a hard gate, not a developer preference.

---

## Stage 3 — SCA: Snyk Dependency Scanning

### What SCA Does

SCA (Software Composition Analysis) scans every package in `node_modules` against a database of known CVEs. If `express@4.21.2` has a critical vulnerability, Snyk catches it before it ships.

### Why Fail on HIGH Not Just CRITICAL?

CRITICAL vulnerabilities are obvious. HIGH vulnerabilities are the ones that compromise production systems with more effort. Ignoring HIGH issues is how supply chain attacks succeed. We fail on both.

### Why Scan Both Frontend and Backend?

`--all-projects` scans the entire monorepo. A React library with a HIGH XSS vulnerability is just as dangerous as a backend package with an injection flaw.

---

## Stage 4+5 — SAST: SonarQube + Quality Gate

### What SAST Does

SAST (Static Application Security Testing) analyses source code without running it. It finds:
- Security hotspots (hardcoded secrets, unsafe regex, XSS risks)
- Code smells (complexity, duplication)
- Bugs (null dereference, unreachable code)

### Why Self-Hosted SonarQube?

Self-hosted Community Edition is free forever. Your source code never leaves your infrastructure. For enterprises this is a compliance requirement — source code is IP and must not be sent to third-party cloud services.

### Why `fetch-depth: 0` on Checkout?

SonarQube uses git blame to attribute issues to specific authors and detect new code vs existing code. With `fetch-depth: 1` (shallow clone), SonarQube cannot do blame analysis and treats everything as "new code", making quality gate results unreliable.

### What is a Quality Gate?

A Quality Gate is a set of conditions SonarQube evaluates after analysis. Default conditions:

| Metric | Threshold |
|--------|-----------|
| New bugs | 0 |
| New vulnerabilities | 0 |
| New security hotspots reviewed | 100% |
| New code coverage | ≥ 70% |
| New code duplication | < 3% |

If ANY condition fails → pipeline stops. This is non-negotiable: code with known security issues does not ship.

### Why Run SonarQube as a Service Container?

Rather than requiring a persistent SonarQube server (which adds infrastructure overhead), we spin up an ephemeral SonarQube instance inside the CI job itself. This means:
- Zero external infrastructure to maintain
- Every pipeline run gets a fresh, clean analysis
- No credential rotation or server maintenance

---

## Stage 6 — Docker Build

### Why Build the Image in CI (Not Locally)?

Images built on developer machines vary by OS, local env vars, and cached layers. Images built in CI are:
- Reproducible — same inputs, same output, every time
- Auditable — every image is tied to a specific git commit SHA
- Controlled — no developer-local surprises ship to production

### Why GHA Cache for Docker Layers?

`cache-from: type=gha` reuses Docker layer cache between CI runs. If only `server/` changes, the `npm ci` and `COPY` layers for `src/` are cached — build time drops from 3min to 30s.

### Why Export as a Tar File?

Docker images built in one job aren't automatically available to other jobs (each job is a fresh runner). We export to a tar, upload as an artifact, and download in downstream jobs. This also means the exact same image bytes are scanned, tested, and pushed — no rebuilding.

---

## Stage 7 — Trivy Image Scan + SBOM

### Why Scan the Image Separately from the Dependencies?

Snyk scans your `package.json` dependencies. Trivy scans the **entire image** including:
- The base OS (Alpine packages)
- Node.js runtime itself
- npm packages inside the container
- Any binaries added during build

A vulnerability in Alpine's `musl` library won't show in Snyk but will show in Trivy.

### What is an SBOM?

SBOM (Software Bill of Materials) is a complete inventory of every component in your software — packages, libraries, versions, licenses.

**Why it matters:**
- When a new CVE drops (like Log4Shell), you can immediately answer "are we affected?"
- US Executive Order 14028 requires SBOMs for software sold to federal agencies
- Enables automated vulnerability tracking over time

We generate it in **CycloneDX** format — the industry standard.

### Why Upload SARIF to GitHub Security Tab?

SARIF is a standard format for security scan results. GitHub reads it and shows vulnerabilities directly in the Security → Code Scanning tab of your repo. Developers see issues in context — not buried in CI logs.

---

## Stage 8 — Smoke Test

### Why Test BEFORE Pushing to Docker Hub?

Once an image is in a registry, it can be pulled and deployed by ArgoCD. If it's broken, you've shipped a broken image to production. The smoke test is the last line of defence — it runs the actual container and proves it works.

### What We Test

| Test | What it proves |
|------|---------------|
| `/health` → 200 | Node.js process started, Express is listening |
| `/api/menu` → 200 | Backend routes are wired correctly |
| `/api/location` → 200 | Both downstream services respond |
| `/` → 200 | React build was copied correctly and is being served |

### Why Wait for HEALTHCHECK Before Asserting?

A container can be "running" but still initialising. We wait for Docker's built-in HEALTHCHECK to report `healthy` before firing assertions — the same signal Kubernetes uses for readiness probes.

---

## Stage 9 — Push + Cosign Sign

### Why Only Push on `main`?

Every PR runs the full pipeline to validate it works. But only merges to `main` produce a real artifact. This prevents Docker Hub from being flooded with images from every feature branch.

### Why Image Signing with Cosign?

Without signing, anyone who compromises your Docker Hub account can push a malicious image with your tag. Cosign uses **keyless signing** — it cryptographically ties the image to your GitHub Actions OIDC identity. Anyone pulling the image can verify:
- This image was built by YOUR GitHub Actions workflow
- It was signed at a specific time
- It has not been tampered with since signing

This is **SLSA Level 2** supply chain security.

### Why SHA Tag AND Latest Tag?

| Tag | Purpose |
|-----|---------|
| `coffee-shop:abc1234` | Immutable — points to exactly this build forever |
| `coffee-shop:latest` | Convenience — always the most recent main build |

Kubernetes deployments should always use the SHA tag. `latest` is for humans.

---

## GitHub Secrets Required

Configure these in GitHub → Settings → Secrets → Actions:

| Secret | Value |
|--------|-------|
| `DOCKER_HUB_USERNAME` | Your Docker Hub username |
| `DOCKER_HUB_TOKEN` | Docker Hub access token (not your password) |
| `SNYK_TOKEN` | From snyk.io → Account Settings → API Token |

> **Why tokens and not passwords?**  
> Tokens can be scoped (read-only, specific repos) and rotated without changing your password. If a token leaks, you revoke it. A leaked password compromises your entire account.

---

## SonarQube Local Setup

Run SonarQube locally for development (before CI runs it):

```bash
# Start SonarQube Community Edition (free, self-hosted)
docker run -d --name sonarqube -p 9000:9000 sonarqube:11-community

# First login: http://localhost:9000 — admin / admin (change on first login)
# Create project → coffee-shop → generate token → run scanner
npx sonar-scanner -Dsonar.token=<your-token> -Dsonar.host.url=http://localhost:9000
```

---

## Security Checklist — Phase 3 Status

| Check | Status |
|-------|--------|
| Pin GitHub Actions to version tags | ✅ |
| Minimal `permissions` at workflow level | ✅ |
| `security-events: write` only on jobs that need it | ✅ |
| `id-token: write` only on push-sign job | ✅ |
| Tests run before any Docker build | ✅ |
| Coverage threshold enforced | ✅ |
| SCA fails on HIGH/CRITICAL | ✅ |
| SAST quality gate blocks pipeline | ✅ |
| Docker image scanned before push | ✅ |
| Smoke test runs before push | ✅ |
| Image signed with Cosign | ✅ |
| Push only on main branch | ✅ |
| Secrets via GitHub Secrets — never in YAML | ✅ |
| SBOM generated for compliance | ✅ |
| Trivy results uploaded to Security tab | ✅ |

---

*Next: [devsecops-registry.md](./devsecops-registry.md) — Docker Hub + Image Signing*
