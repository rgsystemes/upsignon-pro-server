import { beforeEach, describe, it, jest, expect } from '@jest/globals';
import { openShamirShares } from '../../../src/api2/routes/shamirRecovery/openShamirShares';
import { cleanDatabase } from '../../setup/testHelpers';
import { Request, Response } from 'express';
import { addTestUsers, testUsers } from '../../fixtures/users';
import { addTestBanks, testBanks } from '../../fixtures/banks';
import { addTestDevices, deviceForUser } from '../../fixtures/userDevices';
import { addTestShamirConfigs, config2Approved } from '../../fixtures/shamirConfigs';
import { addTestShamirHolders, holdersConfig2 } from '../../fixtures/shamirHolders';
import { addTestShamirShares, sharesConfig2 } from '../../fixtures/shamirShares';
import { addTestShamirRecoveryRequests } from '../../fixtures/shamirRecoveryRequests';

jest.mock('../../../src/api2/helpers/authorizationChecks', () => ({
  checkBasicAuth2: jest.fn(),
}));
jest.mock('../../../src/helpers/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

import { checkBasicAuth2 } from '../../../src/api2/helpers/authorizationChecks';
import { db } from '../../../src/helpers/db';

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

describe('openShamirShares', () => {
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
          deviceSession: 'session1',
          deviceId: 'devicePublicId1',
          targetVaultId: 1,
          shamirConfigId: 2,
          openShares: ['share1', 'share2'],
        },
      } as unknown as Request;
      const resMock = mockRes();
      await openShamirShares(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(401);
      expect(resMock.end).toHaveBeenCalled();
    });

    it('should reject request with invalid body', async () => {
      mockCheckBasicAuth2Success(testUsers[0].id);

      const mockReq = {
        body: {
          userEmail: testUsers[0].email,
          deviceSession: 'session1',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await openShamirShares(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(403);
      expect(resMock.end).toHaveBeenCalled();
    });
  });

  describe('open shamir shares', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      await cleanDatabase();
      await addTestBanks();
      await addTestUsers();
      await addTestDevices();
      await addTestShamirConfigs([config2Approved]);
      await addTestShamirHolders(holdersConfig2);
      await addTestShamirShares(sharesConfig2);
    });

    it('should successfully open shares for pending recovery request', async () => {
      const holder = testUsers[1];
      const requestingUser = testUsers[0];
      mockCheckBasicAuth2Success(holder.id);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      await addTestShamirRecoveryRequests([
        {
          id: 1,
          vault_id: requestingUser.id,
          public_key: 'tempPublicKey1ForRecovery',
          shamir_config_id: 2,
          created_at: new Date(),
          completed_at: null,
          status: 'PENDING',
          expiry_date: futureDate,
          denied_by: [],
        },
      ]);

      const openShares = ['openShare1', 'openShare2', 'openShare3'];
      const mockReq = {
        body: {
          userEmail: holder.email,
          deviceSession: 'session2',
          deviceId: deviceForUser(holder.id).device_unique_id,
          targetVaultId: requestingUser.id,
          shamirConfigId: 2,
          openShares,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await openShamirShares(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.end).toHaveBeenCalled();

      const shares = await db.query(
        'SELECT open_shares, open_at FROM shamir_shares WHERE vault_id = $1 AND holder_vault_id = $2 AND shamir_config_id = $3',
        [requestingUser.id, holder.id, 2],
      );

      expect(shares.rows).toHaveLength(1);
      expect(shares.rows[0].open_shares).toEqual(openShares);
      expect(shares.rows[0].open_at).not.toBeNull();
    });

    it('should reject if no pending recovery request exists', async () => {
      const holder = testUsers[1];
      const requestingUser = testUsers[0];
      mockCheckBasicAuth2Success(holder.id);

      const openShares = ['openShare1', 'openShare2', 'openShare3'];
      const mockReq = {
        body: {
          userEmail: holder.email,
          deviceSession: 'session2',
          deviceId: deviceForUser(holder.id).device_unique_id,
          targetVaultId: requestingUser.id,
          shamirConfigId: 2,
          openShares,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await openShamirShares(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(403);
      expect(resMock.json).toHaveBeenCalledWith({ error: 'no_pending_recovery_request' });
    });

    it('should reject if recovery request is expired', async () => {
      const holder = testUsers[1];
      const requestingUser = testUsers[0];
      mockCheckBasicAuth2Success(holder.id);

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      await addTestShamirRecoveryRequests([
        {
          id: 1,
          vault_id: requestingUser.id,
          public_key: 'tempPublicKey1ForRecovery',
          shamir_config_id: 2,
          created_at: pastDate,
          completed_at: null,
          status: 'PENDING',
          expiry_date: pastDate,
          denied_by: [],
        },
      ]);

      const openShares = ['openShare1', 'openShare2', 'openShare3'];
      const mockReq = {
        body: {
          userEmail: holder.email,
          deviceSession: 'session2',
          deviceId: deviceForUser(holder.id).device_unique_id,
          targetVaultId: requestingUser.id,
          shamirConfigId: 2,
          openShares,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await openShamirShares(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(403);
      expect(resMock.json).toHaveBeenCalledWith({ error: 'no_pending_recovery_request' });
    });

    it('should reject if recovery request is completed', async () => {
      const holder = testUsers[1];
      const requestingUser = testUsers[0];
      mockCheckBasicAuth2Success(holder.id);

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      await addTestShamirRecoveryRequests([
        {
          id: 1,
          vault_id: requestingUser.id,
          public_key: 'tempPublicKey1ForRecovery',
          shamir_config_id: 2,
          created_at: pastDate,
          completed_at: pastDate,
          status: 'COMPLETED',
          expiry_date: futureDate,
          denied_by: [],
        },
      ]);

      const openShares = ['openShare1', 'openShare2', 'openShare3'];
      const mockReq = {
        body: {
          userEmail: holder.email,
          deviceSession: 'session2',
          deviceId: deviceForUser(holder.id).device_unique_id,
          targetVaultId: requestingUser.id,
          shamirConfigId: 2,
          openShares,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await openShamirShares(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(403);
      expect(resMock.json).toHaveBeenCalledWith({ error: 'no_pending_recovery_request' });
    });

    it('should allow multiple holders to open shares for the same request', async () => {
      const holder1 = testUsers[1];
      const holder2 = testUsers[3];
      const requestingUser = testUsers[0];

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      await addTestShamirRecoveryRequests([
        {
          id: 1,
          vault_id: requestingUser.id,
          public_key: 'tempPublicKey1ForRecovery',
          shamir_config_id: 2,
          created_at: new Date(),
          completed_at: null,
          status: 'PENDING',
          expiry_date: futureDate,
          denied_by: [],
        },
      ]);

      mockCheckBasicAuth2Success(holder1.id);
      const openShares1 = ['openShare1', 'openShare2', 'openShare3'];
      const mockReq1 = {
        body: {
          userEmail: holder1.email,
          deviceSession: 'session2',
          deviceId: deviceForUser(holder1.id).device_unique_id,
          targetVaultId: requestingUser.id,
          shamirConfigId: 2,
          openShares: openShares1,
        },
      } as unknown as Request;
      const resMock1 = mockRes();
      await openShamirShares(mockReq1, resMock1);

      expect(resMock1.status).toHaveBeenCalledWith(200);

      mockCheckBasicAuth2Success(holder2.id);
      const openShares2 = ['openShare4', 'openShare5', 'openShare6'];
      const mockReq2 = {
        body: {
          userEmail: holder2.email,
          deviceSession: 'session3',
          deviceId: deviceForUser(holder2.id).device_unique_id,
          targetVaultId: requestingUser.id,
          shamirConfigId: 2,
          openShares: openShares2,
        },
      } as unknown as Request;
      const resMock2 = mockRes();
      await openShamirShares(mockReq2, resMock2);

      expect(resMock2.status).toHaveBeenCalledWith(200);

      const share1 = await db.query(
        'SELECT open_shares FROM shamir_shares WHERE vault_id = $1 AND holder_vault_id = $2 AND shamir_config_id = $3',
        [requestingUser.id, holder1.id, 2],
      );
      expect(share1.rows).toHaveLength(1);
      expect(share1.rows[0].open_shares).toEqual(openShares1);

      const share2 = await db.query(
        'SELECT open_shares FROM shamir_shares WHERE vault_id = $1 AND holder_vault_id = $2 AND shamir_config_id = $3',
        [requestingUser.id, holder2.id, 2],
      );
      expect(share2.rows).toHaveLength(1);
      expect(share2.rows[0].open_shares).toEqual(openShares2);
    });

    it('should update existing open shares if holder submits again', async () => {
      const holder = testUsers[1];
      const requestingUser = testUsers[0];
      mockCheckBasicAuth2Success(holder.id);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      await addTestShamirRecoveryRequests([
        {
          id: 1,
          vault_id: requestingUser.id,
          public_key: 'tempPublicKey1ForRecovery',
          shamir_config_id: 2,
          created_at: new Date(),
          completed_at: null,
          status: 'PENDING',
          expiry_date: futureDate,
          denied_by: [],
        },
      ]);

      const firstOpenShares = ['firstShare1', 'firstShare2'];
      const mockReq1 = {
        body: {
          userEmail: holder.email,
          deviceSession: 'session2',
          deviceId: deviceForUser(holder.id).device_unique_id,
          targetVaultId: requestingUser.id,
          shamirConfigId: 2,
          openShares: firstOpenShares,
        },
      } as unknown as Request;
      const resMock1 = mockRes();
      await openShamirShares(mockReq1, resMock1);

      expect(resMock1.status).toHaveBeenCalledWith(200);

      const secondOpenShares = ['secondShare1', 'secondShare2', 'secondShare3'];
      const mockReq2 = {
        body: {
          userEmail: holder.email,
          deviceSession: 'session2',
          deviceId: deviceForUser(holder.id).device_unique_id,
          targetVaultId: requestingUser.id,
          shamirConfigId: 2,
          openShares: secondOpenShares,
        },
      } as unknown as Request;
      const resMock2 = mockRes();
      await openShamirShares(mockReq2, resMock2);

      expect(resMock2.status).toHaveBeenCalledWith(200);

      const shares = await db.query(
        'SELECT open_shares FROM shamir_shares WHERE vault_id = $1 AND holder_vault_id = $2 AND shamir_config_id = $3',
        [requestingUser.id, holder.id, 2],
      );

      expect(shares.rows).toHaveLength(1);
      expect(shares.rows[0].open_shares).toEqual(secondOpenShares);
    });
  });
});
