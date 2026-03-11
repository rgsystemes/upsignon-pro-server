import { beforeEach, describe, it, jest, expect } from '@jest/globals';
import { retrieveShamirRecoveriesToApprove } from '../../../src/api2/routes/shamirRecovery/retrieveShamirRecoveriesToApprove';
import { cleanDatabase } from '../../setup/testHelpers';
import { Request, Response } from 'express';
import { addTestUsers, testUsers } from '../../fixtures/users';
import { addTestBanks, testBanks } from '../../fixtures/banks';
import {
  addTestDevice,
  addTestDevices,
  device1,
  device2,
  device3,
  device4,
  device5,
  deviceForUser,
} from '../../fixtures/userDevices';
import {
  addTestShamirConfigs,
  config1Approved,
  config2Approved,
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
import { addTestShamirHolders, holdersConfig2 } from '../../fixtures/shamirHolders';
import { addTestShamirShares, sharesConfig2 } from '../../fixtures/shamirShares';
import { addTestShamirRecoveryRequests } from '../../fixtures/shamirRecoveryRequests';

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

describe('retrieveShamirRecoveriesToApprove', () => {
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
      await retrieveShamirRecoveriesToApprove(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(401);
      expect(resMock.end).toHaveBeenCalled();
    });
  });

  describe('recovery requests retrieval', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      await cleanDatabase();
      await addTestBanks();
      await addTestUsers();
      await addTestDevices();
      await addTestShamirConfigs([config1Approved, config2Approved]);
    });

    it('should return empty list when user is not a shamir holder', async () => {
      const u = testUsers[0];
      mockCheckBasicAuth2Success(u.id);

      const mockReq = {
        body: {
          userEmail: u.email,
        },
        headers: {
          'accept-language': 'fr',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await retrieveShamirRecoveriesToApprove(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      const jsonCall = (resMock.json as jest.Mock).mock.calls[0][0] as any;
      expect(jsonCall.isShamirTrustedPerson).toBe(false);
      expect(jsonCall.pendingRecoveryRequests).toEqual([]);
    });

    it('should return pending, not expired recovery requests for holder', async () => {
      const holder = testUsers[1];
      mockCheckBasicAuth2Success(holder.id);

      await addTestShamirHolders(holdersConfig2);
      await addTestShamirShares(sharesConfig2);
      let threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      let threeDaysAgoPlusSevenDays = new Date(threeDaysAgo);
      threeDaysAgoPlusSevenDays.setDate(threeDaysAgoPlusSevenDays.getDate() + 7);
      let tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      let tenDaysAgoPlusSevenDays = new Date(tenDaysAgo);
      tenDaysAgoPlusSevenDays.setDate(tenDaysAgoPlusSevenDays.getDate() + 7);
      await addTestShamirRecoveryRequests([
        {
          id: 1,
          vault_id: 1,
          creator_device_id: 1,
          public_key: 'tempPublicKey1ForRecovery',
          protected_recovery_key_pair: 'protected_recovery_key_pair_1',
          shamir_config_id: 2,
          created_at: threeDaysAgo,
          completed_at: threeDaysAgo,
          status: 'COMPLETED',
          expiry_date: threeDaysAgoPlusSevenDays,
          denied_by: [],
        },
        {
          id: 2,
          vault_id: 1,
          creator_device_id: 1,
          public_key: 'tempPublicKey2ForRecovery',
          protected_recovery_key_pair: 'protected_recovery_key_pair_2',
          shamir_config_id: 2,
          created_at: tenDaysAgo,
          completed_at: null,
          status: 'PENDING',
          expiry_date: tenDaysAgoPlusSevenDays,
          denied_by: [],
        },
        {
          id: 3,
          vault_id: 1,
          creator_device_id: 1,
          public_key: 'tempPublicKey2ForRecovery',
          protected_recovery_key_pair: 'protected_recovery_key_pair_3',
          shamir_config_id: 2,
          created_at: threeDaysAgo,
          completed_at: null,
          status: 'PENDING',
          expiry_date: threeDaysAgoPlusSevenDays,
          denied_by: [],
        },
        {
          id: 4,
          vault_id: 2,
          creator_device_id: 2,
          public_key: 'tempPublicKey3ForRecovery',
          protected_recovery_key_pair: 'protected_recovery_key_pair_4',
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
          userEmail: holder.email,
        },
        headers: {
          'accept-language': 'fr',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await retrieveShamirRecoveriesToApprove(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      const jsonCall = (resMock.json as jest.Mock).mock.calls[0][0] as any;
      expect(jsonCall.isShamirTrustedPerson).toBe(true);
      expect(jsonCall.pendingRecoveryRequests).toHaveLength(2);

      const u1 = testUsers[0];
      const u2 = testUsers[1];
      expect(jsonCall.pendingRecoveryRequests[0].userVaultId).toBe(u1.id);
      expect(jsonCall.pendingRecoveryRequests[0].email).toBe(u1.email);
      expect(jsonCall.pendingRecoveryRequests[0].recoveryPublicKey).toBe(
        'tempPublicKey2ForRecovery',
      );
      expect(jsonCall.pendingRecoveryRequests[0].shamirConfigId).toBe(2);
      expect(jsonCall.pendingRecoveryRequests[0].closedShares).toEqual([
        'encryptedShare1ForHolder2Config2',
      ]);
      expect(jsonCall.pendingRecoveryRequests[1].userVaultId).toBe(u2.id);
      expect(jsonCall.pendingRecoveryRequests[1].email).toBe(u2.email);
      expect(jsonCall.pendingRecoveryRequests[1].recoveryPublicKey).toBe(
        'tempPublicKey3ForRecovery',
      );
      expect(jsonCall.pendingRecoveryRequests[1].shamirConfigId).toBe(2);
      expect(jsonCall.pendingRecoveryRequests[1].closedShares).toEqual([
        'encryptedShare2ForHolder2Config2',
      ]);
    });

    it('should not return requests already approved by holder', async () => {
      const holder = testUsers[1];
      mockCheckBasicAuth2Success(holder.id);

      await addTestShamirHolders(holdersConfig2);
      await addTestShamirShares([
        {
          vault_id: 2,
          holder_vault_id: 2,
          shamir_config_id: 2,
          closed_shares: ['encryptedShare2ForHolder2Config2'],
          open_shares: ['openShare2ForHolder2Config2'],
          created_at: new Date('2023-03-01T15:05:00Z'),
          open_at: null,
        },
      ]);
      let threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      let threeDaysAgoPlusSevenDays = new Date(threeDaysAgo);
      threeDaysAgoPlusSevenDays.setDate(threeDaysAgoPlusSevenDays.getDate() + 7);
      await addTestShamirRecoveryRequests([
        {
          id: 4,
          vault_id: 2,
          creator_device_id: 2,
          public_key: 'tempPublicKey3ForRecovery',
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
          userEmail: holder.email,
        },
        headers: {
          'accept-language': 'fr',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await retrieveShamirRecoveriesToApprove(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      const jsonCall = (resMock.json as jest.Mock).mock.calls[0][0] as any;
      expect(jsonCall.pendingRecoveryRequests).toEqual([]);
    });

    it('should not return requests denied by the holder', async () => {
      const holder = testUsers[1];
      mockCheckBasicAuth2Success(holder.id);

      await addTestShamirHolders(holdersConfig2);
      await addTestShamirShares([
        {
          vault_id: 2,
          holder_vault_id: 2,
          shamir_config_id: 2,
          closed_shares: ['encryptedShare2ForHolder2Config2'],
          open_shares: null,
          created_at: new Date('2023-03-01T15:05:00Z'),
          open_at: null,
        },
      ]);
      let threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      let threeDaysAgoPlusSevenDays = new Date(threeDaysAgo);
      threeDaysAgoPlusSevenDays.setDate(threeDaysAgoPlusSevenDays.getDate() + 7);
      await addTestShamirRecoveryRequests([
        {
          id: 4,
          vault_id: 2,
          creator_device_id: 2,
          public_key: 'tempPublicKey3ForRecovery',
          protected_recovery_key_pair:
            'formatP003-argon2id13-2-67108864-zEKFVGhj2yE9QZ2LvtyrBw==-6KmHqbc57XTfXta4l2dJmQ==-mhuPOE2IwAZNeVu8nQqrQjiq8g26k094nV1TeESDiFA=-encryptedKeyPair',
          shamir_config_id: 2,
          created_at: threeDaysAgo,
          completed_at: null,
          status: 'PENDING',
          expiry_date: threeDaysAgoPlusSevenDays,
          denied_by: [2],
        },
      ]);

      const mockReq = {
        body: {
          userEmail: holder.email,
        },
        headers: {
          'accept-language': 'fr',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await retrieveShamirRecoveriesToApprove(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      const jsonCall = (resMock.json as jest.Mock).mock.calls[0][0] as any;
      expect(jsonCall.pendingRecoveryRequests).toEqual([]);
    });

    it('should return isShamirTrustedPerson true for active holders', async () => {
      const holder = testUsers[1];
      mockCheckBasicAuth2Success(holder.id);
      await addTestShamirHolders(holdersConfig2);

      const mockReq = {
        body: {
          userEmail: holder.email,
        },
        headers: {
          'accept-language': 'fr',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await retrieveShamirRecoveriesToApprove(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      const jsonCall = (resMock.json as jest.Mock).mock.calls[0][0] as any;
      expect(jsonCall.isShamirTrustedPerson).toBe(true);
    });

    it('should return isShamirTrustedPerson true for users with shares', async () => {
      const holder = testUsers[2]; // not holder of current active config but of previous one
      mockCheckBasicAuth2Success(holder.id);
      await addTestShamirHolders([
        {
          id: 1,
          vault_id: holder.id,
          shamir_config_id: 1,
          nb_shares: 1,
          created_at: new Date('2023-03-01T14:30:00Z'),
        },
      ]);
      // fake remaining shares for a previous config where user was holder
      await addTestShamirShares([
        {
          vault_id: 1,
          holder_vault_id: holder.id,
          shamir_config_id: 1,
          closed_shares: ['encryptedShare2ForHolder3Config1'],
          open_shares: null,
          created_at: new Date('2023-03-01T15:05:00Z'),
          open_at: null,
        },
      ]);
      let threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      let threeDaysAgoPlusSevenDays = new Date(threeDaysAgo);
      threeDaysAgoPlusSevenDays.setDate(threeDaysAgoPlusSevenDays.getDate() + 7);
      await addTestShamirRecoveryRequests([
        {
          id: 4,
          vault_id: 1,
          creator_device_id: 1,
          public_key: 'tempPublicKey2ForRecovery',
          protected_recovery_key_pair:
            'formatP003-argon2id13-2-67108864-zEKFVGhj2yE9QZ2LvtyrBw==-6KmHqbc57XTfXta4l2dJmQ==-mhuPOE2IwAZNeVu8nQqrQjiq8g26k094nV1TeESDiFA=-encryptedKeyPair',
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
          userEmail: holder.email,
        },
        headers: {
          'accept-language': 'fr',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await retrieveShamirRecoveriesToApprove(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      const jsonCall = (resMock.json as jest.Mock).mock.calls[0][0] as any;
      expect(jsonCall.isShamirTrustedPerson).toBe(true);
      expect(jsonCall.pendingRecoveryRequests).toHaveLength(1);
      expect(jsonCall.pendingRecoveryRequests[0].requestedAt).toEqual(threeDaysAgo);
    });
  });
});
