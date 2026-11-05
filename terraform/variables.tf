variable "aws_region" {
  description = "AWS region where resources will be deployed"
  type        = string
  default     = "ap-south-1"
}

variable "aws_profile" {
  description = "AWS CLI profile name configured in ~/.aws/credentials. Leave blank to use default AWS credentials or environment variables."
  type        = string
  default     = ""
}

variable "environment" {
  description = "Deployment environment or account name (e.g., dev, staging, prod, personal, company)"
  type        = string
  default     = "prod"
}

variable "project_name" {
  description = "Project identifier used in naming and tagging resources"
  type        = string
  default     = "behavior-prediction"
}

variable "instance_type" {
  description = "EC2 instance type for running Docker and ML backend"
  type        = string
  default     = "t3.small"
}

variable "root_volume_size" {
  description = "Size of the root EBS volume in GB (gp3)"
  type        = number
  default     = 25
}

variable "vpc_cidr" {
  description = "CIDR block for the dedicated VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidr" {
  description = "CIDR block for the public subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "allowed_ssh_cidr" {
  description = "IP CIDR blocks allowed to connect via SSH (port 22). Default is 0.0.0.0/0, but you can restrict it to your IP (e.g., [\"203.0.113.50/32\"])."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "allocate_elastic_ip" {
  description = "Whether to attach a static Elastic IP (EIP). Set to false to avoid extra AWS IPv4 charges."
  type        = bool
  default     = false
}

variable "create_key_pair" {
  description = "Whether Terraform should automatically generate a new SSH key pair and save the .pem file locally"
  type        = bool
  default     = true
}

variable "existing_key_name" {
  description = "Name of an existing AWS EC2 key pair to use if create_key_pair is false"
  type        = string
  default     = ""
}

