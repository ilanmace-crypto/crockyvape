require('dotenv').config();

const createMockPool = (reason) => {
  console.warn(reason || 'Using mock mode');
  const mock = {
    query: async (text, params) => {
      console.log('Mock query:', text, params);
      return { rows: [] };
    },
    connect: async () => ({
      query: mock.query,
      release: () => {},
    }),
  };
  return mock;
};

let Pool;
try {
  // pg may be missing in some serverless builds; do not crash at import time
  ({ Pool } = require('pg'));
} catch (e) {
  module.exports = createMockPool(`pg module is not available (${e?.message || e})`);
  return;
}

let pool;

if (!process.env.DATABASE_URL) {
  pool = createMockPool('DATABASE_URL is not set, using mock mode');
} else {
  // Neon PostgreSQL configuration
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // Neon требует SSL
    max: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
    keepAlive: true,
  });

  pool.on('connect', () => {
    console.log('Connected to Neon PostgreSQL database');
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });
}

module.exports = pool;
