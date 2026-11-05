locals {
  server_ip = length(aws_eip.backend) > 0 ? aws_eip.backend[0].public_ip : aws_instance.backend.public_ip
  key_path  = var.create_key_pair ? "${path.module}/keys/${var.project_name}-${var.environment}-key.pem" : "~/.ssh/${var.existing_key_name}.pem"
}

output "public_ip" {
  description = "Public IP address (Elastic IP if enabled) of the backend EC2 server"
  value       = local.server_ip
}

output "instance_id" {
  description = "AWS EC2 Instance ID"
  value       = aws_instance.backend.id
}

output "ssh_private_key_path" {
  description = "Path to the local private key file"
  value       = local.key_path
}

output "ssh_command" {
  description = "Command to SSH into the provisioned EC2 instance"
  value       = "ssh -i ${local.key_path} ubuntu@${local.server_ip}"
}

output "backend_api_url" {
  description = "Direct URL to Backend API (port 5050)"
  value       = "http://${local.server_ip}:5050"
}

output "ml_api_url" {
  description = "Direct URL to ML FastAPI Service (port 8000)"
  value       = "http://${local.server_ip}:8000"
}

output "dozzle_dashboard_url" {
  description = "URL to Dozzle real-time container log dashboard"
  value       = "http://${local.server_ip}:8088"
}

output "uptime_kuma_dashboard_url" {
  description = "URL to Uptime Kuma monitoring dashboard"
  value       = "http://${local.server_ip}:3001"
}

output "github_actions_secrets_instructions" {
  description = "Summary of GitHub Actions secrets needed to configure CI/CD"
  value       = <<-EOT
    ======================================================================
    Add these repository secrets in GitHub:
    (Repo Settings -> Secrets and variables -> Actions)
    ----------------------------------------------------------------------
    EC2_HOST    : ${local.server_ip}
    EC2_USER    : ubuntu
    EC2_SSH_KEY : Copy the contents of: ${local.key_path}
                  (cat ${local.key_path})
    ======================================================================
  EOT
}

