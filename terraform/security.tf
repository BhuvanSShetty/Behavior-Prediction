# Security Group for EC2 Backend Instance
resource "aws_security_group" "backend" {
  name        = "${var.project_name}-${var.environment}-sg"
  description = "Security group for Behavior Prediction Backend & ML service"
  vpc_id      = aws_vpc.main.id

  # SSH access (port 22)
  ingress {
    description = "SSH access"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.allowed_ssh_cidr
  }

  # HTTP (port 80) for Nginx / Let's Encrypt validation
  ingress {
    description = "HTTP access"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS (port 443) for secure API and WebSocket
  ingress {
    description = "HTTPS access"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Backend Direct Port (port 5050)
  ingress {
    description = "Backend Express/Node API direct port"
    from_port   = 5050
    to_port     = 5050
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # ML Service Direct Port (port 8000)
  ingress {
    description = "ML FastAPI Service direct port"
    from_port   = 8000
    to_port     = 8000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Dozzle Log Streaming (port 8088)
  ingress {
    description = "Dozzle container logs UI"
    from_port   = 8088
    to_port     = 8088
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Uptime Kuma Dashboard (port 3001)
  ingress {
    description = "Uptime Kuma monitoring UI"
    from_port   = 3001
    to_port     = 3001
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Outbound rule: Allow all outgoing traffic (Atlas MongoDB, Docker Hub, apt, SMTP)
  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-sg"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

