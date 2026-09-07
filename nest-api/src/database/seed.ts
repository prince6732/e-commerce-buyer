import { drizzle } from 'drizzle-orm/mysql2';
import * as mysql from 'mysql2/promise';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import { users } from './schema/users';
import { getDbConfig } from './db-config';

dotenv.config();

async function seed() {
  const dbConfig = getDbConfig();
  const connection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
  });


  const db = drizzle(connection);

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@topntech.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'root1234';
  const adminName = process.env.ADMIN_NAME || 'Admin User';

  const existingAdmin = await db
    .select()
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1);

  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  if (existingAdmin.length > 0) {
    console.log(`Admin user with email "${adminEmail}" already exists. Updating credentials...`);
    await db
      .update(users)
      .set({
        name: adminName,
        password: hashedPassword,
        role: 'Admin',
        isVerified: 'true',
        emailVerifiedAt: new Date(),
        status: true,
      })
      .where(eq(users.email, adminEmail));
    console.log('Admin user updated successfully.');
  } else {
    console.log(`Creating admin user "${adminEmail}"...`);
    await db.insert(users).values({
      name: adminName,
      email: adminEmail,
      password: hashedPassword,
      role: 'Admin',
      isVerified: 'true',
      emailVerifiedAt: new Date(),
      status: true,
    });
    console.log('Admin user created successfully.');
  }

  await connection.end();
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
