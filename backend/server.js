// server.js - Express backend for stock-portfolio-tracker

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const axios = require('axios'); // To make HTTP requests to Public.com API
require('dotenv').config(); // To load environment variables from .env file

const app = express();
const PORT = process.env.PORT || 3001;
const PUBLIC_API_SECRET_KEY = process.env.PUBLIC_API_KEY; // The long-lived secret key
const PUBLIC_ACCOUNT_ID = process.env.PUBLIC_ACCOUNT_ID; // The user's account ID

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

/**
 * Gets a valid short-lived access token, requesting a new one if needed.
 * @returns {Promise<string>} A valid access token.
 */
async function getValidAccessToken() {
  // Check if the current token is still valid (with a 1-minute safety buffer)
  if (apiAccessToken.token && Date.now() < apiAccessToken.expiresAt - 60000) {
    console.log('Using existing, valid access token.');
    return apiAccessToken.token;
  }

  console.log('No valid access token found. Requesting a new one...');
  if (!PUBLIC_API_SECRET_KEY) {
      throw new Error('PUBLIC_API_KEY is not configured on the server.');
  }

  try {
    const tokenGenerationUrl = 'https://api.public.com/userapiauthservice/personal/access-tokens';
    console.log(`Requesting new token from: ${tokenGenerationUrl}`);

    const response = await axios.post(tokenGenerationUrl, {
      secret: PUBLIC_API_SECRET_KEY,
      validityInMinutes: 55 // Request a token valid for 55 mins (max is 60)
    });

    // The line that logged the full token response has been removed for security.

    const newAccessToken = response.data.accessToken; 
    const validityInMinutes = response.data.validity_in_minutes || 55;

    if (!newAccessToken) {
        throw new Error("The 'accessToken' property was not found in the API response.");
    }

    apiAccessToken.token = newAccessToken;
    apiAccessToken.expiresAt = Date.now() + validityInMinutes * 60 * 1000;

    console.log('Successfully obtained new access token.');
    return newAccessToken;
  } catch (error) {
    console.error('Failed to create personal access token:', error.response ? error.response.data : error.message);
    throw new Error('Could not obtain API access token. Please check your PUBLIC_API_KEY.');
  }
}


// --- API Routes ---

/**
 * Health check endpoint to verify the API is running.
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API is healthy' });
});

/**
 * API endpoint to fetch stock quotes from the Public.com API.
 * It now handles the entire auth flow internally.
 */
app.get('/api/quotes', async (req, res) => {
    const symbols = req.query.symbols;

    if (!symbols) {
        return res.status(400).json({ error: 'Symbols query parameter is required.' });
    }
    if (!PUBLIC_ACCOUNT_ID) {
        return res.status(500).json({ error: 'PUBLIC_ACCOUNT_ID is not configured on the server.' });
    }

    try {
        const accessToken = await getValidAccessToken();
        
        const apiUrl = `https://api.public.com/userapigateway/marketdata/${PUBLIC_ACCOUNT_ID}/quotes`;
        
        const instruments = symbols.split(',').map(symbol => ({
            symbol: symbol.toUpperCase(),
            type: "EQUITY"
        }));

        res.set('Cache-Control', 'no-store');

        const response = await axios.post(apiUrl, 
            { instruments }, // The request body
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`, // Use the short-lived token
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('Full response from Public.com Quotes API:', JSON.stringify(response.data, null, 2));

        const prices = {};
        if (response.data && Array.isArray(response.data.quotes)) {
            response.data.quotes.forEach(quote => {
                // --- FIX: Use the 'last' property and parse it to a float ---
                const priceString = quote.last; 
                const price = parseFloat(priceString);

                // Check if the symbol exists and the parsed price is a valid number
                if (quote.instrument?.symbol && !isNaN(price)) {
                    prices[quote.instrument.symbol] = price;
                }
            });
        }

        res.json(prices);

    } catch (error) {
        // Enhanced error logging
        console.error('--- ERROR IN /api/quotes ---');
        if (error.response) {
            console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
            console.error('Response Status:', error.response.status);
            console.error('Response Headers:', JSON.stringify(error.response.headers, null, 2));
        } else if (error.request) {
            console.error('Request Data (no response received):', error.request);
        } else {
            console.error('Error Message:', error.message);
        }
        console.error('--- END ERROR ---');

        res.status(500).json({ 
            error: 'An error occurred while fetching stock data.',
            details: error.message
        });
    }
});


// --- Catch-all for Frontend Routing ---
// This sends the React app's index.html for any request that doesn't match an API route.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Server Startup ---
const server = app.listen(PORT, () => {
  console.log(`Stock Portfolio Tracker backend listening on port ${PORT}`);
});

// --- Graceful Shutdown Logic ---
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed.');
    // Add any other cleanup here (e.g., database connections)
    process.exit(0);
  });
};

// Listen for termination signals
process.on('SIGINT', () => gracefulShutdown('SIGINT')); // Ctrl-C
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // `docker stop`
