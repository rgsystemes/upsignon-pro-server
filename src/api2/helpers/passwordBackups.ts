import { db } from '../../helpers/db';

type TransactionClient = Awaited<ReturnType<typeof db.getTransactionClient>>;

export type PasswordBackup = { encryptedPassword: string; deviceId: string };

/**
 * Stores the password backups of the user's devices.
 * Must be called with the transaction client used to save the vault data so that both are saved atomically.
 * Returns the ids of the devices for which no backup could be applied.
 */
export const applyPasswordBackups = async (
  client: Pick<TransactionClient, 'query'>,
  backups: PasswordBackup[],
  userId: number,
  bankId: number,
): Promise<string[]> => {
  const unappliedDeviceIds: string[] = [];
  for (const backup of backups) {
    // We set password_backup_public_key to NULL when applying a new password backup because this value
    // is only needed for the approval of a new SSO device. The SSO flow uses its presence/absence in its logic,
    // so change with caution.
    const result = await client.query(
      "UPDATE user_devices SET encrypted_password_backup_2=$1, password_backup_public_key=NULL WHERE device_unique_id=$2 AND user_id=$3 AND authorization_status='AUTHORIZED' AND bank_id=$4",
      [backup.encryptedPassword, backup.deviceId, userId, bankId],
    );
    if ((result.rowCount ?? 0) === 0) {
      unappliedDeviceIds.push(backup.deviceId);
    }
  }
  return unappliedDeviceIds;
};
