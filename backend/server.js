// server.js - Simple Express backend for stock-portfolio-tracker

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware setup
app.use(helmet());           // Security headers
app.use(compression());      // Gzip compression
app.use(cors());             // Enable CORS (adjust as needed)
app.use(morgan('combined')); // HTTP request logging

// Serve React app static files from /public (copy frontend build here)
app.use(express.static(path.join(__dirname, 'public')));

// Example API route placeholder (expand with real logic)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API is healthy' });
});

// Catch-all: send back React's index.html for any other route (client-side routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Stock Portfolio Tracker backend listening on port ${PORT}`);
});

