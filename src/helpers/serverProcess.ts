import env from './env';
import { db } from './db';
import https from 'https';
import fs from 'fs';
import { logError, logInfo } from './logger';
import { getActivationStatus, sendStatusUpdate } from './serverStatus';
import { cleanOldRevokedDevices, cleanOrphanSharedVaults } from './dbCleaner';
import { syncPeriodicallyWithMicrosoftEntra } from './syncWithMicrosoftEntra';
import { aggregateStatsDaily } from './dailyStats';
import { setupMSGraph } from './init_ms_graph';
import { sendTrialEmailReminders } from '../emails/trialEmails';
import { pullLicences } from '../licences';
import { setupGlobalAgent } from './xmlHttpRequest';
import { cleanUpExpiredShamirRecoveryRequestsDaily } from '../api2/routes/shamirRecovery/cleanUpExpiredShamirRecoveryRequestsDaily';

setupGlobalAgent();

async function cronjob(randomDelay: number) {
  await cleanOldRevokedDevices();
  await cleanOrphanSharedVaults();
  await getActivationStatus();
  await pullLicences();
  setTimeout(async () => {
    await sendStatusUpdate();
    // randomize the time of the call in the next 5 minutes to avoid overloading the server
  }, randomDelay || 0);
}

export const startServer = (app: any, then: any): void => {
  setupMSGraph();
  const serverEnv = env.IS_PRODUCTION ? 'Production' : 'Dev';
  if (env.LOCALHOST_SSL_CERTIFICATE_KEY_PATH && env.LOCALHOST_SSL_CERTIFICATE_CRT_PATH) {
    const options = {
      key: fs.readFileSync(env.LOCALHOST_SSL_CERTIFICATE_KEY_PATH),
      cert: fs.readFileSync(env.LOCALHOST_SSL_CERTIFICATE_CRT_PATH),
    };
    const server = https.createServer(options, app).listen(env.SERVER_PORT || 3000, () => {
      const address = server.address();
      if (!address) {
        logError(`${serverEnv} server COULD NOT START`);
        return;
      }
      logInfo(`${serverEnv} server listening`, server.address());
      notifyPm2Ready();
      then();
    });
    listenForGracefulShutdown(server);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const server = app.listen(env.SERVER_PORT || 3000, () => {
      const address = server.address();
      if (!address) {
        logError(`${serverEnv} server COULD NOT START`);
        return;
      }
      logInfo(`${serverEnv} server listening `, address);
      notifyPm2Ready();
    });
    listenForGracefulShutdown(server);
  }
  cronjob(0);
  // Add status update every day and avoid all calls at the same time by randomizing the interval
  setInterval(() => cronjob(60 * 5 * Math.random() * 1000), 24 * 3600 * 1000);

  syncPeriodicallyWithMicrosoftEntra();
  aggregateStatsDaily();
  // sendMailForDeviceUpdate();
  sendTrialEmailReminders();
  cleanUpExpiredShamirRecoveryRequestsDaily();
};

// Tell pm2 (wait_ready) that this process can take over traffic, so that it can stop the old one.
// process.send only exists when the process is spawned by pm2 with an IPC channel.
const notifyPm2Ready = () => {
  if (process.send) {
    process.send('ready');
  }
};

const listenForGracefulShutdown = (server: any) => {
  let isShuttingDown = false;
  const shutdown = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    // stop accepting new connections, wait for in-flight requests to finish
    server.close(() => {
      logInfo('Graceful shutdown');
      db.gracefulShutdown().then(() => {
        process.exit();
      });
    });
    // drop idle keep-alive connections, otherwise close() would wait for them until kill_timeout
    server.closeIdleConnections?.();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};
