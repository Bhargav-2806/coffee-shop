# DevSecOps Mindset — Phase 1: Docker Containers

> **Core Principle:** A container is not automatically secure just because it's isolated.  
> You are responsible for hardening every layer — the image, the runtime, and the config.

---

## What We Built

| File | Purpose |
|------|---------|
| `Dockerfile` | Builds the production container image |
| `.dockerignore` | Controls what enters the build context |
| `docker-compose.yml` | Runs the container locally for development |

---

## 1. Why Multi-Stage Builds?

A single-stage Dockerfile would bundle TypeScript compiler, Vite, all devDependencies, and raw source `.ts` files into the final image. Anyone who pulls that image gets your build toolchain.

**Multi-stage solves this:**
- **Stage 1 (builder)** — installs everything, compiles, bundles. Thrown away after.
- **Stage 2 (production)** — starts fresh. Only copies the compiled output and production deps.

**Result:** Final image is ~3x smaller and has a fraction of the attack surface.

---

## 2. Why Non-Root User?

By default Docker runs as `root` (UID 0). If your app has a vulnerability (e.g., path traversal, RCE), an attacker running as root inside the container has a much easier path to escaping to the host.

**What we did:** Created `appuser` with no login shell, no home directory, no sudo access. The app runs as this user.

**Real-world impact:** The CIS Docker Benchmark and SOC 2 compliance both require non-root containers. Running as root will fail any security audit.

---

## 3. Why Pin the Base Image Version?

`FROM node:latest` — Docker resolves this at build time. If upstream pushes a new `latest` tag with a vulnerability, your next build silently ships it.

`FROM node:20-alpine` — exact version, reproducible every time. You control when you upgrade.

**Best practice:** Review and bump the version intentionally, after checking the changelog and running Trivy.

---

## 4. Why Alpine Linux?

Standard `node:20` is ~1GB (Debian). `node:20-alpine` is ~160MB.

Fewer packages = fewer CVEs. Alpine ships with almost no userland tools — no curl, no bash, no package manager running as root. Less surface for an attacker to abuse.

**Trade-off:** Some npm packages with native binaries need build tools. We handle this in the builder stage, not production.

---

## 5. Why `npm ci` Instead of `npm install`?

| `npm install` | `npm ci` |
|--------------|----------|
| Can silently update versions | Uses exact lockfile versions only |
| Can modify `package-lock.json` | Fails if lockfile is out of sync |
| Non-deterministic | Fully deterministic / reproducible |

In a CI/CD pipeline or Dockerfile, `npm ci` is the only correct choice. You want exactly what was tested, nothing more.

---

## 6. Why `CMD ["node", "server.js"]` and Not `CMD node server.js`?

**Exec form** (JSON array) — the process becomes PID 1 directly. It receives OS signals like `SIGTERM` when Kubernetes or Docker wants to stop the container gracefully.

**Shell form** (plain string) — spawns `/bin/sh -c "node server.js"`. The shell becomes PID 1, not Node.js. When `SIGTERM` is sent, the shell may not forward it — your app gets killed hard (`SIGKILL`) after a timeout, losing in-flight requests.

Always use exec form for `CMD` and `ENTRYPOINT`.

---

## 7. Why HEALTHCHECK?

Without it, Docker and Kubernetes only know if the *container process* is running — not if the *application* is actually responding.

Scenario: Node.js crashes internally but the process stays alive (caught exception loop). Docker shows "Up". Kubernetes never restarts it. Users get errors.

With `HEALTHCHECK`, the platform polls `/health` and marks the container unhealthy → triggers restart automatically.

---

## 8. Why `.dockerignore`?

Without it, `docker build .` sends your entire project folder to the Docker daemon — including:

- `node_modules/` (~300MB) — makes every build slow and could include OS-incompatible binaries
- `.env` files — API keys and secrets get baked into image layers (visible with `docker history`)
- `.git/` — your entire commit history, branch names, author emails
- Test files — sometimes contain hardcoded credentials or internal URLs

**Rule:** If a file is not needed to run the app in production, it should be in `.dockerignore`.

---

## 9. Why `read_only: true` in Docker Compose?

If an attacker achieves Remote Code Execution in your container, a writable filesystem lets them:
- Drop persistent backdoors
- Modify application files
- Write web shells

`read_only: true` removes this option entirely. Combined with `tmpfs` for `/tmp` (which Node.js needs), the app still works — but the attacker can't persist anything.

---

## 10. Why `no-new-privileges: true`?

Prevents any process inside the container from gaining new Linux capabilities via `setuid` or `setgid` binaries. Even if a malicious dependency tries to call `sudo` or escalate privileges — this flag blocks it at the kernel level.

---

## 11. Why Resource Limits?

Without CPU/memory limits, a single container can consume all host resources — starving other containers and crashing the host. This is a Denial of Service vector even without a malicious actor (a memory leak is enough).

In Kubernetes, resource limits are also required for the scheduler to place pods correctly and for Horizontal Pod Autoscaler to work.

---

## 12. Why Keep Docker Compose for Local Dev Only?

Docker Compose is excellent for local development but is not how we deploy to Kubernetes. Using Compose in production:

- Bypasses Kubernetes health checks, rolling updates, and self-healing
- Doesn't support multiple replicas properly
- Has no concept of namespaces, RBAC, or network policies

**Our rule:** Compose = local dev only. Helm + ArgoCD = everything else.

---

## Security Checklist — Phase 1 Status

| Check | Status |
|-------|--------|
| Pin base image version | ✅ |
| Multi-stage build | ✅ |
| Non-root user | ✅ |
| `npm ci` with frozen lockfile | ✅ |
| Production deps only in final image | ✅ |
| HEALTHCHECK configured | ✅ |
| EXPOSE only required port (8080) | ✅ |
| Exec form CMD | ✅ |
| `.dockerignore` excludes secrets | ✅ |
| `read_only: true` | ✅ |
| `no-new-privileges: true` | ✅ |
| CPU + memory limits | ✅ |
| Log rotation | ✅ |
| Secrets via env_file, not hardcoded | ✅ |
| Image scanning (Trivy) | ⏳ Phase 2 — CI Pipeline |
| Image signing (Cosign) | ⏳ Phase 2 — CI Pipeline |
| SBOM generation | ⏳ Phase 2 — CI Pipeline |

---

*Next: [devsecops-github-actions.md](./devsecops-github-actions.md) — CI Pipeline Security*
