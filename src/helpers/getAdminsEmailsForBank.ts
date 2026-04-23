import { db } from './db';
import env from './env';

export const getAdminEmailsForBank = async (
  bankId: number,
  forceSuperadmins: boolean = false,
): Promise<string[]> => {
  const bankAdmins = await db.query(
    "SELECT email FROM admins AS a INNER JOIN admin_banks AS ag ON ag.admin_id = a.id WHERE a.admin_role != 'superadmin' AND ag.bank_id=$1",
    [bankId],
  );
  const superAdmins = await db.query(
    "SELECT email FROM admins WHERE admin_role = 'superadmin'",
    [],
  );
  let resultingAdminEmails: string[] = [];
  if (bankAdmins.rowCount != null && bankAdmins.rowCount > 0) {
    resultingAdminEmails = [
      ...resultingAdminEmails,
      ...bankAdmins.rows.map((admin) => admin.email),
    ];
    if (forceSuperadmins) {
      resultingAdminEmails = [
        ...resultingAdminEmails,
        ...superAdmins.rows.map((admin) => admin.email),
      ];
    }
  } else if (!env.IS_SAAS || forceSuperadmins) {
    resultingAdminEmails = [
      ...resultingAdminEmails,
      ...superAdmins.rows.map((admin) => admin.email),
    ];
  }
  return resultingAdminEmails;
};
