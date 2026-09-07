const fs = require('fs');
const path = require('path');

// 1. Read states from 000_stateTableSeerer.js
const stateContent = fs.readFileSync(path.join(__dirname, '../../../../000_stateTableSeerer.js'), 'utf8');
const stateMatch = stateContent.match(/bulkInsert\(\s*["']states["']\s*,\s*(\[[\s\S]*?\])\s*\)/);
const statesList = stateMatch ? eval(stateMatch[1]) : [];

// 2. Read cities from 001_citiesTableSeeder.js
const cityContent = fs.readFileSync(path.join(__dirname, '../../../../001_citiesTableSeeder.js'), 'utf8');
const cityMatch = cityContent.match(/bulkInsert\(\s*["']cities["']\s*,\s*(\[[\s\S]*?\])\s*\)/);
const citiesList = cityMatch ? eval(cityMatch[1]) : [];

// 3. Generate 000_stateTableSeeder.ts
const stateTsContent = `export interface StateSeed {
  id: number;
  name: string;
  status: boolean;
}

export const statesSeedData: StateSeed[] = ${JSON.stringify(statesList, null, 2)};

export default statesSeedData;
`;

// 4. Generate 001_citiesTableSeeder.ts
const cityTsContent = `export interface CitySeed {
  id: number;
  name: string;
  state_id: number;
  status: boolean;
}

export const citiesSeedData: CitySeed[] = ${JSON.stringify(citiesList, null, 2)};

export default citiesSeedData;
`;

// Save in nest-api/src/database/seeds/
const seedsDir = path.join(__dirname, '../../database/seeds');
if (!fs.existsSync(seedsDir)) {
  fs.mkdirSync(seedsDir, { recursive: true });
}

fs.writeFileSync(path.join(seedsDir, '000_stateTableSeeder.ts'), stateTsContent, 'utf8');
fs.writeFileSync(path.join(seedsDir, '001_citiesTableSeeder.ts'), cityTsContent, 'utf8');

// Also save at root of nest-api/ for direct access
const rootNestDir = path.join(__dirname, '../../../');
fs.writeFileSync(path.join(rootNestDir, '000_stateTableSeeder.ts'), stateTsContent, 'utf8');
fs.writeFileSync(path.join(rootNestDir, '001_citiesTableSeeder.ts'), cityTsContent, 'utf8');

console.log('✅ Generated 000_stateTableSeeder.ts and 001_citiesTableSeeder.ts successfully in nest-api!');
