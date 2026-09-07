const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../../../001_citiesTableSeeder.js');
const content = fs.readFileSync(filePath, 'utf8');

const match = content.match(/bulkInsert\(\s*["']cities["']\s*,\s*(\[[\s\S]*?\])\s*\)/);
if (!match) {
  console.error('Could not find cities array in seeder file');
  process.exit(1);
}

const rawCities = eval(match[1]);
console.log('Total cities parsed:', rawCities.length);

const cleanedCities = rawCities.map((c) => ({
  id: c.id,
  name: c.name,
  state_id: c.state_id,
  status: c.status !== undefined ? c.status : true,
}));

const formattedArray = JSON.stringify(cleanedCities, null, 2);

const newContent = `"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const count = await queryInterface.sequelize.query(
      \`SELECT COUNT(*) as count FROM cities\`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (parseInt(count[0].count, 10) === 0) {
      await queryInterface.bulkInsert("cities", ${formattedArray});
    } else {
      console.log("Cities table is already seeded");
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("cities", null, {});
  },
};
`;

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('✅ Successfully updated 001_citiesTableSeeder.js without lat and lng!');
