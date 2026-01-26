#!/bin/bash
# Quick deployment script for EC2
# Run this after git pull to update the deployed application

set -e  # Exit on any error
cd /home/ubuntu/aura-estates-insight

echo "🚀 Starting deployment update..."

# Pull latest changes
echo "📡 Pulling latest code..."
git pull origin main

# Install/update dependencies
echo "📦 Updating dependencies..."
npm ci --production

cd server
npm ci --production
cd ..

# Build frontend
echo "🏗️  Building frontend..."
npm run build

# Ensure correct permissions for nginx
echo "🔒 Setting permissions..."
sudo chmod -R 755 /home/ubuntu/aura-estates-insight/dist
sudo chmod -R 755 /home/ubuntu/aura-estates-insight
sudo chmod -R 755 /home/ubuntu

# Restart services
echo "♻️  Restarting services..."
pm2 restart all

# Show status
echo "📊 Service status:"
pm2 status

echo "✅ Deployment update completed!"
echo "🌐 Check your app at: https://your-domain.com"