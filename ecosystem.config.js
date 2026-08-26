/**
 * PM2 process definition for the VPS.
 *
 * Single instance on purpose (fork, not cluster): the login rate limiter and the
 * ticket-number advisory lock fallback keep state in the process, so running N
 * copies would let N x 5 login attempts through per minute. One Next server
 * handles a 4-15 person team comfortably. Before scaling out, move the limiter
 * to a shared store (see README, "ข้อจำกัดที่ควรรู้").
 *
 * Secrets are NOT listed here — this file is committed. Put DATABASE_URL,
 * DIRECT_URL, AUTH_SECRET and AUTH_URL in .env on the server; Next.js loads it
 * at runtime.
 *
 *   pm2 start ecosystem.config.js
 *   pm2 reload teamflow      # zero-downtime restart after a deploy
 *   pm2 logs teamflow
 */
const PORT = 3009;

module.exports = {
  apps: [
    {
      name: "teamflow",
      // Run Next's binary directly so PM2 tracks the real process rather than a
      // pnpm wrapper — restarts, memory limits and graceful stop all depend on it.
      script: "node_modules/next/dist/bin/next",
      args: `start --port ${PORT}`,
      cwd: __dirname,

      exec_mode: "fork",
      instances: 1,

      env: {
        NODE_ENV: "production",
        PORT,
      },

      autorestart: true,
      // Back off instead of hammering restarts when the app fails to boot
      // (a missing env var makes it exit immediately by design).
      exp_backoff_restart_delay: 200,
      max_restarts: 10,
      min_uptime: "20s",

      max_memory_restart: "512M",

      // Give in-flight requests time to finish before SIGKILL.
      kill_timeout: 10000,
      listen_timeout: 15000,

      // Do not restart on file changes: deploys are explicit (pm2 reload).
      watch: false,

      merge_logs: true,
      time: true,
      out_file: "logs/teamflow-out.log",
      error_file: "logs/teamflow-error.log",
    },
  ],
};
