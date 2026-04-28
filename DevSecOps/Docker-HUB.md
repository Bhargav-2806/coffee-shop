# DevSecOps Mindset — Docker Hub: Image Tags, Signing & Supply Chain Security

> **Core Principle:** Pushing an image to a registry is not the end of the security story.  
> You must also prove that what's in the registry is exactly what your pipeline built — untampered, verified, and traceable to a specific commit.

---

## Why Does Every Build Create 3 Tags?

After every successful CI run on `main`, Docker Hub shows 3 new entries. This confuses people who expect one image per build. Here's exactly what each one is:

```
bhargav2806/coffee-shop:<commit-sha>           60.98 MB  ← the actual image
bhargav2806/coffee-shop:latest                 60.98 MB  ← convenience alias
bhargav2806/coffee-shop:sha256-<digest>.sig       255 B  ← Cosign signature
```

**Important:** Only 1 real image exists. The SHA tag and `latest` both point to the same image bytes — same digest, different names. The `.sig` tag is not an image at all — it is a 255 B cryptographic proof blob.

---

### Tag 1 — The Commit SHA Tag (`<commit-sha>`)

This is the only tag that actually matters for deployments.

**What it is:** The image tagged with the exact Git commit SHA that triggered the build. Example: `bhargav2806/coffee-shop:4e46f3eca48bc16c4462ea20a2785d5c10f6ba3e`

**Why it exists:** Immutability. This tag points to exactly one build forever. If something breaks in production, you know immediately which commit caused it. You can roll back to any previous SHA tag with one command. ArgoCD and Kubernetes always use this tag — never `latest`.

**Where it comes from in the pipeline (Stage 10):**
```bash
IMAGE=${{ secrets.DOCKER_HUB_USERNAME }}/coffee-shop
docker tag coffee-shop:${{ github.sha }} $IMAGE:${{ github.sha }}
docker push $IMAGE:${{ github.sha }}
```

---

### Tag 2 — `latest`

**What it is:** The same image, just re-tagged as `latest`. Same digest as the SHA tag — no additional storage cost.

**Why it exists:** Convenience for humans. When a developer wants to quickly pull and run the most recent build locally, `docker pull bhargav2806/coffee-shop:latest` is easier than copying a 40-character SHA. Kubernetes deployments should never use `latest` because it is mutable — it moves with every build, making rollbacks unreliable.

**Where it comes from in the pipeline (Stage 10):**
```bash
docker tag coffee-shop:${{ github.sha }} $IMAGE:latest
docker push $IMAGE:latest
```

**Can it be removed?** Yes. For a pure GitOps setup where ArgoCD always deploys a specific SHA, `latest` is redundant. Removing it reduces Docker Hub from 3 entries to 2 per build without losing any functionality.

---

### Tag 3 — `sha256-<digest>.sig` (255 B)

**What it is:** A Cosign cryptographic signature stored as an OCI artifact in your Docker Hub repository.

**Why it is tiny (255 B):** It is not an image. It contains no application code, no layers, no filesystem. It is purely a signature blob — mathematical proof that this image was built and signed by your specific GitHub Actions workflow.

**Where it comes from in the pipeline (Stage 10):**
```bash
cosign sign --yes ${{ secrets.DOCKER_HUB_USERNAME }}/coffee-shop:${{ github.sha }}
```

Cosign pushes the signature back to Docker Hub alongside the image it signed, using the image digest as the tag name. This is the OCI reference convention for signatures — the registry becomes the signature store.

**Can it be removed?** Yes, by removing the Cosign signing step. But doing so removes supply chain security proof. Read the full explanation below before deciding.

---

## What is Cosign and Why Does It Exist?

### The Attack It Prevents

Imagine this: your CI pipeline builds an image and pushes it to Docker Hub as `bhargav2806/coffee-shop:abc1234`. ArgoCD pulls that image and deploys it to your cluster.

Now an attacker compromises your Docker Hub account and pushes a malicious image with the same tag `abc1234`. ArgoCD pulls the attacker's image on the next sync. Your cluster is running malware. You have no way to know it was not your image — the tag is identical.

This is a **supply chain attack**. The attacker does not break into your application. They tamper with the delivery mechanism — the registry — and your own deployment tooling does the rest for them.

Cosign makes this attack detectable before it causes damage.

---

### What Cosign Is

Cosign is an open-source tool from the **Sigstore project** (backed by Google, Red Hat, and the Linux Foundation). It cryptographically signs Docker images and stores the signatures in the same registry as the image.

A valid Cosign signature proves three things simultaneously:
- This image was built by a specific, verified identity (your GitHub Actions workflow)
- It was signed at a specific point in time
- The image bytes have not changed since signing — any tampering breaks the signature

---

### How Cosign Works in This Pipeline — Step by Step

```
Stage 10 runs after smoke test passes
              │
              ▼
Docker image built → digest: sha256:6d9025044276...
              │
              ▼
Cosign asks GitHub's OIDC server:
"Who is currently running?"

GitHub responds with a short-lived identity token:
"This is github.com/Bhargav-2806/coffee-shop
 workflow: CI Pipeline — The London Brew
 ref: refs/heads/main
 run ID: 25039196847"
              │
              ▼
Cosign sends this token to Fulcio (free public Certificate Authority)

Fulcio verifies the token with GitHub and issues a certificate:
"This certificate belongs to:
 github.com/Bhargav-2806/coffee-shop's GitHub Actions workflow"
Certificate expires in 10 minutes.
              │
              ▼
Cosign uses the certificate to sign the image digest:
Signature = sign(sha256:6d9025044276...) with the certificate
              │
              ▼
The signing event is recorded in Rekor (public transparency log):
"At 10:47:15 UTC on 28 Apr 2026, image sha256:6d9025044276
 was signed by Bhargav-2806/coffee-shop GitHub Actions workflow"
This entry is tamper-proof and publicly auditable.
              │
              ▼
Signature pushed to Docker Hub as:
bhargav2806/coffee-shop:sha256-6d9025044276...sig  (255 B)
```

---

### Why "Keyless"

Traditional signing requires managing a private key — storing it securely, rotating it periodically, ensuring it never leaks. If the key is compromised, every signature ever made with it is invalidated.

Cosign keyless mode uses GitHub's OIDC identity instead of a stored private key. The certificate is issued fresh for each individual signing event and expires automatically in 10 minutes. There is no long-lived key to steal, rotate, or accidentally expose in a log file. The identity IS the GitHub Actions workflow — you cannot fake that without compromising GitHub itself.

This is why the Cosign step in `ci.yml` requires no secrets or stored credentials:
```yaml
- name: Sign image with Cosign (keyless via GitHub OIDC)
  run: |
    cosign sign --yes \
      ${{ secrets.DOCKER_HUB_USERNAME }}/coffee-shop:${{ github.sha }}
```

The only permissions it needs are `id-token: write` — the right to ask GitHub for an OIDC token. That is a GitHub-internal permission, not a stored secret.

---

### How Anyone Can Verify Your Image

Because the signature is public and the transparency log is public, anyone can verify your image at any time:

```bash
cosign verify bhargav2806/coffee-shop:<commit-sha> \
  --certificate-identity-regexp="https://github.com/Bhargav-2806/coffee-shop" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com"
```

Cosign checks three things:
1. Does a valid signature exist for this image digest in Docker Hub?
2. Was the signature issued for `github.com/Bhargav-2806/coffee-shop`?
3. Is the signing event recorded in the Rekor transparency log?

If an attacker pushed a different image with the same tag, the image digest changes. The signature references the original digest — so verification fails. **Tampered = caught, before deployment.**

---

### The `.sig` Tag Explained Simply

```
bhargav2806/coffee-shop:abc1234           ← the medicine (your image)
bhargav2806/coffee-shop:sha256-abc...sig  ← the tamper-evident seal (255 B proof)
```

The `.sig` tag is a tamper-evident seal on a medicine bottle. The bottle is the product. The seal is proof it left the factory untouched. If the seal is missing or broken — do not trust it.

---

## SLSA Level 2 — Why This Matters

**SLSA** (Supply-chain Levels for Software Artifacts) is a security framework with 4 levels, endorsed by Google, NIST, and the US government. Cosign keyless signing via GitHub OIDC achieves **SLSA Level 2**:

| Requirement | Status |
|-------------|--------|
| Build process defined in source control (`ci.yml`) | ✅ |
| Provenance signed and verifiable (who built it, from what, when) | ✅ |
| No human can tamper with the build after it starts | ✅ |
| Signature publicly auditable via Rekor transparency log | ✅ |

US Executive Order 14028 requires SLSA compliance for software sold to federal agencies. Enterprise procurement teams increasingly require it from vendors. Having it in a portfolio project demonstrates awareness of supply chain security at a level most engineers do not reach.

---

## Summary — What to Keep and Why

| Tag | Keep? | Reason |
|-----|-------|--------|
| `<commit-sha>` | ✅ Always | ArgoCD deploys this. Kubernetes uses this. Rollbacks reference this. |
| `latest` | Optional | Convenience only. Remove to clean up Docker Hub. No impact on deployments. |
| `sha256-<digest>.sig` | ✅ Recommended | Supply chain security proof. Removing it loses SLSA Level 2 compliance. |

For this project `latest` is kept because it is standard practice and adds no cost (same image bytes, different pointer). The `.sig` tag stays because it is the proof that everything in this pipeline is real security work — not checkbox security.

---

## Security Checklist — Docker Hub

| Check | Status |
|-------|--------|
| Image tagged with immutable commit SHA | ✅ |
| Image signed with Cosign (keyless, no stored keys) | ✅ |
| Signing event recorded in public Rekor transparency log | ✅ |
| SLSA Level 2 provenance achieved | ✅ |
| `id-token: write` permission scoped only to push-sign job | ✅ |
| Docker Hub token used (not password) | ✅ |
| Push only on merge to `main` — not on PRs or feature branches | ✅ |

---

*Next: [devsecops-argocd.md](./devsecops-argocd.md) — GitOps deployment with ArgoCD*
