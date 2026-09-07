/**
 * Migration & Seeder: Create states & cities tables and seed data without lat & lng
 * Run with: node nest-api/src/database/migrations/seed-states-and-cities.js
 */
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

async function run() {
  console.log('Connecting to MySQL database...');
  let host = process.env.DB_HOST || 'localhost';
  let port = parseInt(process.env.DB_PORT || '3306');
  let user = process.env.DB_USER || process.env.DB_USERNAME || 'root';
  let password = process.env.DB_PASSWORD || '';
  let database = process.env.DB_NAME || process.env.DB_DATABASE || 'zelton';

  const urlStr = process.env.MASTER_DATABASE_URL || process.env.DATABASE_URL || process.env.DB_URL;
  if (urlStr) {
    try {
      const parsed = new URL(urlStr);
      if (parsed.hostname) host = parsed.hostname;
      if (parsed.port) port = parseInt(parsed.port);
      if (parsed.username) user = decodeURIComponent(parsed.username);
      if (parsed.password) password = decodeURIComponent(parsed.password);
      const dbFromPath = parsed.pathname ? parsed.pathname.replace(/^\//, '') : '';
      if (dbFromPath) database = dbFromPath;
    } catch (e) {}
  }

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
  });

  try {
    console.log('1. Creating `states` table if not exists...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS states (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        status TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ `states` table ready');

    console.log('2. Creating `cities` table if not exists...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS cities (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        state_id BIGINT UNSIGNED NOT NULL,
        status TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_cities_state_id (state_id),
        KEY idx_cities_name (name),
        CONSTRAINT fk_cities_state FOREIGN KEY (state_id) REFERENCES states(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ `cities` table ready');

    // ── 3. Seed States ──
    const [stateCountRows] = await connection.execute('SELECT COUNT(*) as count FROM states');
    const stateCount = stateCountRows[0].count;

    // Load states from 000_stateTableSeerer.js
    const stateFileContent = fs.readFileSync(path.join(__dirname, '../../../../000_stateTableSeerer.js'), 'utf8');
    // Extract array from bulkInsert
    const stateMatch = stateFileContent.match(/bulkInsert\(\s*["']states["']\s*,\s*(\[[\s\S]*?\])\s*\)/);
    let statesList = [];
    if (stateMatch) {
      statesList = eval(stateMatch[1]);
    }

    if (stateCount === 0 && statesList.length > 0) {
      console.log(`Seeding ${statesList.length} states without lat/lng...`);
      for (const s of statesList) {
        await connection.execute(
          'INSERT INTO states (id, name, status) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), status=VALUES(status)',
          [s.id, s.name, s.status !== undefined ? (s.status ? 1 : 0) : 1]
        );
      }
      console.log(`✅ Successfully seeded ${statesList.length} states`);
    } else {
      console.log(`ℹ️ States table already has ${stateCount} records`);
    }

    // ── 4. Seed Cities ──
    const [cityCountRows] = await connection.execute('SELECT COUNT(*) as count FROM cities');
    const cityCount = cityCountRows[0].count;

    if (cityCount === 0) {
      console.log('Reading cities seeder file...');
      const citiesFilePath = path.join(__dirname, '../../../../001_citiesTableSeeder.js');
      const citiesFileContent = fs.readFileSync(citiesFilePath, 'utf8');
      
      const cityMatch = citiesFileContent.match(/bulkInsert\(\s*["']cities["']\s*,\s*(\[[\s\S]*?\])\s*\)/);
      if (cityMatch) {
        console.log('Parsing cities data...');
        const rawCities = eval(cityMatch[1]);
        console.log(`Found ${rawCities.length} cities to seed (stripping lat and lng)...`);

        const batchSize = 500;
        for (let i = 0; i < rawCities.length; i += batchSize) {
          const chunk = rawCities.slice(i, i + batchSize);
          const values = [];
          const placeholders = chunk.map(c => {
            values.push(c.id, c.name, c.state_id, c.status !== undefined ? (c.status ? 1 : 0) : 1);
            return '(?, ?, ?, ?)';
          }).join(', ');

          await connection.query(
            `INSERT INTO cities (id, name, state_id, status) VALUES ${placeholders} ON DUPLICATE KEY UPDATE name=VALUES(name), state_id=VALUES(state_id), status=VALUES(status)`,
            values
          );
          console.log(`  Seeded ${Math.min(i + batchSize, rawCities.length)} / ${rawCities.length} cities...`);
        }
        console.log(`✅ Successfully seeded all ${rawCities.length} cities!`);
      }
    } else {
      console.log(`ℹ️ Cities table already has ${cityCount} records`);
    }

  } catch (err) {
    console.error('❌ Error during states and cities seeding:', err);
  } finally {
    await connection.end();
  }
}

run();
