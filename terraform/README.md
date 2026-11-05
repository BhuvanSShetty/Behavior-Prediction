# Multi-Account Terraform Setup for Behavior Prediction Backend

This Terraform suite automates the provisioning of the production infrastructure for the **Behavior Prediction** backend and ML stack on AWS. It is designed to work seamlessly across **different AWS accounts** and **regions** with zero manual console clicking.

---

## Architecture Provisioned

- **VPC & Subnet**: Dedicated VPC with an Internet Gateway and public routing.
- **Security Group**: Ingress for SSH (22), HTTP (80), HTTPS (443), Backend (5050), ML (8000), Dozzle (8088), and Uptime Kuma (3001).
- **SSH Key Pair**: Automatically generated 4096-bit RSA key saved locally into `keys/` with secure `0400` permissions.
- **EC2 Instance**: Ubuntu 22.04 LTS (`t3.small` by default, 25 GB gp3 SSD within Free Tier / credits).
- **Public IP**: Automatically assigned standard EC2 public IP. Elastic IP is disabled by default (`allocate_elastic_ip = false`) to avoid extra AWS IPv4 hourly charges.
- **Cloud-Init (User Data)**: Automatically installs Docker, Docker Compose, Nginx, Certbot, and configures Docker log rotation on first boot.

---

## 1. Prerequisites

### Install Terraform
On macOS (Homebrew):
```bash
brew tap hashicorp/tap
brew install hashicorp/tap/terraform
```
Verify:
```bash
terraform -version
```

### Install AWS CLI
If not already installed:
```bash
brew install awscli
```

---

## 2. Managing Multiple AWS Accounts

To deploy across different AWS accounts, configure named AWS CLI profiles.

### Step 1: Configure AWS CLI profiles for each account
Run:
```bash
# Configure Account 1 (e.g., personal / dev)
aws configure --profile account-1

# Configure Account 2 (e.g., work / prod / credits account)
aws configure --profile account-2
```
Enter the **Access Key ID**, **Secret Access Key**, and **Default Region** (`ap-south-1` or your preferred region) for each account.

Verify access to the account:
```bash
aws sts get-caller-identity --profile account-1
aws sts get-caller-identity --profile account-2
```

---

## 3. Deployment Guide

### Step 1: Switch into the `terraform` directory
```bash
cd terraform
```

### Step 2: Initialize Terraform
```bash
terraform init
```

### Step 3: Deploy to an Account

#### Option A: Using Terraform Workspaces (Recommended for state isolation)
Terraform workspaces keep the `.tfstate` of each account separate so they never overwrite each other.

```bash
# 1. Create and switch to workspace for Account 1
terraform workspace new account-1
terraform workspace select account-1

# 2. Plan the deployment
terraform plan -var-file="environments/account-a.tfvars.example"

# 3. Apply and provision infrastructure
terraform apply -var-file="environments/account-a.tfvars.example" -auto-approve
```

To deploy to Account 2:
```bash
# 1. Create and switch to workspace for Account 2
terraform workspace new account-2
terraform workspace select account-2

# 2. Plan and apply
terraform plan -var-file="environments/account-b.tfvars.example"
terraform apply -var-file="environments/account-b.tfvars.example" -auto-approve
```

#### Option B: Using `terraform.tfvars` directly
Copy the template:
```bash
cp terraform.tfvars.example terraform.tfvars
```
Edit `terraform.tfvars` with your profile and settings:
```hcl
aws_profile = "account-1"
aws_region  = "ap-south-1"
environment = "prod"
```
Run:
```bash
terraform plan
terraform apply
```

---

## 4. Post-Deployment: Connecting Your App

Once `terraform apply` finishes, Terraform will output:
- **`public_ip`**: The static Elastic IP.
- **`ssh_command`**: Ready command to SSH into the instance.
- **`github_actions_secrets_instructions`**: Values to copy into GitHub.

### 1. Wait for Cloud-Init (First Boot)
Wait 1-2 minutes for Docker and Nginx to finish installing. You can SSH into the instance and verify:
```bash
# Run the ssh command printed by terraform output:
ssh -i keys/behavior-prediction-prod-key.pem ubuntu@<PUBLIC_IP>

# Check cloud-init status:
tail -f /var/log/user-data.log
```
When it says `=== EC2 Setup Completed Successfully ===`, Docker and Nginx are ready!

### 2. Deploy the Containers

#### Via GitHub Actions (CI/CD):
1. Go to your GitHub repository -> **Settings** -> **Secrets and variables** -> **Actions**.
2. Update:
   - `EC2_HOST`: The `public_ip` from terraform output.
   - `EC2_USER`: `ubuntu`
   - `EC2_SSH_KEY`: The contents of `terraform/keys/behavior-prediction-*-key.pem`.
   - `ENV_FILE`: Your production `.env` (containing `MONGO_URI`, `JWT_SECRET`, etc.).
3. Push to `main` branch or trigger manually via GitHub Actions tab.

#### Or Via Local Deployment Script:
From the repository root:
```bash
EC2_IP="<PUBLIC_IP>" ./deploy_ec2.sh
```

---

## 5. Domain & SSL Setup (Let's Encrypt)

If you have a domain (e.g. `api.yourdomain.com`):
1. In your DNS provider (Cloudflare, GoDaddy, Route53), add an **A Record** pointing `api.yourdomain.com` to your `public_ip`.
2. Run the SSL script from repo root:
   ```bash
   EC2_IP="<PUBLIC_IP>" ./setup_ssl.sh
   ```

---

## 6. Teardown / Destroy

When you want to tear down infrastructure in an account to stop all billing:
```bash
terraform workspace select account-1
terraform destroy -var-file="environments/account-a.tfvars.example"
```

