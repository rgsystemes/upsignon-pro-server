export const getRandomString = (length: number): string => {
  let result = '';
  // Do not allow
  /**
   * DO NOT ALLOW
   * - O (big o)
   * - 0
   * - l
   * - I
   * - 1
   * To avoid possible confusions when displaying codes in emails.
   */
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789+&@%!';
  const alphabetLength = alphabet.length;
  for (let i = 0; i < length; i++) {
    result += alphabet.charAt(Math.floor(Math.random() * alphabetLength));
  }
  return result;
};
