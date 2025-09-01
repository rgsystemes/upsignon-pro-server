/* eslint-disable @typescript-eslint/no-var-requires */
import path from 'path';
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

import express from 'express';
import { SessionStore } from './helpers/sessionStore';

import { startServer } from './helpers/serverProcess';

import env from './helpers/env';
import { logInfo } from './helpers/logger';
import { runMigrations } from './helpers/runMigrations';

import { getBankConfig } from './api2/routes/bank/getBankConfig';
import { getUrlList2 } from './api2/routes/bank/getUrlList';
import { requestDeviceAccess2 } from './api2/routes/deviceAuthorization/requestDeviceAccess';
import { checkDevice2 } from './api2/routes/deviceAuthorization/checkDevice';
import { getAuthenticationChallenges2 } from './api2/routes/authentication/getAuthenticationChallenges';
import { authenticate2 } from './api2/routes/authentication/authenticate';
import { updateVaultData } from './api2/routes/data/updateVaultData';
import { addNewData2 } from './api2/routes/data/addNewData';
import { getVaultData } from './api2/routes/data/getVaultData';
import { revokeDevice } from './api2/routes/devices/revokeDevice';
import { getAuthorizedDevices2 } from './api2/routes/devices/getAuthorizedDevices';
import { requestPasswordReset2 } from './api2/routes/passwordReset/requestPasswordReset';
import { getMatchingEmailAddressesForSharing2 } from './api2/routes/sharingRecipients/getMatchingEmailAddressesForSharing';
import { getRecipientPublicKey } from './api2/routes/sharingRecipients/getRecipientPublicKey';
import { createSharedVault } from './api2/routes/sharedVaults/createSharedVault';
import { getSharedVaultData } from './api2/routes/sharedVaults/getSharedVaultData';
import { updateSharedVaultData } from './api2/routes/sharedVaults/updateSharedVaultData';
import { renameSharedVault } from './api2/routes/sharedVaults/renameSharedVault';
import { deleteSharedVault } from './api2/routes/sharedVaults/deleteSharedVault';
import { getRecipientsForSharedVault } from './api2/routes/sharingRecipients/getRecipientsForSharedVault';
import { addRecipientToSharedVault } from './api2/routes/sharingRecipients/addRecipientToSharedVault';
import {
  updateRecipientRightsOnSharedVault,
  updateRecipientsRightsOnSharedVault,
} from './api2/routes/sharingRecipients/updateRecipientRightsOnSharedVault';
import {
  removeRecipientFromSharedVault,
  removeRecipientsFromSharedVault,
} from './api2/routes/sharingRecipients/removeRecipientFromSharedVault';
import { disconnect2 } from './api2/routes/authentication/disconnect';
import { backupPassword2 } from './api2/routes/passwordReset/backupPassword';
import { getPasswordBackup2 } from './api2/routes/passwordReset/getPasswordBackup';
import { renameDevice2 } from './api2/routes/devices/renameDevice';
import { checkUserPublicKey2 } from './api2/routes/sharingRecipients/checkUserPublicKey';
import { updateDeviceMetaData2 } from './api2/routes/devices/updateDeviceMetaData';
import { logEvent } from './api2/routes/audit/logEvent';
import libsodium from 'libsodium-wrappers';
import { startLicencePulling, updateLicences } from './licences';
import { getBrowserSetupPreference } from './api2/routes/browserSetupSecurity/getBrowserSetupPreference';
import { setBrowserSetupUserPreference } from './api2/routes/browserSetupSecurity/setBrowserSetupUserPreference';
import { authenticateWithOpenidAuthCode } from './api2/routes/authentication/authenticateWithOpenidAuthCode';
import { verifySignatureMiddleware } from './helpers/signatureHelper';
import { forceStatusUpdate } from './helpers/serverStatus';

const app = express();

// Set express trust-proxy so that secure sessions cookies can work
app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use(express.json({ limit: '5Mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((err: any, req: any, res: any, next: any) => {
  if (err.type === 'entity.too.large') {
    logInfo(`Request body too large (${err.length ?? 'unknown'} bytes) when calling ${req.url}.`);
    return res.sendStatus(413).end();
  }
  next(err);
});

// SESSIONS
if (!env.SESSION_SECRET) {
  console.error('Missing SESSION_SECRET in .env file.');
  process.exit(1);
}
SessionStore.init();

app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  logInfo(req.body?.userEmail, ip, req.url);
  if (!env.IS_PRODUCTION) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  next();
});

app.get('/', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).send('UpSignOn PRO server is running');
});

/// Called by SEPTEO IT SOLUTIONS servers to push licence updates
/// This call is signed by SEPTEO IT SOLUTIONS
app.post(
  '/licences',
  (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  },
  verifySignatureMiddleware,
  updateLicences,
);

/// Called by the upsignon-pro-dashboard to pull licences from SEPTEO IT SOLUTIONS in order to avoid code duplication.
app.post(
  '/start-licence-pulling',
  (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  },
  startLicencePulling,
);
app.post(
  '/force-pro-status-update',
  (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  },
  forceStatusUpdate,
);

// BANK ROUTING with or without bankUUID (default bankUUID used to be 1)
// TODO(giregk): remove default bank id routes in 2026

app.get('/:bankUUID/', (req, res) => {
  var hostname = env.API_PUBLIC_HOSTNAME.replace(/\/$/, '');
  return res
    .status(303)
    .redirect(
      `https://app.upsignon.eu/pro-setup?url=${encodeURIComponent(`https://${hostname}${req.originalUrl}`)}`,
    );
});
// API 2
// BANK
app.all(['/:bankUUID/api2/bank-config', '/api2/bank-config'], getBankConfig);
app.post(['/:bankUUID/api2/url-list', '/api2/url-list'], getUrlList2);

// AUTHORIZATION
app.post(
  ['/:bankUUID/api2/request-device-access', '/api2/request-device-access'],
  requestDeviceAccess2,
);
app.post(['/:bankUUID/api2/check-device', '/api2/check-device'], checkDevice2);

// AUTHENTICATION
app.post(
  ['/:bankUUID/api2/get-authentication-challenges', '/api2/get-authentication-challenges'],
  getAuthenticationChallenges2,
);
app.post(['/:bankUUID/api2/authenticate', '/api2/authenticate'], authenticate2);
app.post(['/:bankUUID/api2/disconnect', '/api2/disconnect'], disconnect2);

// OPENID
app.post(['/:bankUUID/api2/authenticate-with-openid-auth-code'], authenticateWithOpenidAuthCode);

// PASSWORD RESET
app.post(
  ['/:bankUUID/api2/request-password-reset', '/api2/request-password-reset'],
  requestPasswordReset2,
);
app.post(['/:bankUUID/api2/backup-password', '/api2/backup-password'], backupPassword2);
app.post(['/:bankUUID/api2/get-password-backup', '/api2/get-password-backup'], getPasswordBackup2);

// DATA
app.post(['/:bankUUID/api2/get-vault-data', '/api2/get-vault-data'], getVaultData);
app.post(['/:bankUUID/api2/update-vault-data', '/api2/update-vault-data'], updateVaultData);
app.post(['/:bankUUID/api2/add-new-data', '/api2/add-new-data'], addNewData2);

// DEVICES
app.post(
  ['/:bankUUID/api2/get-authorized-devices', '/api2/get-authorized-devices'],
  getAuthorizedDevices2,
);
app.post(['/:bankUUID/api2/rename-device', '/api2/rename-device'], renameDevice2);
app.post(['/:bankUUID/api2/revoke-device', '/api2/revoke-device'], revokeDevice);

// LOGS
app.post(['/:bankUUID/api2/log-event', '/api2/log-event'], logEvent);
app.post(
  ['/:bankUUID/api2/update-device-metadata', '/api2/update-device-metadata'],
  updateDeviceMetaData2,
);

// SHARED VAULTS
app.post(['/:bankUUID/api2/create-shared-vault', '/api2/create-shared-vault'], createSharedVault);
app.post(
  ['/:bankUUID/api2/get-shared-vault-data', '/api2/get-shared-vault-data'],
  getSharedVaultData,
);
app.post(
  ['/:bankUUID/api2/update-shared-vault-data', '/api2/update-shared-vault-data'],
  updateSharedVaultData,
);
app.post(['/:bankUUID/api2/rename-shared-vault', '/api2/rename-shared-vault'], renameSharedVault);
app.post(['/:bankUUID/api2/delete-shared-vault', '/api2/delete-shared-vault'], deleteSharedVault);

// SHARING RECIPIENTS
app.post(
  ['/:bankUUID/api2/check-user-public-key', '/api2/check-user-public-key'],
  checkUserPublicKey2,
);
app.post(
  [
    '/:bankUUID/api2/get-matching-email-addresses-for-sharing',
    '/api2/get-matching-email-addresses-for-sharing',
  ],
  getMatchingEmailAddressesForSharing2,
);
app.post(
  ['/:bankUUID/api2/get-recipient-public-key', '/api2/get-recipient-public-key'],
  getRecipientPublicKey,
);
app.post(
  ['/:bankUUID/api2/add-recipient-to-shared-vault', '/api2/add-recipient-to-shared-vault'],
  addRecipientToSharedVault,
);
app.post(
  ['/:bankUUID/api2/get-recipients-for-shared-vault', '/api2/get-recipients-for-shared-vault'],
  getRecipientsForSharedVault,
);
app.post(
  [
    '/:bankUUID/api2/update-recipient-rights-on-shared-vault',
    '/api2/update-recipient-rights-on-shared-vault',
  ],
  updateRecipientRightsOnSharedVault,
);
app.post(
  [
    '/:bankUUID/api2/update-recipients-rights-on-shared-vault',
    '/api2/update-recipients-rights-on-shared-vault',
  ],
  updateRecipientsRightsOnSharedVault,
);
app.post(
  [
    '/:bankUUID/api2/remove-recipient-from-shared-vault',
    '/api2/remove-recipient-from-shared-vault',
  ],
  removeRecipientFromSharedVault,
);
app.post(
  [
    '/:bankUUID/api2/remove-recipients-from-shared-vault',
    '/api2/remove-recipients-from-shared-vault',
  ],
  removeRecipientsFromSharedVault,
);

// BROWSER SETUP SAFE/UNSAFE CONFIG
app.post('/:bankUUID/api2/get-browser-setup-preference', getBrowserSetupPreference);
app.post('/:bankUUID/api2/set-browser-setup-preference', setBrowserSetupUserPreference);

if (module === require.main) {
  runMigrations()
    .then(() => libsodium.ready)
    .then(() => {
      startServer(app, () => {
        logInfo(`You can try to open in your browser\n  - https://${env.API_PUBLIC_HOSTNAME}\n`);
        logInfo(
          `Your setup link is https://upsignon.eu/pro-setup?url=https://${env.API_PUBLIC_HOSTNAME}`,
        );
      });
    });
}

module.exports = app;
