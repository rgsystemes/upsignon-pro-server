import { beforeEach, describe, it, jest, expect } from '@jest/globals';
import { getRecoveryKeyPair } from '../../../src/api2/routes/shamirRecovery/getRecoveryKeyPair';
import { cleanDatabase } from '../../setup/testHelpers';
import { Request, Response } from 'express';
import { addTestUsers, testUsers } from '../../fixtures/users';
import { addTestBanks } from '../../fixtures/banks';
import { addTestDevices, deviceForUser } from '../../fixtures/userDevices';
import { addTestShamirConfigs, config1Approved } from '../../fixtures/shamirConfigs';

jest.mock('../../../src/api2/helpers/authorizationChecks', () => ({
  checkDeviceAuth: jest.fn(),
}));
jest.mock('../../../src/helpers/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

import { checkDeviceAuth } from '../../../src/api2/helpers/authorizationChecks';
import { db } from '../../../src/helpers/db';
import { addTestShamirRecoveryRequests } from '../../fixtures/shamirRecoveryRequests';
import { fromBase64 } from '../../../src/api2/helpers/base64Convert';

const mockRes = () => {
  return {
    status: jest.fn().mockReturnThis(),
    end: jest.fn(),
    json: jest.fn(),
  } as unknown as Response;
};

const mockCheckDeviceAuthSuccess = (userId: number) => {
  const d = deviceForUser(userId);
  (checkDeviceAuth as jest.Mock<any>).mockResolvedValue({
    granted: true,
    vaultId: userId,
    deviceId: d.id,
  });
};

describe('getRecoveryKeyPair', () => {
  describe('authorization validations', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      await cleanDatabase();
      await addTestBanks();
      await addTestUsers();
      await addTestDevices();
    });

    it('should reject request with invalid device auth', async () => {
      (checkDeviceAuth as jest.Mock<any>).mockResolvedValue({
        granted: false,
      });

      const mockReq = {
        body: {
          userEmail: testUsers[0].email,
          passwordChallengeResponse: 'tpBemQ9uM50tZ4Wfi4SvxreavkSFEA2oPipE47+TtC4=',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await getRecoveryKeyPair(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(401);
      expect(resMock.json).toHaveBeenCalledWith({ error: 'badDeviceSession' });
    });
  });

  describe('body validations', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      await cleanDatabase();
      await addTestBanks();
      await addTestUsers();
      await addTestDevices();
    });

    it('should reject request with missing passwordChallengeResponse', async () => {
      const u = testUsers[0];
      mockCheckDeviceAuthSuccess(u.id);
      const mockReq = {
        body: {
          userEmail: u.email,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await getRecoveryKeyPair(mockReq, resMock);
      expect(resMock.status).toHaveBeenCalledWith(403);
      expect(resMock.end).toHaveBeenCalled();
    });
  });

  describe('challenge and key retrieval', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      await cleanDatabase();
      await addTestBanks();
      await addTestUsers();
      await addTestDevices();
      await addTestShamirConfigs([config1Approved]);
    });

    it('should return 400 if no pending recovery request exists', async () => {
      const u = testUsers[0];
      mockCheckDeviceAuthSuccess(u.id);
      const mockReq = {
        body: {
          userEmail: u.email,
          passwordChallengeResponse: 'tpBemQ9uM50tZ4Wfi4SvxreavkSFEA2oPipE47+TtC4=',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await getRecoveryKeyPair(mockReq, resMock);
      expect(resMock.status).toHaveBeenCalledWith(400);
      expect(resMock.end).toHaveBeenCalled();
    });

    it('should return 401 if password challenge fails', async () => {
      const u = testUsers[0];
      mockCheckDeviceAuthSuccess(u.id);
      const now = new Date();
      const expiry = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +1 day
      await addTestShamirRecoveryRequests([
        {
          id: 1,
          vault_id: u.id,
          creator_device_id: deviceForUser(u.id).id,
          public_key: 'test-public-key',
          protected_recovery_key_pair:
            'formatP003-argon2id13-2-67108864-zEKFVGhj2yE9QZ2LvtyrBw==-6KmHqbc57XTfXta4l2dJmQ==-mhuPOE2IwAZNeVu8nQqrQjiq8g26k094nV1TeESDiFA=-encryptedKeyPair',
          shamir_config_id: 1,
          created_at: now,
          completed_at: null,
          status: 'PENDING',
          expiry_date: expiry,
          denied_by: [],
        },
      ]);
      const mockReq = {
        body: {
          userEmail: u.email,
          // wrong response
          passwordChallengeResponse: 'im5FpMopR6L/EJ0ys7S+Fp+vLUJe/oT2T3AV0fSMxtc=',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await getRecoveryKeyPair(mockReq, resMock);
      expect(resMock.status).toHaveBeenCalledWith(401);
      expect(resMock.end).toHaveBeenCalled();
    });

    it('should return the protectedRecoveryKey if challenge passes', async () => {
      const u = testUsers[0];
      mockCheckDeviceAuthSuccess(u.id);
      const now = new Date();
      const expiry = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +1 day
      await addTestShamirRecoveryRequests([
        {
          id: 1,
          vault_id: u.id,
          creator_device_id: deviceForUser(u.id).id,
          public_key: 'test-public-key',
          protected_recovery_key_pair:
            'formatP003-argon2id13-2-67108864-zEKFVGhj2yE9QZ2LvtyrBw==-6KmHqbc57XTfXta4l2dJmQ==-mhuPOE2IwAZNeVu8nQqrQjiq8g26k094nV1TeESDiFA=-encryptedKeyPair',
          shamir_config_id: 1,
          created_at: now,
          completed_at: null,
          status: 'PENDING',
          expiry_date: expiry,
          denied_by: [],
        },
      ]);
      const mockReq = {
        body: {
          userEmail: u.email,
          // correct response
          passwordChallengeResponse: 'tpBemQ9uM50tZ4Wfi4SvxreavkSFEA2oPipE47+TtC4=',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await getRecoveryKeyPair(mockReq, resMock);
      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.json).toHaveBeenCalledWith({
        protectedRecoveryKey:
          'formatP003-argon2id13-2-67108864-zEKFVGhj2yE9QZ2LvtyrBw==-6KmHqbc57XTfXta4l2dJmQ==-mhuPOE2IwAZNeVu8nQqrQjiq8g26k094nV1TeESDiFA=-encryptedKeyPair',
      });
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      await cleanDatabase();
      await addTestBanks();
      await addTestUsers();
      await addTestDevices();
    });

    it('should return 400 on unexpected error', async () => {
      const u = testUsers[0];
      mockCheckDeviceAuthSuccess(u.id);
      jest.spyOn(db, 'query').mockRejectedValueOnce(new Error('DB error'));
      const mockReq = {
        body: {
          userEmail: u.email,
          passwordChallengeResponse: 'tpBemQ9uM50tZ4Wfi4SvxreavkSFEA2oPipE47+TtC4=',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await getRecoveryKeyPair(mockReq, resMock);
      expect(resMock.status).toHaveBeenCalledWith(400);
      expect(resMock.end).toHaveBeenCalled();
    });
  });
});
