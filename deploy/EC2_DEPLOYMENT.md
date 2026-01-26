# EC2 Deployment Guide — Aura Estates Insight 🚀

This document describes a production-ready deployment for the Aura Estates Insight app on an Ubuntu EC2 instance. It contains commands and config snippets you can copy/paste.

---

## Overview

- Backend: Node/Express server located at `server/` (defaults to port `3001`).
- Frontend: Vite/React app at repository root — build output is `dist/`.
- DB: SQLite (file stored in `server/` by default).
- Recommended process manager: `pm2`.
- Reverse proxy: `nginx` serving frontend and proxying `/api` to backend.

---

## Prerequisites

- AWS account and ability to create EC2 instances and Security Groups.
- Domain name (optional but recommended for HTTPS/Certbot).
- SSH key to access the EC2 instance.

Recommended EC2 specs for small/medium usage:
- t3.small or t3.medium (2 vCPU, 2–4GB RAM)
- Ubuntu 22.04 LTS
- 30 GB GP3 (or EBS of your choice)

Security Group (temporary for testing): allow ports 22, 80, 443, and optionally 3001 (backend) during debug only.

---

## Step 1 — Launch & connect

1. Launch an EC2 instance: Ubuntu 22.04 LTS, choose a key pair.
2. Connect:

```bash
ssh -i /path/to/key.pem ubuntu@YOUR_EC2_IP
```

3. Update OS:

```bash
sudo apt update && sudo apt upgrade -y
```

---

## Step 2 — Install required packages

```bash
# Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential

# Git, nginx, sqlite, certbot (and pip for certbot plugin)
sudo apt install -y git nginx sqlite3 python3-certbot-nginx

# pm2 (global)
sudo npm install -g pm2
```

---

## Step 3 — Clone repo & install

```bash
cd /home/ubuntu
git clone https://github.com/your-org/data-analytics-re.git
cd data-analytics-re

# Install frontend dev deps
npm install

# Install backend deps
cd server
npm install
cd ..
```

---

## Step 4 — Environment variables

Create a secure `.env` for the backend (in `server/`). Example `.env`:

```env
# server/.env
PORT=3001
BRIDGE_API_TOKEN=your_bridge_api_token_here
# Any other secrets can go here (e.g., analytics keys)
```

Important notes:
- The Bridge API token is now secured via environment variables. You MUST create a `.env` file or the sync will fail.
- Use the provided `server/.env.example` as a template.
- Frontend must know the backend URL for production builds: create `.env.production` at repo root with:

```env
VITE_BACKEND_URL=https://your-domain-or-ip
```

After updating `.env.production`, rebuild the frontend (below).

---

## Step 5 — Build frontend

Back at repo root:

```bash
# From /home/ubuntu/data-analytics-re
npm run build
# This produces `dist/`
```

---

## Step 6 — PM2 config and start backend + scheduler

The repo includes a ready-to-use PM2 ecosystem file at `server/ecosystem.config.cjs`. You may need to update the paths if deploying to a different location than `/home/ubuntu/data-analytics-re`.

**Important**: PM2's `env_file` option can be unreliable. Instead, load environment variables manually:

```bash
cd /home/ubuntu/data-analytics-re/server

# Load environment variables and start PM2
source .env
export BRIDGE_API_TOKEN
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup # follow the printed instruction to enable pm2 on boot
```

Check:
```bash
pm2 status
pm2 logs aura-backend
```

**For the sync scheduler**: PM2's cron_restart can be unreliable. Instead, set up a system cron job:

```bash
crontab -e
# Add this line to run sync every 6 hours:
0 */6 * * * cd /home/ubuntu/data-analytics-re/server && source .env && export BRIDGE_API_TOKEN && /usr/bin/node quick-sync.js >> ./logs/sync-cron.log 2>&1
```

---

## Step 7 — Nginx reverse proxy & serve static frontend

The repo includes nginx configuration templates in `deploy/`:
- `deploy/nginx-site.conf` - Full HTTPS setup with SSL
- `deploy/nginx-http-only.conf` - Simple HTTP-only for testing

Copy the appropriate template to `/etc/nginx/sites-available/aura` and customize the domain name:

```bash\n# For HTTPS setup:\n

sudo cp /home/ubuntu/data-analytics-re/deploy/nginx-site.conf /etc/nginx/sites-available/aura

\n\n# OR for HTTP-only testing:\n

sudo cp /home/ubuntu/data-analytics-re/deploy/nginx-http-only.conf /etc/nginx/sites-available/aura

\n\n# Edit the domain name:\nsudo 

nano /etc/nginx/sites-available/aura

\n# Replace 'your-domain.com' with your actual domain\n```\n\nEnable and test:

```bash
sudo ln -s /etc/nginx/sites-available/aura /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

If you're testing without SSL, you can modify the HTTP server block to serve the app directly without 301 redirect.

---

## Step 8 — SSL with Certbot (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
# Follow the prompts to get certificates and enable HTTPS
sudo certbot renew --dry-run
```

After certbot runs, revisit `/etc/nginx/sites-available/aura` and ensure the SSL paths are set.

---

## Step 9 — Permissions & security

- Set strict permissions on `.env`:

```bash
sudo chown ubuntu:ubuntu /home/ubuntu/data-analytics-re/server/.env
chmod 600 /home/ubuntu/data-analytics-re/server/.env
```

- Configure UFW (firewall):

```bash
sudo ufw allow OpenSSH
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
```

- Update Security Group to only allow 22 from your IP and 80/443 from the world. Remove 3001 from inbound rules after setup.

---

## Step 10 — Automatic update script (optional)

The repo includes a deployment update script at `deploy/update-deploy.sh`. Copy it to your home directory:

```bash
cp /home/ubuntu/data-analytics-re/deploy/update-deploy.sh /home/ubuntu/
chmod +x /home/ubuntu/update-deploy.sh
```

Run `/home/ubuntu/update-deploy.sh` to deploy future releases.

---

## Step 11 — Monitoring & logs

- PM2: `pm2 status`, `pm2 logs aura-backend --lines 200`
- Nginx: `/var/log/nginx/access.log` and `/var/log/nginx/error.log`
- Check DB: `sqlite3 server/your.db ".tables"`

---

## Troubleshooting

- 500 from Nginx: check file permissions on `dist/` (use `chmod 755` on parent directories)
- Backend not reachable: ensure PM2 shows `online` and check `pm2 logs`
- If sync fails: view `pm2 logs aura-sync-scheduler` or the cron logs
- Certbot errors: check `/var/log/letsencrypt` and `sudo nginx -t`

---

## Post-deploy checklist

- [ ] `pm2 status` shows services online
- [ ] Frontend loads at `https://your-domain.com`
- [ ] `curl https://your-domain.com/api/sync/status` works
- [ ] Certificates active: `sudo certbot certificates`
- [ ] Backups scheduled for SQLite database

---

## Final notes

✅ **Security**: Secrets are now properly handled via environment variables  
✅ **Deployment Files**: PM2 config, nginx templates, and deployment scripts included  
✅ **Environment Setup**: `.env.example` files provided for guidance  
✅ **Git Security**: `.gitignore` updated to exclude sensitive files  

**Recommended additions**:
- Set up automated SQLite database backups (cron job)
- Configure log rotation for PM2 logs
- Set up monitoring/alerting (optional)

---

## Resolved Issues & Troubleshooting (production notes)

The following issues were encountered during deployment and the commands/fixes below are recommended to reproduce or verify the fixes in a clean deployment.

1) DNS / `www` subdomain
- Problem: `www` record missing caused NXDOMAIN for the `www` host.
- Fix: add a `CNAME` record for `www` that points to the root domain (or add an A record matching the root IP).
	- Cloudflare example: create `CNAME` name `www` → `estate.intellisoft.software` (Proxy status: DNS only while issuing certs).
	- Verify:
	```bash
	dig +short estate.intellisoft.software
	dig +short www.estate.intellisoft.software
	```

2) Connection timeouts (Let's Encrypt HTTP-01)
- Problem: Certbot timed out when reaching port 80.
- Fix: ensure AWS Security Group allows inbound `80`/`443` and the instance firewall (UFW) allows HTTP/HTTPS (or is disabled while testing).
	- Verify:
	```bash
	# From the instance
	sudo ufw status verbose || echo "ufw inactive"
	# From a remote machine
	curl -I http://estate.intellisoft.software
	```

3) Directory traversal / permissions for Nginx
- Problem: Nginx user (`www-data`) could not traverse `/home/ubuntu` causing 500 errors.
- Fix: allow traversal for the parent directories and ensure files are readable by `www-data`:
	```bash
	sudo chmod +x /home/ubuntu
	sudo chmod -R o+rX /home/ubuntu/data-analytics-re/dist
	sudo chown -R ubuntu:www-data /home/ubuntu/data-analytics-re/dist
	```

4) Nginx configuration (server_name + .well-known)
- Problem: `server_name` missing `www` and no explicit `/.well-known/acme-challenge/` handling caused Certbot failures.
- Fix: update `server_name` and ensure Certbot can write/serve challenge files. Example nginx snippet (place in your `aura` site block):
	```nginx
	server_name estate.intellisoft.software www.estate.intellisoft.software;

	location ^~ /.well-known/acme-challenge/ {
		root /home/ubuntu/data-analytics-re/dist;
		default_type "text/plain";
		try_files $uri =404;
	}

	location /api/ {
		proxy_pass http://127.0.0.1:3001;
		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
	}
	```

5) Hard-coded frontend URLs
- Problem: several React files used `http://localhost:3001/api` which made browsers contact `localhost` on the client machine.
- Fix: replace hard-coded strings with `VITE_BACKEND_URL` and relative fallback `/api`, then rebuild the frontend.
	- Find occurrences and replace (example):
	```bash
	# show occurrences
	grep -R "localhost:3001" -n src || true
	# replace across files (review before committing)
	git grep -l "localhost:3001" | xargs -I{} sed -i "s|http://localhost:3001|${VITE_BACKEND_URL:-}|g" {}
	```
	- Build for production with your backend URL set:
	```bash
	export VITE_BACKEND_URL=https://estate.intellisoft.software
	npm run build
	sudo cp -r dist/* /home/ubuntu/data-analytics-re/dist/
	sudo systemctl reload nginx
	```

6) Certbot / SSL issuance troubleshooting
- When certbot fails, use these steps to diagnose and recover safely without hitting rate limits:
	- Test with staging to avoid rate limits:
	```bash
	sudo certbot certonly --webroot -w /home/ubuntu/data-analytics-re/dist -d estate.intellisoft.software -d www.estate.intellisoft.software --staging -v
	```
	- If webroot fails, stop nginx and try standalone (short window):
	```bash
	sudo systemctl stop nginx
	sudo certbot certonly --standalone -d estate.intellisoft.software -d www.estate.intellisoft.software --staging -v
	sudo systemctl start nginx
	```
	- Check Certbot logs for details:
	```bash
	sudo tail -n 200 /var/log/letsencrypt/letsencrypt.log
	sudo tail -n 200 /var/log/nginx/access.log | sed -n '/.well-known/p'
	```

7) Bind backend to localhost and restrict access
- Recommendation: run the Node backend bound to `127.0.0.1` and let Nginx proxy `/api`. We updated the server to use `HOST=127.0.0.1` by default; ensure PM2 restarts the process after changes.
	- Example PM2 restart:
	```bash
	cd /home/ubuntu/data-analytics-re/server
	source .env
	pm2 restart aura-backend
	pm2 save
	```

8) CORS tightening
- Recommendation: set the allowed origin to your frontend domain in `server/index.js` (or use `process.env.CORS_ORIGIN`) when using the `cors` middleware.
	```js
	app.use(cors({ origin: process.env.CORS_ORIGIN || 'https://estate.intellisoft.software' }));
	```

If you want, I can patch the docs to include these exact snippets and also add a `deploy/fix-permissions.sh` helper script. Tell me if you want the helper script added and I will create it.
