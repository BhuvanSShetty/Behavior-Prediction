#!/bin/bash
set -e

PUBLIC_IP="${EC2_IP:-<YOUR_EC2_IP>}"
KEY="~/.ssh/behavior-prediction-key.pem"
REMOTE_USER="ubuntu"
DOMAIN="api.bhuvans.in"

echo "Disabling strict host key checking..."
SSH_OPTS="-o StrictHostKeyChecking=no -i $KEY"

echo "Installing Nginx and Certbot on EC2..."
ssh $SSH_OPTS $REMOTE_USER@$PUBLIC_IP << EOF
  sudo apt-get update
  sudo apt-get install -y nginx certbot python3-certbot-nginx
EOF

echo "Configuring Nginx for $DOMAIN..."
ssh $SSH_OPTS $REMOTE_USER@$PUBLIC_IP << EOF
  sudo bash -c 'cat > /etc/nginx/sites-available/$DOMAIN << "NGINX_CONF"
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:5050;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX_CONF'

  sudo ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
  sudo rm -f /etc/nginx/sites-enabled/default
  sudo nginx -t
  sudo systemctl reload nginx
EOF

echo "Requesting SSL Certificate from Let's Encrypt..."
ssh $SSH_OPTS $REMOTE_USER@$PUBLIC_IP << EOF
  sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --register-unsafely-without-email --redirect
EOF

echo "=========================================="
echo "SSL configured successfully!"
echo "Your secure backend is now available at: https://$DOMAIN"
echo "=========================================="
