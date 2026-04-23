import { beforeEach, describe, it, jest, expect } from '@jest/globals';
import { retrieveShamirConfigChangeToApprove } from '../../../src/api2/routes/shamirRecovery/retrieveShamirConfigChangeToApprove';
import { cleanDatabase } from '../../setup/testHelpers';
import { json, Request, Response } from 'express';
import { addTestUsers, testUsers } from '../../fixtures/users';
import { addTestBanks, testBanks } from '../../fixtures/banks';
import { addTestDevices } from '../../fixtures/userDevices';
import {
  addTestShamirConfigs,
  config1Approved,
  config2Approved,
  config3Pending,
} from '../../fixtures/shamirConfigs';
import {
  addTestShamirHolders,
  holdersConfig1,
  holdersConfig2,
  holdersConfig3,
} from '../../fixtures/shamirHolders';

jest.mock('../../../src/api2/helpers/authorizationChecks', () => ({
  checkBasicAuth2: jest.fn(),
}));
jest.mock('../../../src/helpers/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

import { checkBasicAuth2 } from '../../../src/api2/helpers/authorizationChecks';

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

describe('retrieveShamirConfigChangeToApprove', () => {
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
        headers: {
          'accept-language': 'fr',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await retrieveShamirConfigChangeToApprove(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(401);
      expect(resMock.end).toHaveBeenCalled();
    });
  });

  describe('config change retrieval', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      await cleanDatabase();
      await addTestBanks();
      await addTestUsers();
      await addTestDevices();
    });

    it('should return empty list when user is not a shareholder', async () => {
      const u = testUsers[2];
      mockCheckBasicAuth2Success(u.id);

      await addTestShamirConfigs([config1Approved, config2Approved, config3Pending]);
      await addTestShamirHolders([...holdersConfig1, ...holdersConfig2, ...holdersConfig3]);

      const mockReq = {
        body: {
          userEmail: u.email,
        },
        headers: {
          'accept-language': 'fr',
        },
      } as unknown as Request;
      mockCheckBasicAuth2Success(u.id);
      const resMock = mockRes();
      await retrieveShamirConfigChangeToApprove(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      const jsonCall = (resMock.json as jest.Mock).mock.calls[0][0] as any;
      expect(jsonCall.changesToBeSigned).toEqual([]);
    });

    it('should not return config change if user was not shareholder of previous config', async () => {
      const u = testUsers[4];
      mockCheckBasicAuth2Success(u.id);

      await addTestShamirConfigs([config1Approved, config2Approved]);
      await addTestShamirHolders([...holdersConfig1, ...holdersConfig2]);

      const mockReq = {
        body: {
          userEmail: u.email,
        },
        headers: {
          'accept-language': 'fr',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await retrieveShamirConfigChangeToApprove(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      const jsonCall = (resMock.json as jest.Mock).mock.calls[0][0] as any;
      expect(jsonCall.changesToBeSigned).toEqual([]);
    });

    it('should return empty list if this is the first config', async () => {
      const u = testUsers[0];
      mockCheckBasicAuth2Success(u.id);
      await addTestShamirConfigs([
        {
          ...config1Approved,
          is_active: true,
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
      await retrieveShamirConfigChangeToApprove(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      const jsonCall = (resMock.json as jest.Mock).mock.calls[0][0] as any;
      expect(jsonCall.changesToBeSigned).toEqual([]);
    });

    it('should not return config change if user already signed', async () => {
      mockCheckBasicAuth2Success(testUsers[1].id);

      await addTestShamirConfigs([config1Approved, config2Approved, config3Pending]);
      await addTestShamirHolders([...holdersConfig1, ...holdersConfig2, ...holdersConfig3]);

      const mockReq = {
        body: {
          userEmail: testUsers[1].email,
        },
        headers: {
          'accept-language': 'fr',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await retrieveShamirConfigChangeToApprove(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      const jsonCall = (resMock.json as jest.Mock).mock.calls[0][0] as any;
      expect(jsonCall.changesToBeSigned).toEqual([]);
    });

    it('should return config change if user was shareholder of previous config and has not signed the new one', async () => {
      const u = testUsers[0];
      mockCheckBasicAuth2Success(u.id);

      await addTestShamirConfigs([config1Approved, config2Approved, config3Pending]);
      await addTestShamirHolders([...holdersConfig1, ...holdersConfig2, ...holdersConfig3]);

      const mockReq = {
        body: {
          userEmail: u.email,
        },
        headers: {
          'accept-language': 'fr',
        },
      } as unknown as Request;
      mockCheckBasicAuth2Success(u.id);
      const resMock = mockRes();
      await retrieveShamirConfigChangeToApprove(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      const jsonCall = (resMock.json as jest.Mock).mock.calls[0][0] as any;
      expect(jsonCall.changesToBeSigned).toHaveLength(1);
      expect(jsonCall.changesToBeSigned[0].bankPublicId).toBe(
        '6333b2b6-2598-4a31-a263-e1897b29d5f5',
      );
      expect(jsonCall.changesToBeSigned[0].bankName).toBe('Bank 1');
      const history = jsonCall.changesToBeSigned[0].shamirConfigHistory;
      expect(history).toHaveLength(3);
      expect(history[0].id).toBe(1);
      expect(history[1].id).toBe(2);
      expect(history[2].id).toBe(3);
      expect(jsonCall.allBanksMap).toEqual({
        '6333b2b6-2598-4a31-a263-e1897b29d5f5': 'Bank 1',
        '98073dee-c66b-4bce-b385-1b66bc76e7fc': 'Bank 2',
      });
    });
  });
});
