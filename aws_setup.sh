#!/bin/bash
set -e

REGION="ap-south-1"
KEY_NAME="behavior-prediction-key"
SG_NAME="behavior-prediction-sg"
INSTANCE_TYPE="t3.small"

echo "Creating Key Pair..."
if [ ! -f ~/.ssh/$KEY_NAME.pem ]; then
  aws ec2 create-key-pair --key-name $KEY_NAME --query 'KeyMaterial' --output text > ~/.ssh/$KEY_NAME.pem
  chmod 400 ~/.ssh/$KEY_NAME.pem
  echo "Key pair created and saved to ~/.ssh/$KEY_NAME.pem"
else
  echo "Key pair file already exists locally."
fi

echo "Creating Security Group..."
SG_ID=$(aws ec2 create-security-group --group-name $SG_NAME --description "Security group for Behavior Prediction app" --query 'GroupId' --output text 2>/dev/null || aws ec2 describe-security-groups --group-names $SG_NAME --query 'SecurityGroups[0].GroupId' --output text)
echo "Security Group ID: $SG_ID"

echo "Authorizing Security Group Ingress rules..."
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 22 --cidr 0.0.0.0/0 2>/dev/null || true
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 5050 --cidr 0.0.0.0/0 2>/dev/null || true
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 8000 --cidr 0.0.0.0/0 2>/dev/null || true

echo "Finding Latest Ubuntu 22.04 AMI..."
AMI_ID=$(aws ec2 describe-images --owners 099720109477 \
  --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" \
  --query 'sort_by(Images, &CreationDate)[-1].ImageId' --output text)
echo "Using AMI: $AMI_ID"

echo "Launching EC2 Instance..."
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id $AMI_ID \
  --count 1 \
  --instance-type $INSTANCE_TYPE \
  --key-name $KEY_NAME \
  --security-group-ids $SG_ID \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=BehaviorPredictionServer}]' \
  --query 'Instances[0].InstanceId' \
  --output text)

echo "Instance $INSTANCE_ID launched. Waiting for it to be running..."
aws ec2 wait instance-running --instance-ids $INSTANCE_ID

PUBLIC_IP=$(aws ec2 describe-instances --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)

echo "=========================================="
echo "EC2 Instance Provisioned Successfully!"
echo "Instance ID: $INSTANCE_ID"
echo "Public IP: $PUBLIC_IP"
echo "SSH Command: ssh -i ~/.ssh/$KEY_NAME.pem ubuntu@$PUBLIC_IP"
echo "=========================================="
