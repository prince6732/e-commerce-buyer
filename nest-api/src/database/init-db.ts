import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import * as mysql from 'mysql2/promise';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as schema from './schema';
import { users } from './schema/users';
import { statesSeedData } from './seeds/000_stateTableSeeder';
import { citiesSeedData } from './seeds/001_citiesTableSeeder';
import { getDbConfig } from './db-config';
import { ensureDatabaseExists } from './ensure-db';

dotenv.config();

async function initDb() {
  const dbConfig = getDbConfig();

  // Step 1: Create Database if not created using MASTER_DATABASE_URL credentials
  await ensureDatabaseExists();

  // Step 2: Connect to target database
  console.log(`Connecting to database "${dbConfig.database}" at ${dbConfig.host}:${dbConfig.port}...`);
  const dbConnection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
  });

  const db = drizzle(dbConnection, { schema, mode: 'default' });


  // Step 3: Run Migrations
  const migrationsFolder = path.join(__dirname, 'migrations');
  if (fs.existsSync(migrationsFolder)) {
    console.log(`Running migrations from "${migrationsFolder}"...`);
    try {
      await migrate(db, { migrationsFolder });
      console.log('✓ All database migrations applied successfully.');
    } catch (migErr: any) {
      console.warn(`Standard Drizzle migration notice: ${migErr.message}`);
      console.log('Applying resilient migration execution for existing tables/columns...');
      await runResilientMigrations(dbConnection, migrationsFolder);
      console.log('✓ Resilient migrations applied successfully.');
    }
  } else {
    console.log('No migrations folder found, skipping migration.');
  }

  // Step 4: Seed Data
  console.log('Seeding initial data...');
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
    console.log(`Updating existing admin credentials for "${adminEmail}"...`);
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
    console.log('✓ Admin user updated successfully.');
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
    console.log('✓ Admin user created successfully.');
  }

  // Step 5: Seed States & Cities
  try {
    const [stateCountRows] = await dbConnection.execute('SELECT COUNT(*) as count FROM states');
    const stateCount = Number((stateCountRows as any)[0]?.count || 0);

    if (stateCount === 0 && statesSeedData.length > 0) {
      console.log(`Seeding ${statesSeedData.length} states...`);
      for (const s of statesSeedData) {
        await dbConnection.execute(
          'INSERT INTO states (id, name, status) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name)',
          [s.id, s.name, s.status ? 1 : 0]
        );
      }
      console.log(`✓ Seeded ${statesSeedData.length} states successfully.`);
    } else {
      console.log(`✓ States table already has ${stateCount} records.`);
    }

    const [cityCountRows] = await dbConnection.execute('SELECT COUNT(*) as count FROM cities');
    const cityCount = Number((cityCountRows as any)[0]?.count || 0);

    if (cityCount === 0 && citiesSeedData.length > 0) {
      console.log(`Seeding ${citiesSeedData.length} cities in batches...`);
      const batchSize = 500;
      for (let i = 0; i < citiesSeedData.length; i += batchSize) {
        const chunk = citiesSeedData.slice(i, i + batchSize);
        const values: any[] = [];
        const placeholders = chunk
          .map((c) => {
            values.push(c.id, c.name, c.state_id, c.status ? 1 : 0);
            return '(?, ?, ?, ?)';
          })
          .join(', ');

        await dbConnection.query(
          `INSERT INTO cities (id, name, state_id, status) VALUES ${placeholders} ON DUPLICATE KEY UPDATE name=VALUES(name), state_id=VALUES(state_id)`,
          values
        );
      }
      console.log(`✓ Seeded all ${citiesSeedData.length} cities successfully.`);
    } else {
      console.log(`✓ Cities table already has ${cityCount} records.`);
    }
  } catch (locErr) {
    console.error('Warning during states/cities seeding:', locErr);
  }

  await dbConnection.end();
  console.log('\n=============================================');
  console.log('🎉 Database initialization, migration, and seeding completed successfully!');
  console.log('=============================================\n');
}

async function runResilientMigrations(dbConnection: mysql.Connection, migrationsFolder: string) {
  // Ensure __drizzle_migrations table exists matching Drizzle MySQL schema
  await dbConnection.execute(`
    CREATE TABLE IF NOT EXISTS \`__drizzle_migrations\` (
      \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
      \`hash\` text NOT NULL,
      \`created_at\` bigint DEFAULT NULL,
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  const [rows]: any = await dbConnection.execute(
    'SELECT id, hash, created_at FROM `__drizzle_migrations` ORDER BY created_at DESC LIMIT 1'
  );
  const lastDbMigration = rows && rows[0] ? rows[0] : null;

  const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
  if (!fs.existsSync(journalPath)) {
    throw new Error(`Can't find meta/_journal.json file`);
  }

  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
  for (const entry of journal.entries) {
    const folderMillis = Number(entry.when);
    if (!lastDbMigration || Number(lastDbMigration.created_at) < folderMillis) {
      console.log(`Applying migration tag: ${entry.tag}...`);
      const sqlFilePath = path.join(migrationsFolder, `${entry.tag}.sql`);
      const rawSql = fs.readFileSync(sqlFilePath, 'utf8');
      const stmts = rawSql.split('--> statement-breakpoint');

      for (let stmt of stmts) {
        stmt = stmt.trim();
        if (!stmt) continue;
        try {
          await dbConnection.query(stmt);
        } catch (err: any) {
          // Ignore benign schema errors if table or column already exists, or already modified
          if (
            err.errno === 1050 || // ER_TABLE_EXISTS_ERROR
            err.errno === 1060 || // ER_DUP_FIELDNAME
            err.errno === 1061 || // ER_DUP_KEYNAME
            err.errno === 1091    // ER_CANT_DROP_FIELD_OR_KEY
          ) {
            console.warn(`Notice: Ignored benign schema condition (${err.code}): ${err.message}`);
          } else {
            throw err;
          }
        }
      }

      const hash = crypto.createHash('sha256').update(rawSql).digest('hex');
      await dbConnection.execute(
        'INSERT INTO `__drizzle_migrations` (`hash`, `created_at`) VALUES (?, ?)',
        [hash, folderMillis]
      );
      console.log(`✓ Migration ${entry.tag} recorded successfully.`);
    }
  }
}

initDb().catch((err) => {
  console.error('❌ Database initialization failed:', err);
  process.exit(1);
});
