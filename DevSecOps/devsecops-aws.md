# DevSecOps Mindset — Phase 6: AWS EKS + Terraform

> **Core Principle:** Infrastructure is code. Every cloud resource must be version-controlled, reviewed, and repeatable — never clicked into existence in the AWS console.

---

## ⚠️ When to Apply This Phase

> **Do not apply Terraform until the full local pipeline is working:**
> - Docker build ✅
> - CI pipeline passing all 10 stages ✅
> - kind clusters (coffee-qa + coffee-prod) running successfully ✅
> - ArgoCD deploying via Helm ✅
>
> This phase exists in the repo now so the infrastructure is ready to go when you decide to move to cloud. The files are complete — they just haven't been applied yet.

---

## What We Built

| File | Purpose |
|------|---------|
| `terraform/main.tf` | AWS provider, required versions, S3 remote backend (commented) |
| `terraform/variables.tf` | All input variables with validation |
| `terraform/outputs.tf` | Cluster endpoint, kubectl config command, VPC ID |
| `terraform/vpc.tf` | VPC, public/private subnets, NAT gateway |
| `terraform/eks.tf` | EKS cluster, managed node group, core add-ons |
| `terraform/envs/qa.tfvars.example` | QA variable values template |
| `terraform/envs/prod.tfvars.example` | Production variable values template |

---

## Architecture

```
                        AWS Region (us-east-1)
┌──────────────────────────────────────────────────────┐
│                    VPC (10.0.0.0/16)                  │
│                                                        │
│  ┌─────────────────────┐  ┌─────────────────────┐    │
│  │  Public Subnet AZ-a │  │  Public Subnet AZ-b │    │
│  │  10.0.101.0/24      │  │  10.0.102.0/24      │    │
│  │  [Load Balancer]    │  │  [Load Balancer]    │    │
│  └──────────┬──────────┘  └──────────┬──────────┘    │
│             │ NAT GW                  │               │
│  ┌──────────▼──────────┐  ┌──────────▼──────────┐    │
│  │  Private Subnet AZ-a│  │  Private Subnet AZ-b│    │
│  │  10.0.1.0/24        │  │  10.0.2.0/24        │    │
│  │  [EKS Nodes]        │  │  [EKS Nodes]        │    │
│  └─────────────────────┘  └─────────────────────┘    │
│                                                        │
│              EKS Control Plane (AWS managed)           │
└──────────────────────────────────────────────────────┘
```

**Why private subnets for nodes?** EKS worker nodes should never be directly reachable from the internet. All inbound traffic goes: Internet → ALB/Load Balancer (public subnet) → pods (private subnet). Nodes reach out for image pulls and updates via the NAT Gateway.

**Why two AZs?** High availability. If one AZ has an outage, the other continues serving traffic. EKS will reschedule pods automatically.

---

## Step-by-Step: First-Time Apply

### 1. Prerequisites

```bash
# Install required tools
brew install terraform awscli

# Configure AWS credentials
aws configure
# Enter: Access Key ID, Secret Access Key, region (us-east-1), output (json)

# Verify access
aws sts get-caller-identity
```

### 2. Set up Remote State (one-time, manual)

Terraform state must be stored remotely so the team shares a single source of truth. Create these manually in the AWS console first:

```bash
# Create S3 bucket for state
aws s3api create-bucket \
  --bucket coffee-shop-terraform-state \
  --region us-east-1

# Enable versioning (allows state rollback)
aws s3api put-bucket-versioning \
  --bucket coffee-shop-terraform-state \
  --versioning-configuration Status=Enabled

# Enable encryption at rest
aws s3api put-bucket-encryption \
  --bucket coffee-shop-terraform-state \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

# Create DynamoDB table for state locking (prevents concurrent applies)
aws dynamodb create-table \
  --table-name coffee-shop-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

Then uncomment the `backend "s3"` block in `terraform/main.tf`.

### 3. Apply QA Cluster

```bash
cd terraform

# Copy and fill in QA values
cp envs/qa.tfvars.example envs/qa.tfvars
# Edit envs/qa.tfvars if needed

# Initialise — downloads providers and modules, connects to S3 backend
terraform init

# Preview what will be created (always do this before apply)
terraform plan -var-file="envs/qa.tfvars"

# Apply — takes ~15 minutes for EKS
terraform apply -var-file="envs/qa.tfvars"

# Connect kubectl to the new cluster
aws eks update-kubeconfig --region us-east-1 --name coffee-shop-qa
```

### 4. Apply Production Cluster

```bash
cp envs/prod.tfvars.example envs/prod.tfvars

# Use -state flag to keep QA and Prod state separate
terraform plan  -var-file="envs/prod.tfvars" -state="prod.tfstate"
terraform apply -var-file="envs/prod.tfvars" -state="prod.tfstate"

aws eks update-kubeconfig --region us-east-1 --name coffee-shop-prod
```

### 5. Deploy App to EKS (same Helm commands, new context)

```bash
# Install nginx Ingress Controller (AWS Load Balancer Controller for production — optional upgrade)
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.0/deploy/static/provider/cloud/deploy.yaml

# Deploy via Helm — same chart, just pointing at EKS context now
helm upgrade --install coffee-shop helm/coffee-shop \
  -f helm/coffee-shop/values-qa.yaml \
  --kube-context arn:aws:eks:us-east-1:<account-id>:cluster/coffee-shop-qa

# Install ArgoCD (same as kind — same kubectl commands, different context)
kubectl create namespace argocd
kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

---

## Why Terraform Over the AWS Console

| Action | AWS Console | Terraform |
|--------|------------|-----------|
| Create a cluster | 15 minutes of clicking | `terraform apply` — repeatable |
| Recreate after accident | Start from memory | Exact same config, guaranteed |
| Code review | Impossible | PR with `terraform plan` output |
| Audit trail | CloudTrail logs (hard to read) | Git history |
| Spin up a new environment | Clone everything manually | Copy tfvars file, apply |
| Drift detection | None | `terraform plan` shows drift |
| Destroy when done | Click through every resource | `terraform destroy` |

---

## Security Design Decisions

**Nodes in private subnets** — worker nodes have no public IP. They cannot be SSH'd into from the internet. All access is through the EKS API or kubectl.

**Encrypted EBS volumes** — node root volumes are encrypted at rest using AES-256. If someone extracts a disk, data is unreadable.

**Managed node groups** — AWS automatically patches the EKS-optimised AMI and replaces nodes during updates. You don't manage the OS.

**Single NAT Gateway for QA** — reduces cost for non-production. Production uses one NAT Gateway per AZ (set by `single_nat_gateway = false` when `environment = prod`).

**`enable_cluster_creator_admin_permissions = true`** — the IAM user/role that runs `terraform apply` gets cluster-admin access automatically. Remove this after setting up proper RBAC for the team.

**Remote state encryption** — the S3 bucket has SSE-AES256 enabled. Terraform state can contain sensitive values (like certificates) so it must be encrypted.

---

## Cost Estimate (sample project)

| Resource | QA (t3.medium × 1) | Prod (t3.large × 2) |
|---------|-------------------|---------------------|
| EKS Control Plane | $0.10/hr | $0.10/hr |
| EC2 Nodes | ~$0.047/hr | ~$0.192/hr |
| NAT Gateway | ~$0.045/hr | ~$0.09/hr |
| **Total (approx)** | **~$140/month** | **~$280/month** |

> Run `terraform destroy` when not using the clusters to avoid unnecessary charges.

---

## Migrating from kind → EKS

The beauty of this setup: almost nothing changes in the application layer.

1. Run `terraform apply` → EKS cluster created
2. Run `aws eks update-kubeconfig` → kubectl pointed at EKS
3. Run `helm upgrade --install` → same Helm chart, same values files
4. Update ArgoCD `Application` manifests with the EKS cluster context
5. Update `values-qa.yaml` / `values-prod.yaml` if any EKS-specific values differ

The Helm chart, Kubernetes manifests, CI pipeline, and ArgoCD setup are all cluster-agnostic. kind and EKS both speak the same Kubernetes API.

---

## Security Checklist — Phase 6 Status

| Check | Status |
|-------|--------|
| EKS nodes in private subnets | ✅ |
| Encrypted EBS root volumes | ✅ |
| Managed node group (AWS handles OS patching) | ✅ |
| Remote state in encrypted S3 bucket | ✅ (setup required) |
| State locking with DynamoDB | ✅ (setup required) |
| All resources tagged (ManagedBy, Environment) | ✅ |
| VPC with proper subnet tagging for EKS | ✅ |
| No hardcoded credentials in Terraform files | ✅ |
| `.tfvars` files in `.gitignore` | ✅ |
| Terraform state files in `.gitignore` | ✅ |
| AWS credentials via `aws configure` / IAM role | ✅ |

---

*Next: [devsecops-github.md](./devsecops-github.md) — GitHub repo setup, branch protection, CODEOWNERS (Phase 2 — final step)*
