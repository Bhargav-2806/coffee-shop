# DevSecOps Mindset — Phase 5: Kubernetes

> **Core Principle:** Kubernetes gives you the tools to enforce security at every layer.  
> The default settings are NOT secure — you have to explicitly harden each resource.

---

## What We Built

Two completely separate kind clusters — one for QA, one for Production. This mirrors a real AWS EKS setup where each environment is its own cluster, not just a namespace.

| Folder | Cluster | Purpose |
|--------|---------|---------|
| `kind/qa-cluster.yaml` | coffee-qa | kind cluster config — hostPort 8081/8444 |
| `kind/prod-cluster.yaml` | coffee-prod | kind cluster config — hostPort 8082/8445 |
| `k8s/qa/` | coffee-qa | All manifests for the QA cluster |
| `k8s/prod/` | coffee-prod | All manifests for the Production cluster |

Each folder contains: `namespace.yaml`, `configmap.yaml`, `deployment.yaml`, `service.yaml`, `ingress.yaml`, `networkpolicy.yaml`

---

## Prerequisites

```bash
# Install kind (Kubernetes IN Docker)
brew install kind

# Install kubectl
brew install kubectl
```

---

## How to Apply — QA Cluster

```bash
# 1. Create the QA cluster
kind create cluster --config kind/qa-cluster.yaml

# 2. Install nginx Ingress Controller (one-time per cluster)
kubectl apply -f https://kind.sigs.k8s.io/examples/ingress/deploy-ingress-nginx.yaml --context kind-coffee-qa

# 3. Wait for ingress controller to be ready
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s \
  --context kind-coffee-qa

# 4. Apply all QA manifests
kubectl apply -f k8s/qa/ --context kind-coffee-qa

# 5. Verify pods are running
kubectl get pods -n coffee-qa --context kind-coffee-qa

# 6. Test — QA runs on port 8081
curl http://localhost:8081/health
curl http://localhost:8081/api/menu
```

---

## How to Apply — Production Cluster

```bash
# 1. Create the Production cluster
kind create cluster --config kind/prod-cluster.yaml

# 2. Install nginx Ingress Controller (one-time per cluster)
kubectl apply -f https://kind.sigs.k8s.io/examples/ingress/deploy-ingress-nginx.yaml --context kind-coffee-prod

# 3. Wait for ingress controller to be ready
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s \
  --context kind-coffee-prod

# 4. Apply all Production manifests
kubectl apply -f k8s/prod/ --context kind-coffee-prod

# 5. Verify pods are running
kubectl get pods -n coffee-prod --context kind-coffee-prod

# 6. Test — Production runs on port 8082
curl http://localhost:8082/health
curl http://localhost:8082/api/menu
```

---

## Cluster Management

```bash
# List all kind clusters
kind get clusters

# Switch between clusters
kubectl config use-context kind-coffee-qa
kubectl config use-context kind-coffee-prod

# Delete clusters (when done)
kind delete cluster --name coffee-qa
kind delete cluster --name coffee-prod
```

---

## Why Separate Clusters (Not Namespaces)?

Many teams put QA and Prod in the same cluster under different namespaces. This saves resources but creates real risks:

| Risk | Same Cluster | Separate Clusters |
|------|-------------|------------------|
| Blast radius | Cluster outage takes out both envs | Independent — prod survives QA failures |
| NetworkPolicy gaps | Cross-namespace traffic possible | No shared network at all |
| RBAC complexity | Must carefully scope all roles | Each cluster has independent RBAC |
| Resource contention | QA load tests starve prod pods | Fully isolated resource pools |
| Mirrors real AWS setup | ❌ | ✅ EKS uses separate clusters per env |

The extra resource cost is acceptable for a project that will eventually mirror real AWS EKS infrastructure.

---

## Why Each Resource Exists

### Namespace

Logical boundary inside a cluster. Without namespaces, all workloads share the same network space, RBAC scope, and resource quotas.

**Pod Security Standards (PSS) at namespace level** — `pod-security.kubernetes.io/enforce: restricted` makes the API server REJECT any pod that doesn't meet the restricted profile before it's even scheduled. Non-root, no privileged containers, seccomp required — enforced at admission, not just audit.

---

### ConfigMap

Stores non-sensitive configuration separately from the container image. Same image ships to QA and Prod — only the ConfigMap changes. Baking config into the image means rebuilding to change a log level — a violation of 12-Factor principles.

**What goes in ConfigMap:** `NODE_ENV`, `PORT`, feature flags, log levels.  
**What does NOT:** passwords, API keys, tokens — use Kubernetes Secrets or External Secrets Operator.

---

### Deployment

#### `runAsNonRoot: true` + `runAsUser: 1001`
Rejects the pod at the API server if the container runs as root. UID 1001 matches the `appuser` we created in the Dockerfile. Defence in depth — even a bad image push is blocked before it runs.

#### `readOnlyRootFilesystem: true`
Root filesystem is mounted read-only. If an attacker achieves RCE, they cannot write backdoors, modify app files, or install pivot tools. `/tmp` is the only writable path — an `emptyDir` wiped when the pod dies.

#### `capabilities: drop: [ALL]`
Linux capabilities are fine-grained root permissions (`NET_BIND_SERVICE`, `SYS_PTRACE`, `NET_RAW`). Dropping ALL means even if the process gains root, it has no capabilities to do anything dangerous. Port 8080 > 1024, so `NET_BIND_SERVICE` isn't needed.

#### `allowPrivilegeEscalation: false`
Prevents privilege gain via `setuid`/`setgid` binaries at the kernel level — blocks even malicious npm packages trying to escalate.

#### `seccompProfile: RuntimeDefault`
Filters which syscalls a process can make. Blocks ~100+ dangerous syscalls (`ptrace`, raw sockets, `mount`) while allowing everything a normal Node.js app needs.

#### `automountServiceAccountToken: false`
Kubernetes mounts a service account token into every pod by default. That token can call the K8s API. Our app doesn't need it — disabling it removes an entire attack surface. Compromised tokens can list pods, read secrets, and escalate within the cluster.

#### Resource Limits
`requests` = scheduler guarantee. `limits` = hard cap.  
Without limits, a memory leak or DoS attack consumes all node memory and kills every other pod. With limits, only the affected pod is OOM-killed.

#### Liveness vs Readiness Probe

| Probe | What it does | On failure |
|-------|-------------|-----------|
| Liveness | Is the app alive? | Restart the container |
| Readiness | Is the app ready to serve traffic? | Remove from Service endpoints |

Both hit `/health`. Readiness prevents a slow-starting pod from receiving traffic. Liveness restarts a crashed pod.

#### `maxUnavailable: 0` (Rolling Update)
Kubernetes will NOT remove an old pod until the new one passes its readiness probe. Zero downtime guaranteed — the old version keeps serving traffic during rollout.

---

### Service (ClusterIP)

Stable DNS name for pods. Pods are ephemeral — IPs change on every restart. `ClusterIP` = only reachable inside the cluster, never directly from the internet. The Ingress is the only external entry point.

Port 80 (Service) → Port 8080 (container). The app is always 8080 internally; the Service presents standard HTTP.

---

### Ingress

Single controlled entry point for all external traffic. Without it, traffic would bypass security controls via raw NodePorts.

**Why nginx Ingress Controller:** TLS termination, path-based routing, rate limiting, auth middleware — all as annotations. A single entry point for the entire cluster.

**kind extraPortMappings** = how kind bridges the host machine's ports (8081, 8082) into the cluster's nginx controller. No `/etc/hosts` tricks needed — just `localhost:8081` for QA and `localhost:8082` for prod.

---

### NetworkPolicy — Zero Trust Network

By default every pod can talk to every other pod in the cluster, including across namespaces. This is flat networking and it is dangerous.

**Three-policy model:**

| Policy | What it does |
|--------|-------------|
| `default-deny-all` | Block ALL ingress and egress for all pods |
| `allow-ingress-controller` | Allow only nginx ingress pods → our app on port 8080 |
| `allow-dns-egress` | Allow DNS lookups (UDP/TCP 53) — required to resolve hostnames |

The only allowed inbound path is: `internet → kind port mapping → nginx → our app`. Everything else is denied at the kernel level.

---

## QA vs Production Differences

| Setting | QA | Production |
|---------|----|-----------|
| Cluster name | coffee-qa | coffee-prod |
| Namespace | coffee-qa | coffee-prod |
| Host port (HTTP) | 8081 | 8082 |
| Host port (HTTPS) | 8444 | 8445 |
| Replicas | 1 | 1 (sample project) |
| ArgoCD sync (Phase 4) | Auto | Manual approval |

When we move to Helm, these differences become values in `values-qa.yaml` and `values-prod.yaml` — no more duplicate YAML.

---

## Security Checklist — Phase 5 Status

| Check | Status |
|-------|--------|
| Separate clusters for QA and Prod | ✅ |
| Pod Security Standards: restricted profile | ✅ |
| Non-root user (runAsUser: 1001) | ✅ |
| runAsNonRoot: true | ✅ |
| readOnlyRootFilesystem: true | ✅ |
| Drop ALL Linux capabilities | ✅ |
| allowPrivilegeEscalation: false | ✅ |
| seccompProfile: RuntimeDefault | ✅ |
| automountServiceAccountToken: false | ✅ |
| CPU and memory limits set | ✅ |
| Liveness probe configured | ✅ |
| Readiness probe configured | ✅ |
| Zero downtime rolling update | ✅ |
| NetworkPolicy: deny-all default | ✅ |
| NetworkPolicy: allow ingress only | ✅ |
| NetworkPolicy: allow DNS egress only | ✅ |
| ConfigMap for non-sensitive config | ✅ |
| ClusterIP service (not NodePort/LoadBalancer) | ✅ |
| Secrets in Kubernetes Secrets / ESO | ⏳ Phase 7 — AWS |

---

*Next: [devsecops-helm.md](./devsecops-helm.md) — Helm Charts + ArgoCD*
