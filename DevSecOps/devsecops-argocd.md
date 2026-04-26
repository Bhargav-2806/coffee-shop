# DevSecOps Mindset — Phase 4.5: ArgoCD + GitOps

> **Core Principle:** Git is the single source of truth. The cluster must always reflect what's in Git — not what a developer typed into a terminal last Tuesday.

---

## What We Built

| File | Purpose |
|------|---------|
| `argocd/coffee-shop-qa.yaml` | ArgoCD Application — QA, auto-sync on every Git change |
| `argocd/coffee-shop-prod.yaml` | ArgoCD Application — Prod, manual sync with explicit approval |

---

## How ArgoCD Fits in the Overall Flow

```
GitHub repo (values-qa.yaml tag updated by CI)
         │
         │  ArgoCD polls every 3 minutes (or webhook)
         ▼
ArgoCD on kind-coffee-qa detects drift
         │
         ▼
ArgoCD runs: helm template + kubectl apply
         │
         ▼
New pod rolls out → old pod removed (zero downtime via RollingUpdate)
         │
         ▼
ArgoCD status: Synced ✅ / Healthy ✅
```

For Production, the same loop runs — but ArgoCD stops at "drift detected" and waits for a human to click **Sync** in the UI or run `argocd app sync coffee-shop-prod`.

---

## Install ArgoCD on Each Kind Cluster

ArgoCD is installed directly on each cluster and manages only that cluster (in-cluster mode). This avoids the complexity of a hub-spoke setup for a sample project.

```bash
# ── QA Cluster ────────────────────────────────────────────────────────────────

# Switch to QA context
kubectl config use-context kind-coffee-qa

# Install ArgoCD
kubectl create namespace argocd
kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for ArgoCD to be ready
kubectl wait --namespace argocd \
  --for=condition=available deployment/argocd-server \
  --timeout=120s

# Get the initial admin password
kubectl get secret argocd-initial-admin-secret \
  -n argocd -o jsonpath="{.data.password}" | base64 -d && echo

# Port-forward ArgoCD UI — access at https://localhost:8443
kubectl port-forward svc/argocd-server -n argocd 8443:443

# Apply the QA Application manifest
kubectl apply -f argocd/coffee-shop-qa.yaml --context kind-coffee-qa


# ── Production Cluster ────────────────────────────────────────────────────────

kubectl config use-context kind-coffee-prod

kubectl create namespace argocd
kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

kubectl wait --namespace argocd \
  --for=condition=available deployment/argocd-server \
  --timeout=120s

kubectl get secret argocd-initial-admin-secret \
  -n argocd -o jsonpath="{.data.password}" | base64 -d && echo

# Port-forward ArgoCD UI — access at https://localhost:8444 (different port from QA)
kubectl port-forward svc/argocd-server -n argocd 8444:443

# Apply the Prod Application manifest
kubectl apply -f argocd/coffee-shop-prod.yaml --context kind-coffee-prod
```

---

## Before Applying — Update the repoURL

The Application manifests have a placeholder `YOUR_GITHUB_USERNAME`. Once the GitHub repo is set up (Phase 2), update both files:

```bash
# In argocd/coffee-shop-qa.yaml and argocd/coffee-shop-prod.yaml
# Replace: https://github.com/YOUR_GITHUB_USERNAME/coffee-shop.git
# With:    https://github.com/<your-username>/coffee-shop.git
```

If the repo is private, ArgoCD also needs credentials. Add them via the UI (Settings → Repositories) or CLI:

```bash
argocd repo add https://github.com/<your-username>/coffee-shop.git \
  --username <github-username> \
  --password <github-pat>
```

---

## QA vs Production Sync Strategy

| Setting | QA | Production |
|---------|----|-----------|
| `syncPolicy.automated` | ✅ enabled | ❌ disabled |
| `prune: true` | ✅ | — |
| `selfHeal: true` | ✅ | — |
| How to trigger prod deploy | — | `argocd app sync coffee-shop-prod` or UI |

**`prune: true`** — if you delete a resource from the Helm chart, ArgoCD deletes it from the cluster too. Without this, deleted resources become orphans.

**`selfHeal: true`** — if someone manually runs `kubectl edit` or `kubectl delete` on a resource, ArgoCD reverts it back to what's in Git within minutes. This enforces Git as the only valid way to change cluster state.

**No automated sync for Prod** — production deployments are a deliberate human decision. A developer edits `values-prod.yaml` (bumps the image tag), opens a PR, gets it reviewed and merged, then manually syncs. This creates an approval gate and a clear audit trail in Git history.

---

## Why GitOps Over CI-Push (kubectl in CI)

The old way: CI pipeline runs `kubectl apply` directly to the cluster. This means:
- CI must have cluster credentials stored as secrets — large blast radius if compromised
- No drift detection — if someone changes the cluster manually, CI won't notice
- No rollback built in — to roll back you re-run CI with a previous commit
- No visibility into what's actually running vs what Git says should be running

With ArgoCD:

| Problem | CI-Push | GitOps / ArgoCD |
|---------|---------|----------------|
| Cluster credentials in CI | Required | Not needed — ArgoCD has them, CI only writes to Git |
| Drift detection | None | Continuous — alerts within minutes |
| Manual change protection | None | selfHeal reverts it |
| Rollback | Re-run CI | `helm rollback` or `argocd app rollback` |
| Audit trail | CI logs | Git history — who changed what, when, why |
| Multi-cluster | Complex | Each cluster runs its own ArgoCD agent |

---

## Security in ArgoCD

- ArgoCD runs inside the cluster — it never exposes cluster credentials outside
- The only credential CI needs is write access to the Git repo (not the cluster)
- ArgoCD RBAC can restrict which teams can sync which applications
- The ArgoCD UI should be accessed via port-forward (not exposed as a public LoadBalancer) for local kind clusters

---

*Next: [devsecops-aws.md](./devsecops-aws.md) — AWS EKS + Terraform*
