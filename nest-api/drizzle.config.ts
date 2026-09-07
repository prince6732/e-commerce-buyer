import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import { getDbConfig } from './src/database/db-config';

dotenv.config();

const dbConfig = getDbConfig();

export default defineConfig({
  schema: './src/database/schema/index.ts',
  out: './src/database/migrations',
  dialect: 'mysql',
  dbCredentials: {
    url: dbConfig.databaseUrl,
  },
});

