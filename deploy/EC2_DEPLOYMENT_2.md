This updated **EC2 Deployment Guide** incorporates the specific fixes we discovered for Cloudflare DNS, Linux directory permissions, and Certbot webroot validation. Following these steps will ensure a smooth, error-free deployment for future instances.

---

# EC2 Deployment Guide — Aura Estates Insight 🚀

This document describes a production-ready deployment for the Aura Estates Insight app on an Ubuntu EC2 instance, including Cloudflare and SSL configuration.

---

## Overview

* **Backend:** Node/Express server at `server/` (port `3001`).
* **Frontend:** Vite/React app — build output is `dist/`.
* **Reverse Proxy:** `nginx` handling SSL, serving `dist/`, and proxying `/api`.
* **DNS:** Cloudflare (DNS-only mode recommended for Certbot setup).

---

## Step 1 — Cloudflare & AWS Setup

### 1. Cloudflare DNS Records

Before starting the server setup, ensure your DNS is configured to avoid `NXDOMAIN` errors. Add these two records in Cloudflare:

| Type | Name | Target/Content | Proxy Status |
| --- | --- | --- | --- |
| **A** | `estate` | `YOUR_EC2_PUBLIC_IP` | **DNS Only** (Grey Cloud) |
| **CNAME** | `www.estate` | `estate.intellisoft.software` | **DNS Only** (Grey Cloud) |

*Note: Once SSL is active, you can toggle "Proxy Status" to **Proxied** (Orange Cloud) if desired.*

### 2. AWS Security Group

Ensure the following **Inbound Rules** are active:

* **SSH:** Port 22 (Your IP)
* **HTTP:** Port 80 (0.0.0.0/0)
* **HTTPS:** Port 443 (0.0.0.0/0)

---

## Step 2 — Install & Clone

```bash
# Update and Install Dependencies
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx certbot python3-certbot-nginx

# Install PM2
sudo npm install -g pm2

# Clone & Install
cd /home/ubuntu
git clone https://github.com/your-org/data-analytics-re.git
cd data-analytics-re
npm install
cd server && npm install

```

---

## Step 3 — Crucial Permissions Fix

Nginx requires "execute" (`x`) permissions on every parent directory in the path to serve your `dist` folder. **Without this, you will see 403 or 500 errors.**

```bash
# Allow Nginx (www-data) to traverse the ubuntu home directory
sudo chmod +x /home/ubuntu
sudo chmod +x /home/ubuntu/data-analytics-re
sudo chmod +x /home/ubuntu/data-analytics-re/dist

# Ensure the webroot is readable
sudo chmod -R 755 /home/ubuntu/data-analytics-re/dist

```

---

## Step 4 — Nginx Configuration

Create the site configuration: `sudo nano /etc/nginx/sites-available/aura`

**Paste this template (optimized for both domains and SSL):**

```nginx
server {
    listen 80;
    server_name estate.intellisoft.software www.estate.intellisoft.software;

    root /home/ubuntu/data-analytics-re/dist;
    index index.html;

    # Certbot Validation Path
    location ~ /.well-known/acme-challenge {
        allow all;
        root /home/ubuntu/data-analytics-re/dist;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

```

**Enable and Test:**

```bash
sudo ln -s /etc/nginx/sites-available/aura /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

```

---

## Step 5 — SSL with Certbot (Webroot Method)

Using the `--webroot` method is the most reliable way to handle multiple domains without taking Nginx offline.

```bash
sudo certbot certonly --webroot \
  -w /home/ubuntu/data-analytics-re/dist \
  -d estate.intellisoft.software \
  -d www.estate.intellisoft.software

```

Once successful, update your Nginx file (`/etc/nginx/sites-available/aura`) to add the `listen 443 ssl` block and a `return 301` redirect for the port 80 block.

---

## Step 6 — Backend & Scheduler (PM2)

```bash
cd /home/ubuntu/data-analytics-re/server
source .env
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup

```

**Sync Cron Job:**

```bash
crontab -e
# Add this line for 6-hour sync intervals:
0 */6 * * * cd /home/ubuntu/data-analytics-re/server && source .env && /usr/bin/node quick-sync.js >> ./logs/sync-cron.log 2>&1

```

---

## Troubleshooting Checklist

| Issue | Solution |
| --- | --- |
| **NXDOMAIN Error** | Check Cloudflare. Ensure `www.estate` is added as a record. |
| **500 Internal Error** | Check Nginx logs: `sudo tail /var/log/nginx/error.log`. Usually fixed by `chmod +x /home/ubuntu`. |
| **Timeout on Certbot** | Check AWS Security Group. Port 80 must be open to `0.0.0.0/0`. |
| **Backend 404/502** | Ensure PM2 is running (`pm2 status`) and the port in Nginx matches the `.env` port. |

---

**Next Step:** Would you like me to create a "Ready-to-Use" final Nginx config file that you can download or copy directly into your repository's `deploy/` folder?