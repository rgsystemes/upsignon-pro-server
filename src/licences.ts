import Joi from 'joi';
import { db } from './helpers/db';
import { logError } from './helpers/logger';

interface LicenceItem {
  id: number;
  nb_licences: number;
  valid_from: string;
  valid_until: string | null;
  is_monthly: boolean;
  to_be_renewed: boolean;
}

interface ResellerLicence extends LicenceItem {
  reseller_id: string;
}

interface BankLicence extends LicenceItem {
  bank_id: number | null;
}

interface LicencesBody {
  resellerLicences: ResellerLicence[];
  bankLicences: BankLicence[];
}

export const updateLicences = async (req: any, res: any) => {
  try {
    const validUntilSchema = Joi.string()
      .isoDate()
      .when('is_monthly', {
        is: true,
        then: Joi.string().isoDate().allow(null),
        otherwise: Joi.string().isoDate().required(),
      });
    const expectedSchema = Joi.object({
      resellerLicences: Joi.array()
        .items(
          Joi.object({
            id: Joi.number().positive().required(),
            nb_licences: Joi.number().positive().required(),
            valid_from: Joi.string().isoDate().required(),
            valid_until: validUntilSchema,
            is_monthly: Joi.boolean().allow(null).default(false),
            to_be_renewed: Joi.boolean().allow(null).default(false),
            reseller_id: Joi.string().uuid().required(),
          }),
        )
        .required(),
      bankLicences: Joi.array()
        .items(
          Joi.object({
            id: Joi.number().positive().required(),
            nb_licences: Joi.number().positive().required(),
            valid_from: Joi.string().isoDate().required(),
            valid_until: validUntilSchema,
            is_monthly: Joi.boolean().allow(null).default(false),
            to_be_renewed: Joi.boolean().allow(null).default(false),
            bank_id: Joi.number().allow(null),
          }),
        )
        .required(),
    });
    const safeBody = Joi.attempt(req.body, expectedSchema) as LicencesBody;

    const { resellerLicences, bankLicences } = safeBody;

    for (let i = 0; i < resellerLicences.length; i++) {
      const r = resellerLicences[i];
      await db.query(
        `INSERT INTO external_licences
        (ext_id, nb_licences, valid_from, valid_until, is_monthly, to_be_renewed, reseller_id, bank_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (ext_id) DO UPDATE SET
        nb_licences=EXCLUDED.nb_licences,
        valid_from=EXCLUDED.valid_from,
        valid_until=EXCLUDED.valid_until,
        is_monthly=EXCLUDED.is_monthly,
        to_be_renewed=EXCLUDED.to_be_renewed,
        reseller_id=EXCLUDED.reseller_id,
        bank_id=EXCLUDED.bank_id
        `,
        [
          r.id,
          r.nb_licences,
          r.valid_from,
          r.valid_until,
          r.is_monthly,
          r.to_be_renewed,
          r.reseller_id,
          null,
        ],
      );
    }
    for (let i = 0; i < bankLicences.length; i++) {
      const b = bankLicences[i];
      await db.query(
        `INSERT INTO external_licences
        (ext_id, nb_licences, valid_from, valid_until, is_monthly, to_be_renewed,reseller_id, bank_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (ext_id) DO UPDATE SET
        nb_licences=EXCLUDED.nb_licences,
        valid_from=EXCLUDED.valid_from,
        valid_until=EXCLUDED.valid_until,
        is_monthly=EXCLUDED.is_monthly,
        to_be_renewed=EXCLUDED.to_be_renewed,
        reseller_id=EXCLUDED.reseller_id,
        bank_id=EXCLUDED.bank_id`,
        [
          b.id,
          b.nb_licences,
          b.valid_from,
          b.valid_until,
          b.is_monthly,
          b.to_be_renewed,
          null,
          b.bank_id,
        ],
      );
    }

    const allUpdatedLicenceIds = [
      ...resellerLicences.map((r: ResellerLicence) => r.id),
      ...bankLicences.map((b: BankLicence) => b.id),
    ];

    await db.query('DELETE FROM external_licences WHERE NOT(ext_id=ANY ($1::int[])', [
      allUpdatedLicenceIds,
    ]);

    return res.status(200).end();
  } catch (e) {
    logError('update licences', e);
    return res.status(500).end();
  }
};
