#!/bin/bash
set -e

PUBLIC_IP="${EC2_IP:-<YOUR_EC2_IP>}"
KEY="~/.ssh/behavior-prediction-key.pem"
REMOTE_USER="ubuntu"
APP_DIR="~/app"

echo "Disabling strict host key checking for the first connection..."
SSH_OPTS="-o StrictHostKeyChecking=no -i $KEY"

echo "Installing Docker on EC2..."
ssh $SSH_OPTS $REMOTE_USER@$PUBLIC_IP << 'EOF'
  if ! command -v docker &> /dev/null; then
    sudo apt-get update
    sudo apt-get install -y ca-certificates curl gnupg
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo usermod -aG docker $USER
    echo "Docker installed."
  fi
EOF

echo "Copying files to EC2..."
ssh $SSH_OPTS $REMOTE_USER@$PUBLIC_IP "mkdir -p $APP_DIR"
rsync -avz -e "ssh $SSH_OPTS" \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.vscode' \
  --exclude 'dist' \
  --exclude '__pycache__' \
  --exclude 'Frontend' \
  ./ $REMOTE_USER@$PUBLIC_IP:$APP_DIR/

echo "Building and starting containers on EC2..."
ssh $SSH_OPTS $REMOTE_USER@$PUBLIC_IP << 'EOF'
  cd ~/app
  sudo docker compose up -d --build
EOF

echo "=========================================="
echo "Deployment to EC2 initiated!"
echo "Wait a few minutes for the backend and ML to build and start."
echo "Backend API: http://$PUBLIC_IP:5050"
echo "ML API: http://$PUBLIC_IP:8000"
echo "=========================================="
