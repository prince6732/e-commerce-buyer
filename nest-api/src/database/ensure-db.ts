import * as mysql from 'mysql2/promise';
import { getDbConfig } from './db-config';

export async function ensureDatabaseExists() {
  const config = getDbConfig();
  console.log(`Checking/Creating database "${config.database}" on MySQL server (${config.host}:${config.port})...`);

  const rootConnection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
  });

  await rootConnection.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\`;`);
  console.log(`✓ Database "${config.database}" checked/created successfully.`);
  await rootConnection.end();
}

if (require.main === module) {
  ensureDatabaseExists().catch((err) => {
    console.error('❌ Failed to ensure database exists:', err);
    process.exit(1);
  });
}
