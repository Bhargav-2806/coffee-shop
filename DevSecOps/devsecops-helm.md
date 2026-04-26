# DevSecOps Mindset — Phase 4: Helm + GitOps

> **Core Principle:** Raw Kubernetes YAML duplicated across environments is a maintenance trap.  
> Helm turns that duplication into parameterisation. GitOps turns manual `kubectl apply` into an audited, automated loop.

---

## What We Built

| File | Purpose |
|------|---------|
| `helm/coffee-shop/Chart.yaml` | Chart metadata — name, version, appVersion |
| `helm/coffee-shop/values.yaml` | All defaults — the single source of truth for config |
| `helm/coffee-shop/values-qa.yaml` | QA overrides — namespace, env, image tag (CI-managed) |
| `helm/coffee-shop/values-prod.yaml` | Prod overrides — namespace, env, image tag (manual/PR) |
| `helm/coffee-shop/templates/` | Parameterised versions of every k8s manifest |

---

## How to Install / Upgrade

```bash
# Install to QA cluster
helm upgrade --install coffee-shop helm/coffee-shop \
  -f helm/coffee-shop/values-qa.yaml \
  --kube-context kind-coffee-qa

# Install to Production cluster
helm upgrade --install coffee-shop helm/coffee-shop \
  -f helm/coffee-shop/values-prod.yaml \
  --kube-context kind-coffee-prod

# Preview what will be applied (dry run)
helm template coffee-shop helm/coffee-shop -f helm/coffee-shop/values-qa.yaml

# Check deployed release status
helm list --kube-context kind-coffee-qa

# Roll back to the previous release
helm rollback coffee-shop 1 --kube-context kind-coffee-qa
```

---

## The GitOps Loop

```
Developer merges PR to main
         │
         ▼
CI pipeline runs all 9 stages
         │
         ▼
Stage 9: push-sign job
  ├── Pushes image: bhargav2806/coffee-shop:<sha>
  ├── Signs with Cosign
  └── Updates values-qa.yaml → image.tag: <sha>
         │
         ▼
Git commit: "ci: update QA image tag to <sha> [skip ci]"
         │
         ▼
ArgoCD detects values-qa.yaml changed (polls every 3 min)
         │
         ▼
ArgoCD auto-syncs QA cluster — zero-touch deployment
         │
         ▼
Prod promotion: manual — edit values-prod.yaml via PR,
get approval, merge → ArgoCD syncs prod
```

The `[skip ci]` in the commit message prevents the CI from triggering again on the tag bump commit — breaking an infinite loop.

---

## Why Helm Over Raw YAML

Before Helm, QA and Prod had 6 identical YAML files each with only the namespace and env label changed. That's 12 files to keep in sync manually.

With Helm:

| Problem | Without Helm | With Helm |
|---------|-------------|-----------|
| Environment differences | Copy-paste entire files, edit 3 fields | One `values-qa.yaml` with 3 lines |
| Image tag updates | Edit deployment.yaml manually | CI writes one line in values-qa.yaml |
| Rollback | Manually re-apply old YAML | `helm rollback coffee-shop 1` |
| Upgrade tracking | No history | Full release history with `helm list` |
| Dry run before apply | Not built in | `helm template` or `helm diff` |

---

## Why `values.yaml` + `values-qa.yaml` (Not One File Per Environment)

The base `values.yaml` holds ALL defaults. The environment-specific files hold ONLY what differs.

This means:
- Adding a new config option? Add it once in `values.yaml` — all environments inherit it automatically
- The diff between environments is explicit and minimal — easy to audit in code review
- A security reviewer can look at `values-qa.yaml` and `values-prod.yaml` and immediately see what's different

---

## Image Tag Strategy

| Tag | When set | Who sets it |
|-----|----------|------------|
| `values-qa.yaml → image.tag` | Every push to main | CI pipeline (automated) |
| `values-prod.yaml → image.tag` | When promoting to prod | Developer via PR + approval |
| `latest` on Docker Hub | Every push to main | CI pipeline (convenience only) |

The `latest` tag on Docker Hub is a convenience alias — Kubernetes manifests and Helm values always use the SHA tag for exact reproducibility. `latest` is never used as the deployed tag in Kubernetes.

---

## Security in the Helm Chart

All security settings from Phase 5 (Kubernetes) are preserved in the Helm templates and driven from `values.yaml`:

- `podSecurityContext` block → non-root, seccomp, fsGroup
- `containerSecurityContext` block → readOnlyRootFilesystem, drop ALL capabilities, no privilege escalation
- `automountServiceAccountToken: false` — hardcoded in template (never overridable via values)
- NetworkPolicy templates — deny-all default is always deployed (not behind an `enabled` flag)
- The ingress template has an `enabled` flag (`ingress.enabled: true`) — useful for future environments that may not need an Ingress (e.g., internal-only service mesh)

---

## Helm Security Checklist

| Check | Status |
|-------|--------|
| No secrets in values files — use K8s Secrets or ESO | ✅ |
| Image tag driven by CI SHA — no `latest` in deployed config | ✅ |
| All K8s security contexts preserved in templates | ✅ |
| NetworkPolicy deny-all not behind a feature flag | ✅ |
| `automountServiceAccountToken: false` hardcoded | ✅ |
| `helm template` dry run before every install | ✅ (use manually) |
| Helm chart versioned in `Chart.yaml` | ✅ |
| `[skip ci]` prevents CI loop on tag bump commits | ✅ |

---

*Next: [devsecops-gitops.md](./devsecops-gitops.md) — ArgoCD setup and Application manifests*
