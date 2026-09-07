import * as mysql from 'mysql2/promise';

async function seed() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: 'root1234',
    database: 'zelton',
  });

  const entries: [string, string][] = [
    ['sold_by_name', 'Rahul Singh'],
    ['sold_by_address', 'Home no. 129 naib colony near army gate village kanwla, AMBALA, HARYANA, 134003, IN'],
    ['pan_no', 'EDKPS7525H'],
    ['gstin', '06EDKPS7525H1Z3'],
    ['home_state', 'Haryana'],
    ['support_phone', '9996646857'],
    ['support_email', 'zelton456@gmail.com'],
  ];

  for (const [k, v] of entries) {
    await conn.execute(
      'INSERT INTO settings (`key`, `value`, `created_at`, `updated_at`) VALUES (?, ?, NOW(), NOW()) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), `updated_at` = NOW()',
      [k, v]
    );
  }

  console.log('Settings successfully seeded in database!');
  const [rows] = await conn.execute('SELECT * FROM settings');
  console.log('Current settings in DB:', rows);
  await conn.end();
}

seed().catch(console.error);
