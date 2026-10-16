#!/usr/bin/env bash
# The only thing the CI deploy key can run on the server. enable-auto-deploy.sh
# pins it to that key in ~/.ssh/authorized_keys:
#   restrict,command="/bin/bash /home/<user>/purple-voice/deploy/remote-deploy.sh" ssh-ed25519 … purple-voice-ci
# so sshd runs this script whatever the client asked for, and hands the request
# over in $SSH_ORIGINAL_COMMAND. The one request accepted is
#   deploy <40-character commit SHA> [manual]
# which runs deploy/deploy.sh for that commit, one deploy at a time, streams the
# output back to the SSH session and appends it, timestamped, to
# ~/.purple-voice/deploy.log. The request is matched, never evaluated.
# Automatic deploys skip a commit older than the one already live (a queued
# deploy must never roll production back); "manual" (Run workflow) is how a
# deliberate rollback is asked for.
#
# A deploy that has started finishes even if the SSH connection drops (a cancelled
# GitHub job, a network blip): the outcome is in the log.
set -euo pipefail
LOGIN_UMASK="$(umask)" # deploy.sh gets this back: PM2 and the builds must not inherit 077
umask 077

STATE_DIR="$HOME/.purple-voice"
LOG="$STATE_DIR/deploy.log"
LOCK="$STATE_DIR/deploy.lock"
LOCK_WAIT=2400                       # seconds to queue behind another deploy (< the CI job's 45 min)
LOG_MAX_BYTES=$((5 * 1024 * 1024))   # past this the log is cut to its newest ~2 MB
LOG_KEEP_BYTES=$((2 * 1024 * 1024))
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

mkdir -p "$STATE_DIR"
cd "$APP_DIR"

request="${SSH_ORIGINAL_COMMAND-}"
if [[ ! $request =~ ^deploy\ ([0-9a-f]{40})(\ manual)?$ ]]; then
  echo "remote-deploy: refused. This key only runs: deploy <40-character commit SHA> [manual]" >&2
  # Logged while the log has room (only a deploy, holding the lock, trims it).
  if [ ! -f "$LOG" ] || [ "$(wc -c <"$LOG")" -le "$LOG_MAX_BYTES" ]; then
    printf '%(%F %T)T refused %q\n' -1 "${request:0:200}" >>"$LOG" 2>/dev/null || true
  fi
  exit 64
fi
SHA="${BASH_REMATCH[1]}"
MANUAL="${BASH_REMATCH[2]:+yes}"

# Forced commands run non-interactively, so nothing has put the site user's
# Node.js (nvm) or PM2 on PATH yet. nvm.sh is not written for set -eu.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  set +eu
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  command -v node >/dev/null 2>&1 || nvm use --silent default >/dev/null 2>&1
  set -eu
fi
export GIT_TERMINAL_PROMPT=0 # fail instead of waiting for a password nobody can type

# Writes each line to the SSH session as it comes and, timestamped, to the log.
# SIGPIPE is ignored here so a dropped connection stops the streaming, not the deploy.
stream() {
  trap '' PIPE
  local line
  while IFS= read -r line || [ -n "$line" ]; do
    printf '%s\n' "$line" 2>/dev/null || true
    printf '%(%F %T)T %s\n' -1 "$line" >&8
  done 8>>"$LOG"
}

# One deploy at a time: a second request waits for the first instead of failing.
exec 9>>"$LOCK"
if ! flock -n 9; then
  echo "==> Another deploy is running; waiting for it to finish (up to $((LOCK_WAIT / 60)) min)"
  flock -w "$LOCK_WAIT" 9 || {
    echo "!! Still locked after $((LOCK_WAIT / 60)) min. Is a deploy stuck? Check $LOG" >&2
    exit 75
  }
fi

# Checked only now, holding the lock: while this request queued, a newer commit
# may have gone live (flock doesn't serve waiters in order).
live="$(git rev-parse -q --verify HEAD 2>/dev/null || true)"
if [ -z "$MANUAL" ] && [ -n "$live" ] && [ "$live" != "$SHA" ] &&
  git merge-base --is-ancestor "$SHA" "$live" 2>/dev/null; then
  echo "==> $SHA is older than the live ${live:0:12}; not deploying it (superseded)."
  printf '%(%F %T)T superseded %s (live %s)\n' -1 "$SHA" "$live" >>"$LOG" 2>/dev/null || true
  exit 0
fi

if [ -f "$LOG" ] && [ "$(wc -c <"$LOG")" -gt "$LOG_MAX_BYTES" ]; then
  tail -c "$LOG_KEEP_BYTES" "$LOG" | tail -n +2 >"$LOG.tmp" && mv -f "$LOG.tmp" "$LOG"
fi

client="${SSH_CLIENT:-local}"
# fd 9 (the lock) is closed for deploy.sh: a PM2 daemon it starts must not inherit
# the lock and hold it for ever.
set +e
{
  echo "==> Deploy $SHA requested from ${client%% *} ($APP_DIR)"
  for tool in node npm pm2; do
    command -v "$tool" >/dev/null 2>&1 && continue
    echo "!! $tool is not on PATH for $(id -un). Is Node.js (nvm, $NVM_DIR) and PM2 installed for this user?"
    exit 69
  done
  umask "$LOGIN_UMASK"
  SECONDS=0
  bash "$APP_DIR/deploy/deploy.sh" "$SHA" </dev/null 2>&1 9>&-
  rc=$?
  if [ "$rc" -eq 0 ]; then
    echo "==> Deploy $SHA finished in ${SECONDS}s"
  else
    echo "!! Deploy $SHA failed (exit $rc) after ${SECONDS}s. The log: $LOG"
  fi
  exit "$rc"
} | stream
status=${PIPESTATUS[0]}
exit "$status"
