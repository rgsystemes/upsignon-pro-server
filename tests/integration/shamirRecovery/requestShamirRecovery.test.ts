import { beforeEach, describe, it, jest, expect } from '@jest/globals';
import { requestShamirRecovery } from '../../../src/api2/routes/shamirRecovery/requestShamirRecovery';
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
import { addTestShamirHolders, holdersConfig1 } from '../../fixtures/shamirHolders';
import { addTestShamirShares, sharesConfig1 } from '../../fixtures/shamirShares';
import { addTestShamirRecoveryRequests } from '../../fixtures/shamirRecoveryRequests';

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

describe('requestShamirRecovery', () => {
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
          publicKey: 'test-public-key',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await requestShamirRecovery(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(401);
      expect(resMock.end).toHaveBeenCalled();
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

    it('should reject request with missing publicKey', async () => {
      const u = testUsers[0];
      mockCheckDeviceAuthSuccess(u.id);
      const mockReq = {
        body: {
          userEmail: u.email,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await requestShamirRecovery(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(403);
      expect(resMock.end).toHaveBeenCalled();
    });

    it('should reject request with invalid publicKey type', async () => {
      const u = testUsers[0];
      mockCheckDeviceAuthSuccess(u.id);
      const mockReq = {
        body: {
          userEmail: u.email,
          publicKey: 123,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await requestShamirRecovery(mockReq, resMock);

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
    });

    it('should reject if a pending not expired recovery request already exists', async () => {
      const u = testUsers[0];
      mockCheckDeviceAuthSuccess(u.id);
      await addTestShamirConfigs([config1Approved]);
      await addTestShamirHolders(holdersConfig1);
      await addTestShamirShares(sharesConfig1);
      let threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      let threeDaysAgoPlusSevenDays = new Date(threeDaysAgo);
      threeDaysAgoPlusSevenDays.setDate(threeDaysAgoPlusSevenDays.getDate() + 7);
      await addTestShamirRecoveryRequests([
        {
          id: 1,
          vault_id: u.id,
          public_key: 'tempPublicKey1ForRecovery',
          shamir_config_id: 1,
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
          publicKey: 'new-public-key',
          protectedPrivateKey: 'protected-private-key',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await requestShamirRecovery(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(403);
      expect(resMock.json).toHaveBeenCalledWith({ error: 'shamir_recovery_already_pending' });
    });

    it('should reject if shamir config is not found', async () => {
      const u = testUsers[0];
      mockCheckDeviceAuthSuccess(u.id);

      const mockReq = {
        body: {
          userEmail: u.email,
          publicKey: 'test-public-key',
          protectedPrivateKey: 'protected-private-key',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await requestShamirRecovery(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(403);
      expect(resMock.json).toHaveBeenCalledWith({ error: 'shamir_config_not_found' });
    });
  });

  describe('recovery request creation', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      await cleanDatabase();
      await addTestBanks();
      await addTestUsers();
      await addTestDevices();
      await addTestShamirConfigs([config1Approved]);
      await addTestShamirHolders(holdersConfig1);
    });

    it('should successfully create a recovery request', async () => {
      const u = testUsers[0];
      mockCheckDeviceAuthSuccess(u.id);
      await addTestShamirShares(sharesConfig1);

      const mockReq = {
        body: {
          userEmail: u.email,
          publicKey: 'test-public-key',
          protectedPrivateKey: 'protected-private-key',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await requestShamirRecovery(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.end).toHaveBeenCalled();

      const requests = await db.query(
        'SELECT * FROM shamir_recovery_requests WHERE vault_id = $1',
        [u.id],
      );

      expect(requests.rows).toHaveLength(1);
      expect(requests.rows[0].status).toBe('PENDING');
      expect(requests.rows[0].public_key).toBe('test-public-key');
      expect(requests.rows[0].shamir_config_id).toBe(1);
    });

    it('should clear open shares when requesting recovery', async () => {
      const u = testUsers[0];
      mockCheckDeviceAuthSuccess(u.id);
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
          publicKey: 'test-public-key',
          protectedPrivateKey: 'protected-private-key',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await requestShamirRecovery(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.end).toHaveBeenCalled();

      const shares = await db.query('SELECT * FROM shamir_shares WHERE vault_id = $1', [u.id]);

      expect(shares.rows).toHaveLength(1);
      expect(shares.rows[0].open_shares).toBeNull();
    });

    it('should set expiry date to 7 days from now', async () => {
      const u = testUsers[0];
      mockCheckDeviceAuthSuccess(u.id);
      await addTestShamirShares(sharesConfig1);
      const beforeRequest = new Date();

      const mockReq = {
        body: {
          userEmail: u.email,
          publicKey: 'test-public-key',
          protectedPrivateKey: 'protected-private-key',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await requestShamirRecovery(mockReq, resMock);

      const afterRequest = new Date();

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.end).toHaveBeenCalled();

      const requests = await db.query(
        'SELECT * FROM shamir_recovery_requests WHERE vault_id = $1',
        [u.id],
      );

      expect(requests.rows).toHaveLength(1);
      const expiryDate = new Date(requests.rows[0].expiry_date);
      const expectedMinExpiry = new Date(beforeRequest.getTime() + 6.9 * 24 * 60 * 60 * 1000);
      const expectedMaxExpiry = new Date(afterRequest.getTime() + 7.1 * 24 * 60 * 60 * 1000);

      expect(expiryDate.getTime()).toBeGreaterThan(expectedMinExpiry.getTime());
      expect(expiryDate.getTime()).toBeLessThan(expectedMaxExpiry.getTime());
    });

    it('should allow new request if previous request expired', async () => {
      const u = testUsers[0];
      mockCheckDeviceAuthSuccess(u.id);
      await addTestShamirShares(sharesConfig1);
      let oneMonthBack = new Date();
      oneMonthBack.setMonth(oneMonthBack.getMonth() - 1);
      let oneMonthBackPlus7Days = new Date(oneMonthBack);
      oneMonthBackPlus7Days.setDate(oneMonthBackPlus7Days.getDate() + 7);

      await addTestShamirRecoveryRequests([
        {
          id: 1,
          vault_id: u.id,
          public_key: 'tempPublicKey1ForRecovery',
          shamir_config_id: 1,
          created_at: oneMonthBack,
          completed_at: null,
          status: 'PENDING',
          expiry_date: oneMonthBackPlus7Days,
          denied_by: [],
        },
      ]);

      const mockReq = {
        body: {
          userEmail: u.email,
          publicKey: 'new-public-key',
          protectedPrivateKey: 'protected-private-key',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await requestShamirRecovery(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.end).toHaveBeenCalled();

      const requests = await db.query(
        'SELECT * FROM shamir_recovery_requests WHERE vault_id = $1 ORDER BY expiry_date',
        [u.id],
      );

      expect(requests.rows).toHaveLength(2);
      expect(requests.rows[0].public_key).toBe('tempPublicKey1ForRecovery');
      expect(requests.rows[0].status).toBe('PENDING');
      expect(requests.rows[1].public_key).toBe('new-public-key');
      expect(requests.rows[1].protected_recovery_key_pair).toBe('protected-private-key');
      expect(requests.rows[1].status).toBe('PENDING');
    });
  });
});
