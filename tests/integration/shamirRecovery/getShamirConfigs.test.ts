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
  EnhancedShamirConfig,
  rawConfig3Change,
  approvingSignaturesConfig3,
} from '../../fixtures/shamirConfigs';
import {
  holdersConfig1,
  holdersConfig2,
  holdersConfig3,
  addTestShamirHolders,
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
import { addTestShamirShares, sharesConfig1, sharesConfig2 } from '../../fixtures/shamirShares';

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
        headers: {
          'accept-language': 'fr',
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
        headers: {
          'accept-language': 'fr',
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
        headers: {
          'accept-language': 'fr',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await getShamirConfigs(mockReq, resMock);
      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.json).toHaveBeenCalledWith([]);
    });
    it('should return single configuration', async () => {
      await addTestShamirConfigs([config1Approved]);
      await addTestShamirHolders(holdersConfig1);
      mockCheckBasicAuth2Success(testUsers[0].id);
      const mockReq = {
        body: {
          userEmail: testUsers[0].email,
        },
        headers: {
          'accept-language': 'fr',
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
      });
    });
    it('should return multiple configurations ordered by creation date', async () => {
      await addTestShamirConfigs([config1Approved, config2Approved, config3Pending]);
      await addTestShamirHolders([...holdersConfig1, ...holdersConfig2, ...holdersConfig3]);
      mockCheckBasicAuth2Success(testUsers[0].id);
      const mockReq = {
        body: {
          userEmail: testUsers[0].email,
        },
        headers: {
          'accept-language': 'fr',
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
      const returnedConfig3 = jsonCall[2];
      expect(returnedConfig3).toMatchObject({
        id: 3,
        name: 'Shamir 3',
        minShares: 1,
        isActive: false,
        supportEmail: 'test@testbank1.com',
        bankPublicId: '6333b2b6-2598-4a31-a263-e1897b29d5f5',
        createdAt: new Date('2023-03-15T09:00:00Z'),
        change: rawConfig3Change,
        changeSignatures: [approvingSignaturesConfig3[1], approvingSignaturesConfig3[3]],
        holders: [
          {
            id: 1,
            sharingPublicKey: 'VO8BJSM+drNdlNm9AkAmQXg6/AHl+xDnskvrbdXilH4=',
            signingPublicKey: 'Oo9Do/g8Wak201deG8C902+a7VIEDzgZu6YFyuxqMCs=',
            nbShares: 1,
          },
          {
            id: 2,
            sharingPublicKey: '2CAhQVMbuRulJMyz7nsuNhXDt3kQjzGLOaCnm4v9YhU=',
            signingPublicKey: 'Arf/cbVfjXekFHgrJnpFf07xN8UFSjOjNDaZ/seWS1k=',
            nbShares: 1,
          },
          {
            id: 4,
            sharingPublicKey: 'y8cC9saI397Abt+kdPxx0zG8y4zpzA6JRA4XqAiW93A=',
            signingPublicKey: 'iFB2t1w6HfzUawFQDvvT6QvfDZm/gdVMhu7zLEi4kLs=',
            nbShares: 1,
          },
          {
            id: 5,
            sharingPublicKey: 'fZssSU/bDt+obMKJtqApdO6jbmy0azOtKGtr1H2+QX8=',
            signingPublicKey: 'Z1fm5BxZSXb6oW9zPVHbIgVQnHfWMKS6gf4I6kx4HAE=',
            nbShares: 1,
          },
        ],
        needsUpdate: false,
      });
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
      await addTestShamirHolders(holdersConfig1);
      mockCheckBasicAuth2Success(testUsers[0].id);
      const mockReq = {
        body: {
          userEmail: testUsers[0].email,
        },
        headers: {
          'accept-language': 'fr',
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
      await addTestShamirHolders(holdersConfig1);
      await addTestShamirShares(sharesConfig1);
      mockCheckBasicAuth2Success(testUsers[0].id);
      const mockReq = {
        body: {
          userEmail: testUsers[0].email,
        },
        headers: {
          'accept-language': 'fr',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await getShamirConfigs(mockReq, resMock);
      expect(resMock.status).toHaveBeenCalledWith(200);
      const jsonCall = (resMock.json as jest.Mock).mock.calls[0][0] as EnhancedShamirConfig[];
      expect(jsonCall[0].needsUpdate).toBe(false);
    });
    it('should set needsUpdate to false for inactive configs even when shares are missing', async () => {
      await addTestShamirConfigs([config1Approved]);
      await addTestShamirHolders(holdersConfig1);
      mockCheckBasicAuth2Success(testUsers[0].id);
      const mockReq = {
        body: {
          userEmail: testUsers[0].email,
        },
        headers: {
          'accept-language': 'fr',
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
      await addTestShamirHolders(holdersConfig2);
      await addTestShamirShares(sharesConfig2);
      mockCheckBasicAuth2Success(testUsers[0].id);
      const mockReq = {
        body: {
          userEmail: testUsers[0].email,
        },
        headers: {
          'accept-language': 'fr',
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
      await addTestShamirHolders([...holdersConfig1, ...holdersConfig2]);

      mockCheckBasicAuth2Success(testUsers[3].id);

      const mockReq = {
        body: {
          userEmail: testUsers[3].email,
        },
        headers: {
          'accept-language': 'fr',
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
        headers: {
          'accept-language': 'fr',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await getShamirConfigs(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(400);
      expect(resMock.end).toHaveBeenCalled();
    });
  });
});
