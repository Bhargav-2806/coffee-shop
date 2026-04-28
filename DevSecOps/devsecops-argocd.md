# DevSecOps Mindset — Phase 4.5: ArgoCD + GitOps

> **Core Principle:** Git is the single source of truth. The cluster must always reflect what's in Git — not what a developer typed into a terminal last Tuesday.

---

## What We Built

| File | Purpose |
|------|---------|
| `argocd/coffee-shop-qa.yaml` | ArgoCD Application manifest — QA, auto-sync on every Git change |
| `argocd/coffee-shop-prod.yaml` | ArgoCD Application manifest — Prod, manual sync with explicit approval |
| `kind/qa-cluster.yaml` | kind cluster config — QA on port 8081 |
| `kind/prod-cluster.yaml` | kind cluster config — Prod on port 8082 |

---

## How ArgoCD Fits in the Overall Flow

```
You push code → GitHub Actions CI runs all 11 stages
                              │
                    CI Stage 11: Helm Update
              bumps image tag in values-qa.yaml → git push
                              │
              ArgoCD on kind-coffee-qa detects Git change
                              │
              ArgoCD renders: helm template + kubectl apply
                              │
              New pod rolls out → old pod removed (RollingUpdate)
                              │
              ArgoCD status: Synced ✅  Healthy ✅
              App live at http://localhost:8081
```

For Production, the same loop runs — but ArgoCD stops at "drift detected" and waits for a human to click **Sync** in the UI or run `argocd app sync coffee-shop-prod`. Production deployments require explicit approval.

---

## Cluster Architecture

Two separate kind clusters — one per environment. Each cluster runs its own ArgoCD instance (in-cluster mode) and manages only itself.

| Cluster | Context | App URL | ArgoCD UI |
|---------|---------|---------|-----------|
| `coffee-qa` | `kind-coffee-qa` | http://localhost:8081 | https://localhost:8080 |
| `coffee-prod` | `kind-coffee-prod` | http://localhost:8082 | https://localhost:8090 |

Separate clusters provide blast radius isolation — a misconfigured QA deployment cannot affect prod. This mirrors real-world EKS where QA and prod are completely separate AWS accounts or VPCs.

---

## Prerequisites Check

Before setting up either cluster, verify all tools are installed:

```bash
kind version        # v0.31.0+
kubectl version --client  # v1.35+
helm version        # v4.1.4+
docker info | grep "Server Version"  # Docker must be running
```

---

## QA Cluster Setup

### Step 1 — Create the cluster

```bash
kind create cluster --config kind/qa-cluster.yaml
# Creates context: kind-coffee-qa
# App will be accessible at http://localhost:8081
```

### Step 2 — Install nginx Ingress Controller

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml --context kind-coffee-qa

kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s \
  --context kind-coffee-qa
```

### Step 3 — Install ArgoCD

```bash
kubectl create namespace argocd --context kind-coffee-qa

kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml \
  --context kind-coffee-qa

# Watch pods — wait for all to show Running
kubectl get pods -n argocd --context kind-coffee-qa -w
```

### Step 4 — Create the app namespace

```bash
kubectl create namespace coffee-qa --context kind-coffee-qa
```

### Step 5 — Access the ArgoCD UI

```bash
# Get initial admin password
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" --context kind-coffee-qa | base64 -d && echo

# Port-forward (keep this terminal open)
kubectl port-forward svc/argocd-server -n argocd 8080:443 --context kind-coffee-qa
```

Open **https://localhost:8080** → accept the self-signed cert warning → login `admin` / password above.

### Step 6 — Create the Application via UI

Click **New App** and fill in:

| Field | Value |
|-------|-------|
| Application Name | `coffee-shop-qa` |
| Project Name | `default` |
| Sync Policy | `Automatic` |
| Prune Resources | ✅ checked |
| Self Heal | ✅ checked |
| Repository URL | `https://github.com/Bhargav-2806/coffee-shop.git` |
| Revision | `main` |
| Path | `helm/coffee-shop` |
| Cluster URL | `https://kubernetes.default.svc` |
| Namespace | `coffee-qa` |
| Values File | `values-qa.yaml` |

Click **Create**. ArgoCD immediately syncs — pulling the Helm chart from GitHub, rendering it with `values-qa.yaml`, and deploying all resources to `coffee-qa`.

### What Gets Deployed

ArgoCD deploys the full Helm chart as a single Application. Every resource is visible in the UI as a connected graph:

```
coffee-shop-qa (Application)
├── coffee-qa          (Namespace)
├── coffee-shop-config (ConfigMap)
├── coffee-shop        (Service)
├── coffee-shop        (Deployment)
│   └── coffee-shop-<hash> (ReplicaSet)
│       └── coffee-shop-<hash>-<id> (Pod — 1/1 Running)
├── coffee-shop        (Ingress)
├── default-deny-all   (NetworkPolicy)
├── allow-ingress-controller (NetworkPolicy)
└── allow-dns-egress   (NetworkPolicy)
```

### Verify It Works

```bash
curl http://localhost:8081/health
curl http://localhost:8081/api/menu
curl http://localhost:8081/api/location
```

---

## Production Cluster Setup

### Step 1 — Create the cluster

```bash
kind create cluster --config kind/prod-cluster.yaml
# Creates context: kind-coffee-prod
# App will be accessible at http://localhost:8082
```

### Step 2 — Install nginx Ingress Controller

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml --context kind-coffee-prod

kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s \
  --context kind-coffee-prod
```

### Step 3 — Install ArgoCD

```bash
kubectl create namespace argocd --context kind-coffee-prod

kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml \
  --context kind-coffee-prod

kubectl get pods -n argocd --context kind-coffee-prod -w
```

### Step 4 — Create the app namespace

```bash
kubectl create namespace coffee-prod --context kind-coffee-prod
```

### Step 5 — Access the Prod ArgoCD UI

```bash
# Get initial admin password
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" --context kind-coffee-prod | base64 -d && echo

# Port-forward on 8090 — different port from QA ArgoCD on 8080
kubectl port-forward svc/argocd-server -n argocd 8090:443 --context kind-coffee-prod
```

Open **https://localhost:8090** → login `admin` / password above.

### Step 6 — Create the Application via UI

| Field | Value |
|-------|-------|
| Application Name | `coffee-shop-prod` |
| Project Name | `default` |
| Sync Policy | **Manual** ← no auto-deploy to prod |
| Repository URL | `https://github.com/Bhargav-2806/coffee-shop.git` |
| Revision | `main` |
| Path | `helm/coffee-shop` |
| Cluster URL | `https://kubernetes.default.svc` |
| Namespace | `coffee-prod` |
| Values File | `values-prod.yaml` |

Click **Create**. ArgoCD will detect the Helm chart but will NOT deploy automatically. The app shows **OutOfSync** until you click **Sync** manually.

### Deploying to Production

When you are ready to promote a build to production:

1. Update `helm/coffee-shop/values-prod.yaml` with the specific SHA tag you want to promote:
   ```yaml
   image:
     tag: <commit-sha-from-qa>
   ```
2. Commit and push to `main`
3. Open https://localhost:8090 → click **Sync** → review the diff → click **Synchronize**

This creates a deliberate approval gate — every production deployment is a conscious human decision with a Git audit trail.

---

## QA vs Production Sync Strategy

| Setting | QA | Production |
|---------|----|-----------|
| Sync Policy | Automatic | Manual |
| `prune: true` | ✅ | — |
| `selfHeal: true` | ✅ | — |
| Triggered by | CI Stage 11 (Helm Update) | Human clicks Sync in UI |
| Approval required | No | Yes |
| ArgoCD UI port | 8080 | 8090 |
| App URL | localhost:8081 | localhost:8082 |

**`prune: true`** — if you delete a resource from the Helm chart, ArgoCD deletes it from the cluster too. Without this, deleted resources become orphans.

**`selfHeal: true`** — if someone manually runs `kubectl edit` on a resource in QA, ArgoCD reverts it back to Git state within minutes. This enforces Git as the only valid way to change cluster state.

**No automated sync for Prod** — production deployments are a deliberate human decision. A developer bumps the tag in `values-prod.yaml`, opens a PR, gets it reviewed and merged, then manually syncs. This creates an approval gate and a clear audit trail in Git history.

---

## The Full GitOps Loop — End to End

```
Developer pushes code to main
           │
           ▼
GitHub Actions CI (11 stages — ~5 min)
  Stage 1+2:  Build + Unit Tests (parallel)
  Stage 3:    Coverage Gate ≥ 50%
  Stage 4:    Snyk SCA — fail on HIGH/CRITICAL
  Stage 5+6:  SonarQube SAST + Quality Gate
  Stage 7:    Docker Build (multi-stage)
  Stage 8:    Trivy CVE Scan + SBOM
  Stage 9:    Smoke Test (all endpoints → 200)
  Stage 10:   Push to Docker Hub + Cosign Sign
  Stage 11:   Helm Update → bumps values-qa.yaml tag → git push [skip ci]
           │
           ▼
ArgoCD on kind-coffee-qa detects values-qa.yaml change
           │
           ▼
ArgoCD deploys new image → RollingUpdate → Healthy
           │
           ▼
App live at http://localhost:8081 with new code ✅
           │
           │  (manual step — human decision)
           ▼
Engineer reviews QA, promotes tag to values-prod.yaml
Opens PR → reviewed → merged → clicks Sync in prod ArgoCD
           │
           ▼
App live at http://localhost:8082 ✅
```

---

## Why GitOps Over CI-Push (kubectl in CI)

The old way: CI pipeline runs `kubectl apply` directly to the cluster. Problems:

- CI must have cluster credentials stored as secrets — large blast radius if compromised
- No drift detection — if someone changes the cluster manually, CI never notices
- No rollback built in — to roll back you must re-run CI with a previous commit
- No visibility into what's actually running vs what Git says should be running

With ArgoCD:

| Problem | CI-Push | GitOps / ArgoCD |
|---------|---------|----------------|
| Cluster credentials in CI | Required | Not needed — CI only writes to Git |
| Drift detection | None | Continuous — alerts within minutes |
| Manual change protection | None | selfHeal reverts it automatically |
| Rollback | Re-run CI | `argocd app rollback coffee-shop-qa` |
| Audit trail | CI logs | Git history — who changed what, when, why |
| Multi-cluster | Complex | Each cluster runs its own ArgoCD agent |

---

## Security in ArgoCD

ArgoCD runs inside the cluster — it never exposes cluster credentials externally. The only credential CI needs is write access to the Git repo (not the cluster). ArgoCD RBAC can restrict which teams can sync which applications. The ArgoCD UI is accessed via `kubectl port-forward` for local kind clusters — never exposed as a public LoadBalancer.

---

## Security Checklist — ArgoCD Status

| Check | Status |
|-------|--------|
| Separate clusters for QA and prod | ✅ |
| ArgoCD in-cluster mode (no external creds) | ✅ |
| Auto-sync enabled for QA | ✅ |
| Manual sync required for prod | ✅ |
| selfHeal prevents manual drift in QA | ✅ |
| prune removes deleted resources | ✅ |
| CI writes only to Git — never touches cluster directly | ✅ |
| Full audit trail via Git history | ✅ |
| NetworkPolicies enforced (deny-all + allowlist) | ✅ |
| ArgoCD UI accessed via port-forward only | ✅ |

---

*Next: [devsecops-aws.md](./devsecops-aws.md) — AWS EKS + Terraform*
