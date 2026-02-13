import { beforeEach, describe, it, jest, expect } from '@jest/globals';
import { getShamirConfigs } from '../../../src/api2/routes/shamirRecovery/getShamirConfigs';
import { cleanDatabase } from '../../setup/testHelpers';
import { Request, Response } from 'express';
import { addTestUsers, testUsers } from '../../fixtures/users';
import { addTestBanks, testBanks } from '../../fixtures/banks';
import { addTestDevices } from '../../fixtures/userDevices';
import {
  addTestShamirConfigs,
  config1Approved,
  config2Approved,
  config3Pending,
  approvingSignaturesConfig2,
  EnhancedShamirConfig,
} from '../../fixtures/shamirConfigs';
import {
  addShamirHoldersForConfig,
  holdersConfig1,
  holdersConfig2,
  holdersConfig3,
  addShamirHolders,
} from '../../fixtures/shamirHolders';

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

const mockCheckBasicAuth2Failure = () => {
  (checkBasicAuth2 as jest.Mock<any>).mockResolvedValue({
    granted: false,
  });
};

const addShamirShares = async (
  shamirConfigId: number,
  vaultId: number,
  holderVaultId: number,
  closedShares: string[] | null,
) => {
  await db.query(
    `INSERT INTO shamir_shares (shamir_config_id, vault_id, holder_vault_id, closed_shares)
    VALUES ($1, $2, $3, $4)`,
    [shamirConfigId, vaultId, holderVaultId, closedShares],
  );
};

describe('getShamirConfigs', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await cleanDatabase();
    await addTestBanks();
    await addTestUsers();
    await addTestDevices();
  });

  describe('authentication', () => {
    it('should reject request without authentication', async () => {
      mockCheckBasicAuth2Failure();

      const mockReq = {
        body: {
          userEmail: testUsers[0].email,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await getShamirConfigs(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(401);
      expect(resMock.end).toHaveBeenCalled();
    });

    it('should accept request with valid authentication', async () => {
      mockCheckBasicAuth2Success(testUsers[0].id);

      const mockReq = {
        body: {
          userEmail: testUsers[0].email,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await getShamirConfigs(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.json).toHaveBeenCalled();
    });
  });

  describe('retrieve configurations', () => {
    it('should return empty array when no configurations exist', async () => {
      mockCheckBasicAuth2Success(testUsers[0].id);

      const mockReq = {
        body: {
          userEmail: testUsers[0].email,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await getShamirConfigs(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.json).toHaveBeenCalledWith([]);
    });

    it('should return single configuration', async () => {
      await addTestShamirConfigs([config1Approved]);
      await addShamirHolders(holdersConfig1);

      mockCheckBasicAuth2Success(testUsers[0].id);

      const mockReq = {
        body: {
          userEmail: testUsers[0].email,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await getShamirConfigs(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      const jsonCall = (resMock.json as jest.Mock).mock.calls[0][0] as EnhancedShamirConfig[];
      expect(jsonCall).toHaveLength(1);
      expect(jsonCall[0]).toMatchObject({
        id: 1,
        name: 'Shamir 1',
        minShares: 1,
        isActive: false,
        supportEmail: 'support@testbank1.com',
        creatorEmail: 'admin@testbank1.com',
      });
    });

    it('should return multiple configurations ordered by creation date', async () => {
      await addTestShamirConfigs([config1Approved, config2Approved, config3Pending]);
      await addShamirHolders([...holdersConfig1, ...holdersConfig2, ...holdersConfig3]);

      mockCheckBasicAuth2Success(testUsers[0].id);

      const mockReq = {
        body: {
          userEmail: testUsers[0].email,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await getShamirConfigs(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      const jsonCall = (resMock.json as jest.Mock).mock.calls[0][0] as EnhancedShamirConfig[];
      expect(jsonCall).toHaveLength(3);
      expect(jsonCall[0].id).toBe(1);
      expect(jsonCall[1].id).toBe(2);
      expect(jsonCall[2].id).toBe(3);
    });

    it('should return correct holders information', async () => {
      await addTestShamirConfigs([config2Approved]);
      await addShamirHolders(holdersConfig2);

      mockCheckBasicAuth2Success(testUsers[0].id);

      const mockReq = {
        body: {
          userEmail: testUsers[0].email,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await getShamirConfigs(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      const jsonCall = (resMock.json as jest.Mock).mock.calls[0][0] as EnhancedShamirConfig[];
      expect(jsonCall[0].holders).toHaveLength(4);
      expect(jsonCall[0].holders[0]).toMatchObject({
        id: testUsers[0].id,
        email: testUsers[0].email,
        nbShares: 1,
      });
      expect(jsonCall[0].holders[0].sharingPublicKey).toBeTruthy();
      expect(jsonCall[0].holders[0].signingPublicKey).toBeTruthy();
    });

    it('should return change and changeSignatures', async () => {
      await addTestShamirConfigs([config1Approved, config2Approved]);
      await addShamirHolders([...holdersConfig1, ...holdersConfig2]);

      mockCheckBasicAuth2Success(testUsers[0].id);

      const mockReq = {
        body: {
          userEmail: testUsers[0].email,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await getShamirConfigs(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      const jsonCall = (resMock.json as jest.Mock).mock.calls[0][0] as EnhancedShamirConfig[];
      expect(jsonCall[0].change).toBeTruthy();
      expect(jsonCall[0].changeSignatures).toEqual([]);
      expect(jsonCall[1].change).toBeTruthy();
      expect(jsonCall[1].changeSignatures).toEqual(approvingSignaturesConfig2);
    });
  });

  describe('needsUpdate flag', () => {
    it('should set needsUpdate to true when no shares exist for active config', async () => {
      await addTestShamirConfigs([
        {
          ...config1Approved,
          is_active: true,
        },
      ]);
      await addShamirHolders(holdersConfig1);

      mockCheckBasicAuth2Success(testUsers[0].id);

      const mockReq = {
        body: {
          userEmail: testUsers[0].email,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await getShamirConfigs(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      const jsonCall = (resMock.json as jest.Mock).mock.calls[0][0] as EnhancedShamirConfig[];
      expect(jsonCall[0].needsUpdate).toBe(true);
    });

    it('should set needsUpdate to false when all shares are up to date for active config', async () => {
      await addTestShamirConfigs([
        {
          ...config1Approved,
          is_active: true,
        },
      ]);
      await addShamirHoldersForConfig(1, [{ vaultId: testUsers[0].id, nbShares: 2 }]);
      await addShamirShares(1, testUsers[0].id, testUsers[0].id, ['share1', 'share2']);

      mockCheckBasicAuth2Success(testUsers[0].id);

      const mockReq = {
        body: {
          userEmail: testUsers[0].email,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await getShamirConfigs(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      const jsonCall = (resMock.json as jest.Mock).mock.calls[0][0] as EnhancedShamirConfig[];
      expect(jsonCall[0].needsUpdate).toBe(false);
    });

    it('should set needsUpdate to true when number of shares is reduced', async () => {
      await addTestShamirConfigs([
        {
          ...config1Approved,
          is_active: true,
        },
      ]);
      await addShamirHoldersForConfig(1, [{ vaultId: testUsers[0].id, nbShares: 3 }]);
      await addShamirShares(1, testUsers[0].id, testUsers[0].id, ['share1', 'share2']);

      mockCheckBasicAuth2Success(testUsers[0].id);

      const mockReq = {
        body: {
          userEmail: testUsers[0].email,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await getShamirConfigs(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      const jsonCall = (resMock.json as jest.Mock).mock.calls[0][0] as EnhancedShamirConfig[];
      expect(jsonCall[0].needsUpdate).toBe(true);
    });

    it('should set needsUpdate to false for inactive configs even when shares are missing', async () => {
      await addTestShamirConfigs([config1Approved]);
      await addShamirHolders(holdersConfig1);

      mockCheckBasicAuth2Success(testUsers[0].id);

      const mockReq = {
        body: {
          userEmail: testUsers[0].email,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await getShamirConfigs(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      const jsonCall = (resMock.json as jest.Mock).mock.calls[0][0] as EnhancedShamirConfig[];
      expect(jsonCall[0].isActive).toBe(false);
      expect(jsonCall[0].needsUpdate).toBe(false);
    });

    it('should handle multiple users with different share status', async () => {
      await addTestShamirConfigs([
        {
          ...config2Approved,
          is_active: true,
        },
      ]);
      await addShamirHoldersForConfig(2, [
        { vaultId: testUsers[0].id, nbShares: 2 },
        { vaultId: testUsers[1].id, nbShares: 2 },
      ]);
      await addShamirShares(2, testUsers[0].id, testUsers[0].id, ['share1', 'share2']);
      await addShamirShares(2, testUsers[0].id, testUsers[1].id, ['share3', 'share4']);

      mockCheckBasicAuth2Success(testUsers[0].id);

      const mockReq = {
        body: {
          userEmail: testUsers[0].email,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await getShamirConfigs(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      const jsonCall = (resMock.json as jest.Mock).mock.calls[0][0] as EnhancedShamirConfig[];
      expect(jsonCall[0].needsUpdate).toBe(false);
    });
  });

  describe('user from different banks', () => {
    it('should only return configs for the user bank', async () => {
      await addTestShamirConfigs([config1Approved, config2Approved]);
      await addShamirHolders([...holdersConfig1, ...holdersConfig2]);

      mockCheckBasicAuth2Success(testUsers[3].id);

      const mockReq = {
        body: {
          userEmail: testUsers[3].email,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await getShamirConfigs(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      const jsonCall = (resMock.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockCheckBasicAuth2Success(testUsers[0].id);

      jest.spyOn(db, 'query').mockRejectedValueOnce(new Error('Database error'));

      const mockReq = {
        body: {
          userEmail: testUsers[0].email,
        },
      } as unknown as Request;
      const resMock = mockRes();
      await getShamirConfigs(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(400);
      expect(resMock.end).toHaveBeenCalled();
    });
  });
});
