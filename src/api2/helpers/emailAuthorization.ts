import { db } from '../../helpers/db';
import { MicrosoftGraph } from 'upsignon-ms-entra';

type TEmailAuthorizationStatus = 'UNAUTHORIZED' | 'PATTERN_AUTHORIZED' | 'MS_ENTRA_AUTHORIZED';
type TMsEntraId = string | null;
type TEmailAuthorizationResponse = {
  status: TEmailAuthorizationStatus;
  msEntraId: TMsEntraId;
};

export const isEmailAuthorizedWithPattern = (emailPattern: string, emailToCheck: string) => {
  if (emailPattern.indexOf('*@') === 0) {
    return emailToCheck.split('@')[1] === emailPattern.replace('*@', '');
  } else {
    return emailToCheck === emailPattern;
  }
};

export const getEmailAuthorizationStatus = async (
  userEmail: string,
  bankId: number,
): Promise<TEmailAuthorizationResponse> => {
  // CHECK MICROSOFT ENTRA
  let userMSEntraId = null;
  try {
    userMSEntraId = await MicrosoftGraph.getUserId(bankId, userEmail);
  } catch (e) {
    console.error(e);
  }
  if (userMSEntraId) {
    try {
      const isEntraAuthorized = await MicrosoftGraph.isUserAuthorizedForUpSignOn(
        bankId,
        userMSEntraId,
      );
      if (isEntraAuthorized) return { status: 'MS_ENTRA_AUTHORIZED', msEntraId: userMSEntraId };
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

  if (isAuthorizedByPattern) return { status: 'PATTERN_AUTHORIZED', msEntraId: userMSEntraId };

  return { status: 'UNAUTHORIZED', msEntraId: userMSEntraId };
};
