import { beforeEach, describe, it, jest, expect } from '@jest/globals';
import { shamirSecurityAlert } from '../../../src/api2/routes/shamirRecovery/shamirSecurityAlert';
import { cleanDatabase } from '../../setup/testHelpers';
import { Request, Response } from 'express';
import { addTestBanks, testBanks } from '../../fixtures/banks';

jest.mock('../../../src/api2/helpers/authorizationChecks', () => ({
  checkBasicAuth2: jest.fn(),
}));
jest.mock('../../../src/helpers/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));
jest.mock('../../../src/emails/sendShamirSecurityAlertToAdmins', () => ({
  sendShamirSecurityAlertToAdmins: jest.fn(),
}));

import { checkBasicAuth2 } from '../../../src/api2/helpers/authorizationChecks';
import { db } from '../../../src/helpers/db';
import { sendShamirSecurityAlertToAdmins } from '../../../src/emails/sendShamirSecurityAlertToAdmins';

const mockRes = () => {
  return {
    status: jest.fn().mockReturnThis(),
    end: jest.fn(),
    json: jest.fn(),
  } as unknown as Response;
};

const mockCheckBasicAuthSuccess = (bankId: number) => {
  (checkBasicAuth2 as jest.Mock<any>).mockResolvedValue({
    granted: true,
    bankIds: { internalId: bankId },
    deviceId: 1,
  });
};

describe('shamirSecurityAlert', () => {
  describe('authorization validations', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      await cleanDatabase();
      await addTestBanks();
    });

    it('should reject request with invalid basic auth', async () => {
      (checkBasicAuth2 as jest.Mock<any>).mockResolvedValue({ granted: false });
      const mockReq = {
        body: {
          userEmail: 'user@example.com',
          brokenShamirChain: 'chain info',
          bankName: 'BankName',
          bankUrl: 'https://bank.com',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await shamirSecurityAlert(mockReq, resMock);
      expect(resMock.status).toHaveBeenCalledWith(401);
      expect(resMock.end).toHaveBeenCalled();
    });
  });

  describe('body validations', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      await cleanDatabase();
      await addTestBanks();
    });

    it('should reject request with missing fields', async () => {
      mockCheckBasicAuthSuccess(testBanks[0].id);
      const mockReq = {
        body: {
          userEmail: 'user@example.com',
          bankName: 'BankName',
          bankUrl: 'https://bank.com',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await shamirSecurityAlert(mockReq, resMock);
      expect(resMock.status).toHaveBeenCalledWith(403);
      expect(resMock.end).toHaveBeenCalled();
    });

    it('should reject request with invalid bankUrl', async () => {
      mockCheckBasicAuthSuccess(testBanks[0].id);
      const mockReq = {
        body: {
          userEmail: 'user@example.com',
          brokenShamirChain: 'chain info',
          bankName: 'BankName',
          bankUrl: 'not-a-url',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await shamirSecurityAlert(mockReq, resMock);
      expect(resMock.status).toHaveBeenCalledWith(403);
      expect(resMock.end).toHaveBeenCalled();
    });
  });

  describe('alert logic', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      await cleanDatabase();
      await addTestBanks();
    });

    it('should send alert and update flag if not already broken', async () => {
      mockCheckBasicAuthSuccess(testBanks[0].id);
      await db.query('UPDATE banks SET has_broken_shamir_chain = false WHERE id = $1', [
        testBanks[0].id,
      ]);
      const mockReq = {
        body: {
          userEmail: 'user@example.com',
          brokenShamirChain: 'chain info',
          bankName: 'BankName',
          bankUrl: 'https://bank.com',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await shamirSecurityAlert(mockReq, resMock);
      expect(sendShamirSecurityAlertToAdmins).toHaveBeenCalledWith({
        bankId: testBanks[0].id,
        brokenShamirChain: 'chain info',
        bankName: 'BankName',
        bankUrl: 'https://bank.com',
      });
      const bankState = await db.query('SELECT has_broken_shamir_chain FROM banks WHERE id = $1', [
        testBanks[0].id,
      ]);
      expect(bankState.rows[0].has_broken_shamir_chain).toBe(true);
      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.end).toHaveBeenCalled();
      // Check logInfo was called for alert
      const { logInfo } = require('../../../src/helpers/logger');
      expect(logInfo).toHaveBeenCalledWith('SHAMIR SECURITY ALERT FOR BANK 1');
    });

    it('should not send alert if already broken', async () => {
      mockCheckBasicAuthSuccess(testBanks[0].id);
      await db.query('UPDATE banks SET has_broken_shamir_chain = true WHERE id = $1', [
        testBanks[0].id,
      ]);
      const mockReq = {
        body: {
          userEmail: 'user@example.com',
          brokenShamirChain: 'chain info',
          bankName: 'BankName',
          bankUrl: 'https://bank.com',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await shamirSecurityAlert(mockReq, resMock);
      expect(sendShamirSecurityAlertToAdmins).not.toHaveBeenCalled();
      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.end).toHaveBeenCalled();
      // Check logInfo was called for alert
      const { logInfo } = require('../../../src/helpers/logger');
      expect(logInfo).toHaveBeenCalledWith('SHAMIR SECURITY ALERT FOR BANK 1');
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      await cleanDatabase();
      await addTestBanks();
    });

    it('should return 400 on unexpected error', async () => {
      mockCheckBasicAuthSuccess(testBanks[0].id);
      jest.spyOn(db, 'query').mockRejectedValueOnce(new Error('DB error'));
      const mockReq = {
        body: {
          userEmail: 'user@example.com',
          brokenShamirChain: 'chain info',
          bankName: 'BankName',
          bankUrl: 'https://bank.com',
        },
      } as unknown as Request;
      const resMock = mockRes();
      await shamirSecurityAlert(mockReq, resMock);
      expect(resMock.status).toHaveBeenCalledWith(400);
      expect(resMock.end).toHaveBeenCalled();
    });
  });
});
