import http from 'http';
import https from 'https';
import env from './env';

type RequestOptions = {
  method: 'POST' | 'GET';
  body?: string;
  headers?: {
    'Content-Type': 'application/json' | 'application/x-www-form-urlencoded';
  };
};
type RequestResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  body: string;
};
export const proxiedFetch = (url: string, options: RequestOptions): Promise<RequestResponse> => {
  return new Promise((resolve, reject) => {
    const uri = new URL(url);
    const xmlHttpRequestOptions = {
      hostname: uri.hostname,
      port: uri.port || 443,
      path: uri.pathname,
      method: options.method,
      headers: options.headers || {
        'Content-Type': 'application/json',
      },
    };
    const agent = url.startsWith('https://') ? https : http;

    const req = agent.request(xmlHttpRequestOptions, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (data) => {
        body += data;
      });
      res.on('end', () => {
        try {
          resolve({
            ok: !!res.statusCode && res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode || 0,
            statusText: res.statusMessage || '',
            body: body,
          });
        } catch (e) {
          console.error(`Error ${e}\with body\n${body}`);
          reject(e);
        }
      });
    });
    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
};

export const setupGlobalAgent = () => {
  if (env.HTTP_PROXY) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const globalAgent = require('global-agent');
    globalAgent.bootstrap();
    // @ts-ignore
    global.GLOBAL_AGENT.HTTP_PROXY = env.HTTP_PROXY;
  }
};
