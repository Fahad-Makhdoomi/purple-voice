#!/usr/bin/env bash
# Turns on automatic deploys from GitHub for a CloudPanel install
# (DEPLOYMENT.md § Automatic deploys from GitHub). Run as the site user, not root:
#   bash ~/purple-voice/deploy/cloudpanel/enable-auto-deploy.sh <owner/repo> <server-address>
#
# Run it until it says it's done; each run picks up where the last one stopped:
#   1. Makes a read-only deploy key for the repository and, until GitHub accepts it,
#      prints it with where to add it (Settings → Deploy keys), then stops.
#   2. Turns ~/purple-voice into a git checkout of main if it isn't one (a copy of
#      the old files is kept in ~/purple-voice-before-git-<time>.tar.gz first).
#   3. Makes the key GitHub Actions logs in with. ~/.ssh/authorized_keys lets it run
#      deploy/remote-deploy.sh and nothing else; its private half is printed once,
#      for the DEPLOY_SSH_KEY secret, and is not kept on this server.
#   4. Prints the other secrets (DEPLOY_HOST, DEPLOY_USER, DEPLOY_KNOWN_HOSTS).
# Later runs change nothing and print the secrets again (all but the private key).
# --rotate-ci-key replaces the CI key; the old one stops working at once.
#
# The app directory is ~/purple-voice; set PV_APP_DIR to use another.
set -euo pipefail
umask 077

usage="usage: enable-auto-deploy.sh <owner/repo> <server-address> [--rotate-ci-key]"
ROTATE=false
args=()
for arg in "$@"; do
  case "$arg" in
    --rotate-ci-key) ROTATE=true ;;
    -h | --help) echo "$usage"; exit 0 ;;
    -*) echo "$usage" >&2; exit 2 ;;
    *) args+=("$arg") ;;
  esac
done
[ "${#args[@]}" -eq 2 ] || { echo "$usage" >&2; exit 2; }
REPO="${args[0]%.git}"
SERVER="${args[1]}"

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
APP_DIR="${PV_APP_DIR:-$HOME/purple-voice}"
SSH_DIR="$HOME/.ssh"
REPO_KEY="$SSH_DIR/purple_voice_repo"
HOST_ALIAS=github-purple-voice
REMOTE_URL="git@$HOST_ALIAS:$REPO.git"
CI_COMMENT=purple-voice-ci
AUTH_KEYS="$SSH_DIR/authorized_keys"
# GitHub's published ED25519 host key fingerprint (docs.github.com → "GitHub's SSH
# key fingerprints"). The key ssh-keyscan fetches is trusted only if it matches.
GITHUB_ED25519_FP='SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU'
RULE='────────────────────────────────────────────────────────────────────────────'

say() { printf '\n==> %s\n' "$*"; }
warn() { printf '   (!) %s\n' "$*" >&2; }
die() { printf '\n!! %s\n' "$*" >&2; exit 1; }

# ── Preflight ────────────────────────────────────────────────────────────────
[ "$(id -u)" -ne 0 ] || die "Run this as the site user, not root (e.g. su - <site-user>, or SSH in as it)."
[[ $REPO =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || die "'$REPO' is not a GitHub repository (owner/name). $usage"
[[ $SERVER =~ ^[A-Za-z0-9.:]([A-Za-z0-9.:-]*)$ ]] || die "'$SERVER' is not an IP address or host name. $usage"
for tool in git ssh ssh-keygen ssh-keyscan; do
  command -v "$tool" >/dev/null 2>&1 || die "$tool is not installed on this server."
done
[ -d "$APP_DIR" ] || die "$APP_DIR not found. Put the code there first (DEPLOYMENT.md § 2A, step 3)."
[ -f "$APP_DIR/package.json" ] && [ -f "$APP_DIR/deploy/deploy.sh" ] ||
  die "$APP_DIR doesn't look like Purple Voice (no package.json or deploy/deploy.sh)."
APP_DIR="$(cd "$APP_DIR" && pwd)"
FORCED="$APP_DIR/deploy/remote-deploy.sh"
BASH_BIN="$(command -v bash)"
# Both end up inside command="…" in authorized_keys, so they must need no quoting.
[[ $FORCED =~ ^[A-Za-z0-9_./-]+$ && $BASH_BIN =~ ^[A-Za-z0-9_./-]+$ ]] ||
  die "$FORCED has characters that can't go in authorized_keys. Move the app to a plain path."

mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"
TMP="$(mktemp -d "$SSH_DIR/.purple-voice-tmp.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

# ── 1. Read-only deploy key for the repository ──────────────────────────────
say "Repository deploy key"
if [ ! -f "$REPO_KEY" ]; then
  ssh-keygen -q -t ed25519 -N '' -C "purple-voice-repo@$(hostname)" -f "$REPO_KEY"
  echo "   created $REPO_KEY"
else
  echo "   $REPO_KEY exists"
fi
[ -f "$REPO_KEY.pub" ] || ssh-keygen -y -f "$REPO_KEY" >"$REPO_KEY.pub"

# An alias, so this key is used for this repository only and other git remotes
# keep their keys. Appended, so entries already in the file keep their meaning.
CONFIG="$SSH_DIR/config"
touch "$CONFIG"
chmod 600 "$CONFIG"
if ! grep -Eiq "^[[:space:]]*Host[[:space:]]+([^#]*[[:space:]])?$HOST_ALIAS([[:space:]]|\$)" "$CONFIG"; then
  printf '\n# Purple Voice: read-only deploy key for %s (enable-auto-deploy.sh)\nHost %s\n  HostName github.com\n  User git\n  IdentityFile %s\n  IdentitiesOnly yes\n' \
    "$REPO" "$HOST_ALIAS" "$REPO_KEY" >>"$CONFIG"
  echo "   added Host $HOST_ALIAS to $CONFIG"
fi
ssh -G "$HOST_ALIAS" 2>/dev/null | grep -qx 'hostname github.com' ||
  die "Host $HOST_ALIAS in $CONFIG doesn't point at github.com. Fix or remove that entry and re-run."

# ── GitHub's host key, checked against the published fingerprint ───────────
KNOWN="$SSH_DIR/known_hosts"
touch "$KNOWN"
fingerprints() { ssh-keygen -E sha256 -lf "$1" 2>/dev/null | awk '{ print $2 }'; }
ssh-keygen -F github.com -f "$KNOWN" 2>/dev/null | grep -v '^#' >"$TMP/known-github" || true
if [ -s "$TMP/known-github" ] && fingerprints "$TMP/known-github" | grep -qxF "$GITHUB_ED25519_FP"; then
  echo "   github.com's host key is already trusted"
else
  ssh-keyscan -t ed25519 github.com 2>/dev/null | grep -v '^#' | head -n 1 >"$TMP/github" || true
  [ -s "$TMP/github" ] || die "Couldn't reach github.com on port 22 (ssh-keyscan). Outbound SSH must be allowed."
  offered="$(fingerprints "$TMP/github")"
  [ "$offered" = "$GITHUB_ED25519_FP" ] ||
    die "github.com answered with host key ${offered:-?}, not GitHub's published $GITHUB_ED25519_FP. Not trusting it; nothing was added."
  cat "$TMP/github" >>"$KNOWN"
  echo "   added github.com ($GITHUB_ED25519_FP) to $KNOWN"
fi

# ── Can this server read the repository? ────────────────────────────────────
say "Checking read access to $REPO"
export GIT_SSH_COMMAND="ssh -o BatchMode=yes -o ConnectTimeout=20"
export GIT_TERMINAL_PROMPT=0
if ! heads="$(git ls-remote "$REMOTE_URL" refs/heads/main 2>"$TMP/ls-remote.err")"; then
  if ! grep -qiE 'permission denied|repository not found' "$TMP/ls-remote.err"; then
    sed 's/^/   /' "$TMP/ls-remote.err" >&2
    die "Couldn't reach GitHub over SSH (above). Check this server can connect to github.com:22, then re-run."
  fi
  cat <<KEY

$RULE
GitHub doesn't accept this server's deploy key for $REPO yet. Add it:

  https://github.com/$REPO/settings/keys → Add deploy key
    Title: $(hostname) (Purple Voice server)
    Key:   $(cat "$REPO_KEY.pub")
    Leave "Allow write access" unticked: the server only ever reads.

Then run this again:
  bash $SCRIPT $REPO $SERVER
$RULE
KEY
  exit 0
fi
if [ -z "$heads" ]; then
  echo
  echo "   $REPO has no main branch yet. Push the code to it (DEPLOYMENT.md § Automatic"
  echo "   deploys from GitHub, step 1), then run this again:"
  echo "     bash $SCRIPT $REPO $SERVER"
  exit 0
fi
echo "   ok: main is at ${heads:0:7}"

# ── 2. The app directory as a git checkout ──────────────────────────────────
cd "$APP_DIR"
if [ -d .git ] && git rev-parse -q --verify HEAD >/dev/null; then
  say "$APP_DIR is a git checkout"
  current="$(git remote get-url origin 2>/dev/null || true)"
  if [ "$current" != "$REMOTE_URL" ]; then
    if [ -n "$current" ]; then git remote set-url origin "$REMOTE_URL"; else git remote add origin "$REMOTE_URL"; fi
    echo "   origin: ${current:-none} → $REMOTE_URL"
  fi
  git fetch -q --prune --tags --force origin
  changed="$(git status --porcelain --untracked-files=no)"
  if [ -n "$changed" ]; then
    warn "These files were edited on the server; the next deploy replaces them with the repository's:"
    printf '%s\n' "$changed" | sed 's/^/        /' >&2
  fi
else
  say "Turning $APP_DIR into a git checkout of $REPO (main)"
  BACKUP="$HOME/purple-voice-before-git-$(date +%Y%m%d-%H%M%S).tar.gz"
  tar -czf "$BACKUP" -C "$(dirname "$APP_DIR")" \
    --exclude=node_modules --exclude=.next --exclude=dist --exclude='*.tsbuildinfo' \
    --exclude=storage/uploads --exclude=.git "$(basename "$APP_DIR")"
  echo "   saved the current files (without dependencies and builds) to $BACKUP"
  git init -q
  git remote add origin "$REMOTE_URL" 2>/dev/null || git remote set-url origin "$REMOTE_URL"
  git fetch -q --prune --tags --force origin
  git checkout -q -f -B main origin/main
  # Files the upload had that the repository doesn't. Ignored ones (node_modules,
  # builds, env files) stay.
  leftovers="$(git clean -nd)"
  if [ -n "$leftovers" ]; then
    printf '%s\n' "$leftovers" | sed 's/^Would remove /   removing /'
    git clean -fdq
  fi
  echo "   $APP_DIR is now main at $(git log -1 --format='%h %s')"
  echo "   The running app is still the earlier build: the next deploy puts main live."
fi
[ -f "$FORCED" ] ||
  die "$FORCED is missing: the code on this server predates automatic deploys. Push the latest code to main, run ./deploy/deploy.sh main, then re-run this."

# ── 3. The key GitHub Actions logs in with ──────────────────────────────────
say "CI login key"
# sshd ignores authorized_keys when the home directory or ~/.ssh is writable by others.
for dir in "$HOME" "$SSH_DIR"; do
  mode="$(stat -c %a "$dir")"
  if (((8#$mode & 8#022) != 0)); then
    warn "$dir is writable by group or others (mode $mode), so sshd may ignore authorized_keys. Fix: chmod go-w $dir"
  fi
done
touch "$AUTH_KEYS"
chmod 600 "$AUTH_KEYS"
OPTIONS="restrict,command=\"$BASH_BIN $FORCED\""
existing="$(awk -v c="$CI_COMMENT" '$NF == c' "$AUTH_KEYS" | head -n 1)"
key_body=""
if [ -n "$existing" ] && ! $ROTATE; then
  key_body="$(sed -nE 's/.*(ssh-ed25519 [A-Za-z0-9+/=]+).*/\1/p' <<<"$existing")"
  [ -n "$key_body" ] || die "Can't read the $CI_COMMENT line in $AUTH_KEYS. Re-run with --rotate-ci-key to replace it."
fi
NEW_PRIVATE=""
if [ -z "$key_body" ]; then
  ssh-keygen -q -t ed25519 -N '' -C "$CI_COMMENT" -f "$TMP/ci"
  key_body="$(awk '{ print $1" "$2 }' "$TMP/ci.pub")"
  NEW_PRIVATE="$TMP/ci"
fi
line="$OPTIONS $key_body $CI_COMMENT"
if [ "$line" != "$existing" ]; then
  { awk -v c="$CI_COMMENT" '$NF != c' "$AUTH_KEYS"; printf '%s\n' "$line"; } >"$TMP/authorized_keys"
  chmod 600 "$TMP/authorized_keys"
  mv -f "$TMP/authorized_keys" "$AUTH_KEYS"
fi
if [ -n "$NEW_PRIVATE" ]; then
  if [ -n "$existing" ]; then echo "   replaced the CI key (the old one no longer logs in)"; else echo "   authorized a new CI key"; fi
elif [ "$line" != "$existing" ]; then
  echo "   CI key already authorized; pointed it at $FORCED"
else
  echo "   CI key already authorized (its private key was shown once; lost it? re-run with --rotate-ci-key)"
fi
echo "   it can only run: $BASH_BIN $FORCED"

# The SSH port, for the self-test below and DEPLOY_PORT.
SSHD_PORT="$(cat /etc/ssh/sshd_config.d/*.conf /etc/ssh/sshd_config 2>/dev/null |
  awk 'tolower($1) == "port" && $2 ~ /^[0-9]+$/ { print $2; exit }' || true)"
SSHD_PORT="${SSHD_PORT:-22}"

# Log in the way GitHub Actions will and ask for something the forced command
# refuses: proves sshd takes the key and runs remote-deploy.sh, without deploying.
if [ -n "$NEW_PRIVATE" ]; then
  rc=0
  out="$(ssh -i "$NEW_PRIVATE" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=10 \
    -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR \
    -p "$SSHD_PORT" "$(id -un)@127.0.0.1" self-test 2>&1)" || rc=$?
  if [ "$rc" -eq 64 ] && grep -q 'only runs: deploy' <<<"$out"; then
    echo "   self-test: the key logs in over SSH and can only run deploys"
  else
    warn "Self-test login to 127.0.0.1:$SSHD_PORT didn't behave as expected (exit $rc):"
    printf '%s\n' "$out" | sed 's/^/        /' >&2
    warn "GitHub's deploys may fail to log in until that is fixed; re-run with --rotate-ci-key afterwards."
  fi
fi

# ── 4. What goes into GitHub ────────────────────────────────────────────────
HOST_KEY="$(awk '{ print $1" "$2; exit }' /etc/ssh/ssh_host_ed25519_key.pub 2>/dev/null || true)"
if [ -z "$HOST_KEY" ]; then
  HOST_KEY="$(ssh-keyscan -t ed25519 -p "$SSHD_PORT" 127.0.0.1 2>/dev/null | awk '!/^#/ { print $2" "$3; exit }' || true)"
fi
APP_URL="$(sed -n 's/^APP_URL=//p' "$HOME/.purple-voice/api.env" 2>/dev/null | tr -d "\"'" | tail -n 1 || true)"

echo
echo "$RULE"
echo "Add these in GitHub: https://github.com/$REPO/settings/secrets/actions"
echo
if [ -n "$NEW_PRIVATE" ]; then
  echo "DEPLOY_SSH_KEY — everything between the rules, BEGIN and END lines included."
  echo "Shown only now: it is deleted from this server when this script ends."
  echo "$RULE"
  cat "$NEW_PRIVATE"
  echo "$RULE"
else
  echo "DEPLOY_SSH_KEY     (already set when the key was made; --rotate-ci-key for a new one)"
fi
echo "DEPLOY_HOST        $SERVER"
echo "DEPLOY_USER        $(id -un)"
if [ -n "$HOST_KEY" ]; then
  echo "DEPLOY_KNOWN_HOSTS $SERVER $HOST_KEY"
else
  echo "DEPLOY_KNOWN_HOSTS (couldn't read this server's host key: on your computer run"
  echo "                   ssh-keyscan -t ed25519 $SERVER and paste the line it prints)"
fi
[ "$SSHD_PORT" = 22 ] || echo "DEPLOY_PORT        $SSHD_PORT"
echo
echo "Optional variable (Settings → Secrets and variables → Actions → Variables):"
echo "DEPLOY_HEALTHCHECK_URL ${APP_URL:-https://<your-domain>}/api/health"
echo
echo "Then: GitHub → Actions → Deploy → Run workflow (main) to try it. Every push to"
echo "main that passes CI deploys by itself. On this server: tail -f ~/.purple-voice/deploy.log"
echo "$RULE"
