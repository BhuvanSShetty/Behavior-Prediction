#!/bin/bash
set -euxo pipefail

# Output log for debugging
exec > >(tee -a /var/log/user-data.log) 2>&1
echo "=== Starting Behavior Prediction EC2 Cloud-Init Setup ==="

# Wait for cloud-init apt locks to release
while fuser /var/lib/dpkg/lock >/dev/null 2>&1 || fuser /var/lib/apt/lists/lock >/dev/null 2>&1; do
    echo "Waiting for apt lock..."
    sleep 2
done

export DEBIAN_FRONTEND=noninteractive

# Update system packages
apt-get update -y
apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    rsync \
    htop \
    jq \
    ufw

# Add Docker Official GPG key and repo
install -m 0755 -d /etc/apt/keyrings
if [ ! -f /etc/apt/keyrings/docker.gpg ]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
fi

ARCH=$(dpkg --print-architecture)
CODENAME=$(lsb_release -cs)
echo "deb [arch=$ARCH signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $CODENAME stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -y
apt-get install -y --no-install-recommends \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin \
    nginx \
    certbot \
    python3-certbot-nginx

# Configure Docker daemon with log rotation (prevents disk space exhaustion)
mkdir -p /etc/docker
cat <<EOF > /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "20m",
    "max-file": "3"
  }
}
EOF

# Restart and enable Docker
systemctl enable --now docker
systemctl restart docker

# Grant ubuntu user permission to run docker without sudo
usermod -aG docker ubuntu

# Create the application directory
mkdir -p /home/ubuntu/app
chown -R ubuntu:ubuntu /home/ubuntu/app

# Ensure systemctl nginx is enabled
systemctl enable nginx

echo "=== EC2 Setup Completed Successfully at $(date) ==="
touch /var/log/user_data_complete.txt

