import { Pool, PoolConfig } from 'pg';
require('dotenv').config({ path: '../../../.env.test' });

import { runMigrations } from '../../src/helpers/runMigrations';

export class TestDatabase {
  private pool: Pool | null = null;
  private config: PoolConfig;

  constructor() {
    this.config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5434'),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASS || 'postgres',
      database: process.env.DB_NAME || 'postgres',
    };
  }

  async create() {
    this.pool = new Pool(this.config);

    try {
      await runMigrations();
    } catch (error) {
      console.error('Failed to run migrations:', error);
      await this.drop();
      throw error;
    }
  }

  async clean() {
    if (!this.pool) {
      throw new Error('Database pool is not initialized');
    }

    const tables = await this.pool.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename != 'migrations'
    `);

    for (const row of tables.rows) {
      await this.pool.query(`TRUNCATE TABLE ${row.tablename} CASCADE`);
    }
  }

  async drop() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  getPool() {
    if (!this.pool) {
      throw new Error('Database pool is not initialized');
    }
    return this.pool;
  }

  getDbName() {
    return this.config.database;
  }
}
