# Terraform + AWS provider configuration
# NOTE: Apply only after local kind cluster deployment is verified working

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

  # Remote state backend — create the S3 bucket + DynamoDB table manually first,
  # then uncomment this block before running terraform init
  # backend "s3" {
  #   bucket         = "coffee-shop-terraform-state"
  #   key            = "eks/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "coffee-shop-terraform-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  # These tags are applied to every resource Terraform creates
  default_tags {
    tags = {
      Project     = "coffee-shop"
      ManagedBy   = "terraform"
      Environment = var.environment
    }
  }
}
