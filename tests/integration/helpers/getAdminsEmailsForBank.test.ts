import { beforeEach, describe, it, jest, expect } from '@jest/globals';
import { getAdminEmailsForBank } from '../../../src/helpers/getAdminsEmailsForBank';
import { cleanDatabase } from '../../setup/testHelpers';
import { addTestBanks } from '../../fixtures/banks';
import { addTestAdmins, addTestAdminBanks, allAdmins } from '../../fixtures/admins';

import env from '../../../src/helpers/env';

describe('getAdminEmailsForBank', () => {
  describe('when bank has admins', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      await cleanDatabase();
      await addTestBanks();
    });

    it('should return bank admin emails only when forceSuperadmins is false', async () => {
      await addTestAdmins(allAdmins);
      await addTestAdminBanks();
      const result = await getAdminEmailsForBank(1, false);

      expect(result).toHaveLength(2);
      expect(result).toContain('admin1@bank1.com');
      expect(result).toContain('admin2@bank1.com');
    });

    it('should return bank admin emails and superadmin emails when forceSuperadmins is true', async () => {
      await addTestAdmins(allAdmins);
      await addTestAdminBanks();
      const result = await getAdminEmailsForBank(1, true);

      expect(result).toHaveLength(4);
      expect(result).toContain('admin1@bank1.com');
      expect(result).toContain('admin2@bank1.com');
      expect(result).toContain('superadmin@company.com');
      expect(result).toContain('superadmin2@company.com');
    });

    it('should return correct admins for bank 2', async () => {
      await addTestAdmins(allAdmins);
      await addTestAdminBanks();
      const result = await getAdminEmailsForBank(2, false);

      expect(result).toHaveLength(1);
      expect(result).toContain('admin3@bank2.com');
      expect(result).not.toContain('admin1@bank1.com');
      expect(result).not.toContain('superadmin@company.com');
    });
  });

  describe('when bank has no admins', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      await cleanDatabase();
      await addTestBanks();
    });

    it('should return empty array when IS_SAAS is true and forceSuperadmins is false', async () => {
      await addTestAdmins(allAdmins);
      (env as any).IS_SAAS = true;

      const result = await getAdminEmailsForBank(1, false);

      expect(result).toHaveLength(0);
    });

    it('should return superadmin emails when IS_SAAS is false and forceSuperadmins is false', async () => {
      await addTestAdmins(allAdmins);
      (env as any).IS_SAAS = false;

      const result = await getAdminEmailsForBank(1, false);

      expect(result).toHaveLength(2);
      expect(result).toContain('superadmin@company.com');
      expect(result).toContain('superadmin2@company.com');
    });

    it('should return superadmin emails when IS_SAAS is false and forceSuperadmins is true', async () => {
      await addTestAdmins(allAdmins);
      (env as any).IS_SAAS = true;

      const result = await getAdminEmailsForBank(1, true);

      expect(result).toHaveLength(2);
      expect(result).toContain('superadmin@company.com');
      expect(result).toContain('superadmin2@company.com');
    });
    it('should return superadmin emails when IS_SAAS is true and forceSuperadmins is true', async () => {
      await addTestAdmins(allAdmins);
      (env as any).IS_SAAS = false;

      const result = await getAdminEmailsForBank(1, true);

      expect(result).toHaveLength(2);
      expect(result).toContain('superadmin@company.com');
      expect(result).toContain('superadmin2@company.com');
    });
    it('should return superadmin emails when IS_SAAS is true and forceSuperadmins is true', async () => {
      await addTestAdmins(allAdmins);
      (env as any).IS_SAAS = true;

      const result = await getAdminEmailsForBank(1, true);

      expect(result).toHaveLength(2);
      expect(result).toContain('superadmin@company.com');
      expect(result).toContain('superadmin2@company.com');
    });
  });

  describe('edge cases', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      await cleanDatabase();
      await addTestBanks();
      await addTestAdmins(allAdmins);
      await addTestAdminBanks();
    });

    it('should handle bank with no matching ID', async () => {
      const result = await getAdminEmailsForBank(999, false);

      expect(result).toHaveLength(0);
    });
  });

  describe('restricted_superadmin behavior', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      await cleanDatabase();
      await addTestBanks();
    });

    it('should only return superadmins, not restricted_superadmins when forceSuperadmins is true', async () => {
      await addTestAdmins(allAdmins);
      await addTestAdminBanks();
      const result = await getAdminEmailsForBank(1, true);

      expect(result).not.toContain('restricted@company.com');
      expect(result).not.toContain('restricted2@company.com');
      expect(result).toContain('superadmin@company.com');
      expect(result).toContain('superadmin2@company.com');
    });

    it('should not return restricted_superadmins when bank has no regular admins', async () => {
      await addTestAdmins(allAdmins);

      const result = await getAdminEmailsForBank(1, true);

      expect(result).not.toContain('restricted@company.com');
      expect(result).not.toContain('restricted2@company.com');
      expect(result).toContain('superadmin@company.com');
      expect(result).toContain('superadmin2@company.com');
    });
  });
});
