#!/usr/bin/env bash
# One-time setup of Purple Voice on a server managed by CloudPanel.
#
# Before running (DEPLOYMENT.md § 2A):
#   1. DNS: an A record for the domain points at this server.
#   2. CloudPanel → Sites → Add Site → Create a Node.js Site: the domain,
#      Node.js 22, App Port 3000 (any port 1024+). Note the site user it creates.
#   3. The code is in /home/<site-user>/purple-voice (git clone or uploaded tarball).
#
# Then, as root:
#   bash /home/<site-user>/purple-voice/deploy/cloudpanel/setup.sh <site-user> <domain> <admin-email>
#
# What it does: creates a role and database in the server's PostgreSQL (installing
# PostgreSQL 16 only if there is none; an existing one is not reconfigured or
# restarted); writes ~/.purple-voice/api.env and web.env (site user, mode 600) with
# fresh secrets; installs PM2 for the site user with a boot service; schedules
# nightly backups; runs the first deploy; and writes the nginx additions to paste
# into CloudPanel's Vhost editor. Safe to re-run: existing env files, database
# passwords and the first-login password are kept.
#
# Optional overrides: WEB_PORT (default 3000), API_PORT (4000), DB_NAME / DB_USER
# (purple_voice), PV_DATABASE_URL (use this database instead of creating one).
# Ports must be 1024 or above and free. CloudPanel's App Port only matters until
# the vhost from this script is pasted: from then on nginx uses WEB_PORT.
set -euo pipefail

usage="usage: setup.sh <site-user> <domain> <admin-email>"
SITE_USER="${1:?$usage}"
DOMAIN="${2:?$usage}"
ADMIN_EMAIL="${3:?$usage}"
WEB_PORT="${WEB_PORT:-3000}"
API_PORT="${API_PORT:-4000}"
DB_NAME="${DB_NAME:-purple_voice}"
DB_USER="${DB_USER:-purple_voice}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$HERE/../.." && pwd)"
HOME_DIR="/home/$SITE_USER"
ENV_DIR="$HOME_DIR/.purple-voice"
SITE_ROOT="$HOME_DIR/htdocs/$DOMAIN"
UPLOADS="$SITE_ROOT/uploads"
BACKUPS="$HOME_DIR/backups/purple-voice"

cd / # commands below run as other users (postgres, the site user) that can't read root's cwd

say() { printf '\n==> %s\n' "$*"; }
die() { printf '\n!! %s\n' "$*" >&2; exit 1; }
# Run a command as the site user with CloudPanel's per-user Node.js (nvm) loaded.
as_site() {
  runuser -l "$SITE_USER" -c '
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    command -v node >/dev/null 2>&1 || nvm use --silent default >/dev/null 2>&1 || true
    '"$1"
}

# ── Preflight ────────────────────────────────────────────────────────────────
[ "$(id -u)" -eq 0 ] || die "Run as root (sudo -i first)."
id -u "$SITE_USER" >/dev/null 2>&1 || die "No user '$SITE_USER'. Create the Node.js site in CloudPanel first; it creates the site user."
[ -d "$SITE_ROOT" ] || die "$SITE_ROOT not found. Is '$DOMAIN' the exact domain of the CloudPanel site?"
[ -f "$APP_DIR/package.json" ] || die "Can't find the code next to this script ($APP_DIR)."
command -v clpctl >/dev/null 2>&1 || echo "   (clpctl not found: continuing, but this script expects a CloudPanel server)"
case "$APP_DIR/" in "$SITE_ROOT"/*) die "The code is inside $SITE_ROOT, which nginx serves. Move it to $HOME_DIR/purple-voice." ;; esac

NODE_VERSION="$(as_site 'node -v' 2>/dev/null | tail -n 1 || true)"
[ -n "$NODE_VERSION" ] || die "Node.js isn't available to $SITE_USER. In CloudPanel → Sites → $DOMAIN → Settings, pick Node.js 22."
NODE_MAJOR="${NODE_VERSION#v}"; NODE_MAJOR="${NODE_MAJOR%%.*}"
[ "$NODE_MAJOR" -ge 22 ] || die "Node.js $NODE_VERSION is too old. In CloudPanel → Sites → $DOMAIN → Settings, pick Node.js 22 (or newer)."
echo "   site user $SITE_USER, Node.js $NODE_VERSION, code in $APP_DIR"
chown -R "$SITE_USER:$SITE_USER" "$APP_DIR"

# Node runs as the site user, which may not bind ports below 1024. On the first
# run nothing of ours is listening yet, so a taken port belongs to something else
# (3306 is CloudPanel's MySQL, 5432 PostgreSQL).
for port in "$WEB_PORT" "$API_PORT"; do
  [ "$port" -ge 1024 ] 2>/dev/null ||
    die "Port $port can't be used: ports below 1024 need root. Leave WEB_PORT/API_PORT unset to use 3000 and 4000."
  if [ ! -f "$ENV_DIR/api.env" ] && ss -Hltn "sport = :$port" | grep -q .; then
    die "Port $port is already in use (see: ss -ltnp 'sport = :$port'). Choose free ports, e.g. WEB_PORT=3010 API_PORT=4010 bash $0 ..."
  fi
done
[ "$WEB_PORT" != "$API_PORT" ] || die "WEB_PORT and API_PORT must differ."

# ── Swap: headroom for builds on a 4 GB box ─────────────────────────────────
if ! swapon --show --noheadings | grep -q .; then
  say "Adding 2 GB swap"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -q -w vm.swappiness=10 && echo 'vm.swappiness=10' > /etc/sysctl.d/99-swappiness.conf
fi

# ── PostgreSQL ───────────────────────────────────────────────────────────────
# A PostgreSQL already on the server is shared as it is: Purple Voice gets its own
# role and database, and the server's settings are neither changed nor restarted,
# so the other apps on it keep running. Only when there is none is PostgreSQL 16
# installed and tuned. For a PostgreSQL that isn't an apt package (Docker, a
# managed database), create the role and database yourself and pass PV_DATABASE_URL.
if [ -n "${PV_DATABASE_URL:-}" ]; then
  PG_MODE=url
  echo "   using the database in PV_DATABASE_URL"
elif command -v pg_lsclusters >/dev/null 2>&1 && pg_lsclusters --no-header 2>/dev/null | grep -q .; then
  PG_MODE=existing
elif ss -Hltn "sport = :5432" | grep -q .; then
  die "Something listens on port 5432 but it isn't an apt-installed PostgreSQL (Docker?).
   Create a role and database for Purple Voice there, then re-run with
   PV_DATABASE_URL='postgresql://purple_voice:PASSWORD@127.0.0.1:5432/purple_voice' bash $0 $SITE_USER $DOMAIN $ADMIN_EMAIL"
else
  PG_MODE=install
fi

if [ "$PG_MODE" = install ]; then
  say "Installing PostgreSQL 16"
  apt-get update -q
  if ! apt-cache show postgresql-16 >/dev/null 2>&1; then
    apt-get install -y -q postgresql-common
    /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
  fi
  DEBIAN_FRONTEND=noninteractive apt-get install -y -q postgresql-16 postgresql-client-16
  say "Tuning PostgreSQL 16 for a shared 4 GB server (only Purple Voice uses it)"
  install -m 644 "$APP_DIR/deploy/postgres/purplevoice.conf" /etc/postgresql/16/main/conf.d/purplevoice.conf
  cat > /etc/postgresql/16/main/conf.d/zz-purplevoice-cloudpanel.conf <<'CONF'
# CloudPanel also runs MySQL and PHP-FPM on this server: leave them room.
shared_buffers = 768MB
effective_cache_size = 2GB
CONF
  systemctl restart postgresql@16-main
fi

if [ "$PG_MODE" != url ]; then
  # The cluster on the default port, else the first one running.
  PG_LINE="$(pg_lsclusters --no-header | awk '$4 ~ /^online/ && $3 == 5432' | head -n 1)"
  [ -n "$PG_LINE" ] || PG_LINE="$(pg_lsclusters --no-header | awk '$4 ~ /^online/' | head -n 1)"
  [ -n "$PG_LINE" ] || die "PostgreSQL is installed but no cluster is running (check: pg_lsclusters). Start it and re-run."
  PG_VERSION="$(awk '{ print $1 }' <<<"$PG_LINE")"
  PG_PORT="$(awk '{ print $3 }' <<<"$PG_LINE")"
  if [ "$PG_MODE" = existing ]; then
    echo "   using the existing PostgreSQL $PG_VERSION on port $PG_PORT; its settings are left as they are"
  fi
  if [ "${PG_VERSION%%.*}" -lt 13 ]; then
    echo "   (PostgreSQL $PG_VERSION is past end of life; Purple Voice is tested on 16)"
  fi
fi
psql_admin() { runuser -u postgres -- psql -w -p "$PG_PORT" -v ON_ERROR_STOP=1 -qtA "$@"; }

# ── Database and env files ───────────────────────────────────────────────────
install -d -m 700 -o "$SITE_USER" -g "$SITE_USER" "$ENV_DIR"
install -d -m 755 -o "$SITE_USER" -g "$SITE_USER" "$UPLOADS"
install -d -m 700 -o "$SITE_USER" -g "$SITE_USER" "$HOME_DIR/backups" "$BACKUPS"
secret() { openssl rand -base64 "$1" | tr -d '\n'; }

if [ ! -f "$ENV_DIR/api.env" ]; then
  if [ "$PG_MODE" = url ]; then
    say "Writing env files"
    DB_URL="$PV_DATABASE_URL"
  else
    say "Creating role $DB_USER and database $DB_NAME, then the env files"
    psql_admin -c 'SELECT 1' >/dev/null 2>&1 ||
      die "Couldn't connect to PostgreSQL on port $PG_PORT as the postgres system user. Create a role and database yourself and re-run with PV_DATABASE_URL (see the top of this script)."
    DB_PASS="$(openssl rand -hex 24)"
    if [ "$(psql_admin -c "SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER'")" = 1 ]; then
      psql_admin -c "ALTER ROLE \"$DB_USER\" WITH LOGIN PASSWORD '$DB_PASS'"
    else
      psql_admin -c "CREATE ROLE \"$DB_USER\" WITH LOGIN PASSWORD '$DB_PASS'"
    fi
    [ "$(psql_admin -c "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'")" = 1 ] ||
      psql_admin -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\""
    DB_URL="postgresql://$DB_USER:$DB_PASS@127.0.0.1:$PG_PORT/$DB_NAME?schema=public&connection_limit=10"
  fi

  REVALIDATE="$(secret 36)"
  cat > "$ENV_DIR/api.env" <<ENV
# Purple Voice API, worker and seed. Generated by deploy/cloudpanel/setup.sh.
# Every setting is explained in .env.example. Run ./deploy/deploy.sh after editing.
NODE_ENV=production
DATABASE_URL="$DB_URL"
API_HOST=127.0.0.1
API_PORT=$API_PORT
APP_URL=https://$DOMAIN
CORS_ORIGINS=https://$DOMAIN
WEB_INTERNAL_URL=http://127.0.0.1:$WEB_PORT
REVALIDATE_SECRET=$REVALIDATE
JWT_ACCESS_SECRET=$(secret 48)
JWT_REFRESH_SECRET=$(secret 48)
# Back this up off the server: without it stored API keys can't be decrypted.
APP_ENCRYPTION_KEY=$(secret 32)
URL_SIGNING_SECRET=$(secret 48)
STORAGE_DRIVER=local
STORAGE_LOCAL_PATH=$UPLOADS
STORAGE_PUBLIC_URL=https://$DOMAIN/uploads
SEED_SUPER_ADMIN_EMAIL=$ADMIN_EMAIL
LOG_LEVEL=info

# ── Fill in what you use (DEPLOYMENT.md § 4), then run ./deploy/deploy.sh ──
MAIL_FROM="Purple Voice <no-reply@$DOMAIN>"
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SUPPORT_NOTIFY_EMAILS=$ADMIN_EMAIL
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_BASIC=
STRIPE_PRICE_PRO=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ANTHROPIC_API_KEY=
CAPTCHA_PROVIDER=none
CAPTCHA_SECRET_KEY=
ENV
  cat > "$ENV_DIR/web.env" <<ENV
# Purple Voice web app. Generated by deploy/cloudpanel/setup.sh.
NODE_ENV=production
# Next.js port; nginx's pv_web upstream (the pasted vhost) points here.
PORT=$WEB_PORT
NEXT_PUBLIC_SITE_URL=https://$DOMAIN
API_INTERNAL_URL=http://127.0.0.1:$API_PORT
REVALIDATE_SECRET=$REVALIDATE
NEXT_TELEMETRY_DISABLED=1
# Captcha site key (compiled into the site: redeploy after changing it).
NEXT_PUBLIC_CAPTCHA_SITE_KEY=
ENV
  chown "$SITE_USER:$SITE_USER" "$ENV_DIR"/*.env
  chmod 600 "$ENV_DIR"/*.env
else
  echo "   $ENV_DIR/api.env exists: keeping it and the database password"
fi

FIRST_LOGIN="$ENV_DIR/first-login.txt"
if [ ! -f "$FIRST_LOGIN" ]; then
  ADMIN_PASS="pv-$(openssl rand -hex 9)"
  printf 'https://%s/login\nemail:    %s\npassword: %s\n\nChange it in Admin → Your account, then delete this file.\n' \
    "$DOMAIN" "$ADMIN_EMAIL" "$ADMIN_PASS" > "$FIRST_LOGIN"
  chown "$SITE_USER:$SITE_USER" "$FIRST_LOGIN"
  chmod 600 "$FIRST_LOGIN"
fi
ADMIN_PASS="$(sed -n 's/^password: //p' "$FIRST_LOGIN")"

# ── PM2 with a boot service ──────────────────────────────────────────────────
say "Installing PM2 for $SITE_USER"
as_site 'npm install -g pm2@latest --no-audit --no-fund --loglevel=error'
NODE_BIN="$(as_site 'dirname "$(command -v node)"' | tail -n 1)"
env PATH="$NODE_BIN:$PATH" "$NODE_BIN/pm2" startup systemd -u "$SITE_USER" --hp "$HOME_DIR" >/dev/null
systemctl enable "pm2-$SITE_USER" >/dev/null 2>&1 || true
as_site 'pm2 install pm2-logrotate >/dev/null && pm2 set pm2-logrotate:max_size 20M >/dev/null && pm2 set pm2-logrotate:retain 14 >/dev/null' ||
  echo "   (pm2-logrotate not installed: logs in ~/.pm2/logs will grow until rotated)"

# ── Nightly backups ──────────────────────────────────────────────────────────
say "Scheduling backups at 03:15 into $BACKUPS"
cat > /etc/cron.d/purple-voice-backup <<CRON
# Purple Voice: nightly database + uploads backup (deploy/backup.sh), kept 14 days.
15 3 * * * $SITE_USER bash $APP_DIR/deploy/backup.sh >> $BACKUPS/backup.log 2>&1
CRON
chmod 644 /etc/cron.d/purple-voice-backup

# ── First deploy ─────────────────────────────────────────────────────────────
say "Building and starting Purple Voice (a few minutes)"
as_site "cd '$APP_DIR' && SEED_SUPER_ADMIN_PASSWORD='$ADMIN_PASS' ./deploy/deploy.sh"

# ── nginx additions for CloudPanel's Vhost editor ────────────────────────────
VHOST_OUT="$HOME_DIR/purple-voice-vhost.conf"
sed -e "s/__WEB_PORT__/$WEB_PORT/g" -e "s/__API_PORT__/$API_PORT/g" "$HERE/vhost.conf" > "$VHOST_OUT"
chown "$SITE_USER:$SITE_USER" "$VHOST_OUT"

cat <<DONE

────────────────────────────────────────────────────────────────────────────
Purple Voice is running on 127.0.0.1:$WEB_PORT (web) and 127.0.0.1:$API_PORT (API).

Next steps
  1. CloudPanel → Sites → $DOMAIN → Vhost: add the blocks from
       $VHOST_OUT
     (instructions at the top of that file), then Save.
  2. CloudPanel → Sites → $DOMAIN → SSL/TLS → Actions → New Let's Encrypt
     Certificate (if you haven't already).
  3. Sign in at https://$DOMAIN/login with the details in
       $FIRST_LOGIN
     then change the password in Admin → Your account.
  4. Copy APP_ENCRYPTION_KEY from $ENV_DIR/api.env to your password manager.
  5. Fill in SMTP, Stripe, Google and the rest in $ENV_DIR/api.env, then, as
     $SITE_USER:   cd ~/purple-voice && ./deploy/deploy.sh
────────────────────────────────────────────────────────────────────────────
DONE
