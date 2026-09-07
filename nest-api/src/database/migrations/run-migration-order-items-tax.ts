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

  const columnsToAdd = [
    { name: 'hsn', sql: '`hsn` varchar(15) NULL' },
    { name: 'tax_rate', sql: '`tax_rate` decimal(5,2) NULL' },
    { name: 'taxable_amount', sql: '`taxable_amount` decimal(10,2) NULL' },
    { name: 'tax_amount', sql: '`tax_amount` decimal(10,2) NULL' },
    { name: 'cgst_rate', sql: '`cgst_rate` decimal(5,2) NULL' },
    { name: 'cgst_amount', sql: '`cgst_amount` decimal(10,2) NULL' },
    { name: 'sgst_rate', sql: '`sgst_rate` decimal(5,2) NULL' },
    { name: 'sgst_amount', sql: '`sgst_amount` decimal(10,2) NULL' },
    { name: 'igst_rate', sql: '`igst_rate` decimal(5,2) NULL' },
    { name: 'igst_amount', sql: '`igst_amount` decimal(10,2) NULL' },
  ];

  for (const col of columnsToAdd) {
    try {
      const [existing]: any = await connection.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'order_items' AND COLUMN_NAME = ?`,
        [dbConfig.database, col.name]
      );
      if (existing && existing.length > 0) {
        console.log(`Column ${col.name} already exists.`);
      } else {
        await connection.execute(`ALTER TABLE \`order_items\` ADD COLUMN ${col.sql}`);
        console.log(`✓ Added column ${col.name}`);
      }
    } catch (err: any) {
      console.error(`Error adding column ${col.name}:`, err.message);
    }
  }

  const [cols] = await connection.execute('DESCRIBE order_items');
  console.log('Current order_items columns:');
  console.table((cols as any[]).map((c: any) => ({ Field: c.Field, Type: c.Type, Null: c.Null })));

  await connection.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
