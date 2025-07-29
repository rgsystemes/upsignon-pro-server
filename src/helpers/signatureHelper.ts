import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import env from './env';

const wellKnownUpSignOnPublicKey = env.IS_PRODUCTION
  ? '-----BEGIN PUBLIC KEY-----\nMFYwEAYHKoZIzj0CAQYFK4EEAAoDQgAEB/4zGfZRH715/kObqaWDL2nZR+ybUh/y\nx/wCHiLXX9VDzSh/qB+NC0KJ/rMPKXKhCCKgWCo/OBxieXarHJS6lg==\n-----END PUBLIC KEY-----\n'
  : '-----BEGIN PUBLIC KEY-----\nMFYwEAYHKoZIzj0CAQYFK4EEAAoDQgAEyQqX6RbASOpD9VqF7a/Z16yTA8Qssrfs\nH7ttDE4TAgaN+HXiTOrZ9y0Cba0i106lcfOTdignGYu2qRZEFKcMuQ==\n-----END PUBLIC KEY-----\n';

/**
 * Verifies an ECDSA signature
 * @param data - Original data
 * @param timestamp - Timestamp used during signing
 * @param signature - Signature to verify in base64 format
 * @param publicKey - EC public key in PEM format
 * @returns boolean - true if signature is valid
 */
const verifyECSignature = (
  data: string,
  timestamp: number,
  signature: string,
  publicKey: string,
): boolean => {
  try {
    const payload = `${timestamp}:${data}`;

    const verify = crypto.createVerify('SHA256');
    verify.update(payload, 'utf8');

    return verify.verify(publicKey, signature, 'base64');
  } catch (error) {
    console.error('EC signature verification error:', error);
    return false;
  }
};

/**
 * Middleware to verify ECDSA signature of requests
 */
export const verifySignatureMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const signature = req.headers['x-signature'] as string;
  const timestampHeader = req.headers['x-timestamp'] as string;

  if (!signature || !timestampHeader) {
    res.status(401).json({
      error: 'Missing signature or timestamp headers',
    });
    return;
  }

  const timestamp = parseInt(timestampHeader, 10);
  if (isNaN(timestamp)) {
    res.status(400).json({
      error: 'Invalid timestamp format',
    });
    return;
  }

  // Check that the request is not too old (5 minutes max)
  const currentTime = Math.floor(Date.now() / 1000);
  const maxAge = 5 * 60; // 5 minutes

  if (Math.abs(currentTime - timestamp) > maxAge) {
    res.status(401).json({
      error: 'Request timestamp too old or too far in future',
    });
    return;
  }

  // Get the request body
  const requestBody = JSON.stringify(req.body);

  // Verify the signature
  try {
    const isValidSignature = verifyECSignature(
      requestBody,
      timestamp,
      signature,
      wellKnownUpSignOnPublicKey,
    );

    if (!isValidSignature) {
      res.status(401).json({
        error: 'Invalid signature',
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Signature verification error:', error);
    res.status(500).json({
      error: 'Signature verification failed',
    });
  }
};
