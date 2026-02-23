import { beforeEach, describe, it, jest, expect } from '@jest/globals';
import { upsertShamirBackup } from '../../../src/api2/routes/shamirRecovery/upsertShamirBackup';
import { cleanDatabase } from '../../setup/testHelpers';
import { Request, Response } from 'express';
import { addTestUsers, testUsers } from '../../fixtures/users';
import { addTestBanks, testBanks } from '../../fixtures/banks';
import { addTestDevices, deviceForUser } from '../../fixtures/userDevices';
import {
  addTestShamirConfigs,
  config1Approved,
  config2Approved,
  config3Pending,
} from '../../fixtures/shamirConfigs';

jest.mock('../../../src/api2/helpers/authorizationChecks', () => ({
  checkBasicAuth2: jest.fn(),
}));
jest.mock('../../../src/helpers/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

import { checkBasicAuth2 } from '../../../src/api2/helpers/authorizationChecks';
import { db } from '../../../src/helpers/db';
import { addTestShamirShares, sharesConfig1, sharesConfig2 } from '../../fixtures/shamirShares';
import {
  addTestShamirHolders,
  holdersConfig1,
  holdersConfig2,
  holdersConfig3,
} from '../../fixtures/shamirHolders';
import {
  addTestShamirRecoveryRequests,
  pendingRecoveryRequest1,
  pendingRecoveryRequest2,
} from '../../fixtures/shamirRecoveryRequests';

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
  (checkBasicAuth2 as jest.Mock<any>).mockResolvedValue({
    granted: true,
    userId,
    bankIds: {
      publicId: b.public_id,
      internalId: b.id,
      usesDeprecatedIntId: false,
    },
  });
};

describe('upsertShamirBackup', () => {
  describe('body validations', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      await cleanDatabase();
      await addTestBanks();
      await addTestUsers();
      await addTestDevices();
    });

    it('should reject request with invalid shamirConfigId type', async () => {
      const u = testUsers[0];
      const d = deviceForUser(u.id);
      mockCheckBasicAuth2Success(u.id);

      const mockReq = {
        body: {
          userEmail: u.email,
          deviceId: d.device_unique_id,
          deviceSession: 'any-session',
          shamirConfigId: 'not-a-number',
          holderShares: [{ holderId: 1, closedShares: ['share1'] }],
        },
      } as unknown as Request;
      const resMock = mockRes();
      await upsertShamirBackup(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(403);
      expect(resMock.end).toHaveBeenCalled();
    });

    it('should reject request with missing userEmail', async () => {
      const u = testUsers[0];
      const d = deviceForUser(u.id);
      mockCheckBasicAuth2Success(u.id);

      const mockReq = {
        body: {
          deviceId: d.device_unique_id,
          deviceSession: 'any-session',
          shamirConfigId: 1,
          holderShares: [{ holderId: 1, closedShares: ['share1'] }],
        },
      } as unknown as Request;
      const resMock = mockRes();
      await upsertShamirBackup(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(403);
      expect(resMock.end).toHaveBeenCalled();
    });

    it('should reject request with missing deviceSession', async () => {
      const u = testUsers[0];
      const d = deviceForUser(u.id);
      mockCheckBasicAuth2Success(u.id);

      const mockReq = {
        body: {
          userEmail: u.email,
          deviceId: d.device_unique_id,
          shamirConfigId: 1,
          holderShares: [{ holderId: 1, closedShares: ['share1'] }],
        },
      } as unknown as Request;
      const resMock = mockRes();
      await upsertShamirBackup(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(403);
      expect(resMock.end).toHaveBeenCalled();
    });

    it('should reject request with missing holderShares', async () => {
      const u = testUsers[0];
      const d = deviceForUser(u.id);
      mockCheckBasicAuth2Success(u.id);

      const mockReq = {
        body: {
          userEmail: u.email,
          deviceId: d.device_unique_id,
          deviceSession: 'any-session',
          shamirConfigId: 1,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await upsertShamirBackup(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(403);
      expect(resMock.end).toHaveBeenCalled();
    });

    it('should reject request with invalid holderShares structure', async () => {
      const u = testUsers[0];
      const d = deviceForUser(u.id);
      mockCheckBasicAuth2Success(u.id);

      const mockReq = {
        body: {
          userEmail: u.email,
          deviceId: d.device_unique_id,
          deviceSession: 'any-session',
          shamirConfigId: 1,
          holderShares: [{ holderId: 1 }],
        },
      } as unknown as Request;
      const resMock = mockRes();
      await upsertShamirBackup(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(403);
      expect(resMock.end).toHaveBeenCalled();
    });
  });

  describe('security validations', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      await cleanDatabase();
      await addTestBanks();
      await addTestUsers();
      await addTestDevices();
      await addTestShamirConfigs([config1Approved]);
    });

    it('should reject if number of closedShares does not match nb_shares', async () => {
      const u = testUsers[0];
      const d = deviceForUser(u.id);
      mockCheckBasicAuth2Success(u.id);

      await addTestShamirShares(sharesConfig1);
      await addTestShamirHolders([
        {
          id: 1,
          vault_id: 1,
          shamir_config_id: 1,
          nb_shares: 2,
          created_at: new Date('2023-02-10T10:00:00Z'),
        },
      ]);

      const mockReq = {
        body: {
          userEmail: u.email,
          deviceId: d.device_unique_id,
          deviceSession: 'any-session',
          shamirConfigId: 1,
          holderShares: [{ holderId: testUsers[0].id, closedShares: ['share1'] }],
        },
      } as unknown as Request;
      const resMock = mockRes();
      await upsertShamirBackup(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(403);
      expect(resMock.json).toHaveBeenCalledWith({ error: 'backup_creation_failed' });
    });

    it('should reject if holder does not exist in shamir_holders', async () => {
      const u = testUsers[0];
      const d = deviceForUser(u.id);
      mockCheckBasicAuth2Success(u.id);

      const mockReq = {
        body: {
          userEmail: u.email,
          deviceId: d.device_unique_id,
          deviceSession: 'any-session',
          shamirConfigId: 1,
          holderShares: [{ holderId: 999, closedShares: ['share1'] }],
        },
      } as unknown as Request;
      const resMock = mockRes();
      await upsertShamirBackup(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(403);
      expect(resMock.json).toHaveBeenCalledWith({ error: 'backup_creation_failed' });
    });
  });

  describe('backup creation and update', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      await cleanDatabase();
      await addTestBanks();
      await addTestUsers();
      await addTestDevices();
      await addTestShamirConfigs([config1Approved, config2Approved, config3Pending]);
    });

    it('should successfully create a new backup', async () => {
      const u = testUsers[0];
      const d = deviceForUser(u.id);
      mockCheckBasicAuth2Success(u.id);

      await addTestShamirHolders(holdersConfig1);

      const mockReq = {
        body: {
          userEmail: u.email,
          deviceId: d.device_unique_id,
          deviceSession: 'any-session',
          shamirConfigId: 1,
          holderShares: [
            { holderId: testUsers[0].id, closedShares: ['share1'] },
            { holderId: testUsers[1].id, closedShares: ['share2', 'share3'] },
          ],
        },
      } as unknown as Request;
      const resMock = mockRes();
      await upsertShamirBackup(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.end).toHaveBeenCalled();

      const shares = await db.query(
        'SELECT * FROM shamir_shares WHERE vault_id = $1 AND shamir_config_id = $2 ORDER BY holder_vault_id',
        [u.id, 1],
      );

      expect(shares.rows).toHaveLength(2);
      expect(shares.rows[0].holder_vault_id).toBe(testUsers[0].id);
      expect(shares.rows[0].closed_shares).toEqual(['share1']);
      expect(shares.rows[1].holder_vault_id).toBe(testUsers[1].id);
      expect(shares.rows[1].closed_shares).toEqual(['share2', 'share3']);
    });

    it('should replace existing backup when upserting', async () => {
      const u = testUsers[0];
      const d = deviceForUser(u.id);
      mockCheckBasicAuth2Success(u.id);

      await addTestShamirHolders(holdersConfig1);

      await db.query(
        'INSERT INTO shamir_shares (vault_id, holder_vault_id, shamir_config_id, closed_shares) VALUES ($1, $2, $3, $4)',
        [u.id, testUsers[0].id, 1, ['old-share']],
      );

      const mockReq = {
        body: {
          userEmail: u.email,
          deviceId: d.device_unique_id,
          deviceSession: 'any-session',
          shamirConfigId: 1,
          holderShares: [{ holderId: testUsers[0].id, closedShares: ['new-share'] }],
        },
      } as unknown as Request;
      const resMock = mockRes();
      await upsertShamirBackup(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.end).toHaveBeenCalled();

      const shares = await db.query('SELECT * FROM shamir_shares WHERE vault_id = $1', [u.id]);

      expect(shares.rows).toHaveLength(1);
      expect(shares.rows[0].closed_shares).toEqual(['new-share']);
    });

    it('should abort pending recovery requests when creating backup', async () => {
      const u = testUsers[0];
      const d = deviceForUser(u.id);
      mockCheckBasicAuth2Success(u.id);

      await addTestShamirHolders(holdersConfig2);

      await addTestShamirRecoveryRequests([pendingRecoveryRequest1]);

      const mockReq = {
        body: {
          userEmail: u.email,
          deviceId: d.device_unique_id,
          deviceSession: 'any-session',
          shamirConfigId: 2,
          holderShares: [
            { holderId: testUsers[0].id, closedShares: ['share1'] },
            { holderId: testUsers[1].id, closedShares: ['share2'] },
            { holderId: testUsers[3].id, closedShares: ['share4'] },
            { holderId: testUsers[4].id, closedShares: ['share5'] },
          ],
        },
      } as unknown as Request;
      const resMock = mockRes();
      await upsertShamirBackup(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.end).toHaveBeenCalled();

      const requests = await db.query(
        'SELECT * FROM shamir_recovery_requests WHERE vault_id = $1',
        [u.id],
      );

      expect(requests.rows).toHaveLength(1);
      expect(requests.rows[0].status).toBe('ABORTED');
    });

    it('should not abort recovery requests for different configs', async () => {
      const u = testUsers[0];
      const d = deviceForUser(u.id);
      mockCheckBasicAuth2Success(u.id);

      await addTestShamirHolders([...holdersConfig1, ...holdersConfig2, ...holdersConfig3]);

      await addTestShamirRecoveryRequests([
        {
          id: 1,
          vault_id: 1,
          public_key: 'tempPublicKey1ForRecovery',
          protected_private_key: '',
          shamir_config_id: 2,
          created_at: new Date('2024-01-10T10:00:00Z'),
          completed_at: null,
          status: 'PENDING',
          expiry_date: new Date('2024-01-17T10:00:00Z'),
          denied_by: [],
        },
        {
          id: 2,
          vault_id: 1,
          public_key: 'tempPublicKey2ForRecovery',
          protected_private_key: '',
          shamir_config_id: 3,
          created_at: new Date('2024-01-12T14:30:00Z'),
          completed_at: null,
          status: 'PENDING',
          expiry_date: new Date('2024-01-19T14:30:00Z'),
          denied_by: [],
        },
      ]);

      const mockReq = {
        body: {
          userEmail: u.email,
          deviceId: d.device_unique_id,
          deviceSession: 'any-session',
          shamirConfigId: 2,
          holderShares: [{ holderId: testUsers[0].id, closedShares: ['share1'] }],
        },
      } as unknown as Request;
      const resMock = mockRes();
      await upsertShamirBackup(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.end).toHaveBeenCalled();

      const requests = await db.query(
        'SELECT * FROM shamir_recovery_requests WHERE vault_id = $1 ORDER BY shamir_config_id',
        [u.id],
      );

      expect(requests.rows).toHaveLength(2);
      expect(requests.rows[0].status).toBe('ABORTED');
      expect(requests.rows[1].status).toBe('PENDING');
    });

    it('should handle multiple holders with multiple shares each', async () => {
      const u = testUsers[0];
      const d = deviceForUser(u.id);
      mockCheckBasicAuth2Success(u.id);

      await addTestShamirHolders([
        { id: 1, vault_id: testUsers[0].id, shamir_config_id: 2, nb_shares: 3 },
        { id: 2, vault_id: testUsers[1].id, shamir_config_id: 2, nb_shares: 2 },
        { id: 3, vault_id: testUsers[2].id, shamir_config_id: 2, nb_shares: 1 },
      ]);

      const mockReq = {
        body: {
          userEmail: u.email,
          deviceId: d.device_unique_id,
          deviceSession: 'any-session',
          shamirConfigId: 2,
          holderShares: [
            { holderId: testUsers[0].id, closedShares: ['s1', 's2', 's3'] },
            { holderId: testUsers[1].id, closedShares: ['s4', 's5'] },
            { holderId: testUsers[2].id, closedShares: ['s6'] },
          ],
        },
      } as unknown as Request;
      const resMock = mockRes();
      await upsertShamirBackup(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.end).toHaveBeenCalled();

      const shares = await db.query(
        'SELECT * FROM shamir_shares WHERE vault_id = $1 AND shamir_config_id = $2 ORDER BY holder_vault_id',
        [u.id, 2],
      );

      expect(shares.rows).toHaveLength(3);
      expect(shares.rows[0].closed_shares).toEqual(['s1', 's2', 's3']);
      expect(shares.rows[1].closed_shares).toEqual(['s4', 's5']);
      expect(shares.rows[2].closed_shares).toEqual(['s6']);
    });
  });
});
