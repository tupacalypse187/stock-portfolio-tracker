// server.js - Express backend for stock-portfolio-tracker

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const axios = require('axios'); // To make HTTP requests to Public.com API
const { Sequelize, DataTypes } = require('sequelize'); // Import Sequelize
require('dotenv').config(); // To load environment variables from .env file

// --- Environment Variable Validation ---
if (!process.env.DATABASE_URL) {
    console.error("FATAL ERROR: DATABASE_URL environment variable is not set. Please check your .env file or docker-compose configuration.");
    process.exit(1); // Exit the process with an error code
}

const app = express();
const PORT = process.env.PORT || 3001;
const PUBLIC_API_SECRET_KEY = process.env.PUBLIC_API_KEY; // The long-lived secret key
const PUBLIC_ACCOUNT_ID = process.env.PUBLIC_ACCOUNT_ID; // The user's account ID

// --- Database Setup ---
// Uses the DATABASE_URL from your .env file, which docker-compose provides.
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false, // Set to console.log to see raw SQL queries
  // FIX: Remove SSL requirement for local Docker development.
  // The connection between containers on the internal Docker network does not need SSL.
  dialectOptions: {
    ssl: false
  },
});

// --- Database Models ---
const Portfolio = sequelize.define('Portfolio', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
});

const Holding = sequelize.define('Holding', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  symbol: { type: DataTypes.STRING, allowNull: false },
  shares: { type: DataTypes.FLOAT, allowNull: false },
  purchasePrice: { type: DataTypes.FLOAT, allowNull: false },
  purchaseDate: { type: DataTypes.DATEONLY, allowNull: false },
});

// Model Associations
Portfolio.hasMany(Holding, { foreignKey: 'portfolioId', onDelete: 'CASCADE' });
Holding.belongsTo(Portfolio, { foreignKey: 'portfolioId' });


// --- In-memory store for the short-lived access token ---
let apiAccessToken = {
  token: null,
  expiresAt: 0, // Store expiry time in milliseconds
};

// --- Middleware Setup ---
app.use(helmet());           // Security headers
app.use(compression());      // Gzip compression
app.use(cors());             // Enable CORS (adjust as needed for production)
app.use(morgan('dev'));      // HTTP request logging (using 'dev' for cleaner logs)
app.use(express.json());     // To parse JSON request bodies

// --- Static File Serving ---
// Serve React app static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));


// --- Authentication Helper Function ---
async function getValidAccessToken() {
  if (apiAccessToken.token && Date.now() < apiAccessToken.expiresAt - 60000) {
    return apiAccessToken.token;
  }
  if (!PUBLIC_API_SECRET_KEY) throw new Error('PUBLIC_API_KEY is not configured on the server.');
  try {
    const response = await axios.post('https://api.public.com/userapiauthservice/personal/access-tokens', {
      secret: PUBLIC_API_SECRET_KEY,
      validityInMinutes: 55
    });
    const newAccessToken = response.data.accessToken;
    if (!newAccessToken) throw new Error("The 'accessToken' property was not found in the API response.");
    apiAccessToken.token = newAccessToken;
    apiAccessToken.expiresAt = Date.now() + (response.data.validity_in_minutes || 55) * 60 * 1000;
    console.log('Successfully obtained new access token.');
    return newAccessToken;
  } catch (error) {
    console.error('Failed to create personal access token:', error.response ? error.response.data : error.message);
    throw new Error('Could not obtain API access token. Please check your PUBLIC_API_KEY.');
  }
}

// --- API Routes ---

app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'API is healthy' }));

app.get('/api/quotes', async (req, res) => {
    const { symbols } = req.query;
    if (!symbols) return res.status(400).json({ error: 'Symbols query parameter is required.' });
    if (!PUBLIC_ACCOUNT_ID) return res.status(500).json({ error: 'PUBLIC_ACCOUNT_ID is not configured.' });
    try {
        const accessToken = await getValidAccessToken();
        const apiUrl = `https://api.public.com/userapigateway/marketdata/${PUBLIC_ACCOUNT_ID}/quotes`;
        const instruments = symbols.split(',').map(symbol => ({ symbol: symbol.toUpperCase(), type: "EQUITY" }));
        res.set('Cache-Control', 'no-store');
        const response = await axios.post(apiUrl, { instruments }, { headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }});
        const prices = {};
        if (response.data?.quotes) {
            response.data.quotes.forEach(quote => {
                const price = parseFloat(quote.last);
                if (quote.instrument?.symbol && !isNaN(price)) {
                    prices[quote.instrument.symbol] = price;
                }
            });
        }
        res.json(prices);
    } catch (error) {
        console.error('--- ERROR IN /api/quotes ---', error.message);
        res.status(500).json({ error: 'An error occurred while fetching stock data.', details: error.message });
    }
});

// --- Portfolio & Holding CRUD Endpoints ---

// GET /api/portfolios
app.get('/api/portfolios', async (req, res) => {
    try {
        const portfolios = await Portfolio.findAll({
            include: [{ model: Holding, as: 'Holdings' }],
            order: [['createdAt', 'ASC'], [{ model: Holding, as: 'Holdings' }, 'createdAt', 'ASC']],
        });
        res.json(portfolios);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch portfolios', details: e.message });
    }
});

// POST /api/portfolios
app.post('/api/portfolios', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Portfolio name is required.' });
        const newPortfolio = await Portfolio.create({ name });
        res.status(201).json(newPortfolio);
    } catch (e) {
        res.status(500).json({ error: 'Failed to create portfolio', details: e.message });
    }
});

// PUT /api/portfolios/:id
app.put('/api/portfolios/:id', async (req, res) => {
    try {
        const { name } = req.body;
        const portfolio = await Portfolio.findByPk(req.params.id);
        if (!portfolio) return res.status(404).json({ error: 'Portfolio not found.' });
        portfolio.name = name;
        await portfolio.save();
        res.json(portfolio);
    } catch (e) {
        res.status(500).json({ error: 'Failed to update portfolio', details: e.message });
    }
});

// DELETE /api/portfolios/:id
app.delete('/api/portfolios/:id', async (req, res) => {
    try {
        const portfolio = await Portfolio.findByPk(req.params.id);
        if (!portfolio) return res.status(404).json({ error: 'Portfolio not found.' });
        await portfolio.destroy();
        res.status(204).send();
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete portfolio', details: e.message });
    }
});

// POST /api/portfolios/:portfolioId/holdings
app.post('/api/portfolios/:portfolioId/holdings', async (req, res) => {
    try {
        const { symbol, shares, purchasePrice, purchaseDate } = req.body;
        const newHolding = await Holding.create({
            symbol, shares, purchasePrice, purchaseDate, portfolioId: req.params.portfolioId
        });
        res.status(201).json(newHolding);
    } catch (e) {
        res.status(500).json({ error: 'Failed to add holding', details: e.message });
    }
});

// DELETE /api/holdings/:id
app.delete('/api/holdings/:id', async (req, res) => {
    try {
        const holding = await Holding.findByPk(req.params.id);
        if (!holding) return res.status(404).json({ error: 'Holding not found.' });
        await holding.destroy();
        res.status(204).send();
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete holding', details: e.message });
    }
});

// --- Catch-all for Frontend Routing ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Server Startup ---
const startServer = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connection has been established successfully.');
        await sequelize.sync(); 
        console.log('All models were synchronized successfully.');

        const server = app.listen(PORT, () => {
          console.log(`Stock Portfolio Tracker backend listening on port ${PORT}`);
        });

        const gracefulShutdown = (signal) => {
          console.log(`\n${signal} received. Shutting down gracefully...`);
          server.close(() => {
            console.log('HTTP server closed.');
            sequelize.close().then(() => console.log('Database connection closed.'));
            process.exit(0);
          });
        };
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    } catch (error) {
        console.error('Unable to connect to the database or start server:', error);
    }
};

startServer();
