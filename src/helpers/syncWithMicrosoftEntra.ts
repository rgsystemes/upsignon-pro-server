import { isEmailAuthorizedWithPattern } from '../api2/helpers/emailAuthorization';
import { getNext1pmOr1am } from './dateHelper';
import { db } from './db';
import { logError } from './logger';
import { MicrosoftGraph } from 'upsignon-ms-entra';

export const syncPeriodicallyWithMicrosoftEntra = async (): Promise<void> => {
  performMicrosoftEntraSync();

  // call perform sync everyday at 1pm and 1am
  const nextSyncDate = getNext1pmOr1am();
  setTimeout(() => {
    performMicrosoftEntraSync();
    setInterval(performMicrosoftEntraSync, 12 * 3600 * 1000); // call it every 12 hours
  }, nextSyncDate.getTime() - Date.now()); // start the cron at the next 1pm or 1am
};

const performMicrosoftEntraSync = async (): Promise<void> => {
  try {
    // NB : for optimization purposes, we call MS graph on banks first to initialize their config
    // but then when we call getUserId, we don't get the config again for each user...

    // Get all assigned users for each bank
    const banksRes = await db.query('SELECT id FROM banks');
    const banks = banksRes.rows;
    const assignedMSUsersByBank: { [id: number]: string[] } = {};
    for (let i = 0; i < banks.length; i++) {
      const bank = banks[i];
      try {
        const allMsUsersForBank = await MicrosoftGraph.getAllUsersAssignedToUpSignOn(bank.id, true);
        assignedMSUsersByBank[bank.id] = allMsUsersForBank;
      } catch (e) {
        console.error(
          `performMicrosoftEntraSync > MicrosoftGraph.getAllUsersAssignedToUpSignOn(${bank.id}, true) errored:`,
          e,
        );
      }
    }

    // Loop through users in our db
    const usersRes = await db.query(
      'SELECT id, email, ms_entra_id, deactivated, bank_id FROM users',
    );
    const allowedEmailsRes = await db.query('SELECT pattern, bank_id FROM allowed_emails');
    for (let i = 0; i < usersRes.rows.length; i++) {
      const u = usersRes.rows[i];
      // First update their ms entra id
      if (!u.ms_entra_id) {
        try {
          const msEntraUid = await MicrosoftGraph.getUserId(u.bank_id, u.email);
          if (msEntraUid != null) {
            await db.query('UPDATE users SET ms_entra_id=$1 WHERE id=$2 AND bank_id=$3', [
              msEntraUid,
              u.id,
              u.bank_id,
            ]);
            u.ms_entra_id = msEntraUid;
          }
        } catch (e) {
          console.error(e);
        }
      }

      // Then check their authorization
      let isMsEntraAllowed = false;
      if (u.ms_entra_id) {
        if (assignedMSUsersByBank[u.bank_id].indexOf(u.ms_entra_id) >= 0) {
          isMsEntraAllowed = true;
        } else {
          try {
            // maybe the user was recreated with another uuid or completely deleted
            const msEntraUid = await MicrosoftGraph.getUserId(u.bank_id, u.email);
            if (msEntraUid != u.ms_entra_id) {
              await db.query('UPDATE users SET ms_entra_id=$1 WHERE id=$2 AND bank_id=$3', [
                msEntraUid,
                u.id,
                u.bank_id,
              ]);
              u.ms_entra_id = msEntraUid;
            }
            // then retry the check
            if (msEntraUid && assignedMSUsersByBank[u.bank_id].indexOf(msEntraUid) >= 0) {
              isMsEntraAllowed = true;
            }
          } catch (e) {
            console.error(e);
          }
        }
      }

      // Maybe the user will be allowed by pattern
      let isEmailPatternAllowed = false;
      if (!isMsEntraAllowed) {
        const bankPatterns = allowedEmailsRes.rows
          .filter((ae) => ae.bank_id === u.bank_id)
          .map((p) => p.pattern);
        isEmailPatternAllowed = bankPatterns.some((p) => isEmailAuthorizedWithPattern(p, u.email));
      }
      // deactivate or reactivate that user
      const willBeDeactivated = !isEmailPatternAllowed && !isMsEntraAllowed;
      if (willBeDeactivated != !!u.deactivated) {
        await db.query('UPDATE users SET deactivated=$1 WHERE id=$2 AND bank_id=$3', [
          willBeDeactivated ? true : null,
          u.id,
          u.bank_id,
        ]);
      }
    }
  } catch (e: any) {
    // if there is an error, we stop everything since the results are no longer guaranted
    logError('performMicrosoftEntraSync', e);
  }
};
