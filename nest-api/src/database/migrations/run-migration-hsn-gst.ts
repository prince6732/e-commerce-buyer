import * as mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import { getDbConfig } from '../db-config';

dotenv.config();

async function run() {
  const dbConfig = getDbConfig();
  console.log(`Connecting to database "${dbConfig.database}" at ${dbConfig.host}:${dbConfig.port}...`);
  const connection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
  });

  console.log('Applying ALTER TABLE on categories for hsn, cgst, sgst, igst...');
  try {
    await connection.execute(`
      ALTER TABLE \`categories\`
        ADD COLUMN IF NOT EXISTS \`hsn\` varchar(15) NULL,
        ADD COLUMN IF NOT EXISTS \`cgst\` decimal(5,2) NULL,
        ADD COLUMN IF NOT EXISTS \`sgst\` decimal(5,2) NULL,
        ADD COLUMN IF NOT EXISTS \`igst\` decimal(5,2) NULL;
    `);
    console.log('✓ Successfully added hsn, cgst, sgst, and igst columns to categories table.');
  } catch (err: any) {
    console.error('Error altering table:', err.message);
  }

  const [cols] = await connection.execute('DESCRIBE categories');
  console.log('Current categories columns:');
  console.table((cols as any[]).map((c: any) => ({ Field: c.Field, Type: c.Type, Null: c.Null })));

  await connection.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
