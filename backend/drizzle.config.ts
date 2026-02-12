import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    // Point to schema file
    schema: './src/db/schema.ts',
    // Where to save the migration SQL files
    out: './drizzle',
    // The driver to use
    dialect: 'postgresql',
    // Database connection for pushing changes
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
    // Print all SQL statements during migration for debugging
    verbose: true,
    // Ask for confirmation before critical changes
    strict: true,
});