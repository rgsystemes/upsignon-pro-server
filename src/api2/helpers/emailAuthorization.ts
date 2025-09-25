import { db } from '../../helpers/db';
import { MicrosoftGraph } from 'upsignon-ms-entra';

type TEmailAuthorizationStatus = 'UNAUTHORIZED' | 'PATTERN_AUTHORIZED' | 'MS_ENTRA_AUTHORIZED';

export const isEmailAuthorizedWithPattern = (emailPattern: string, emailToCheck: string) => {
  if (emailPattern.indexOf('*@') === 0) {
    return emailToCheck.split('@')[1] === emailPattern.replace('*@', '');
  } else {
    return emailToCheck === emailPattern;
  }
};

export const getEmailAuthorizationStatus = async (
  userEmail: string,
  userMSEntraId: string | null,
  bankId: number,
): Promise<TEmailAuthorizationStatus> => {
  // CHECK MICROSOFT ENTRA
  if (userMSEntraId) {
    try {
      const isEntraAuthorized = await MicrosoftGraph.isUserAuthorizedForUpSignOn(
        bankId,
        userMSEntraId,
      );
      if (isEntraAuthorized) return 'MS_ENTRA_AUTHORIZED';
    } catch (e) {
      console.error(e);
    }
  }

  // CHECK EMAIL PATTERNS
  const patternRes = await db.query('SELECT pattern FROM allowed_emails WHERE bank_id=$1', [
    bankId,
  ]);
  const isAuthorizedByPattern = patternRes.rows
    .map((p) => p.pattern)
    .some((emailPattern) => isEmailAuthorizedWithPattern(emailPattern, userEmail));

  if (isAuthorizedByPattern) return 'PATTERN_AUTHORIZED';

  return 'UNAUTHORIZED';
};
