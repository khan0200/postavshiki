const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const app = express();
app.use(express.json());

// Logger middleware for debugging API calls
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// Serve static frontend files from the root directory
app.use(express.static(__dirname));

// Import API handlers
const suppliersHandler = require('./api/suppliers');
const partsHandler = require('./api/parts');
const inspectorsHandler = require('./api/inspectors');
const commentsHandler = require('./api/comments');
const recordsHandler = require('./api/records');
const recordsYearsHandler = require('./api/records-years');
const recordsImportHandler = require('./api/records-import');

// Adapt Vercel handler function to Express route handler
const adapt = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

// Map API endpoints
app.all('/api/suppliers', adapt(suppliersHandler));
app.all('/api/parts', adapt(partsHandler));
app.all('/api/inspectors', adapt(inspectorsHandler));
app.all('/api/comments', adapt(commentsHandler));
app.all('/api/records', adapt(recordsHandler));
app.all('/api/records-years', adapt(recordsYearsHandler));
app.all('/api/records-import', adapt(recordsImportHandler));

// Default fallback to index.html for unknown routes (optional, but good for SPAs)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 Dev server running at http://localhost:${PORT}`);
  console.log(`📂 Serving static files from ${__dirname}`);
  console.log(`==================================================\n`);
});
