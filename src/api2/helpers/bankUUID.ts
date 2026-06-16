import { db } from '../../helpers/db';

export type BankIds = {
  publicId: string;
  internalId: number;
};

export class BadBankIdException extends Error {}

/// This function transforms uuidv4 bank id into integer bank id
/// and maintains backwards compatibility with previous id format
export const getBankIds = async (req: any): Promise<BankIds> => {
  const rawId = req.params.bankUUID;
  let internalId, publicId;
  if (!!rawId && rawId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)) {
    publicId = rawId;
  } else {
    throw new BadBankIdException('Bad bankId in req.params: ' + rawId);
  }

  const gRes = await db.query('SELECT id FROM banks WHERE public_id=$1', [publicId]);
  if (gRes.rows.length === 1) {
    internalId = gRes.rows[0].id;
  } else {
    throw new BadBankIdException(`Bank public id ${publicId} not found.`);
  }

  return {
    internalId,
    publicId,
  };
};
