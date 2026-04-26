# Outputs — use these after terraform apply to connect kubectl and ArgoCD

output "cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "EKS API server endpoint"
  value       = module.eks.cluster_endpoint
}

output "cluster_certificate_authority_data" {
  description = "Base64-encoded cluster CA certificate — used by kubectl"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

output "configure_kubectl" {
  description = "Run this command to point kubectl at the new EKS cluster"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}"
}

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "private_subnet_ids" {
  description = "Private subnet IDs — EKS nodes run here"
  value       = module.vpc.private_subnets
}
