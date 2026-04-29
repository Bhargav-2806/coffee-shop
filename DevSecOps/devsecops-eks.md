# DevSecOps Mindset — EKS: Running Kubernetes on AWS

> **Core Principle:** Running containers in production is not just an infrastructure problem — it is a security problem.  
> Every layer from the EC2 node to the pod network to the IAM role is an attack surface that must be deliberately hardened.

---

## What Is EKS?

EKS stands for **Elastic Kubernetes Service** — AWS's managed Kubernetes offering. You define what workloads you want to run, and AWS handles the complexity of keeping Kubernetes itself healthy.

Without EKS, running Kubernetes on AWS means:
- Manually provisioning EC2 instances and installing Kubernetes on each
- Running your own `etcd` cluster (the database that stores all cluster state)
- Managing control plane upgrades, certificates, and HA yourself
- Monitoring the API server and restarting it if it crashes

With EKS, AWS owns all of that. You only manage the **worker nodes** — the EC2 instances where your actual containers run.

---

## EKS Architecture: Two Distinct Layers

This is the most important concept to understand. EKS has two completely separate layers:

### Layer 1 — Control Plane (AWS-managed, invisible to you)

| Component | What it does |
|---|---|
| API Server | The brain — every `kubectl` command talks to this |
| etcd | The memory — stores all cluster state (pods, services, secrets) |
| Scheduler | Decides which node a pod runs on |
| Controller Manager | Watches for desired state and reconciles it |

You **never see these as EC2 instances**. AWS runs them on their own infrastructure across multiple Availability Zones. You access the API server via:

```
https://C1905B7D9BC0F878D4BE46B1E31A5D6F.gr7.us-east-1.eks.amazonaws.com
```

This costs **$0.10/hour** even if you have zero worker nodes — you are paying for AWS to run the control plane.

### Layer 2 — Data Plane (your EC2 instances)

These are the worker nodes — the machines where your containers actually run. In our setup:

```
ip-10-0-1-227.ec2.internal   t3.small   us-east-1a   Node 1 (ArgoCD + system pods)
ip-10-0-2-88.ec2.internal    t3.small   us-east-1b   Node 2 (coffee-shop pod)
```

Each node runs three core processes:
- **kubelet** — talks to the API server, manages pod lifecycle on the node
- **kube-proxy** — manages network rules so pods can communicate
- **containerd** — the container runtime that actually pulls and runs images

**Mental model:** Kubernetes is the brain, EC2 is the muscle. The brain is invisible and managed by AWS. The muscle is your EC2 instances.

---

## Why We Chose us-east-1 (and Why Frankfurt Is Better for Europe)

We defaulted to `us-east-1` (N. Virginia) because it is AWS's oldest, largest region and is the default in most documentation. However, this was the wrong choice for a deployment from Berlin.

| Region | Location | Latency from Berlin | GDPR |
|---|---|---|---|
| `us-east-1` | N. Virginia | ~100ms | ❌ Data leaves EU |
| `eu-central-1` | Frankfurt | ~10ms | ✅ Data stays in EU |

**For any real production deployment targeting European users, always use `eu-central-1`.** Changing region is a 2-line change in `qa.tfvars` — but it requires a full `terraform destroy` + `terraform apply` because AWS resources cannot be moved between regions.

To switch after today's destroy:

```hcl
# terraform/envs/qa.tfvars
aws_region = "eu-central-1"   # Frankfurt — 550km from Berlin
```

```hcl
# terraform/main.tf backend
backend "s3" {
  region = "eu-central-1"
  ...
}
```

---

## Full Deployment: Step-by-Step Commands

### Step 1 — Terraform Apply (creates EKS + VPC + nodes)

```bash
cd terraform
terraform init
terraform plan -var-file="envs/qa.tfvars"
terraform apply -var-file="envs/qa.tfvars"
# Takes ~20-25 minutes
# Creates 57 resources: VPC, subnets, NAT gateway, EKS cluster, IAM roles, node group
```

Expected outputs after apply:

```
cluster_endpoint = "https://C1905B7D9BC0F878D4BE46B1E31A5D6F.gr7.us-east-1.eks.amazonaws.com"
cluster_name     = "coffee-shop-qa"
configure_kubectl = "aws eks update-kubeconfig --region us-east-1 --name coffee-shop-qa"
private_subnet_ids = ["subnet-0c5a671c0f6bc09c6", "subnet-09d335ab1842ccda1"]
vpc_id = "vpc-06edc130185b0e97d"
```

### Step 2 — Connect kubectl

```bash
aws eks update-kubeconfig --region us-east-1 --name coffee-shop-qa
# Writes cluster credentials to ~/.kube/config
# Adds context: arn:aws:eks:us-east-1:116743944879:cluster/coffee-shop-qa
```

Verify the node joined the cluster:

```bash
kubectl get nodes
# NAME                          STATUS   ROLES    AGE   VERSION
# ip-10-0-1-227.ec2.internal    Ready    <none>   3m    v1.31.13-eks-ecaa3a6
```

### Step 3 — Install ArgoCD

```bash
kubectl create namespace argocd

kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for ArgoCD to be fully ready
kubectl wait --for=condition=available --timeout=300s deployment/argocd-server -n argocd
# deployment.apps/argocd-server condition met
```

### Step 4 — Access ArgoCD UI

```bash
# Get the admin password
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d

# Port-forward to access locally
kubectl port-forward svc/argocd-server -n argocd 8080:443
# Open: https://localhost:8080
# Username: admin
# Password: output from above command
```

### Step 5 — Create Namespace and Deploy App

```bash
kubectl create namespace coffee-qa

# Apply the ArgoCD Application manifest from our repo
kubectl apply -f argocd/coffee-shop-qa.yaml
```

ArgoCD immediately detects the manifest, polls GitHub, pulls the Helm chart, and deploys the app into `coffee-qa` namespace automatically.

### Step 6 — Verify the App

```bash
kubectl get pods -n coffee-qa
# NAME                           READY   STATUS    RESTARTS   AGE
# coffee-shop-7c5d59f4dd-dcmj2   1/1     Running   0          2m

kubectl get svc -n coffee-qa
# NAME          TYPE           CLUSTER-IP     EXTERNAL-IP                                    PORT(S)
# coffee-shop   LoadBalancer   172.20.195.0   ab255134...us-east-1.elb.amazonaws.com         80:32672/TCP
```

Open the `EXTERNAL-IP` in a browser — the app is publicly accessible.

---

## Errors We Hit and Why They Happened

### Error 1 — t3.medium: Not Free Tier Eligible

```
AsgInstanceLaunchFailures: Could not launch On-Demand Instances.
InvalidParameterCombination - The specified instance type is not eligible for Free Tier.
```

**Root cause:** The AWS account had restrictions on non-Free-Tier instance types. `t3.medium` was blocked.

**Fix:** Changed `node_instance_type` from `t3.medium` to `t3.small` in `qa.tfvars`.

```hcl
# Before
node_instance_type = "t3.medium"   # 2 vCPU, 4GB — blocked by account restriction

# After
node_instance_type = "t3.small"    # 2 vCPU, 2GB — minimum viable EKS node
```

**Why not `t3.micro`?** Free Tier eligible instances (`t2.micro`, `t3.micro`) have only 1GB RAM. EKS system pods (CoreDNS, kube-proxy, vpc-cni) alone consume ~500MB. The app pod would have zero headroom and be OOMKilled immediately.

When instance type changes, Terraform must replace 4 resources (not 1) because instance type is baked into the Launch Template — an immutable property:

```
Plan: 4 to add, 0 to change, 1 to destroy
# 1 destroy: old failed node group
# 4 add: new launch template + new node group + ASG policy + IAM attachment
```

---

### Error 2 — Pod Stuck in Pending: Too Many Pods

```
0/1 nodes are available: 1 Too many pods.
preemption: 0/1 nodes are available: 1 No preemption victims found for incoming pod.
```

**Root cause:** `t3.small` has a maximum of **11 pods** due to AWS ENI (Elastic Network Interface) limits. The formula is:

```
Max pods = (number of ENIs × IPs per ENI) - number of ENIs + 2
t3.small: 3 ENIs × 4 IPs = (3 × 4) - 3 + 2 = 11 pods maximum
```

With 1 node running:
- 4 system pods (CoreDNS ×2, kube-proxy, vpc-cni)
- 7 ArgoCD pods (argocd-server, repo-server, application-controller, dex-server, redis, notifications-controller, applicationset-controller)
- Total: 11 pods — node is full, coffee-shop pod has nowhere to go

**Fix:** Scale the node group to 2 nodes:

```bash
# Get the node group name
aws eks list-nodegroups --cluster-name coffee-shop-qa --region us-east-1

# Scale to 2 nodes
aws eks update-nodegroup-config \
  --cluster-name coffee-shop-qa \
  --nodegroup-name coffee-shop-nodes-20260429102835776600000001 \
  --scaling-config minSize=1,maxSize=2,desiredSize=2 \
  --region us-east-1
```

Also update `qa.tfvars` to keep Terraform state in sync:

```hcl
node_desired_size = 2   # Updated from 1
```

The second node was placed in a **different Availability Zone** (`us-east-1a` vs `us-east-1b`) automatically — AWS spreads nodes across AZs for resilience.

---

## Why We Have 2 Nodes

### Reason 1 — Pod Capacity (the immediate reason)

`t3.small` max pod limit is 11. With ArgoCD running 7 pods + 4 system pods, there was no space left for the coffee-shop pod. The second node gave the scheduler room to place the app.

### Reason 2 — High Availability Across Availability Zones

AWS automatically placed Node 1 in `us-east-1b` and Node 2 in `us-east-1a`. These are physically separate data centres within the us-east-1 region — separate power, separate networking, separate cooling.

If `us-east-1b` has an outage (power failure, hardware fault, network issue), Node 2 in `us-east-1a` keeps running. Kubernetes detects Node 1 as `NotReady` and reschedules the pods automatically.

With 1 node, any node-level failure takes down the entire application. With 2 nodes in 2 AZs, the application survives a single AZ failure.

### Reason 3 — Zero-Downtime Deployments

Our `values.yaml` specifies a rolling update strategy:

```yaml
rollingUpdate:
  maxUnavailable: 0   # Never kill a pod before the replacement is Running
  maxSurge: 1         # Spin up 1 extra pod during deploy
```

With only 1 node and 11 pods already running, `maxSurge: 1` has no capacity to create the extra pod. Two nodes give the scheduler capacity to spin up the new version alongside the old one before terminating the old version.

---

## How the Full Deployment Flow Works

Understanding this is critical. There are 3 separate connections — not one continuous chain.

```
1. CI PIPELINE
   Developer pushes code → GitHub Actions runs:
   - Build Docker image
   - Run tests (Vitest, Trivy, SAST)
   - Push image to Docker Hub (3 tags: :sha, :latest, :sha.sig)
   - Commit updated values-qa.yaml (new image tag) back to GitHub

2. GITOPS (ArgoCD → GitHub)
   ArgoCD polls GitHub every 3 minutes
   Detects values-qa.yaml changed (new image tag)
   Calls Kubernetes API: "apply this Helm chart with this image tag"

3. KUBERNETES (EKS node → Docker Hub)
   kubelet on the worker node pulls the image directly from Docker Hub
   Uses NAT Gateway to reach the public internet from the private subnet
   Starts the container with the new image
```

**The key insight:** ArgoCD and Docker Hub never talk to each other. ArgoCD only knows about Git. Kubernetes only knows about the image tag it was told to run. They are completely decoupled.

For a public Docker Hub image (like `bhargav2806/coffee-shop`), no credentials are needed — any machine on the internet can pull it. For a private registry, you would create a Kubernetes `imagePullSecret`:

```bash
kubectl create secret docker-registry dockerhub-creds \
  --docker-username=bhargav2806 \
  --docker-password=<token> \
  --namespace=coffee-qa
```

And reference it in the Helm chart deployment template:

```yaml
spec:
  imagePullSecrets:
    - name: dockerhub-creds
```

---

## Network Architecture: Public vs Private Subnets

Our VPC (`10.0.0.0/16`) has a deliberate split:

```
Internet
    ↓
Internet Gateway
    ↓
Public Subnets (10.0.101.x, 10.0.102.x)
    - Classic ELB lives here (has public IP)
    - NAT Gateway lives here (has public IP)
    ↓
Private Subnets (10.0.1.x, 10.0.2.x)
    - EKS worker nodes live here (NO public IP)
    - Pods live here
    - Outbound internet via NAT Gateway
```

**Why nodes have no public IP:**

If a node had a public IP, an attacker could attempt to reach it directly — port scan for open services, try to SSH in, exploit any vulnerability in kubelet or the OS. With no public IP, the only way to reach a node is through the Kubernetes API (which requires AWS credentials and cluster access).

The `Public IPv4 address: –` field you saw in the AWS EC2 console is intentional and a security requirement. The `Public DNS: –` being empty confirms the same.

**Outbound traffic from nodes:**

Nodes need to pull Docker images from Docker Hub, download OS updates, and call AWS APIs. They do this through the **NAT Gateway** in the public subnet. NAT Gateway has a public IP, but it only allows outbound connections — no inbound traffic can originate from outside through it.

---

## How to Access the Application

### Option 1 — ELB DNS (production path, recommended)

```
http://ab255134fe3284ca0a810eed6feb6f50-1521799430.us-east-1.elb.amazonaws.com
```

This is the public entry point. The Classic ELB sits in the public subnet and forwards port 80 traffic to the node port, which Kubernetes routes to the pod on port 8080.

Find it via:
```bash
kubectl get svc -n coffee-qa
# EXTERNAL-IP column

# Or via AWS CLI:
aws elb describe-load-balancers \
  --region us-east-1 \
  --query 'LoadBalancerDescriptions[*].DNSName' \
  --output text
```

### Option 2 — kubectl port-forward (debug path, no ELB needed)

```bash
kubectl port-forward svc/coffee-shop -n coffee-qa 8080:80
# Open: http://localhost:8080
```

This creates an encrypted tunnel through the Kubernetes API server directly to the pod. Useful for debugging without exposing anything publicly. Does not use the ELB.

### Option 3 — AWS Systems Manager Session (node-level debugging)

```bash
aws ssm start-session --target i-0ec1770b60be5b67e --region us-east-1
# Now inside the node
curl http://10.0.2.88:8080/health
```

SSM allows shell access to private nodes without SSH keys or open port 22. The `10.0.x.x` private IPs are only reachable from within the VPC — your laptop on the public internet cannot reach them directly.

### Why You Cannot Use Private IPs from Your Laptop

```
Your laptop (public internet)
    ↕  cannot reach
10.0.2.88 (private VPC subnet)
```

Private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) are not routed on the public internet. Only machines inside the VPC — or connected via VPN/Direct Connect — can reach `10.0.x.x` addresses. This is the correct security posture, not a limitation.

---

## Where the DevSecOps Mindset Applies in EKS

### 1. Private Worker Nodes (Zero Direct Attack Surface)

Nodes have no public IP. No one can SSH in from the internet. No port 22 open. The only management path is through the Kubernetes API (requires AWS IAM credentials) or SSM (also requires IAM credentials).

```hcl
# eks.tf — nodes go into private subnets only
subnet_ids = module.vpc.private_subnets
```

### 2. Encrypted EBS Volumes (Data at Rest)

Every worker node's root disk is encrypted at rest:

```hcl
# eks.tf
block_device_mappings = {
  xvda = {
    device_name = "/dev/xvda"
    ebs = {
      volume_size = 20
      volume_type = "gp3"
      encrypted   = true   # AES-256 via AWS KMS
    }
  }
}
```

If AWS decommissions the underlying hardware and the disk is physically extracted, the data is unreadable without the KMS key.

### 3. Pod Security Context (Least Privilege Containers)

Every pod runs with hardened security settings:

```yaml
# values.yaml
podSecurityContext:
  runAsNonRoot: true        # Cannot run as root (UID 0)
  runAsUser: 1001           # Specific non-root UID
  runAsGroup: 1001
  seccompProfile:
    type: RuntimeDefault    # Blocks dangerous syscalls

containerSecurityContext:
  allowPrivilegeEscalation: false   # Cannot sudo or setuid
  readOnlyRootFilesystem: true      # Cannot write to container filesystem
  capabilities:
    drop:
      - ALL                          # No Linux capabilities at all
```

A compromised coffee-shop container cannot escalate to root, cannot write to disk, cannot make dangerous kernel calls, and cannot affect other pods or the node.

### 4. Kubernetes RBAC (Who Can Do What in the Cluster)

The `enable_cluster_creator_admin_permissions = true` in `eks.tf` grants the IAM identity that ran `terraform apply` full cluster-admin. In a production setup, this should be broken into specific roles:

```yaml
# Developer — can read pods and logs, cannot delete
# CI pipeline — can update image tags only
# ArgoCD — can apply manifests to specific namespaces only
# On-call engineer — can restart pods, cannot modify RBAC
```

### 5. Network Policy (Pod-to-Pod Firewall)

Our Helm chart includes a `NetworkPolicy` that restricts what can talk to the coffee-shop pod:

```yaml
# Only allow ingress from the LoadBalancer (port 8080)
# Deny all other pod-to-pod traffic by default
```

Without network policies, any compromised pod in any namespace could reach your app pod directly. With network policies, even if an attacker compromises a pod in `kube-system`, it cannot reach your app.

### 6. Managed Node Group (Automatic OS Patching)

We used `eks_managed_node_groups` instead of self-managed nodes. AWS handles:
- Node OS updates (Amazon Linux 2 EKS-optimised AMI)
- Kubernetes version upgrades (one-click in console or `terraform apply`)
- Node replacement on hardware failure

Self-managed nodes require you to maintain the AMI, handle OS patches, and manage the upgrade process — creating significant operational and security debt.

### 7. Kubernetes Version Pinning

We explicitly set `kubernetes_version = "1.31"` rather than using `latest`. This means:
- Upgrades are deliberate and tested, not automatic
- Breaking changes in a new version don't surprise you in production
- The `.terraform.lock.hcl` pins the provider version too

End of Extended Support for Kubernetes 1.31 is November 26, 2026 — as warned in the AWS console. Plan to upgrade to 1.32 before that date.

### 8. LoadBalancer Service Type (EKS vs kind)

On local `kind` cluster: `ClusterIP` service + nginx Ingress (only accessible at localhost)  
On EKS: `LoadBalancer` service type — AWS automatically provisions a Classic ELB

```yaml
# values-qa.yaml — overrides the default ClusterIP for EKS
service:
  type: LoadBalancer
  port: 80
  targetPort: 8080
```

The values override pattern is the correct DevSecOps approach — the base `values.yaml` is secure (ClusterIP, not exposed), and the environment-specific override deliberately opens it up with a conscious decision.

### 9. ArgoCD Self-Healing (Drift Prevention)

```yaml
# argocd/coffee-shop-qa.yaml
syncPolicy:
  automated:
    prune: true      # Remove resources deleted from Git
    selfHeal: true   # Revert manual kubectl changes back to Git state
```

If an engineer runs `kubectl set image` manually in production (bypassing GitOps), ArgoCD detects the drift within 3 minutes and reverts it back to what Git says. This enforces Git as the single source of truth and creates an immutable audit trail.

### 10. IAM Roles for Nodes (Not Access Keys)

Worker nodes talk to AWS APIs (ECR, S3, CloudWatch) using IAM roles attached to the instance profile — not hardcoded AWS access keys. This means:
- No credentials stored on disk that can be stolen
- Credentials rotate automatically via the instance metadata service
- IAM policies follow least privilege — nodes can only do what they need to do

---

## The Difference Between Internal and External DNS

| DNS Name | Accessible from | Used for |
|---|---|---|
| `ab255134...elb.amazonaws.com` | Public internet | User-facing access |
| `ip-10-0-2-88.ec2.internal` | Inside VPC only | Node hostname (not useful externally) |
| `10.0.2.88` | Inside VPC only | Pod-to-node internal routing |
| `coffee-shop.coffee-qa.svc.cluster.local` | Inside cluster only | Pod-to-service DNS |

In production, you would add a Route53 CNAME or Alias record:

```
coffee-shop.yourdomain.com  →  ALIAS  →  ab255134...elb.amazonaws.com
```

This means the ELB DNS (which changes on every terraform destroy + apply) is abstracted behind a stable domain name. Users always reach `coffee-shop.yourdomain.com` regardless of which ELB is behind it.

---

## Destroy: Cleaning Up Everything

Always destroy in this order — ArgoCD first, then Terraform. Terraform destroy while ArgoCD is still running can cause race conditions where ArgoCD recreates resources Terraform just deleted.

```bash
# Step 1 — Remove the ArgoCD application (stops deployment syncing)
kubectl delete -f argocd/coffee-shop-qa.yaml

# Step 2 — Remove namespaces (deletes all pods and services)
kubectl delete namespace coffee-qa
kubectl delete namespace argocd

# Step 3 — Destroy all AWS infrastructure
cd terraform
terraform destroy -var-file="envs/qa.tfvars"
# Takes ~10 minutes, removes all 57 resources
# Type "yes" when prompted
```

### Verify Nothing Is Left Running (Avoid Surprise Bills)

```bash
# No EKS clusters should remain
aws eks list-clusters --region us-east-1

# No EC2 instances should be running
aws ec2 describe-instances \
  --region us-east-1 \
  --query 'Reservations[*].Instances[*].[InstanceId,State.Name,InstanceType]' \
  --output table

# No load balancers should exist
aws elb describe-load-balancers \
  --region us-east-1 \
  --query 'LoadBalancerDescriptions[*].LoadBalancerName' \
  --output text
```

### What Remains After Destroy

The S3 bucket and DynamoDB table (created manually for Terraform state) are **not managed by Terraform** in this config and will not be destroyed. They cost almost nothing:
- S3 state file: ~$0.001/month
- DynamoDB: $0 (stays within free tier at this usage level)

If you want to remove them completely:

```bash
aws s3 rb s3://coffee-shop-tfstate-bhargav --force
aws dynamodb delete-table --table-name coffee-shop-tf-locks --region us-east-1
```

---

## AWS Cost Breakdown for This 1-Hour Test

| Resource | Cost/Hour | What it is |
|---|---|---|
| EKS Control Plane | $0.10 | AWS-managed Kubernetes API server |
| EC2 t3.small ×2 | $0.046 | Worker nodes ($0.023 each) |
| NAT Gateway | $0.045 | Outbound internet for private nodes |
| Classic ELB | $0.025 | Public load balancer |
| EBS gp3 20GB ×2 | ~$0.003 | Encrypted root volumes |
| **Total** | **~$0.22/hour** | |

A 1-hour full test costs roughly **$0.22**. Running this 24/7 for a month would cost ~$160. This is why `terraform destroy` matters — idle AWS infrastructure burns money continuously.

---

## Security Checklist

| Control | Status | Where |
|---|---|---|
| Worker nodes in private subnets | ✅ | `vpc.tf` private_subnets |
| No public IP on worker nodes | ✅ | EKS managed node group default |
| EBS volumes encrypted | ✅ | `eks.tf` block_device_mappings |
| Pod runs as non-root | ✅ | `values.yaml` runAsUser: 1001 |
| Read-only root filesystem | ✅ | `values.yaml` readOnlyRootFilesystem |
| No privilege escalation | ✅ | `values.yaml` allowPrivilegeEscalation: false |
| All capabilities dropped | ✅ | `values.yaml` capabilities.drop: ALL |
| Seccomp profile applied | ✅ | `values.yaml` RuntimeDefault |
| Network policy restricting ingress | ✅ | Helm networkpolicy template |
| ArgoCD self-heal prevents drift | ✅ | `argocd/coffee-shop-qa.yaml` |
| Kubernetes version pinned | ✅ | `kubernetes_version = "1.31"` |
| Managed node group (auto-patching) | ✅ | `eks_managed_node_groups` |
| IAM role on nodes (no access keys) | ✅ | EKS managed node group default |
| Cluster API public + private access | ✅ | Both endpoints enabled |
