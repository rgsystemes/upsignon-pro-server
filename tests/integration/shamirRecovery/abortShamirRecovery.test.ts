import { beforeEach, describe, it, jest, expect } from '@jest/globals';
import { abortShamirRecovery } from '../../../src/api2/routes/shamirRecovery/abortShamirRecovery';
import { cleanDatabase } from '../../setup/testHelpers';
import { Request, Response } from 'express';
import { addTestUsers, testUsers } from '../../fixtures/users';
import { addTestBanks } from '../../fixtures/banks';
import { addTestDevices, deviceForUser } from '../../fixtures/userDevices';
import { addTestShamirConfigs, config1Approved } from '../../fixtures/shamirConfigs';
import { addTestShamirHolders, holdersConfig1 } from '../../fixtures/shamirHolders';

jest.mock('../../../src/api2/helpers/authorizationChecks', () => ({
  checkDeviceAuth: jest.fn(),
}));
jest.mock('../../../src/helpers/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));
jest.mock('../../../src/emails/shamir/sendShamirRecoveryRequestCancelled', () => ({
  sendShamirRecoveryRequestCancelledToTrustedPersons: jest.fn(),
}));

import { checkDeviceAuth } from '../../../src/api2/helpers/authorizationChecks';
import { db } from '../../../src/helpers/db';
import {
  addTestShamirRecoveryRequests,
  pendingRecoveryRequest2,
} from '../../fixtures/shamirRecoveryRequests';
import { addTestShamirShares } from '../../fixtures/shamirShares';
import { sendShamirRecoveryRequestCancelledToTrustedPersons } from '../../../src/emails/shamir/sendShamirRecoveryRequestCancelled';

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
    vaultEmail: 'mocked@testbank.com',
  });
};

describe('abortShamirRecovery', () => {
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
        headers: {
          'accept-language': 'fr',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await abortShamirRecovery(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(401);
      expect(resMock.json).toHaveBeenCalledWith({ error: 'badDeviceSession' });
      expect(sendShamirRecoveryRequestCancelledToTrustedPersons).not.toHaveBeenCalled();
    });
  });

  describe('abort recovery request', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      await cleanDatabase();
      await addTestBanks();
      await addTestUsers();
      await addTestDevices();
      await addTestShamirConfigs([config1Approved]);
      await addTestShamirHolders(holdersConfig1);
    });

    it('should successfully abort pending recovery request', async () => {
      const u = testUsers[1];
      mockCheckDeviceAuthSuccess(u.id);

      await addTestShamirRecoveryRequests([{ ...pendingRecoveryRequest2, shamir_config_id: 1 }]);

      const mockReq = {
        body: {
          userEmail: u.email,
        },
        headers: {
          'accept-language': 'fr',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await abortShamirRecovery(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.end).toHaveBeenCalled();

      const requests = await db.query(
        'SELECT * FROM shamir_recovery_requests WHERE vault_id = $1',
        [u.id],
      );

      expect(requests.rows).toHaveLength(1);
      expect(requests.rows[0].status).toBe('ABORTED');
      expect(sendShamirRecoveryRequestCancelledToTrustedPersons).toHaveBeenCalledWith({
        vaultEmail: 'mocked@testbank.com',
        trustedPersonEmails: ['user1@testbank1.com'],
        supportEmail: 'support@testbank1.com',
        acceptLanguage: 'fr',
      });
    });

    it('should clear open shares when aborting recovery', async () => {
      const u = testUsers[0];
      const d = deviceForUser(u.id);
      mockCheckDeviceAuthSuccess(u.id);

      await addTestShamirRecoveryRequests([
        {
          id: 1,
          vault_id: u.id,
          creator_device_id: d.id,
          public_key: 'tempPublicKey1ForRecovery',
          protected_recovery_key_pair:
            'formatP003-argon2id13-2-67108864-zEKFVGhj2yE9QZ2LvtyrBw==-6KmHqbc57XTfXta4l2dJmQ==-mhuPOE2IwAZNeVu8nQqrQjiq8g26k094nV1TeESDiFA=-encryptedKeyPair',
          shamir_config_id: 1,
          created_at: new Date('2024-01-10T10:00:00Z'),
          completed_at: null,
          status: 'PENDING',
          expiry_date: new Date('2024-01-17T10:00:00Z'),
          denied_by: [],
        },
      ]);
      await addTestShamirShares([
        {
          vault_id: 1,
          holder_vault_id: 1,
          shamir_config_id: 1,
          closed_shares: ['encryptedShare1ForHolder1'],
          open_shares: ['openShare1ForHolder1'],
          created_at: new Date('2023-02-10T10:30:00Z'),
          open_at: null,
        },
      ]);

      const mockReq = {
        body: {
          userEmail: u.email,
        },
        headers: {
          'accept-language': 'fr',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await abortShamirRecovery(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.end).toHaveBeenCalled();

      const shares = await db.query('SELECT * FROM shamir_shares WHERE vault_id = $1', [u.id]);

      expect(shares.rows).toHaveLength(1);
      expect(shares.rows[0].open_shares).toBeNull();
      expect(shares.rows[0].open_at).toBeNull();
    });

    it('should only abort pending requests, not completed ones', async () => {
      const u = testUsers[0];
      const d = deviceForUser(u.id);
      mockCheckDeviceAuthSuccess(u.id);

      await addTestShamirRecoveryRequests([
        {
          id: 1,
          vault_id: u.id,
          creator_device_id: d.id,
          public_key: 'tempPublicKey1ForRecovery',
          protected_recovery_key_pair: '',
          shamir_config_id: 1,
          created_at: new Date('2024-01-10T10:00:00Z'),
          completed_at: null,
          status: 'COMPLETED',
          expiry_date: new Date('2024-01-17T10:00:00Z'),
          denied_by: [],
        },
        {
          id: 2,
          vault_id: u.id,
          creator_device_id: d.id,
          public_key: 'tempPublicKey1ForRecovery2',
          protected_recovery_key_pair: '',
          shamir_config_id: 1,
          created_at: new Date('2024-02-10T10:00:00Z'),
          completed_at: null,
          status: 'PENDING',
          expiry_date: new Date('2024-02-17T10:00:00Z'),
          denied_by: [],
        },
      ]);

      const mockReq = {
        body: {
          userEmail: u.email,
        },
        headers: {
          'accept-language': 'fr',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await abortShamirRecovery(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.end).toHaveBeenCalled();

      const requests = await db.query(
        'SELECT * FROM shamir_recovery_requests WHERE vault_id = $1 ORDER BY status',
        [u.id],
      );

      expect(requests.rows).toHaveLength(2);
      expect(requests.rows[0].status).toBe('ABORTED');
      expect(requests.rows[1].status).toBe('COMPLETED');
      expect(sendShamirRecoveryRequestCancelledToTrustedPersons).toHaveBeenCalledTimes(1);
    });

    it('should handle aborting when no pending requests exist', async () => {
      const u = testUsers[0];
      mockCheckDeviceAuthSuccess(u.id);

      const mockReq = {
        body: {
          userEmail: u.email,
        },
        headers: {
          'accept-language': 'fr',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await abortShamirRecovery(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.end).toHaveBeenCalled();
      expect(sendShamirRecoveryRequestCancelledToTrustedPersons).not.toHaveBeenCalled();
    });
  });
});
