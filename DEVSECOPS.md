# DevSecOps Overview — The London Brew

> Security is not a phase at the end. It is a mindset applied at every step.  
> "Shift Left" = catch security issues as early as possible.

---

## What is DevSecOps?

DevSecOps integrates security practices into every stage of the software delivery pipeline — from writing code to deploying to production. Instead of security being a final checkpoint, every developer, every pipeline stage, and every infrastructure decision carries a security responsibility.

---

## Project: The London Brew — Coffee Shop

**Stack:** React/TypeScript (frontend) + Node.js/Express (backend)  
**Pattern:** Single container, stateless, no database  
**Environments:** QA + Production  
**Cloud Target:** AWS EKS (via Terraform)

---

## Phases & DevSecOps Documentation

Each phase has a dedicated file in the `DevSecOps/` folder explaining the mindset, best practices, and why each decision matters.

| Phase | What We Build | DevSecOps File |
|-------|--------------|----------------|
| **Phase 1** | Dockerfile, .dockerignore, Docker Compose | [devsecops-docker.md](./DevSecOps/devsecops-docker.md) |
| **Phase 2** | GitHub repository, branch protection, secret scanning | `DevSecOps/devsecops-github.md` *(coming)* |
| **Phase 3** | GitHub Actions CI pipeline (8 stages) | `DevSecOps/devsecops-ci-pipeline.md` *(coming)* |
| **Phase 4** | Docker Hub registry, image signing (Cosign) | `DevSecOps/devsecops-registry.md` *(coming)* |
| **Phase 5** | Helm charts, ArgoCD, GitOps CD | `DevSecOps/devsecops-gitops.md` *(coming)* |
| **Phase 6** | Kubernetes manifests, NetworkPolicy, Pod Security | `DevSecOps/devsecops-kubernetes.md` *(coming)* |
| **Phase 7** | Terraform, AWS EKS, ZTNA architecture | `DevSecOps/devsecops-cloud.md` *(coming)* |
| **Phase 8** | DAST — OWASP ZAP post-deploy on QA | `DevSecOps/devsecops-dast.md` *(coming)* |

---

## DevSecOps Pipeline Summary

```
Code → GitHub → CI (Build → Test → SCA → SAST → Docker Build → Trivy → Smoke → Push)
     → Docker Hub → Helm Chart Update → ArgoCD → Kubernetes (QA → Prod)
                                                              ↓
                                                         DAST on QA
```

---

## Core Security Principles Applied Throughout

| Principle | What It Means |
|-----------|--------------|
| **Shift Left** | Catch security issues at code/build time, not production |
| **Least Privilege** | Every component gets only the access it needs, nothing more |
| **Immutable Infrastructure** | Never patch running containers — rebuild and redeploy |
| **Zero Trust** | Never assume trust based on network location — always verify |
| **Defence in Depth** | Multiple overlapping security layers — no single point of failure |
| **Secrets as Config** | Secrets injected at runtime, never baked into images or code |

---

*See each phase's `DevSecOps/devsecops-*.md` file for detailed mindset, explanations, and checklists.*
