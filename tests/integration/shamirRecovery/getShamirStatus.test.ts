import { beforeEach, describe, it, jest, expect } from '@jest/globals';
import { getShamirStatus } from '../../../src/api2/routes/shamirRecovery/getShamirStatus';
import { cleanDatabase } from '../../setup/testHelpers';
import { Request, Response } from 'express';
import { addTestUsers, testUsers } from '../../fixtures/users';
import { addTestBanks } from '../../fixtures/banks';
import { addTestDevices, deviceForUser } from '../../fixtures/userDevices';
import {
  addTestShamirConfigs,
  config1Approved,
  config2Approved,
} from '../../fixtures/shamirConfigs';

jest.mock('../../../src/api2/helpers/authorizationChecks', () => ({
  checkDeviceAuth: jest.fn(),
}));
jest.mock('../../../src/helpers/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

import { checkDeviceAuth } from '../../../src/api2/helpers/authorizationChecks';
import { addTestShamirHolders, holdersConfig1, holdersConfig2 } from '../../fixtures/shamirHolders';
import { addTestShamirShares, sharesConfig2 } from '../../fixtures/shamirShares';
import {
  addTestShamirRecoveryRequests,
  deniedRecoveryRequest,
  pendingRecoveryRequest1,
} from '../../fixtures/shamirRecoveryRequests';

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

describe('getShamirStatus', () => {
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
        },
      } as unknown as Request;
      const resMock = mockRes();
      await getShamirStatus(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(401);
      expect(resMock.json).toHaveBeenCalledWith({ error: 'badDeviceSession' });
    });
  });

  describe('status retrieval', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      await cleanDatabase();
      await addTestBanks();
      await addTestUsers();
      await addTestDevices();
      await addTestShamirConfigs([config1Approved, config2Approved]);
    });

    it('should return not_setup when user has no shamir shares', async () => {
      const u = testUsers[0];
      mockCheckDeviceAuthSuccess(u.id);

      const mockReq = {
        body: {
          userEmail: u.email,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await getShamirStatus(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.json).toHaveBeenCalledWith({ status: 'not_setup' });
    });

    it('should return no_pending_recovery_request when no pending request exists', async () => {
      const u = testUsers[0];
      mockCheckDeviceAuthSuccess(u.id);

      await addTestShamirHolders([...holdersConfig1, ...holdersConfig2]);
      await addTestShamirShares(sharesConfig2);

      const mockReq = {
        body: {
          userEmail: u.email,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await getShamirStatus(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.json).toHaveBeenCalledWith({ status: 'no_pending_recovery_request' });
    });

    it('should return pending status when recovery request exists but not enough shares', async () => {
      const u = testUsers[0];
      mockCheckDeviceAuthSuccess(u.id);
      await addTestShamirHolders([...holdersConfig1, ...holdersConfig2]);
      await addTestShamirShares(sharesConfig2);
      await addTestShamirRecoveryRequests([pendingRecoveryRequest1]);

      const mockReq = {
        body: {
          userEmail: u.email,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await getShamirStatus(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      const jsonCall = (resMock.json as jest.Mock).mock.calls[0][0] as any;
      expect(jsonCall.status).toBe('pending');
      expect(jsonCall.supportEmail).toBe(config2Approved.support_email);
      expect(jsonCall.createdAt).toEqual(pendingRecoveryRequest1.created_at);
      expect(jsonCall.expiryDate).toEqual(pendingRecoveryRequest1.expiry_date);
    });

    it('should return refused status when recovery request is refused', async () => {
      const u = testUsers[0];
      mockCheckDeviceAuthSuccess(u.id);
      await addTestShamirHolders([...holdersConfig1, ...holdersConfig2]);
      await addTestShamirShares(sharesConfig2);
      await addTestShamirRecoveryRequests([deniedRecoveryRequest]);

      const mockReq = {
        body: {
          userEmail: u.email,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await getShamirStatus(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      const jsonCall = (resMock.json as jest.Mock).mock.calls[0][0] as any;
      expect(jsonCall.status).toBe('refused');
      expect(jsonCall.supportEmail).toBe(config2Approved.support_email);
    });

    it('should return ready status when enough shares are open', async () => {
      const u = testUsers[0];
      const d = deviceForUser(u.id);
      mockCheckDeviceAuthSuccess(u.id);

      await addTestShamirHolders([...holdersConfig1, ...holdersConfig2]);
      await addTestShamirShares([
        {
          vault_id: 1,
          holder_vault_id: 1,
          shamir_config_id: 2,
          closed_shares: ['encryptedShare1ForHolder1Config2'],
          open_shares: null,
          created_at: new Date('2023-03-01T15:00:00Z'),
          open_at: null,
        },
        {
          vault_id: 1,
          holder_vault_id: 2,
          shamir_config_id: 2,
          closed_shares: ['encryptedShare1ForHolder2Config2'],
          open_shares: ['openShare1ForHolder2Config2'],
          created_at: new Date('2023-03-01T15:00:00Z'),
          open_at: null,
        },
        {
          vault_id: 1,
          holder_vault_id: 4,
          shamir_config_id: 2,
          closed_shares: ['encryptedShare1ForHolder4Config2'],
          open_shares: ['openShare1ForHolder4Config2'],
          created_at: new Date('2023-03-01T15:00:00Z'),
          open_at: null,
        },
        {
          vault_id: 1,
          holder_vault_id: 5,
          shamir_config_id: 2,
          closed_shares: ['encryptedShare1ForHolder5Config2'],
          open_shares: ['openShare1ForHolder5Config2'],
          created_at: new Date('2023-03-01T15:00:00Z'),
          open_at: null,
        },
      ]);
      let threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      let threeDaysAgoPlusSevenDays = new Date(threeDaysAgo);
      threeDaysAgoPlusSevenDays.setDate(threeDaysAgoPlusSevenDays.getDate() + 7);
      await addTestShamirRecoveryRequests([
        {
          id: 1,
          vault_id: u.id,
          creator_device_id: d.id,
          public_key: 'tempPublicKey1ForRecovery',
          protected_recovery_key_pair:
            'formatP003-argon2id13-2-67108864-zEKFVGhj2yE9QZ2LvtyrBw==-6KmHqbc57XTfXta4l2dJmQ==-mhuPOE2IwAZNeVu8nQqrQjiq8g26k094nV1TeESDiFA=-encryptedKeyPair',
          shamir_config_id: 2,
          created_at: threeDaysAgo,
          completed_at: null,
          status: 'PENDING',
          expiry_date: threeDaysAgoPlusSevenDays,
          denied_by: [],
        },
      ]);

      const mockReq = {
        body: {
          userEmail: u.email,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await getShamirStatus(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      const jsonCall = (resMock.json as jest.Mock).mock.calls[0][0] as any;
      expect(jsonCall.status).toBe('ready');
      expect(jsonCall.openShares).toEqual([
        'openShare1ForHolder2Config2',
        'openShare1ForHolder4Config2',
        'openShare1ForHolder5Config2',
      ]);
      expect(jsonCall.supportEmail).toBe(config2Approved.support_email);
      expect(jsonCall.createdAt).toEqual(threeDaysAgo);
      expect(jsonCall.expiryDate).toEqual(threeDaysAgoPlusSevenDays);
    });

    it('should return the most recent pending recovery request', async () => {
      const u = testUsers[0];
      const d = deviceForUser(u.id);
      mockCheckDeviceAuthSuccess(u.id);

      await addTestShamirHolders([...holdersConfig1, ...holdersConfig2]);
      await addTestShamirShares(sharesConfig2);
      await addTestShamirRecoveryRequests([
        {
          id: 1,
          vault_id: 1,
          creator_device_id: d.id,
          public_key: 'tempPublicKey1ForRecovery',
          protected_recovery_key_pair:
            'formatP003-argon2id13-2-67108864-zEKFVGhj2yE9QZ2LvtyrBw==-6KmHqbc57XTfXta4l2dJmQ==-mhuPOE2IwAZNeVu8nQqrQjiq8g26k094nV1TeESDiFA=-encryptedKeyPair',
          shamir_config_id: 2,
          created_at: new Date('2024-01-05T16:00:00Z'),
          completed_at: null,
          status: 'PENDING',
          expiry_date: new Date('2024-01-12T16:00:00Z'),
          denied_by: [],
        },
        {
          id: 2,
          vault_id: 1,
          creator_device_id: d.id,
          public_key: 'tempPublicKey2ForRecovery',
          protected_recovery_key_pair:
            'formatP003-argon2id13-2-67108864-zEKFVGhj2yE9QZ2LvtyrBw==-6KmHqbc57XTfXta4l2dJmQ==-mhuPOE2IwAZNeVu8nQqrQjiq8g26k094nV1TeESDiFA=-encryptedKeyPair',
          shamir_config_id: 2,
          created_at: new Date('2024-01-06T16:00:00Z'),
          completed_at: null,
          status: 'PENDING',
          expiry_date: new Date('2024-01-13T16:00:00Z'),
          denied_by: [],
        },
      ]);

      const mockReq = {
        body: {
          userEmail: u.email,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await getShamirStatus(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      const jsonCall = (resMock.json as jest.Mock).mock.calls[0][0] as any;
      expect(jsonCall.createdAt).toEqual(new Date('2024-01-06T16:00:00Z'));
    });
  });
});
