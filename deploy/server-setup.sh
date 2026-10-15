#!/usr/bin/env bash
# One-time bootstrap for a fresh Ubuntu 24.04 VPS (KVM 2: 4 GB RAM, 2 vCPU).
# Run as root:  bash deploy/server-setup.sh purplevoice.ai you@example.com
set -euo pipefail

DOMAIN="${1:?usage: server-setup.sh <domain> <letsencrypt-email>}"
EMAIL="${2:?usage: server-setup.sh <domain> <letsencrypt-email>}"
APP_USER=purplevoice
APP_DIR=/var/www/purple-voice
DB_NAME=purple_voice
DB_USER=pv

echo "==> System packages"
apt-get update
apt-get -y upgrade
apt-get install -y curl git ufw nginx certbot python3-certbot-nginx postgresql-16 build-essential

echo "==> Node.js 22 LTS + PM2"
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
npm install -g pm2@latest

echo "==> 2 GB swap (headroom for builds on a 4 GB box)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10 && echo 'vm.swappiness=10' > /etc/sysctl.d/99-swappiness.conf
fi

echo "==> Firewall: SSH, HTTP, HTTPS only (Postgres and Node stay on localhost)"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "==> App user and directories"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash "$APP_USER"
mkdir -p "$APP_DIR/storage/uploads" /etc/purple-voice /var/backups/purple-voice /var/www/certbot
chown -R "$APP_USER:$APP_USER" "$APP_DIR" /var/backups/purple-voice
chmod 750 /etc/purple-voice

echo "==> PostgreSQL"
DB_PASS=$(openssl rand -base64 30 | tr -d '/+=')
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
cp "$(dirname "$0")/postgres/purplevoice.conf" /etc/postgresql/16/main/conf.d/purplevoice.conf
systemctl restart postgresql

echo "==> Environment files (fill in the blanks afterwards)"
if [ ! -f /etc/purple-voice/api.env ]; then
  cat > /etc/purple-voice/api.env <<ENV
NODE_ENV=production
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME?schema=public&connection_limit=10"
API_HOST=127.0.0.1
API_PORT=4000
APP_URL=https://$DOMAIN
CORS_ORIGINS=https://$DOMAIN
WEB_INTERNAL_URL=http://127.0.0.1:3000
REVALIDATE_SECRET=$(openssl rand -base64 36)
JWT_ACCESS_SECRET=$(openssl rand -base64 48)
JWT_REFRESH_SECRET=$(openssl rand -base64 48)
APP_ENCRYPTION_KEY=$(openssl rand -base64 32)
URL_SIGNING_SECRET=$(openssl rand -base64 48)
STORAGE_DRIVER=local
STORAGE_LOCAL_PATH=$APP_DIR/storage/uploads
STORAGE_PUBLIC_URL=https://$DOMAIN/uploads
MAIL_FROM="Purple Voice <no-reply@$DOMAIN>"
LOG_LEVEL=info
ENV
  REVALIDATE=$(grep REVALIDATE_SECRET /etc/purple-voice/api.env | cut -d= -f2-)
  cat > /etc/purple-voice/web.env <<ENV
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://$DOMAIN
API_INTERNAL_URL=http://127.0.0.1:4000
REVALIDATE_SECRET=$REVALIDATE
ENV
  chown root:"$APP_USER" /etc/purple-voice/*.env
  chmod 640 /etc/purple-voice/*.env
  echo "   Wrote /etc/purple-voice/{api,web}.env — add SMTP, Stripe, Google, captcha and ANTHROPIC_API_KEY."
  echo "   BACK UP APP_ENCRYPTION_KEY: without it, stored API keys cannot be decrypted."
fi

echo "==> nginx + TLS"
sed "s/purplevoice.ai/$DOMAIN/g" "$(dirname "$0")/nginx/purplevoice.conf" > /etc/nginx/sites-available/purplevoice
ln -sf /etc/nginx/sites-available/purplevoice /etc/nginx/sites-enabled/purplevoice
rm -f /etc/nginx/sites-enabled/default
certbot certonly --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" || \
  echo "   certbot failed — point DNS at this server, then re-run: certbot certonly --nginx -d $DOMAIN -d www.$DOMAIN"
nginx -t && systemctl reload nginx

echo "==> PM2 on boot"
env PATH="$PATH" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER"

echo "==> Nightly backups at 03:15"
cp "$(dirname "$0")/backup.sh" /usr/local/bin/purple-voice-backup && chmod +x /usr/local/bin/purple-voice-backup
echo "15 3 * * * $APP_USER /usr/local/bin/purple-voice-backup >> /var/log/purple-voice-backup.log 2>&1" > /etc/cron.d/purple-voice-backup

echo "Done. Next: as $APP_USER, clone the repo into $APP_DIR/app and run deploy/deploy.sh (see DEPLOYMENT.md)."
