import Joi from 'joi';
import { Request, Response } from 'express';
import { db } from './helpers/db';
import { logError, logInfo } from './helpers/logger';
import env from './helpers/env';

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

// NB: Licence flows
// - PUSH FLOW (licence update/creation): upsignon-adv-dashboard -> upsignon-pro-server/licences
// - AUTO PULL FLOW (pro server cron and start): upsignon-pro-server -> upsignon-perso-server/pull-licences -> upsignon-adv-dashboard/pull-licences
// - MANUAL PULL FLOW: upsignon-pro-dashboard/start-pull-licences -> upsignon-perso-server/pull-licences -> upsignon-adv-dashboard/pull-licences

export const updateLicences = async (req: any, res: any) => {
  try {
    await updateLicencesInDb(req.body);
    return res.status(200).end();
  } catch (e) {
    logError('update licences', e);
    return res.status(500).end();
  }
};

export const startLicencePulling = async (req: Request, res: Response) => {
  const succeess = await pullLicences();
  if (succeess) res.status(200).end();
  else res.status(400).end();
};

export const pullLicences = async (): Promise<boolean> => {
  try {
    const secretRes = await db.query("SELECT value FROM settings WHERE key='SECRET'");
    if (secretRes.rowCount === 0) {
      logError(`pullLicences error: no SECRET`);
      return false;
    }
    const urlRes = await db.query("SELECT value FROM settings WHERE key='PRO_SERVER_URL_CONFIG'");
    if (urlRes.rowCount === 0) {
      logError(`pullLicences error: url not defined`);
      return false;
    }

    const { url } = urlRes.rows[0].value;

    const response = await fetch(`${env.STATUS_SERVER_URL}/pull-licences`, {
      method: 'POST',
      cache: 'no-store',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        secret: secretRes.rows[0].value,
      }),
    });
    if (!response.ok) {
      logError(`pullLicences error: ${response.status}`);
      return false;
    }
    const jsonBody = await response.json();
    await updateLicencesInDb(jsonBody);
    return true;
  } catch (e) {
    logError('pullLicences', e);
    return false;
  }
};

const updateLicencesInDb = async (unsafeLicencesObject: any) => {
  const validUntilSchema = Joi.string()
    .isoDate()
    .when('is_monthly', {
      is: true,
      then: Joi.string().isoDate().allow(null),
      otherwise: Joi.string().isoDate().required(),
    });
  const licencesSchema = Joi.object({
    resellerLicences: Joi.array()
      .items(
        Joi.object({
          id: Joi.number().positive().required(),
          nb_licences: Joi.number().required(),
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
          nb_licences: Joi.number().required(),
          valid_from: Joi.string().isoDate().required(),
          valid_until: validUntilSchema,
          is_monthly: Joi.boolean().allow(null).default(false),
          to_be_renewed: Joi.boolean().allow(null).default(false),
          bank_id: Joi.number().allow(null),
        }),
      )
      .required(),
  });
  const safeBody = Joi.attempt(unsafeLicencesObject, licencesSchema) as LicencesBody;
  const { resellerLicences, bankLicences } = safeBody;

  for (let i = 0; i < resellerLicences.length; i++) {
    const r = resellerLicences[i];
    const existenceRes = await db.query('SELECT 1 FROM resellers WHERE id=$1', [r.reseller_id]);
    if (existenceRes.rows.length === 1) {
      const previousExtLicenceRes = await db.query(
        'SELECT reseller_id, bank_id, uses_pool FROM external_licences WHERE ext_id=$1',
        [r.id],
      );
      let willUsePool = true; // true by default for resellers
      if (previousExtLicenceRes.rows.length > 0) {
        const prevL = previousExtLicenceRes.rows[0];
        if (prevL.bank_id) {
          // the licence was previously associated directly to a bank, and now it's associated to a reseller
          willUsePool = true;
        } else if (prevL.reseller_id != r.reseller_id) {
          // the licence was previously associated to another reseller
          logInfo(
            'updateLicencesInDb received a reseller changed licence -> deletion of internal licence attributions',
          );
          await db.query('DELETE FROM internal_licences WHERE external_licences_id=$1', [r.id]);
          willUsePool = true;
        } else {
          // do not change the will use pool value
          willUsePool = prevL.uses_pool;
        }
      }
      await db.query(
        `INSERT INTO external_licences
        (ext_id, nb_licences, valid_from, valid_until, is_monthly, to_be_renewed, reseller_id, bank_id, uses_pool)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (ext_id) DO UPDATE SET
        nb_licences=EXCLUDED.nb_licences,
        valid_from=EXCLUDED.valid_from,
        valid_until=EXCLUDED.valid_until,
        is_monthly=EXCLUDED.is_monthly,
        to_be_renewed=EXCLUDED.to_be_renewed,
        reseller_id=EXCLUDED.reseller_id,
        bank_id=EXCLUDED.bank_id,
        uses_pool=EXCLUDED.uses_pool
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
          willUsePool,
        ],
      );
    }
  }
  for (let i = 0; i < bankLicences.length; i++) {
    const b = bankLicences[i];
    const existenceRes = await db.query('SELECT 1 FROM banks WHERE id=$1', [b.bank_id]);
    if (existenceRes.rows.length === 1) {
      const previousExtLicenceRes = await db.query(
        'SELECT reseller_id, bank_id, uses_pool FROM external_licences WHERE ext_id=$1',
        [b.id],
      );
      if (previousExtLicenceRes.rows.length > 0) {
        const prevL = previousExtLicenceRes.rows[0];
        if (prevL.reseller_id) {
          // the licence was previously associated with a reseller, and now it's associated directly to a bank
          logInfo(
            'updateLicencesInDb received a reseller to bank changed licence -> deletion of internal licence attributions',
          );
          await db.query('DELETE FROM internal_licences WHERE external_licences_id=$1', [b.id]);
        }
      }
      await db.query(
        `INSERT INTO external_licences
        (ext_id, nb_licences, valid_from, valid_until, is_monthly, to_be_renewed, reseller_id, bank_id, uses_pool)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false)
        ON CONFLICT (ext_id) DO UPDATE SET
        nb_licences=EXCLUDED.nb_licences,
        valid_from=EXCLUDED.valid_from,
        valid_until=EXCLUDED.valid_until,
        is_monthly=EXCLUDED.is_monthly,
        to_be_renewed=EXCLUDED.to_be_renewed,
        reseller_id=EXCLUDED.reseller_id,
        bank_id=EXCLUDED.bank_id,
        uses_pool=EXCLUDED.uses_pool`,
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
  }

  const allUpdatedLicenceIds = [
    ...resellerLicences.map((r: ResellerLicence) => r.id),
    ...bankLicences.map((b: BankLicence) => b.id),
  ];

  await db.query('DELETE FROM external_licences WHERE NOT(ext_id=ANY ($1::int[]))', [
    allUpdatedLicenceIds,
  ]);
};
