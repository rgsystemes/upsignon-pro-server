/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const dotEnvPath = path.join(__dirname, '.env');
require('dotenv').config({ path: dotEnvPath });

module.exports = {
  apps: [
    {
      name: 'upsignon-pro-server',
      script: path.join(__dirname, './compiled/server.js'),
      instances: 1,
      // Cluster mode is required for zero-downtime reloads (`pm2 reload`):
      // the new process starts and listens on the shared port before the old one is stopped.
      exec_mode: 'cluster',
      // The app sends process.send('ready') once it is listening (after DB migrations).
      wait_ready: true,
      // Max time (ms) to wait for the 'ready' signal (migrations included) before pm2 gives up.
      listen_timeout: 60000,
      error_file: path.join(__dirname, './logs/server-error.log'),
      out_file: path.join(__dirname, './logs/server-output.log'),
      combine_logs: true,
      // Max time (ms) left to the old process to finish in-flight requests after SIGINT before SIGKILL.
      kill_timeout: 10000,
      source_map_support: true,
      autorestart: true,
      min_uptime: 1000,
      env: {
        // prevent pm2 override of NODE_ENV
        NODE_ENV: process.env.NODE_ENV,
      },
    },
  ],
};
