import { beforeEach, describe, it, jest, expect } from '@jest/globals';
import { signShamirConfigChange } from '../../../src/api2/routes/shamirRecovery/signShamirConfigChange';
import { cleanDatabase } from '../../setup/testHelpers';
import { Request, Response } from 'express';
import { addTestUsers, testUsers } from '../../fixtures/users';
import { addTestBanks, testBanks } from '../../fixtures/banks';
import { addTestDevices, deviceForUser } from '../../fixtures/userDevices';
import {
  addTestShamirConfigs,
  approvingSignaturesConfig2,
  approvingSignaturesConfig3,
  config1Approved,
  config2Approved,
  config3Pending,
  nonSenseApprovingSignaturesConfig1,
  refusingSignaturesConfig3,
  unlegitimateApprovingSignaturesConfig2,
} from '../../fixtures/shamirConfigs';

jest.mock('../../../src/api2/helpers/authorizationChecks', () => ({
  checkBasicAuth2: jest.fn(),
}));
jest.mock('../../../src/emails/shamir/sendShamirConfigChangeApproved', () => ({
  sendShamirConfigChangeApprovedToAdminsCCTrustedPersons: jest.fn(),
}));
jest.mock('../../../src/emails/shamir/sendShamirConfigChangeRejected', () => ({
  sendShamirConfigChangeRejectedToAdminsCCTrustedPersons: jest.fn(),
}));

jest.mock('../../../src/helpers/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

import { checkBasicAuth2 } from '../../../src/api2/helpers/authorizationChecks';
import { db } from '../../../src/helpers/db';
import { sendShamirConfigChangeApprovedToAdminsCCTrustedPersons } from '../../../src/emails/shamir/sendShamirConfigChangeApproved';
import { sendShamirConfigChangeRejectedToAdminsCCTrustedPersons } from '../../../src/emails/shamir/sendShamirConfigChangeRejected';
import {
  addTestShamirHolders,
  holdersConfig1,
  holdersConfig2,
  holdersConfig3,
} from '../../fixtures/shamirHolders';

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

describe('signShamirConfigChange', () => {
  describe('body validations', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      await cleanDatabase();
      await addTestBanks();
      await addTestUsers();
      await addTestDevices();
    });
    it('should reject request with invalid body', async () => {
      const u = testUsers[0];
      const d = deviceForUser(u.id);
      mockCheckBasicAuth2Success(u.id);

      const mockReq = {
        body: {
          userEmail: u.email,
          deviceId: d.id,
          deviceSession: 'any-session',
          shamirConfigId: 'not-a-number',
          signedAt: approvingSignaturesConfig2[0].signedAt,
          approved: approvingSignaturesConfig2[0].approved,
          signature: approvingSignaturesConfig2[0].signature,
        },
        headers: {
          'accept-language': 'fr',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await signShamirConfigChange(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(403);
      expect(resMock.end).toHaveBeenCalled();

      const mockReq2 = {
        body: {
          userEmail: u.email,
          deviceId: d.id,
          deviceSession: 'any-session',
          shamirConfigId: 2,
          approved: approvingSignaturesConfig2[0].approved,
          signature: approvingSignaturesConfig2[0].signature,
        },
      } as unknown as Request;
      const resMock2 = mockRes();
      await signShamirConfigChange(mockReq2, resMock2);

      expect(resMock2.status).toHaveBeenCalledWith(403);
      expect(resMock2.end).toHaveBeenCalled();

      const mockReq3 = {
        body: {
          userEmail: u.email,
          deviceId: d.id,
          deviceSession: 'any-session',
          shamirConfigId: 2,
          signedAt: approvingSignaturesConfig2[0].signedAt,
          approved: approvingSignaturesConfig2[0].approved,
        },
      } as unknown as Request;
      const resMock3 = mockRes();
      await signShamirConfigChange(mockReq3, resMock3);

      expect(resMock3.status).toHaveBeenCalledWith(403);
      expect(resMock3.end).toHaveBeenCalled();
    });
    it('should reject if config not found', async () => {
      const u = testUsers[0];
      const d = deviceForUser(u.id);
      mockCheckBasicAuth2Success(u.id);

      const mockReq = {
        body: {
          userEmail: u.email,
          deviceId: d.id,
          deviceSession: 'any-session',
          shamirConfigId: 999,
          signedAt: approvingSignaturesConfig2[0].signedAt,
          approved: approvingSignaturesConfig2[0].approved,
          signature: approvingSignaturesConfig2[0].signature,
        },
        headers: {
          'accept-language': 'fr',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await signShamirConfigChange(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(403);
      expect(resMock.end).toHaveBeenCalled();
    });
  });
  describe('state validation', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      await cleanDatabase();
      await addTestBanks();
      await addTestUsers();
      await addTestDevices();
    });
    it('should reject if signing first config', async () => {
      await addTestShamirConfigs([config1Approved]);
      const u = testUsers[0];
      const d = deviceForUser(u.id);
      const shId = 1;
      mockCheckBasicAuth2Success(u.id);

      const mockReq = {
        body: {
          userEmail: u.email,
          deviceId: d.id,
          deviceSession: 'any-session',
          shamirConfigId: shId,
          signedAt: nonSenseApprovingSignaturesConfig1[0].signedAt,
          approved: nonSenseApprovingSignaturesConfig1[0].approved,
          signature: nonSenseApprovingSignaturesConfig1[0].signature,
        },
        headers: {
          'accept-language': 'fr',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await signShamirConfigChange(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(403);
      expect(resMock.end).toHaveBeenCalled();
    });
    it('should reject if user is not legitimate to sign', async () => {
      await addTestShamirConfigs([config1Approved, config2Approved]);
      const u = testUsers[1];
      const d = deviceForUser(u.id);
      const shId = 2;
      mockCheckBasicAuth2Success(u.id);

      const mockReq = {
        body: {
          userEmail: u.email,
          deviceId: d.id,
          deviceSession: 'any-session',
          shamirConfigId: shId,
          signedAt: unlegitimateApprovingSignaturesConfig2[0].signedAt,
          approved: unlegitimateApprovingSignaturesConfig2[0].approved,
          signature: unlegitimateApprovingSignaturesConfig2[0].signature,
        },
        headers: {
          'accept-language': 'fr',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await signShamirConfigChange(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(403);
      expect(resMock.end).toHaveBeenCalled();
    });
    it('should reject if user has already signed', async () => {
      await addTestShamirConfigs([config1Approved, config2Approved]);
      const u = testUsers[0];
      const d = deviceForUser(u.id);
      const shId = 2;
      mockCheckBasicAuth2Success(u.id);

      const mockReq = {
        body: {
          userEmail: u.email,
          deviceId: d.id,
          deviceSession: 'any-session',
          shamirConfigId: shId,
          signedAt: approvingSignaturesConfig2[0].signedAt,
          approved: approvingSignaturesConfig2[0].approved,
          signature: approvingSignaturesConfig2[0].signature,
        },
        headers: {
          'accept-language': 'fr',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await signShamirConfigChange(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(403);
      expect(resMock.json).toHaveBeenCalledWith({ error: 'already_signed' });
    });
  });
  describe('signature validation', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      await cleanDatabase();
      await addTestBanks();
      await addTestUsers();
      await addTestDevices();
    });
    it('should reject invalid signature', async () => {
      await addTestShamirConfigs([
        config1Approved,
        {
          ...config2Approved,
          change_signatures: null,
        },
      ]);
      const u = testUsers[0];
      const d = deviceForUser(u.id);
      const shId = 2;
      mockCheckBasicAuth2Success(u.id);

      const mockReq = {
        body: {
          userEmail: u.email,
          deviceId: d.id,
          deviceSession: 'any-session',
          shamirConfigId: shId,
          signedAt: approvingSignaturesConfig2[0].signedAt,
          approved: approvingSignaturesConfig2[0].approved,
          signature: approvingSignaturesConfig3[0].signature,
        },
        headers: {
          'accept-language': 'fr',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await signShamirConfigChange(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(403);
      expect(resMock.end).toHaveBeenCalled();
    });
    it('should accept valid signature and store it', async () => {
      await addTestShamirConfigs([
        config1Approved,
        {
          ...config2Approved,
          change_signatures: null,
        },
      ]);
      const u = testUsers[0];
      const d = deviceForUser(u.id);
      const shId = 2;
      mockCheckBasicAuth2Success(u.id);

      const mockReq = {
        body: {
          userEmail: u.email,
          deviceId: d.id,
          deviceSession: 'any-session',
          shamirConfigId: shId,
          signedAt: approvingSignaturesConfig2[0].signedAt,
          approved: approvingSignaturesConfig2[0].approved,
          signature: approvingSignaturesConfig2[0].signature,
        },
        headers: {
          'accept-language': 'fr',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await signShamirConfigChange(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.end).toHaveBeenCalled();

      const updatedConfig = await db.query(
        `SELECT change_signatures FROM shamir_configs WHERE id = $1`,
        [shId],
      );

      const signatures = updatedConfig.rows[0].change_signatures;
      expect(signatures).toHaveLength(1);
      expect(signatures[0].holderVaultId).toBe(u.id);
      expect(signatures[0].approved).toBe(true);
      expect(signatures[0].signature).toBe(approvingSignaturesConfig2[0].signature);
    });
  });

  describe('config activation', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      await cleanDatabase();
      await addTestBanks();
      await addTestUsers();
      await addTestDevices();
    });
    it('should not activate the config if the consensus is not yet reached', async () => {
      await addTestShamirConfigs([
        config1Approved,
        {
          ...config2Approved,
          change_signatures: approvingSignaturesConfig2,
        },
        {
          ...config3Pending,
          change_signatures: null,
        },
      ]);
      const u = testUsers[1];
      const d = deviceForUser(u.id);
      const shId = 3;
      mockCheckBasicAuth2Success(u.id);

      const mockReq = {
        body: {
          userEmail: u.email,
          deviceId: d.id,
          deviceSession: 'any-session',
          shamirConfigId: shId,
          signedAt: approvingSignaturesConfig3[1].signedAt,
          approved: approvingSignaturesConfig3[1].approved,
          signature: approvingSignaturesConfig3[1].signature,
        },
        headers: {
          'accept-language': 'fr',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await signShamirConfigChange(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.end).toHaveBeenCalled();

      const updatedConfig = await db.query(
        `SELECT is_active, change_signatures FROM shamir_configs WHERE id = $1`,
        [shId],
      );

      const signatures = updatedConfig.rows[0].change_signatures;
      expect(signatures).toHaveLength(1);
      expect(signatures[0].holderVaultId).toBe(u.id);
      expect(signatures[0].approved).toBe(true);
      expect(signatures[0].signature).toBe(approvingSignaturesConfig3[1].signature);
      expect(updatedConfig.rows[0].is_active).toBe(false);

      const previousConfig = await db.query(`SELECT is_active FROM shamir_configs WHERE id = $1`, [
        shId - 1,
      ]);
      expect(previousConfig.rows[0].is_active).toBe(true);

      // Should NOT send approval or rejection emails
      expect(sendShamirConfigChangeApprovedToAdminsCCTrustedPersons).not.toHaveBeenCalled();
      expect(sendShamirConfigChangeRejectedToAdminsCCTrustedPersons).not.toHaveBeenCalled();
    });
    it('should activate the config if the consensus is now reached (with one approver)', async () => {
      await addTestShamirConfigs([
        config1Approved,
        {
          ...config2Approved,
          is_active: false,
          change_signatures: null,
        },
      ]);
      await addTestShamirHolders([...holdersConfig1, ...holdersConfig2]);
      const u = testUsers[0];
      const d = deviceForUser(u.id);
      const shId = 2;
      mockCheckBasicAuth2Success(u.id);

      const mockReq = {
        body: {
          userEmail: u.email,
          deviceId: d.id,
          deviceSession: 'any-session',
          shamirConfigId: shId,
          signedAt: approvingSignaturesConfig2[0].signedAt,
          approved: approvingSignaturesConfig2[0].approved,
          signature: approvingSignaturesConfig2[0].signature,
        },
        headers: {
          'accept-language': 'fr',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await signShamirConfigChange(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.end).toHaveBeenCalled();

      const updatedConfig = await db.query(
        `SELECT is_active, change_signatures FROM shamir_configs WHERE id = $1`,
        [shId],
      );

      const signatures = updatedConfig.rows[0].change_signatures;
      expect(signatures).toHaveLength(1);
      expect(signatures[0].holderVaultId).toBe(u.id);
      expect(signatures[0].approved).toBe(true);
      expect(signatures[0].signature).toBe(approvingSignaturesConfig2[0].signature);
      expect(updatedConfig.rows[0].is_active).toBe(true);

      const previousConfig = await db.query(`SELECT is_active FROM shamir_configs WHERE id = $1`, [
        shId - 1,
      ]);
      expect(previousConfig.rows[0].is_active).toBe(false);

      // Should send approval email
      expect(sendShamirConfigChangeApprovedToAdminsCCTrustedPersons).toHaveBeenCalledWith({
        trustedPersonEmails: ['user1@testbank1.com'],
        supportEmail: 'support@testbank1.com',
        bankId: 1,
        bankName: 'Bank 1',
        currentShamirConfigName: 'Shamir 1',
        nextShamirConfigName: 'Shamir 2',
        nbApprovers: 1,
        acceptLanguage: 'fr',
      });
      expect(sendShamirConfigChangeRejectedToAdminsCCTrustedPersons).not.toHaveBeenCalled();
    });
    it('should activate the config if the consensus is now reached (with three approvers)', async () => {
      await addTestShamirConfigs([config1Approved, config2Approved, config3Pending]);
      await addTestShamirHolders([...holdersConfig1, ...holdersConfig2, ...holdersConfig3]);

      const u = testUsers[0];
      const d = deviceForUser(u.id);
      const shId = 3;
      mockCheckBasicAuth2Success(u.id);

      const mockReq = {
        body: {
          userEmail: u.email,
          deviceId: d.id,
          deviceSession: 'any-session',
          shamirConfigId: shId,
          signedAt: approvingSignaturesConfig3[0].signedAt,
          approved: approvingSignaturesConfig3[0].approved,
          signature: approvingSignaturesConfig3[0].signature,
        },
        headers: {
          'accept-language': 'fr',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await signShamirConfigChange(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.end).toHaveBeenCalled();

      const updatedConfig = await db.query(
        `SELECT is_active, change_signatures FROM shamir_configs WHERE id = $1`,
        [shId],
      );

      const signatures = updatedConfig.rows[0].change_signatures;
      expect(signatures).toHaveLength(3);
      expect(signatures[2].holderVaultId).toBe(u.id);
      expect(signatures[2].approved).toBe(true);
      expect(signatures[2].signature).toBe(approvingSignaturesConfig3[0].signature);
      expect(updatedConfig.rows[0].is_active).toBe(true);

      const previousConfig = await db.query(`SELECT is_active FROM shamir_configs WHERE id = $1`, [
        shId - 1,
      ]);
      expect(previousConfig.rows[0].is_active).toBe(false);

      // Should send approval email
      expect(sendShamirConfigChangeApprovedToAdminsCCTrustedPersons).toHaveBeenCalledWith({
        trustedPersonEmails: [
          'user1@testbank1.com',
          'user2@testbank1.com',
          'user1@testbank2.com',
          'user2@testbank2.com',
        ],
        supportEmail: 'security@testbank1.com',
        bankId: 1,
        bankName: 'Bank 1',
        currentShamirConfigName: 'Shamir 2',
        nextShamirConfigName: 'Shamir 3',
        nbApprovers: 3,
        acceptLanguage: 'fr',
      });
      expect(sendShamirConfigChangeRejectedToAdminsCCTrustedPersons).not.toHaveBeenCalled();
    });

    it('should not resend approval emails on surplus approval', async () => {
      await addTestShamirConfigs([
        config1Approved,
        {
          ...config2Approved,
          is_active: false,
        },
        {
          ...config3Pending,
          is_active: true,
          change_signatures: [
            approvingSignaturesConfig3[1],
            approvingSignaturesConfig3[2],
            approvingSignaturesConfig3[3],
          ],
        },
      ]);
      await addTestShamirHolders([...holdersConfig1, ...holdersConfig2, ...holdersConfig3]);

      const u = testUsers[0];
      const d = deviceForUser(u.id);
      const shId = 3;
      mockCheckBasicAuth2Success(u.id);

      const mockReq = {
        body: {
          userEmail: u.email,
          deviceId: d.id,
          deviceSession: 'any-session',
          shamirConfigId: shId,
          signedAt: approvingSignaturesConfig3[0].signedAt,
          approved: approvingSignaturesConfig3[0].approved,
          signature: approvingSignaturesConfig3[0].signature,
        },
        headers: {
          'accept-language': 'fr',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await signShamirConfigChange(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.end).toHaveBeenCalled();

      const updatedConfig = await db.query(
        `SELECT is_active, change_signatures FROM shamir_configs WHERE id = $1`,
        [shId],
      );

      const signatures = updatedConfig.rows[0].change_signatures;
      expect(signatures).toHaveLength(4);
      expect(signatures[3].holderVaultId).toBe(u.id);
      expect(signatures[3].approved).toBe(true);
      expect(signatures[3].signature).toBe(approvingSignaturesConfig3[0].signature);
      expect(updatedConfig.rows[0].is_active).toBe(true);

      // Should NOT send approval or rejection emails
      expect(sendShamirConfigChangeApprovedToAdminsCCTrustedPersons).not.toHaveBeenCalled();
      expect(sendShamirConfigChangeRejectedToAdminsCCTrustedPersons).not.toHaveBeenCalled();
    });

    it('should send a refusal email when the consensus can no longer be reached', async () => {
      await addTestShamirConfigs([
        config1Approved,
        config2Approved,
        {
          ...config3Pending,
          change_signatures: [refusingSignaturesConfig3[1]],
        },
      ]);
      await addTestShamirHolders([...holdersConfig1, ...holdersConfig2, ...holdersConfig3]);

      const u = testUsers[0];
      const d = deviceForUser(u.id);
      const shId = 3;
      mockCheckBasicAuth2Success(u.id);

      const mockReq = {
        body: {
          userEmail: u.email,
          deviceId: d.id,
          deviceSession: 'any-session',
          shamirConfigId: shId,
          signedAt: refusingSignaturesConfig3[0].signedAt,
          approved: refusingSignaturesConfig3[0].approved,
          signature: refusingSignaturesConfig3[0].signature,
        },
        headers: {
          'accept-language': 'fr',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await signShamirConfigChange(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.end).toHaveBeenCalled();

      const updatedConfig = await db.query(
        `SELECT is_active, change_signatures FROM shamir_configs WHERE id = $1`,
        [shId],
      );

      const signatures = updatedConfig.rows[0].change_signatures;
      expect(signatures).toHaveLength(2);
      expect(signatures[1].holderVaultId).toBe(u.id);
      expect(signatures[1].approved).toBe(false);
      expect(signatures[1].signature).toBe(refusingSignaturesConfig3[0].signature);
      expect(updatedConfig.rows[0].is_active).toBe(false);

      const previousConfig = await db.query(`SELECT is_active FROM shamir_configs WHERE id = $1`, [
        shId - 1,
      ]);
      expect(previousConfig.rows[0].is_active).toBe(true);

      expect(sendShamirConfigChangeApprovedToAdminsCCTrustedPersons).not.toHaveBeenCalled();

      expect(sendShamirConfigChangeRejectedToAdminsCCTrustedPersons).toHaveBeenCalledWith({
        trustedPersonEmails: [
          'user1@testbank1.com',
          'user2@testbank1.com',
          'user1@testbank2.com',
          'user2@testbank2.com',
        ],
        supportEmail: 'security@testbank1.com',
        bankId: 1,
        bankName: 'Bank 1',
        currentShamirConfigName: 'Shamir 2',
        acceptLanguage: 'fr',
      });
    });

    it('should not resend rejection emails on surplus approval', async () => {
      await addTestShamirConfigs([
        config1Approved,
        config2Approved,
        {
          ...config3Pending,
          is_active: false,
          change_signatures: [refusingSignaturesConfig3[1], refusingSignaturesConfig3[2]],
        },
      ]);
      await addTestShamirHolders([...holdersConfig1, ...holdersConfig2, ...holdersConfig3]);

      const u = testUsers[0];
      const d = deviceForUser(u.id);
      const shId = 3;
      mockCheckBasicAuth2Success(u.id);

      const mockReq = {
        body: {
          userEmail: u.email,
          deviceId: d.id,
          deviceSession: 'any-session',
          shamirConfigId: shId,
          signedAt: refusingSignaturesConfig3[0].signedAt,
          approved: refusingSignaturesConfig3[0].approved,
          signature: refusingSignaturesConfig3[0].signature,
        },
        headers: {
          'accept-language': 'fr',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await signShamirConfigChange(mockReq, resMock);

      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.end).toHaveBeenCalled();

      const updatedConfig = await db.query(
        `SELECT is_active, change_signatures FROM shamir_configs WHERE id = $1`,
        [shId],
      );

      const signatures = updatedConfig.rows[0].change_signatures;
      expect(signatures).toHaveLength(3);
      expect(signatures[2].holderVaultId).toBe(u.id);
      expect(signatures[2].approved).toBe(false);
      expect(signatures[2].signature).toBe(refusingSignaturesConfig3[0].signature);
      expect(updatedConfig.rows[0].is_active).toBe(false);

      // Should NOT send approval or rejection emails
      expect(sendShamirConfigChangeApprovedToAdminsCCTrustedPersons).not.toHaveBeenCalled();
      expect(sendShamirConfigChangeRejectedToAdminsCCTrustedPersons).not.toHaveBeenCalled();
    });
  });
});
