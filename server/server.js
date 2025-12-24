const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Используем PostgreSQL если DATABASE_URL задан, иначе SQLite
const apiRoutes = process.env.DATABASE_URL ? 
  require('./routes/api_postgresql') : 
  require('./routes/api_sqlite');
const adminRoutes = process.env.DATABASE_URL ? 
  require('./routes/admin_postgresql') : 
  require('./routes/admin_sqlite');

const initDatabase = process.env.DATABASE_URL ? 
  require('./config/postgresql_init').initPostgresDatabase : 
  require('./config/sqlite').initDatabase;

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Routes
app.use('/api', apiRoutes);
app.use('/admin', adminRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  
  // Initialize SQLite database
  try {
    await initDatabase();
    console.log('SQLite database initialized successfully!');
  } catch (error) {
    console.error('Database initialization failed:', error);
  }
});
