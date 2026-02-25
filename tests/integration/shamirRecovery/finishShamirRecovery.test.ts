import { beforeEach, describe, it, jest, expect } from '@jest/globals';
import { finishShamirRecovery } from '../../../src/api2/routes/shamirRecovery/finishShamirRecovery';
import { cleanDatabase } from '../../setup/testHelpers';
import { Request, Response } from 'express';
import { addTestUsers, testUsers } from '../../fixtures/users';
import { addTestBanks, testBanks } from '../../fixtures/banks';
import { addTestDevices, deviceForUser } from '../../fixtures/userDevices';
import { addTestShamirConfigs, config1Approved } from '../../fixtures/shamirConfigs';

jest.mock('../../../src/api2/helpers/authorizationChecks', () => ({
  checkBasicAuth2: jest.fn(),
}));
jest.mock('../../../src/helpers/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

import { checkBasicAuth2 } from '../../../src/api2/helpers/authorizationChecks';
import { db } from '../../../src/helpers/db';
import { addTestShamirHolders, holdersConfig1 } from '../../fixtures/shamirHolders';
import { addTestShamirRecoveryRequests } from '../../fixtures/shamirRecoveryRequests';
import { addTestShamirShares } from '../../fixtures/shamirShares';

const mockRes = () => {
  return {
    status: jest.fn().mockReturnThis(),
    end: jest.fn(),
    json: jest.fn(),
  } as unknown as Response;
};

const mockCheckBasicAuth2Success = (userId: number) => {
  const bankId = testUsers.find((tu) => tu.id === userId)!.bank_id;
  const b = testBanks.find((tb) => tb.id === bankId)!;
  const d = deviceForUser(userId);
  (checkBasicAuth2 as jest.Mock<any>).mockResolvedValue({
    granted: true,
    userId,
    deviceId: d.id,
    bankIds: {
      publicId: b.public_id,
      internalId: b.id,
      usesDeprecatedIntId: false,
    },
  });
};

describe('finishShamirRecovery', () => {
  describe('authorization validations', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      await cleanDatabase();
      await addTestBanks();
      await addTestUsers();
      await addTestDevices();
    });

    it('should reject request with invalid auth', async () => {
      (checkBasicAuth2 as jest.Mock<any>).mockResolvedValue({
        granted: false,
      });

      const mockReq = {
        body: {
          userEmail: testUsers[0].email,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await finishShamirRecovery(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(401);
      expect(resMock.end).toHaveBeenCalled();
    });
  });

  describe('finish recovery request', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      await cleanDatabase();
      await addTestBanks();
      await addTestUsers();
      await addTestDevices();
      await addTestShamirConfigs([config1Approved]);
      await addTestShamirHolders(holdersConfig1);
    });

    it('should successfully complete pending recovery request', async () => {
      const u = testUsers[0];
      const d = deviceForUser(u.id);
      mockCheckBasicAuth2Success(u.id);

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

      const mockReq = {
        body: {
          userEmail: u.email,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await finishShamirRecovery(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.end).toHaveBeenCalled();

      const requests = await db.query(
        'SELECT * FROM shamir_recovery_requests WHERE vault_id = $1',
        [u.id],
      );

      expect(requests.rows).toHaveLength(1);
      expect(requests.rows[0].status).toBe('COMPLETED');
      expect(requests.rows[0].completed_at).not.toBeNull();
      expect(requests.rows[0].protected_recovery_key_pair).toBeNull();
    });

    it('should clear open shares when finishing recovery', async () => {
      const u = testUsers[0];
      const d = deviceForUser(u.id);
      mockCheckBasicAuth2Success(u.id);

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
          open_shares: ['openShareForHolder1'],
          created_at: new Date('2023-02-10T10:30:00Z'),
          open_at: null,
        },
      ]);

      const mockReq = {
        body: {
          userEmail: u.email,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await finishShamirRecovery(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.end).toHaveBeenCalled();

      const shares = await db.query('SELECT * FROM shamir_shares WHERE vault_id = $1', [u.id]);

      expect(shares.rows).toHaveLength(1);
      expect(shares.rows[0].open_shares).toBeNull();
    });

    it('should only complete pending requests, not already completed ones', async () => {
      const u = testUsers[0];
      const d = deviceForUser(u.id);
      mockCheckBasicAuth2Success(u.id);

      const initialCompletedAt = new Date('2024-01-11T10:00:00Z');
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
          completed_at: initialCompletedAt,
          status: 'COMPLETED',
          expiry_date: new Date('2024-01-17T10:00:00Z'),
          denied_by: [],
        },
      ]);

      const mockReq = {
        body: {
          userEmail: u.email,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await finishShamirRecovery(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.end).toHaveBeenCalled();

      const afterRequests = await db.query(
        'SELECT * FROM shamir_recovery_requests WHERE vault_id = $1',
        [u.id],
      );

      expect(afterRequests.rows).toHaveLength(1);
      expect(afterRequests.rows[0].status).toBe('COMPLETED');
      expect(afterRequests.rows[0].completed_at).toEqual(initialCompletedAt);
    });

    it('should handle finishing when no pending requests exist', async () => {
      const u = testUsers[0];
      mockCheckBasicAuth2Success(u.id);

      const mockReq = {
        body: {
          userEmail: u.email,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await finishShamirRecovery(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.end).toHaveBeenCalled();
    });
  });
});
