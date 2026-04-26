# EKS cluster + managed node group
# Uses the official AWS EKS Terraform module

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = var.cluster_name
  cluster_version = var.kubernetes_version

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets   # Nodes run in private subnets only

  # API server reachable from internet (for kubectl) and from within VPC
  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true

  # Core EKS managed add-ons — always keep these on latest
  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
  }

  # Managed node group — AWS handles node patching and replacement
  eks_managed_node_groups = {
    coffee-shop-nodes = {
      instance_types = [var.node_instance_type]

      min_size     = var.node_min_size
      max_size     = var.node_max_size
      desired_size = var.node_desired_size

      # Amazon Linux 2 — EKS-optimised, hardened AMI
      ami_type = "AL2_x86_64"

      # Encrypted root volume — data at rest protection
      block_device_mappings = {
        xvda = {
          device_name = "/dev/xvda"
          ebs = {
            volume_size           = 20
            volume_type           = "gp3"
            encrypted             = true
            delete_on_termination = true
          }
        }
      }

      # Node labels — useful for future workload scheduling
      labels = {
        environment = var.environment
        app         = "coffee-shop"
      }
    }
  }

  # Grants the IAM identity running terraform full cluster-admin access
  enable_cluster_creator_admin_permissions = true
}
