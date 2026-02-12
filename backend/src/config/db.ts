import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '../db/schema';
import { env } from './env';

/**
 * Database Configuration
 * Configured with connection pooling for high throughput.
 */
const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

export const db = drizzle(pool, { schema });