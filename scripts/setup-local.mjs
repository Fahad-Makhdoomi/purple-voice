#!/usr/bin/env node
/**
 * One-command local setup: `npm run setup` (Windows, macOS, Linux).
 *
 *   1. checks Node.js 22+
 *   2. starts Postgres + Mailpit in Docker (docker-compose.yml), unless you pass
 *      --database-url=postgresql://… for a Postgres you run yourself
 *   3. writes apps/api/.env and apps/web/.env.local from .env.example with fresh
 *      secrets (existing files are kept; --force rewrites them)
 *   4. installs dependencies, applies migrations and seeds demo data
 *
 * Then `npm run dev` serves the site on http://localhost:3000.
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API_ENV = join(ROOT, 'apps/api/.env');
const WEB_ENV = join(ROOT, 'apps/web/.env.local');
const args = process.argv.slice(2);
const force = args.includes('--force');
const customDb = args.find((a) => a.startsWith('--database-url='))?.slice('--database-url='.length);
const DOCKER_DB = 'postgresql://pv:pv_dev_password@localhost:5434/purple_voice?schema=public';

const say = (msg) => console.log(`\n==> ${msg}`);
const fail = (msg) => {
  console.error(`\n!! ${msg}\n`);
  process.exit(1);
};
/** Runs a command in the repo, streaming its output. npm/npx/docker resolve through the shell on Windows. */
function run(cmd, cmdArgs, { allowFail = false, quiet = false } = {}) {
  const res = spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    stdio: quiet ? 'pipe' : 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });
  if (res.status !== 0 && !allowFail)
    fail(`${cmd} ${cmdArgs.join(' ')} failed (exit ${res.status ?? res.error?.message}).`);
  return res.status === 0;
}
const secret = (bytes) => randomBytes(bytes).toString('base64');

// ── 1. Node.js ──────────────────────────────────────────────────────────────
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 12)) {
  fail(
    `Node.js ${process.versions.node} is too old. Install Node.js 22 LTS or newer from https://nodejs.org and run npm run setup again.`,
  );
}

// ── 2. Database ─────────────────────────────────────────────────────────────
let databaseUrl = customDb;
let mailpit = false;
if (!databaseUrl) {
  say('Starting Postgres and Mailpit in Docker');
  if (!run('docker', ['compose', 'version'], { allowFail: true, quiet: true })) {
    fail(
      'Docker is not available. Either install Docker Desktop (https://docs.docker.com/get-docker/) and start it,\n' +
        '   or point setup at a Postgres 16 you run yourself:\n' +
        '   npm run setup -- --database-url=postgresql://USER:PASSWORD@localhost:5432/purple_voice',
    );
  }
  // --wait (Compose 2.1+) returns once Postgres passes its health check.
  if (!run('docker', ['compose', 'up', '-d', '--wait', 'db', 'mailpit'], { allowFail: true })) {
    run('docker', ['compose', 'up', '-d', 'db', 'mailpit']);
  }
  databaseUrl = DOCKER_DB;
  mailpit = true;
}

const { hostname, port } = new URL(databaseUrl);
async function reachable(host, p) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port: Number(p) || 5432, timeout: 2000 });
    socket.once('connect', () => (socket.destroy(), resolve(true)));
    socket.once('error', () => resolve(false));
    socket.once('timeout', () => (socket.destroy(), resolve(false)));
  });
}
let up = false;
for (let i = 0; i < 30 && !up; i++) {
  up = await reachable(hostname, port);
  if (!up) await new Promise((r) => setTimeout(r, 1000));
}
if (!up)
  fail(`Postgres at ${hostname}:${port || 5432} is not answering. Check that it is running.`);

// ── 3. Env files ────────────────────────────────────────────────────────────
const template = readFileSync(join(ROOT, '.env.example'), 'utf8');
const webStart = template.indexOf('#  Web  (apps/web/.env.local)');
if (webStart < 0) fail('.env.example has no Web block; it may be damaged.');
const lineStart = (text, idx) => text.lastIndexOf('\n', text.lastIndexOf('\n', idx) - 1) + 1;
const apiBlock = template.slice(
  template.indexOf('#  API  (apps/api/.env)'),
  lineStart(template, webStart),
);
const webBlock = template.slice(lineStart(template, webStart));

/** Sets KEY=value lines in an env block (the key must already be in the template). */
function fill(block, values) {
  let out = block;
  for (const [key, value] of Object.entries(values)) {
    const re = new RegExp(`^${key}=.*$`, 'm');
    out = re.test(out) ? out.replace(re, `${key}=${value}`) : `${out.trimEnd()}\n${key}=${value}\n`;
  }
  return out;
}

const revalidate = secret(36);
const adminPassword = `pv-${randomBytes(6).toString('hex')}1`;
let createdApiEnv = false;

if (existsSync(API_ENV) && !force) {
  console.log('   apps/api/.env exists: keeping it (npm run setup -- --force rewrites it)');
} else {
  writeFileSync(
    API_ENV,
    `# Written by npm run setup. Edit freely; never commit it.\n${fill(apiBlock, {
      NODE_ENV: 'development',
      DATABASE_URL: databaseUrl,
      REVALIDATE_SECRET: revalidate,
      JWT_ACCESS_SECRET: secret(48),
      JWT_REFRESH_SECRET: secret(48),
      APP_ENCRYPTION_KEY: secret(32),
      URL_SIGNING_SECRET: secret(48),
      ...(mailpit ? { SMTP_HOST: 'localhost', SMTP_PORT: '1025', SMTP_SECURE: 'false' } : {}),
      BILLING_DEV_BYPASS: 'true',
      SEED_SUPER_ADMIN_EMAIL: 'admin@purplevoice.local',
      SEED_SUPER_ADMIN_PASSWORD: adminPassword,
      SEED_DEMO: 'true',
    })}`,
  );
  createdApiEnv = true;
  console.log('   wrote apps/api/.env');
}

if (existsSync(WEB_ENV) && !force) {
  console.log('   apps/web/.env.local exists: keeping it');
} else {
  // The web app must share the API's revalidation secret.
  const apiRevalidate =
    readFileSync(API_ENV, 'utf8').match(/^REVALIDATE_SECRET=(.*)$/m)?.[1] ?? revalidate;
  writeFileSync(
    WEB_ENV,
    `# Written by npm run setup. Edit freely; never commit it.\n${fill(webBlock, {
      REVALIDATE_SECRET: apiRevalidate,
    })}`,
  );
  console.log('   wrote apps/web/.env.local');
}

// ── 4. Dependencies, database, demo data ────────────────────────────────────
if (!existsSync(join(ROOT, 'node_modules')) || force) {
  say('Installing dependencies (a few minutes the first time)');
  run('npm', ['ci', '--no-audit', '--no-fund']);
}
say('Building shared code and applying database migrations');
run('npm', ['run', 'build', '-w', '@pv/shared']);
// A just-created Postgres can refuse logins for a few seconds while it initialises.
let migrated = false;
for (let attempt = 1; attempt <= 5 && !migrated; attempt++) {
  migrated = run('npm', ['run', 'db:deploy'], { allowFail: attempt < 5 });
  if (!migrated) await new Promise((r) => setTimeout(r, 3000));
}
say('Seeding plans, the super admin and a demo workspace');
run('npm', ['run', 'db:seed']);

console.log(`
────────────────────────────────────────────────────────────────────────────
Ready. Start everything with:   npm run dev

  Website and dashboard   http://localhost:3000
  API                     http://localhost:4000/api/health${mailpit ? '\n  Emails (Mailpit)        http://localhost:8025' : ''}
  Super admin             admin@purplevoice.local${createdApiEnv ? ` / ${adminPassword}` : ' (password from your apps/api/.env)'}
  Demo subscriber         demo@purplevoice.local / demo-password-1

Payments run in test mode locally: "Choose plan" activates instantly
(BILLING_DEV_BYPASS). Commit and push to main to put a change live
(DEPLOYMENT.md § Day-to-day).
────────────────────────────────────────────────────────────────────────────`);
