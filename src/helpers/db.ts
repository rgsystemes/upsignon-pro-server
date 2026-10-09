import { Pool, QueryResult } from 'pg';
import env from './env';
// @ts-ignore
const pool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  database: env.DB_NAME,
  password: env.DB_PASS,
  // Safety nets so that a stuck query or transaction fails fast instead of hanging until the proxy times out.
  // statement_timeout is kept below the 60s proxy timeout.
  statement_timeout: 50000,
  idle_in_transaction_session_timeout: 30000,
  options: '-c lock_timeout=10000',
});

const query = (text: string, params?: Array<any>): Promise<QueryResult> => pool.query(text, params);

const gracefulShutdown = (): Promise<void> => pool.end();

type TransactionClientInterface = {
  begin: () => Promise<void>;
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
  release: () => void;
  query: (text: string, params?: Array<any>) => Promise<QueryResult>;
};
const getTransactionClient = async (): Promise<TransactionClientInterface> => {
  const client = await pool.connect();
  return {
    begin: async () => {
      await client.query('BEGIN');
    },
    commit: async () => {
      await client.query('COMMIT');
    },
    rollback: async () => {
      await client.query('ROLLBACK');
    },
    release: () => client.release(),
    query: (text: string, params?: Array<any>): Promise<QueryResult> => client.query(text, params),
  };
};
export const db = {
  query,
  gracefulShutdown,
  getTransactionClient,
};
