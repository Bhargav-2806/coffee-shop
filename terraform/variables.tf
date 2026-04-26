# All input variables — values supplied via envs/qa.tfvars or envs/prod.tfvars

variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name — qa or prod"
  type        = string

  validation {
    condition     = contains(["qa", "prod"], var.environment)
    error_message = "environment must be 'qa' or 'prod'."
  }
}

variable "cluster_name" {
  description = "EKS cluster name (e.g. coffee-shop-qa)"
  type        = string
}

variable "kubernetes_version" {
  description = "Kubernetes version for the EKS cluster"
  type        = string
  default     = "1.29"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "node_instance_type" {
  description = "EC2 instance type for EKS worker nodes"
  type        = string
  default     = "t3.medium"
}

variable "node_desired_size" {
  description = "Desired number of worker nodes"
  type        = number
  default     = 2
}

variable "node_min_size" {
  description = "Minimum number of worker nodes"
  type        = number
  default     = 1
}

variable "node_max_size" {
  description = "Maximum number of worker nodes (for scale-out)"
  type        = number
  default     = 3
}
