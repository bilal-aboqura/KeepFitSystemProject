# Deployment Guide — KeepFit Supplement

This guide covers deploying to a VPS (DigitalOcean / Linode / Hetzner / etc.)
with Docker + Nginx + SSL. Estimated time: 30–60 minutes.

---

## Prerequisites

- A VPS running **Ubuntu 22.04+** with at least **1 GB RAM** (2 GB recommended)
- Root or sudo access
- Your domain (`keepfitsupplement.com`) DNS A-record pointing to the VPS IP
- Docker + Docker Compose installed on the VPS
- Your `.env.production` file ready (copy from `.env.example`, fill real values)

## 1. Prepare the VPS

```bash
# SSH into your server
ssh root@YOUR_SERVER_IP

# Install Docker
curl -fsSL https://get.docker.com | sh

# Create the app directory
mkdir -p /opt/keepfit && cd /opt/keepfit
```

## 2. Upload the code

From your local machine:

```bash
# Option A: git clone (if you push to a repo)
git clone YOUR_REPO_URL /opt/keepfit

# Option B: rsync (if not using git)
rsync -avz --exclude node_modules --exclude .next --exclude .git \
  ./keepfit-supplement/ root@YOUR_SERVER_IP:/opt/keepfit/
```

## 3. Create `.env.production`

On the server, in `/opt/keepfit`:

```bash
cp .env.example .env.production
nano .env.production
```

Fill in all real values. **Critical changes from dev:**

```env
NEXT_PUBLIC_SITE_URL=https://keepfitsupplement.com
KASHIER_TESTMODE=false          # ← switch to LIVE
# Optionally set KASHIER_WEBHOOK_SECRET if Kashier provides one
```

## 4. Run database migrations

Run the migration + admin seed once (from the server, using Node directly):

```bash
# Install Node 20 if not present
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install deps and migrate
npm ci
node --env-file=.env.production scripts/migrate.mjs
node --env-file=.env.production scripts/seed-admin.mjs
```

## 5. Get SSL certificates (Let's Encrypt)

```bash
# Install certbot
apt-get install -y certbot

# Get certs (stop nginx first if it's running)
certbot certonly --standalone -d keepfitsupplement.com -d www.keepfitsupplement.com

# Copy certs to the nginx certs directory
mkdir -p /opt/keepfit/nginx/certs
cp /etc/letsencrypt/live/keepfitsupplement.com/fullchain.pem /opt/keepfit/nginx/certs/
cp /etc/letsencrypt/live/keepfitsupplement.com/privkey.pem  /opt/keepfit/nginx/certs/
```

## 6. Build and start

```bash
cd /opt/keepfit
docker compose up -d --build
```

Check it's running:

```bash
docker compose ps
docker compose logs -f web    # see Next.js startup logs
```

Visit `https://keepfitsupplement.com` — it should be live.

## 7. Configure Kashier webhook

In your Kashier dashboard:

1. Go to **Settings → Webhooks**
2. Add webhook URL: `https://keepfitsupplement.com/api/kashier/webhook`
3. Note the webhook secret (if provided) and add it to `.env.production` as
   `KASHIER_WEBHOOK_SECRET`
4. Restart: `docker compose restart web`

## 8. Configure Bosta shipping and automatic pickup

1. Add the Bosta values to `.env.production`:

```env
BOSTA_API_KEY=your-bosta-api-key
BOSTA_WEBHOOK_SECRET=generate-a-long-random-secret
BOSTA_PICKUP_HAS_FRAGILE_ITEMS=false
BOSTA_PICKUP_NOTES=KeepFit confirmed orders
CRON_SECRET=generate-another-long-random-secret
```

2. In the Bosta dashboard, add a default pickup location with a default contact
   name and phone number. Shipment creation sends
   `https://keepfitsupplement.com/api/webhooks/bosta` to Bosta with the authenticated
   webhook header automatically.

3. Run the database migration and restart the app:

```bash
node --env-file=.env.production scripts/migrate.mjs
docker compose up -d --build
```

4. Schedule the daily pickup check at midnight Cairo time. The automation only
   creates a pickup when at least three orders are in `processing` status.

```cron
CRON_TZ=Africa/Cairo
0 0 * * * curl -fsS -H "Authorization: Bearer REPLACE_WITH_CRON_SECRET" https://keepfitsupplement.com/api/cron/bosta-pickup/daily >/dev/null
```

5. Schedule a status refresh every 15 minutes. Bosta webhooks update orders
immediately; this job is a fallback and also keeps Mylerz shipments synchronized.
An in-transit shipment sets the order to `shipped`; a delivered shipment sets it
to `delivered` and marks COD as paid.

```cron
*/15 * * * * curl -fsS -H "Authorization: Bearer REPLACE_WITH_CRON_SECRET" https://keepfitsupplement.com/api/cron/shipment-status/quarter-hour >/dev/null
```

Admins can create or refresh a shipment and download its AWB from the order
details page. The orders page also supports importing existing Bosta shipments
and manually running the pickup workflow.

## 9. Configure free Telegram order alerts

1. Open `@BotFather` in Telegram, run `/newbot`, and copy the bot token.
2. Open the new bot, press **Start**, and send it any message. For a group,
   add the bot to the group and send a message there instead.
3. Open `https://api.telegram.org/botYOUR_TOKEN/getUpdates` and copy the
   required chat's `message.chat.id` value.
4. Add both values to `.env.production`:

```env
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
```

5. Restart the app with `docker compose restart web`.

COD orders send an alert as soon as the order is saved. Card orders send an
alert only after Kashier confirms successful payment.

## 10. Set up auto-renew for SSL

```bash
# Add to crontab
crontab -e

# Add this line (renews monthly, reloads nginx):
0 3 1 * * certbot renew --quiet --post-hook "cp /etc/letsencrypt/live/keepfitsupplement.com/*.pem /opt/keepfit/nginx/certs/ && docker compose -f /opt/keepfit/docker-compose.yml restart nginx"
```

## 11. Switch Kashier to LIVE

In `.env.production`:

```env
KASHIER_TESTMODE=false
KASHIER_API_KEY=your-live-api-key
KASHIER_SECRET_KEY=your-live-secret-key
```

Then: `docker compose up -d --build`

---

## Useful commands

```bash
# View logs
docker compose logs -f

# Restart
docker compose restart

# Rebuild after code update
git pull && docker compose up -d --build

# Stop everything
docker compose down

# Update database schema (after code changes)
node --env-file=.env.production scripts/migrate.mjs
```

## Without Docker (PM2 alternative)

If you prefer PM2 over Docker:

```bash
# Install PM2
npm install -g pm2

# Build
npm ci
npm run build

# Start
pm2 start npm --name "keepfit" -- start
pm2 save
pm2 startup    # auto-start on boot

# Nginx config stays the same, but upstream points to localhost:3000
# Change `server web:3000;` to `server 127.0.0.1:3000;` in nginx/default.conf
```

## Troubleshooting

| Issue | Fix |
|---|---|
| Blank page / 502 | `docker compose logs web` — check for env errors |
| Images not loading | Verify `public/images/` was copied; check `next.config.ts` remotePatterns |
| Kashier redirect fails | Verify `NEXT_PUBLIC_SITE_URL` is `https://...` and matches Kashier dashboard |
| Webhook not firing | Check Kashier dashboard webhook URL; verify `https` + certs work |
| Admin login loop | Clear cookies; verify `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.production` |
| Orders not created | Check `docker compose logs web` for API errors; verify DB migration ran |
