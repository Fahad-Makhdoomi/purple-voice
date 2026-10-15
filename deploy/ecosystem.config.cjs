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
 * Environment comes from /etc/purple-voice/*.env (see DEPLOYMENT.md).
 */
const ROOT = __dirname + '/..';

module.exports = {
  apps: [
    {
      name: 'pv-web',
      cwd: `${ROOT}/apps/web`,
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000 -H 127.0.0.1',
      node_args: '--env-file=/etc/purple-voice/web.env --max-old-space-size=640',
      max_memory_restart: '800M',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'pv-api',
      cwd: `${ROOT}/apps/api`,
      script: 'dist/server.js',
      node_args: '--env-file=/etc/purple-voice/api.env --max-old-space-size=512',
      max_memory_restart: '700M',
      kill_timeout: 35000, // let live calls finish (server waits up to 30 s)
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'pv-worker',
      cwd: `${ROOT}/apps/api`,
      script: 'dist/worker.js',
      node_args: '--env-file=/etc/purple-voice/api.env --max-old-space-size=256',
      max_memory_restart: '350M',
      instances: 1,
      env: { NODE_ENV: 'production' },
    },
  ],
};
