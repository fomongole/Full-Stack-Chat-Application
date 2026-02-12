import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from '../config/db';

async function main() {
    console.log('⏳ Running migrations...');

    // This looks for the 'drizzle' folder in the root
    // and apply the SQL files to the remote database.
    await migrate(db, { migrationsFolder: 'drizzle' });

    console.log('✅ Migrations completed successfully');
    process.exit(0);
}

main().catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});