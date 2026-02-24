import { beforeEach, describe, it, jest, expect } from '@jest/globals';
import { denyShamirRequestApproval } from '../../../src/api2/routes/shamirRecovery/denyShamirRequestApproval';
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

describe('denyShamirRequestApproval', () => {
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
        },
      } as unknown as Request;
      const resMock = mockRes();
      await denyShamirRequestApproval(mockReq, resMock);

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
      await denyShamirRequestApproval(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(403);
      expect(resMock.end).toHaveBeenCalled();
    });
  });

  describe('deny recovery request', () => {
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

    it('should successfully deny pending recovery request', async () => {
      const holder = testUsers[1];
      const requestingUser = testUsers[0];
      const requestingDevice = deviceForUser(requestingUser.id);
      mockCheckBasicAuth2Success(holder.id);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      await addTestShamirRecoveryRequests([
        {
          id: 1,
          device_id: requestingDevice.id,
          public_key: 'tempPublicKey1ForRecovery',
          shamir_config_id: 2,
          created_at: new Date(),
          completed_at: null,
          status: 'PENDING',
          expiry_date: futureDate,
          denied_by: [],
        },
      ]);

      const mockReq = {
        body: {
          userEmail: holder.email,
          deviceSession: 'session2',
          deviceId: deviceForUser(holder.id).device_unique_id,
          targetVaultId: requestingUser.id,
          shamirConfigId: 2,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await denyShamirRequestApproval(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.end).toHaveBeenCalled();

      const requests = await db.query(
        'SELECT denied_by FROM shamir_recovery_requests WHERE id = $1',
        [1],
      );

      expect(requests.rows).toHaveLength(1);
      expect(requests.rows[0].denied_by).toContain(holder.id);
      expect(requests.rows[0].denied_by).toHaveLength(1);
    });

    it('should not deny request twice from same holder', async () => {
      const holder = testUsers[1];
      const requestingUser = testUsers[0];
      const requestingDevice = deviceForUser(requestingUser.id);
      mockCheckBasicAuth2Success(holder.id);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      await addTestShamirRecoveryRequests([
        {
          id: 1,
          device_id: requestingDevice.id,
          public_key: 'tempPublicKey1ForRecovery',
          shamir_config_id: 2,
          created_at: new Date(),
          completed_at: null,
          status: 'PENDING',
          expiry_date: futureDate,
          denied_by: [holder.id],
        },
      ]);

      const mockReq = {
        body: {
          userEmail: holder.email,
          deviceSession: 'session2',
          deviceId: deviceForUser(holder.id).device_unique_id,
          targetVaultId: requestingUser.id,
          shamirConfigId: 2,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await denyShamirRequestApproval(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.end).toHaveBeenCalled();

      const requests = await db.query(
        'SELECT denied_by FROM shamir_recovery_requests WHERE id = $1',
        [1],
      );

      expect(requests.rows).toHaveLength(1);
      expect(requests.rows[0].denied_by).toHaveLength(1);
    });

    it('should not deny completed recovery request', async () => {
      const holder = testUsers[1];
      const requestingUser = testUsers[0];
      const requestingDevice = deviceForUser(requestingUser.id);
      mockCheckBasicAuth2Success(holder.id);

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      await addTestShamirRecoveryRequests([
        {
          id: 1,
          device_id: requestingDevice.id,
          public_key: 'tempPublicKey1ForRecovery',
          shamir_config_id: 2,
          created_at: pastDate,
          completed_at: pastDate,
          status: 'COMPLETED',
          expiry_date: futureDate,
          denied_by: [],
        },
      ]);

      const mockReq = {
        body: {
          userEmail: holder.email,
          deviceSession: 'session2',
          deviceId: deviceForUser(holder.id).device_unique_id,
          targetVaultId: requestingUser.id,
          shamirConfigId: 2,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await denyShamirRequestApproval(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.end).toHaveBeenCalled();

      const requests = await db.query(
        'SELECT denied_by FROM shamir_recovery_requests WHERE id = $1',
        [1],
      );

      expect(requests.rows).toHaveLength(1);
      expect(requests.rows[0].denied_by).toHaveLength(0);
    });

    it('should not deny expired recovery request', async () => {
      const holder = testUsers[1];
      const requestingUser = testUsers[0];
      const requestingDevice = deviceForUser(requestingUser.id);
      mockCheckBasicAuth2Success(holder.id);

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      await addTestShamirRecoveryRequests([
        {
          id: 1,
          device_id: requestingDevice.id,
          public_key: 'tempPublicKey1ForRecovery',
          shamir_config_id: 2,
          created_at: pastDate,
          completed_at: null,
          status: 'PENDING',
          expiry_date: pastDate,
          denied_by: [],
        },
      ]);

      const mockReq = {
        body: {
          userEmail: holder.email,
          deviceSession: 'session2',
          deviceId: deviceForUser(holder.id).device_unique_id,
          targetVaultId: requestingUser.id,
          shamirConfigId: 2,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await denyShamirRequestApproval(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.end).toHaveBeenCalled();

      const requests = await db.query(
        'SELECT denied_by FROM shamir_recovery_requests WHERE id = $1',
        [1],
      );

      expect(requests.rows).toHaveLength(1);
      expect(requests.rows[0].denied_by).toHaveLength(0);
    });

    it('should not deny if user is not a holder for this vault', async () => {
      const nonHolder = testUsers[2];
      const requestingUser = testUsers[0];
      const requestingDevice = deviceForUser(requestingUser.id);
      mockCheckBasicAuth2Success(nonHolder.id);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      await addTestShamirRecoveryRequests([
        {
          id: 1,
          device_id: requestingDevice.id,
          public_key: 'tempPublicKey1ForRecovery',
          shamir_config_id: 2,
          created_at: new Date(),
          completed_at: null,
          status: 'PENDING',
          expiry_date: futureDate,
          denied_by: [],
        },
      ]);

      const mockReq = {
        body: {
          userEmail: nonHolder.email,
          deviceSession: 'session4',
          deviceId: deviceForUser(nonHolder.id).device_unique_id,
          targetVaultId: requestingUser.id,
          shamirConfigId: 2,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await denyShamirRequestApproval(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.end).toHaveBeenCalled();

      const requests = await db.query(
        'SELECT denied_by FROM shamir_recovery_requests WHERE id = $1',
        [1],
      );

      expect(requests.rows).toHaveLength(1);
      expect(requests.rows[0].denied_by).toHaveLength(0);
    });

    it('should allow multiple different holders to deny the same request', async () => {
      const holder1 = testUsers[1];
      const holder2 = testUsers[3];
      const requestingUser = testUsers[0];
      const requestingDevice = deviceForUser(requestingUser.id);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      await addTestShamirRecoveryRequests([
        {
          id: 1,
          device_id: requestingDevice.id,
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
      const mockReq1 = {
        body: {
          userEmail: holder1.email,
          deviceSession: 'session2',
          deviceId: deviceForUser(holder1.id).device_unique_id,
          targetVaultId: requestingUser.id,
          shamirConfigId: 2,
        },
      } as unknown as Request;
      const resMock1 = mockRes();
      await denyShamirRequestApproval(mockReq1, resMock1);

      expect(resMock1.status).toHaveBeenCalledWith(200);

      mockCheckBasicAuth2Success(holder2.id);
      const mockReq2 = {
        body: {
          userEmail: holder2.email,
          deviceSession: 'session3',
          deviceId: deviceForUser(holder2.id).device_unique_id,
          targetVaultId: requestingUser.id,
          shamirConfigId: 2,
        },
      } as unknown as Request;
      const resMock2 = mockRes();
      await denyShamirRequestApproval(mockReq2, resMock2);

      expect(resMock2.status).toHaveBeenCalledWith(200);

      const requests = await db.query(
        'SELECT denied_by FROM shamir_recovery_requests WHERE id = $1',
        [1],
      );

      expect(requests.rows).toHaveLength(1);
      expect(requests.rows[0].denied_by).toHaveLength(2);
      expect(requests.rows[0].denied_by).toContain(holder1.id);
      expect(requests.rows[0].denied_by).toContain(holder2.id);
    });
  });
});
