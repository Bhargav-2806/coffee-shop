# DevSecOps Mindset — Terraform: Infrastructure as Code on AWS

> **Core Principle:** Infrastructure should be code — version-controlled, peer-reviewed, and reproducible.  
> Clicking through the AWS Console to create resources is the equivalent of writing code directly in production with no tests and no history.

---

## Why Terraform?

When you create AWS resources manually through the console, several problems emerge immediately:

- Nobody else knows what you created or why
- There is no audit trail — who changed what, and when?
- You cannot recreate the environment if it breaks
- QA and Production drift apart because they were built by hand at different times
- Deleting everything cleanly is nearly impossible

Terraform solves all of this. Every resource — the VPC, EKS cluster, IAM roles, KMS key, subnets — is declared in `.tf` files. The files live in Git. Changes go through pull requests. The environment can be created and destroyed with two commands.

---

## What Terraform State Is and Why It Matters

When you run `terraform apply`, Terraform creates real AWS resources. But Terraform needs to **remember what it created** so that next time you run `terraform plan`, it knows what already exists versus what needs to change.

That memory is a file called `terraform.tfstate`. It maps your code to real AWS resource IDs:

```
Your code declares:        Terraform state records:
aws_eks_cluster            → cluster ID: "coffee-shop-qa-eks"
aws_vpc                    → VPC ID: "vpc-0a1b2c3d4e5f"
aws_subnet (public-a)      → subnet ID: "subnet-0123456789"
```

Without this file, Terraform does not know what it previously built. It would attempt to create duplicate resources on every run, or lose track of existing infrastructure entirely.

### Local State vs Remote State

By default, Terraform writes `terraform.tfstate` to your local machine. This has serious problems in practice:

| Problem | Consequence |
|---------|-------------|
| File lives on one laptop | If the laptop is lost, state is gone — orphaned AWS resources with no way to manage them via Terraform |
| Two people run `terraform apply` simultaneously | Both read the same state, make changes, both write back — state is now corrupt, infrastructure is inconsistent |
| State file contains secrets | Resource IDs, cluster endpoints, IAM keys appear in plaintext — committing to Git is a security incident |

**Remote state** solves all three: the file is stored in S3 (encrypted, versioned, accessible to the whole team) and a DynamoDB table acts as a distributed lock to prevent concurrent runs.

---

## The Bootstrap Problem

There is one catch: Terraform cannot manage its own backend. The S3 bucket and DynamoDB table that store Terraform state must exist **before** Terraform runs for the first time. You cannot use Terraform to create them — you create them manually once, then Terraform uses them for everything else forever.

This is called **bootstrapping**.

---

## Step 1 — Prerequisites: AWS CLI Setup

Before Terraform can create any AWS resources, the AWS CLI must be installed and configured with credentials.

### Install AWS CLI (macOS)

**Option A — Official AWS PKG Installer (recommended):**
```bash
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /
rm AWSCLIV2.pkg
aws --version
# aws-cli/2.x.x Python/3.11.x Darwin/...
```

> ⚠️ Do NOT use `brew install awscli` — the Homebrew version links against Python 3.14 which has a known compatibility bug with macOS system `libexpat`, causing an `ImportError` on every invocation.

**Verify installation:**
```bash
aws --version
# aws-cli/2.x.x Python/3.11.x ...
```

### Configure AWS Credentials

```bash
aws configure
```

```
AWS Access Key ID:     → paste your access key
AWS Secret Access Key: → paste your secret key
Default region name:   → us-east-1
Default output format: → json
```

**Where to get credentials:**
1. AWS Console → top-right account name → **Security credentials**
2. **Access keys** → **Create access key** → select **CLI** → Create
3. Copy both keys — the secret key is shown **only once**

**Verify credentials work:**
```bash
aws sts get-caller-identity
```

Expected output:
```json
{
    "UserId": "AIDAXXXXXXXXXXXXXXXXX",
    "Account": "116743944879",
    "Arn": "arn:aws:iam::116743944879:user/your-username"
}
```

> ⚠️ **Security best practice:** The `Arn` field should show a specific IAM user (`arn:aws:iam::ACCOUNT:user/NAME`), not `root`. Using the root account for CLI operations gives every command unlimited AWS permissions — there is no blast radius limit if credentials are leaked. For real projects, always create a dedicated IAM user with only the permissions needed (least privilege).

---

## Step 2 — Bootstrap: S3 Bucket + DynamoDB Table

Run these commands **once** before any Terraform commands. These resources are permanent — they persist even after `terraform destroy`.

### Create the S3 State Bucket

```bash
# Create the bucket in us-east-1
aws s3api create-bucket \
  --bucket coffee-shop-tfstate-bhargav \
  --region us-east-1
```

```bash
# Enable versioning — every state file change is recoverable
# If a bad apply corrupts state, you can roll back to any previous version
aws s3api put-bucket-versioning \
  --bucket coffee-shop-tfstate-bhargav \
  --versioning-configuration Status=Enabled
```

```bash
# Enable server-side encryption — state file contains sensitive data in plaintext
# (resource IDs, cluster endpoints, IAM role ARNs)
aws s3api put-bucket-encryption \
  --bucket coffee-shop-tfstate-bhargav \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'
```

```bash
# Block ALL public access — this bucket must never be accessible publicly
aws s3api put-public-access-block \
  --bucket coffee-shop-tfstate-bhargav \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

echo "✅ S3 bucket ready"
```

**Why each setting matters:**

| Setting | Why |
|---------|-----|
| Versioning | State corruption recovery — roll back to any previous version |
| Encryption | State file contains sensitive values in plaintext — must not be readable by anyone with S3 access |
| Block public access | State file must never be publicly accessible — it would expose your entire infrastructure map |

### Create the DynamoDB Lock Table

```bash
# PAY_PER_REQUEST = no provisioned capacity needed — only used during terraform runs
aws dynamodb create-table \
  --table-name coffee-shop-tf-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1

echo "✅ DynamoDB table ready"
```

**How the lock works:**

```
Engineer A runs: terraform apply
  → Terraform writes to DynamoDB: "LockID: coffee-shop-tfstate-bhargav/eks/qa/terraform.tfstate — held by: A"

Engineer B runs: terraform apply at the same time
  → Terraform reads DynamoDB, sees lock is held
  → Error: "state is locked by another process — retry later"
  → B must wait until A's apply finishes and releases the lock

A's apply completes
  → Terraform deletes the lock entry from DynamoDB
  → B can now acquire the lock and proceed
```

This is identical to a database row lock — prevents two concurrent writes from corrupting shared state.

---

## Step 3 — Terraform Configuration

### Backend Configuration (`terraform/main.tf`)

```hcl
terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }

  # Remote state backend
  # S3 stores the state file, DynamoDB prevents concurrent applies
  backend "s3" {
    bucket         = "coffee-shop-tfstate-bhargav"
    key            = "eks/qa/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "coffee-shop-tf-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  # Default tags applied to every resource Terraform creates
  # Enables cost tracking and resource identification in AWS Console
  default_tags {
    tags = {
      Project     = "coffee-shop"
      ManagedBy   = "terraform"
      Environment = var.environment
    }
  }
}
```

**Why `key = "eks/qa/terraform.tfstate"`?**

The `key` is the path inside the S3 bucket. Using a structured path (`eks/qa/terraform.tfstate`) means you can store multiple environments in the same bucket without conflict:

```
coffee-shop-tfstate-bhargav/
├── eks/
│   ├── qa/terraform.tfstate      ← QA cluster state
│   └── prod/terraform.tfstate    ← Prod cluster state (separate)
└── bootstrap/terraform.tfstate   ← If you ever Terraform the bootstrap itself
```

### Environment Values (`terraform/envs/qa.tfvars`)

```hcl
aws_region         = "us-east-1"
environment        = "qa"
cluster_name       = "coffee-shop-qa"
kubernetes_version = "1.31"          # Current EKS stable

# t3.medium: 2 vCPU, 4 GB RAM — sufficient for a single-app test cluster
node_instance_type = "t3.medium"
node_desired_size  = 1
node_min_size      = 1
node_max_size      = 2
```

> **Why `.tfvars` files are gitignored:** `*.tfvars` is in `.gitignore`. The real files (`qa.tfvars`, `prod.tfvars`) stay local and are never committed — they could contain environment-specific values or future secrets. The `.tfvars.example` files are committed as templates.

---

## Step 4 — Terraform Workflow

### Initialise

```bash
cd terraform
terraform init -var-file="envs/qa.tfvars"
```

What `init` does:
- Downloads the AWS provider plugin (`hashicorp/aws ~> 5.0`)
- Downloads the EKS module from the Terraform registry
- Connects to the S3 backend and verifies the bucket is accessible
- Creates a `.terraform.lock.hcl` file that pins provider versions (commit this to Git)

Expected output:
```
Initializing the backend...
Successfully configured the backend "s3"!

Initializing provider plugins...
- Installing hashicorp/aws v5.x.x...
- Installing terraform-aws-modules/eks v20.x.x...

Terraform has been successfully initialized!
```

### Plan

```bash
terraform plan -var-file="envs/qa.tfvars"
```

`plan` is a **dry run** — it shows every resource that will be created, changed, or destroyed without touching anything. Always review the plan before applying.

Key things to check in the plan output:
- Number of resources to add/change/destroy
- No unexpected destroys (a destroy on a production resource is catastrophic)
- Resource names and configurations match what you expect

For this project the plan shows:
```
Plan: 57 to add, 0 to change, 0 to destroy.
```

57 resources covering: VPC, 4 subnets (2 public + 2 private), NAT gateway, Internet gateway, route tables, EKS cluster, managed node group, IAM roles and policies, KMS key, security groups, CoreDNS + kube-proxy + vpc-cni add-ons, and supporting resources.

### Apply

```bash
terraform apply -var-file="envs/qa.tfvars"
```

Terraform shows the plan again and asks for confirmation:
```
Do you want to perform these actions?
  Enter a value: yes
```

**Timeline for this stack (~15 minutes):**

| Time | What's being created |
|------|---------------------|
| 0–2 min | VPC, subnets, Internet Gateway, NAT Gateway, route tables |
| 2–4 min | IAM roles, KMS key, security groups |
| 4–12 min | EKS control plane (this is always the slow part — AWS is provisioning managed Kubernetes) |
| 12–15 min | Managed node group (EC2 instances boot and join the cluster) |
| 15 min | ✅ Done — outputs printed |

After apply completes, Terraform prints outputs:
```
cluster_name     = "coffee-shop-qa"
cluster_endpoint = "https://XXXX.gr7.us-east-1.eks.amazonaws.com"
configure_kubectl = "aws eks update-kubeconfig --region us-east-1 --name coffee-shop-qa"
vpc_id           = "vpc-XXXXXXXXXX"
```

### Connect kubectl to EKS

```bash
# This command comes directly from Terraform outputs
aws eks update-kubeconfig --region us-east-1 --name coffee-shop-qa

# Verify the cluster is reachable
kubectl get nodes
# NAME                            STATUS   ROLES    AGE   VERSION
# ip-10-0-x-x.ec2.internal        Ready    <none>   2m    v1.31.x
```

### Destroy

```bash
# Tears down every resource Terraform created — billing stops immediately
terraform destroy -var-file="envs/qa.tfvars"
```

Terraform lists everything that will be deleted and asks for confirmation. This takes ~10 minutes. The S3 bucket and DynamoDB table are **not** destroyed by this — they are bootstrap resources, created manually, deleted manually if needed.

---

## What Terraform Created — Resource Map

```
AWS Account (116743944879)
│
└── VPC: coffee-shop-qa (10.0.0.0/16)
    │
    ├── Internet Gateway
    │
    ├── Public Subnet AZ-a (10.0.1.0/24)
    │   ├── NAT Gateway (outbound internet for private subnets)
    │   └── Route: 0.0.0.0/0 → Internet Gateway
    │
    ├── Public Subnet AZ-b (10.0.2.0/24)
    │   └── Route: 0.0.0.0/0 → Internet Gateway
    │
    ├── Private Subnet AZ-a (10.0.3.0/24)  ← EKS nodes live here
    │   └── Route: 0.0.0.0/0 → NAT Gateway
    │
    ├── Private Subnet AZ-b (10.0.4.0/24)  ← EKS nodes live here
    │   └── Route: 0.0.0.0/0 → NAT Gateway
    │
    └── EKS Cluster: coffee-shop-qa (K8s 1.31)
        │
        ├── KMS Key (etcd secrets encryption)
        ├── IAM Role: cluster role
        ├── IAM Role: node group role
        ├── Security Groups: cluster + node
        │
        ├── Add-ons: CoreDNS, kube-proxy, vpc-cni
        │
        └── Managed Node Group: coffee-shop-nodes
            ├── Instance type: t3.medium
            ├── Desired: 1 node
            ├── EBS volume: 20 GB gp3 (encrypted)
            └── Labels: environment=qa, app=coffee-shop
```

---

## Security Best Practices — Terraform

### 1. Never Commit State Files

```gitignore
# .gitignore — these must never be committed
*.tfstate
*.tfstate.*
.terraform/
```

State files contain plaintext resource IDs, cluster endpoints, and can expose sensitive data. Always use remote state (S3) and never commit `.tfstate` to Git.

### 2. Never Commit Real `.tfvars`

```gitignore
*.tfvars
!*.tfvars.example
```

Variable files can contain environment-specific values and future secrets (database passwords, API keys). Commit only the `.example` template — the real file stays local or in a secrets manager.

### 3. Pin Provider Versions

```hcl
required_providers {
  aws = {
    source  = "hashicorp/aws"
    version = "~> 5.0"   # allows 5.x but not 6.0
  }
}
```

Unpinned providers (`version = "latest"`) can break your infrastructure silently when a new major version is released with breaking changes. Always pin to a minor version range and upgrade deliberately.

### 4. Commit the Lock File

```
.terraform.lock.hcl  ← COMMIT THIS
```

The lock file pins the exact provider versions used. Without it, different engineers might use different provider versions, leading to inconsistent infrastructure.

### 5. Use Remote State with Encryption + Locking

```hcl
backend "s3" {
  bucket         = "coffee-shop-tfstate-bhargav"
  key            = "eks/qa/terraform.tfstate"
  region         = "us-east-1"
  dynamodb_table = "coffee-shop-tf-locks"
  encrypt        = true   # ← always true
}
```

Never use local state for shared infrastructure. Remote state ensures one source of truth, prevents concurrent corruption, and encrypts sensitive data at rest.

### 6. Encrypt EBS Volumes by Default

```hcl
block_device_mappings = {
  xvda = {
    device_name = "/dev/xvda"
    ebs = {
      encrypted   = true      # ← data at rest encryption
      volume_type = "gp3"
      volume_size = 20
    }
  }
}
```

Node root volumes store container images, logs, and temporary data. Without encryption, anyone with physical access to the underlying hardware (or a misconfigured snapshot) can read this data.

### 7. Keep Nodes in Private Subnets

```hcl
module "eks" {
  subnet_ids = module.vpc.private_subnets   # ← private only, never public
}
```

EKS worker nodes should never have public IP addresses. All inbound traffic goes through the load balancer. Nodes only need outbound internet access (via NAT Gateway) for pulling images and calling AWS APIs.

### 8. Tag Every Resource

```hcl
provider "aws" {
  default_tags {
    tags = {
      Project     = "coffee-shop"
      ManagedBy   = "terraform"
      Environment = var.environment
    }
  }
}
```

Tags are how you track costs, find orphaned resources, and enforce access policies. `ManagedBy = "terraform"` is especially useful — when you see an untagged resource in the console, you know it was created manually and might be a security risk.

### 9. Always Run Plan Before Apply

```bash
# WRONG — skip plan, apply directly
terraform apply -var-file="envs/prod.tfvars" -auto-approve

# RIGHT — always review before applying
terraform plan -var-file="envs/prod.tfvars"
# review output carefully
terraform apply -var-file="envs/prod.tfvars"
```

On production, a plan might show an unexpected `destroy` action for a critical database or cluster. `-auto-approve` would execute it silently. Always read the plan.

### 10. Separate State Per Environment

```
# Wrong — all environments share one state file
key = "terraform.tfstate"

# Right — isolated state per environment
key = "eks/qa/terraform.tfstate"     # QA
key = "eks/prod/terraform.tfstate"   # Prod
```

If QA and prod share state, a corrupted QA apply could affect prod state. Keep them completely isolated.

### 11. Use IAM Roles, Not Access Keys, in CI

For CI pipelines (GitHub Actions, Jenkins), never store `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` as long-lived secrets. Use OIDC identity federation instead — the pipeline assumes an IAM role with a short-lived token. No stored credentials means no credentials to leak.

```yaml
# GitHub Actions OIDC — no stored AWS secrets needed
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::116743944879:role/github-actions-terraform
    aws-region: us-east-1
```

---

## Real-World State Backend Alternatives

| Company / Setup | State Backend | Lock Mechanism |
|-----------------|--------------|----------------|
| AWS projects (small/medium team) | S3 | DynamoDB |
| GCP projects | Google Cloud Storage | GCS native locking |
| Azure projects | Azure Blob Storage | Azure native lease |
| Any cloud (SaaS option) | **Terraform Cloud (HCP)** | Built-in — free for small teams |
| Large engineering teams | **Terraform Enterprise** | RBAC + policy enforcement + SSO |
| Open-source self-hosted | **Atlantis** | Git PR-based workflow — plan on PR open, apply on merge |

**Terraform Cloud** is worth knowing — it is HashiCorp's free SaaS offering that handles remote state, locking, and a UI for plan/apply workflows without managing S3 and DynamoDB yourself.

**Atlantis** is widely used at larger companies — it runs as a server in your cluster and automatically runs `terraform plan` when a PR is opened, posts the plan output as a PR comment, and runs `terraform apply` when the PR is merged. This makes infrastructure changes go through the same code review process as application code.

---

## Security Checklist — Terraform

| Check | Status |
|-------|--------|
| AWS CLI installed from official PKG (not Homebrew) | ✅ |
| Credentials configured via `aws configure` | ✅ |
| Root account used only for initial setup — IAM user for ongoing work | ⚠️ Recommended for production |
| S3 bucket created with versioning enabled | ✅ |
| S3 bucket encryption (AES256) enabled | ✅ |
| S3 bucket public access blocked | ✅ |
| DynamoDB lock table created (PAY_PER_REQUEST) | ✅ |
| Backend `encrypt = true` in `main.tf` | ✅ |
| `*.tfstate` and `.terraform/` in `.gitignore` | ✅ |
| Real `*.tfvars` in `.gitignore` (only `.example` committed) | ✅ |
| Provider versions pinned (`~> 5.0`) | ✅ |
| `.terraform.lock.hcl` committed to Git | ✅ |
| EKS nodes in private subnets only | ✅ |
| EBS volumes encrypted | ✅ |
| All resources tagged (`ManagedBy = terraform`) | ✅ |
| `terraform plan` reviewed before every `apply` | ✅ |
| Separate state key per environment (`eks/qa/` vs `eks/prod/`) | ✅ |

---

*Next: After `terraform apply` completes — connect kubectl, install ArgoCD on EKS, deploy the app, and verify public access.*





What is Terraform State?
When you run terraform apply, Terraform creates your AWS resources. But Terraform needs to remember what it created — so next time you run terraform plan, it knows what already exists vs. what needs to change or be deleted.
That memory is stored in a file called terraform.tfstate. It's a JSON file that maps your Terraform code to real AWS resource IDs.
Your code says:          Terraform state knows:
aws_eks_cluster          → actual cluster ID: "coffee-shop-qa-eks"
aws_vpc                  → actual VPC ID: "vpc-0a1b2c3d4e5f"
aws_subnet (public-a)    → actual subnet ID: "subnet-0123456789"
Without this file, Terraform has no idea what it previously built. Every plan would try to create everything from scratch.

Why S3? Why Not Just a Local File?
By default, terraform.tfstate is saved on your laptop in the project folder. That works fine when you're the only person and you never lose your machine. But in real projects:
Problem 1 — Team collaboration. If two engineers both run terraform apply at the same time from their own laptops, they each have a different state file. They'll overwrite each other's infrastructure and corrupt everything.
Problem 2 — State file lost = disaster. If your laptop dies, or you accidentally delete the file, Terraform no longer knows what it created. You'd have to manually import every single AWS resource back into state — or destroy and recreate everything.
Problem 3 — State contains secrets. The .tfstate file contains sensitive data (database passwords, IAM keys, etc. in plaintext). You should never commit it to Git. Storing it in S3 with encryption solves this.
So S3 is used as a central, encrypted, versioned store for the state file. Everyone on the team points to the same bucket. The file is backed up automatically because S3 keeps versions.

Why DynamoDB? What's the Lock For?
S3 solves the storage problem. But it doesn't solve the race condition problem.
Imagine two engineers both run terraform apply at the same time. Both read the state file from S3. Both start making changes. Both write their updated state file back to S3 — the second one overwrites the first. Infrastructure is now inconsistent.
DynamoDB is used as a distributed lock. Before Terraform does anything, it writes a lock entry to DynamoDB:
"Lock acquired by: Bhargav — terraform apply — 10:32:14 UTC"
If a second person tries to run at the same time, Terraform checks DynamoDB, sees the lock is held, and refuses to proceed until the first run finishes.
╔═══════════════════════════╗
║  Error: state is locked   ║
║  Lock ID: abc-123         ║
║  Locked by: bhargav       ║
║  Run: terraform apply     ║
╚═══════════════════════════╝
It's the same concept as a database row lock — prevents two writes from corrupting the same record simultaneously.

Real-World Usage — What Do Companies Actually Use?
Company SizeWhere they store TF stateLock mechanismSolo / small projectLocal file (risky)NoneSmall team on AWSS3 + DynamoDBDynamoDB (exactly what we're doing)Small team on GCPGoogle Cloud StorageGCS built-in lockingSmall team on AzureAzure Blob StorageAzure Blob native leaseMedium/Large companyTerraform Cloud / HCP TerraformBuilt-in locking + UI + audit logsEnterpriseAtlantis (self-hosted)Git-based workflow — PRs trigger plansHashiCorp customersTerraform EnterpriseFull RBAC, policy enforcement, SSO
The most common at real companies: S3 + DynamoDB for AWS or Terraform Cloud (HashiCorp's SaaS, free for small teams).