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
  reseller_id?: string | null;
  bank_id: number | null;
}

interface LicencesBody {
  licences: LicenceItem[];
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
  const success = await pullLicences();
  if (success) res.status(200).end();
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
    licences: Joi.array()
      .items(
        Joi.object({
          id: Joi.number().positive().required(),
          nb_licences: Joi.number().required(),
          valid_from: Joi.string().isoDate().required(),
          valid_until: validUntilSchema,
          is_monthly: Joi.boolean().allow(null).default(false),
          to_be_renewed: Joi.boolean().allow(null).default(false),
          reseller_id: Joi.string().uuid().allow(null),
          bank_id: Joi.number().allow(null),
        }),
      )
      .required(),
  });
  const safeBody = Joi.attempt(unsafeLicencesObject, licencesSchema) as LicencesBody;
  const { licences } = safeBody;

  const resellersRes = await db.query('SELECT id FROM resellers');
  const resellerIds = resellersRes.rows.map((r) => r.id);
  const banksRes = await db.query('SELECT id FROM banks');
  const bankIds = banksRes.rows.map((b) => b.id);

  for (let i = 0; i < licences.length; i++) {
    const l = licences[i];
    if (l.reseller_id && resellerIds.indexOf(l.reseller_id) === -1) {
      continue;
    }
    if (l.bank_id && bankIds.indexOf(l.bank_id) === -1) {
      continue;
    }

    const previousExtLicenceRes = await db.query(
      'SELECT reseller_id, bank_id, nb_licences FROM external_licences WHERE ext_id=$1 limit 1',
      [l.id],
    );
    const prevL = previousExtLicenceRes.rows[0];
    if (prevL && prevL.reseller_id !== l.reseller_id) {
      // the licence was previously associated to another reseller
      logInfo(
        'updateLicencesInDb received a reseller changed licence -> deletion of internal licence attributions',
      );
      await db.query('DELETE FROM internal_licences WHERE external_licences_id=$1', [l.id]);
    }
    if (l.bank_id) {
      // clean up just in case
      await db.query('DELETE FROM internal_licences WHERE external_licences_id=$1', [l.id]);
    }
    if (prevL && l.nb_licences < prevL.nb_licences) {
      const internalLicences = await db.query(
        'SELECT SUM(nb_licences)::int as nb_licences FROM internal_licences WHERE external_licences_id=$1',
        [l.id],
      );
      if (l.nb_licences < internalLicences.rows[0].nb_licences) {
        await db.query('DELETE FROM internal_licences WHERE external_licences_id=$1', [l.id]);
      }
    }
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
        l.id,
        l.nb_licences,
        l.valid_from,
        l.valid_until,
        l.is_monthly,
        l.to_be_renewed,
        l.reseller_id,
        l.bank_id,
      ],
    );
  }
  await db.query('DELETE FROM external_licences WHERE NOT(ext_id=ANY ($1::int[]))', [
    licences.map((l) => l.id),
  ]);
};
