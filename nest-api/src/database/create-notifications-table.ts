import * as mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import { getDbConfig } from './db-config';
dotenv.config();

async function createNotificationsTable() {
  const dbConfig = getDbConfig();

  const connection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
  });


  const query = `
    CREATE TABLE IF NOT EXISTS \`notifications\` (
      \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
      \`user_id\` bigint unsigned DEFAULT NULL,
      \`recipient_group\` varchar(50) NOT NULL DEFAULT 'admin',
      \`title\` varchar(255) NOT NULL,
      \`message\` text NOT NULL,
      \`type\` varchar(50) NOT NULL DEFAULT 'system',
      \`link\` varchar(500) DEFAULT NULL,
      \`is_read\` boolean NOT NULL DEFAULT false,
      \`metadata\` json DEFAULT NULL,
      \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`fk_notifications_user_id\` (\`user_id\`),
      CONSTRAINT \`fk_notifications_user_id\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  await connection.query(query);
  console.log('✓ Notifications table checked/created successfully.');
  await connection.end();
}

createNotificationsTable().catch((err) => {
  console.error('Error creating notifications table:', err);
});
