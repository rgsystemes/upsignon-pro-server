import { beforeEach, describe, it, expect } from '@jest/globals';
import { Request, Response } from 'express';
import { getPasswordBackup2 } from '../../../src/api2/routes/passwordReset/getPasswordBackup';
import { cleanDatabase } from '../../setup/testHelpers';
import { addTestBanks, testBanks } from '../../fixtures/banks';
import { addTestUsers, testUsers } from '../../fixtures/users';
import { addTestDevices, deviceForUser } from '../../fixtures/userDevices';

jest.mock('../../../src/helpers/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));
jest.mock('../../../src/api2/helpers/deviceChallengev2', () => ({
  createDeviceChallengeV2: jest.fn(),
  checkDeviceRequestAuthorizationV2: jest.fn(),
}));
jest.mock('../../../src/helpers/sessionStore', () => ({
  SessionStore: { checkOpenIdSession: jest.fn() },
}));

import { checkDeviceRequestAuthorizationV2 } from '../../../src/api2/helpers/deviceChallengev2';
import { SessionStore } from '../../../src/helpers/sessionStore';
import { db } from '../../../src/helpers/db';

const user = testUsers[0]; // user1@testbank1.com, bank 1
const bank = testBanks[0];
const device = deviceForUser(user.id);
const RESET_TOKEN = 'ABCD1234';

const mockRes = () =>
  ({
    status: jest.fn().mockReturnThis(),
    end: jest.fn(),
    json: jest.fn(),
  }) as unknown as Response;

const mockReq = (body: Record<string, unknown>) =>
  ({
    params: { bankUUID: bank.public_id },
    body: {
      userEmail: user.email,
      deviceId: device.device_unique_id,
      deviceChallengeResponse: 'challenge-response',
      ...body,
    },
  }) as unknown as Request;

const enablePasswordlessForUser = async () => {
  await db.query(
    `INSERT INTO allowed_emails (pattern, bank_id, uses_passwordless_auth) VALUES ($1, $2, true)`,
    [user.email, bank.id],
  );
};

const insertResetRequest = async () => {
  await db.query(
    `INSERT INTO password_reset_request
      (device_id, status, reset_token, reset_token_expiration_date, bank_id, granted_by)
     VALUES ($1, 'ADMIN_AUTHORIZED', $2, current_timestamp(0) + interval '1 hour', $3, 'test')`,
    [device.id, RESET_TOKEN, bank.id],
  );
};

const getResetRequests = async () =>
  (await db.query(`SELECT * FROM password_reset_request WHERE device_id = $1 ORDER BY id`, [device.id]))
    .rows;

describe('getPasswordBackup2', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await cleanDatabase();
    await addTestBanks();
    await addTestUsers();
    await addTestDevices();
    await db.query(`UPDATE user_devices SET encrypted_password_backup_2 = 'backup' WHERE id = $1`, [
      device.id,
    ]);
    (checkDeviceRequestAuthorizationV2 as jest.Mock<any>).mockResolvedValue(true);
    (SessionStore.checkOpenIdSession as jest.Mock<any>).mockResolvedValue(true);
  });

  describe('reset with a token', () => {
    it('completes the request and consumes the token when passwordless is NOT used', async () => {
      await insertResetRequest();
      const res = mockRes();
      await getPasswordBackup2(mockReq({ resetToken: RESET_TOKEN }), res);

      expect(res.status).toHaveBeenCalledWith(200);
      const requests = await getResetRequests();
      expect(requests).toHaveLength(1);
      expect(requests[0].status).toBe('COMPLETED');
      expect(requests[0].reset_token).toBeNull();
    });

    it('completes the request and consumes the token when passwordless IS used', async () => {
      await enablePasswordlessForUser();
      await insertResetRequest();
      const res = mockRes();
      await getPasswordBackup2(mockReq({ resetToken: RESET_TOKEN }), res);

      expect(res.status).toHaveBeenCalledWith(200);
      const requests = await getResetRequests();
      expect(requests).toHaveLength(1);
      expect(requests[0].status).toBe('COMPLETED');
      expect(requests[0].reset_token).toBeNull();
    });

    it('cannot replay the token once consumed, even with passwordless', async () => {
      await enablePasswordlessForUser();
      await insertResetRequest();
      await getPasswordBackup2(mockReq({ resetToken: RESET_TOKEN }), mockRes());

      const res = mockRes();
      await getPasswordBackup2(mockReq({ resetToken: RESET_TOKEN }), res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'no_request' });
    });
  });

  describe('reset with an SSO session', () => {
    it('records a COMPLETED request when passwordless is NOT used', async () => {
      const res = mockRes();
      await getPasswordBackup2(mockReq({ openidSession: 'session' }), res);

      expect(res.status).toHaveBeenCalledWith(200);
      const requests = await getResetRequests();
      expect(requests).toHaveLength(1);
      expect(requests[0].status).toBe('COMPLETED');
      expect(requests[0].granted_by).toBe('SSO authentication');
    });

    it('records nothing when passwordless IS used (regular unlock, not a reset)', async () => {
      await enablePasswordlessForUser();
      const res = mockRes();
      await getPasswordBackup2(mockReq({ openidSession: 'session' }), res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(await getResetRequests()).toHaveLength(0);
    });
  });
});
