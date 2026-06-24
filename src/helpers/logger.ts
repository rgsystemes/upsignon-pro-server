import { Request } from 'express';

export const logInfo = (...m: any[]): void => {
  console.log(new Date().toISOString() + ': ', ...m);
};

export const logError = (...m: any[]): void => {
  console.error(new Date().toISOString() + ': ', ...m);
};

const SENSITIVE_QUERY_PARAM_FRAGMENTS = ['token', 'code', 'password', 'secret', 'key'];

export const sanitizeUrlForLogs = (req: Request): string => {
  try {
    const parsedUrl = new URL(req.originalUrl, `${req.protocol}://${req.headers.host}`);

    for (const key of Array.from(parsedUrl.searchParams.keys())) {
      const normalizedKey = key.toLowerCase();

      if (SENSITIVE_QUERY_PARAM_FRAGMENTS.some((fragment) => normalizedKey.includes(fragment))) {
        parsedUrl.searchParams.set(key, '[REDACTED]');
      }
    }

    return `${parsedUrl.pathname}${parsedUrl.search}`;
  } catch {
    return `${req.protocol}://${req.headers.host}${req.originalUrl.split('?')[0]}`;
  }
};
