import { db } from '../../helpers/db';

export const getDeviceInfo = async (
  deviceId: number,
): Promise<{ device_name: string; device_type: string } | null> => {
  const res = await db.query('SELECT device_name, device_type FROM user_devices WHERE id=$1', [
    deviceId,
  ]);
  if (res.rows.length === 1) {
    return res.rows[0];
  }
  return null;
};
