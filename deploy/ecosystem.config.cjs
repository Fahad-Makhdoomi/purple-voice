/**
 * PM2 process file. Three processes, sized for a 4 GB / 2 vCPU VPS:
 *
 *   pv-web     Next.js (public site, dashboard, admin)       ~400–600 MB
 *   pv-api     Express API + live-call WebSockets             ~200–400 MB
 *   pv-worker  dialer, webhook deliveries, maintenance        ~150 MB
 *
 * Exactly one pv-worker must run (it owns the campaign dialer). pv-api runs
 * one instance: live calls hold in-process state, and two cores are better
 * spent on Postgres and Next.js than on a second API copy.
 *
 * Environment comes from api.env / web.env in the env directory: $PV_ENV_DIR,
 * else ~/.purple-voice (CloudPanel), else /etc/purple-voice (plain Ubuntu).
 * Ports come from those files too: PORT in web.env (Next.js, default 3000)
 * and API_PORT in api.env (default 4000). See DEPLOYMENT.md.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const WEB_DIR = path.join(ROOT, 'apps/web');
const API_DIR = path.join(ROOT, 'apps/api');

function envDir() {
  if (process.env.PV_ENV_DIR) return process.env.PV_ENV_DIR;
  const home = path.join(os.homedir(), '.purple-voice');
  return fs.existsSync(path.join(home, 'api.env')) ? home : '/etc/purple-voice';
}
const ENV_DIR = envDir();

module.exports = {
  apps: [
    {
      name: 'pv-web',
      cwd: WEB_DIR,
      // npm workspaces hoist next to the repo root; resolve it wherever it landed.
      script: require.resolve('next/dist/bin/next', { paths: [WEB_DIR] }),
      args: 'start -H 127.0.0.1',
      node_args: `--env-file=${ENV_DIR}/web.env --max-old-space-size=640`,
      max_memory_restart: '800M',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'pv-api',
      cwd: API_DIR,
      script: 'dist/server.js',
      node_args: `--env-file=${ENV_DIR}/api.env --max-old-space-size=512`,
      max_memory_restart: '700M',
      kill_timeout: 35000, // let live calls finish (server waits up to 30 s)
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'pv-worker',
      cwd: API_DIR,
      script: 'dist/worker.js',
      node_args: `--env-file=${ENV_DIR}/api.env --max-old-space-size=256`,
      max_memory_restart: '350M',
      instances: 1,
      env: { NODE_ENV: 'production' },
    },
  ],
};
