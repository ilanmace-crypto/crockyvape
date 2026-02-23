const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

async function setupDatabase() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set in .env');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to Neon database...');
    const client = await pool.connect();

    console.log('Reading schema file...');
    const schemaSQL = fs.readFileSync('./database_schema.sql', 'utf8');

    console.log('Executing schema...');
    await client.query(schemaSQL);

    console.log('Schema executed successfully!');

    // Optionally insert initial data
    console.log('Inserting initial categories...');
    await client.query(`
      INSERT INTO categories (name, slug, description) VALUES
      ('Жидкости', 'liquids', 'Электронные жидкости для вейпинга'),
      ('Расходники', 'consumables', 'Расходные материалы')
      ON CONFLICT (slug) DO NOTHING;
    `);

    console.log('Database setup complete!');
    client.release();
  } catch (error) {
    console.error('Error setting up database:', error);
  } finally {
    await pool.end();
  }
}

setupDatabase();
