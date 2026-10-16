/**
 * Ortenau Guesser - Express Backend Server
 * Serves Frontend static files and mounts modular routes for Ortenaukreis geoservices.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const regionRoutes = require('./routes/regionRoutes');
const locationRoutes = require('./routes/locationRoutes');
const guessRoutes = require('./routes/guessRoutes');
const streetviewRoutes = require('./routes/streetviewRoutes');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors());
app.use(express.json());

// Serve static Frontend assets
const frontendDir = path.join(__dirname, '../Frontend');
app.use(express.static(frontendDir));

// Mount modular API routers
app.use('/api', regionRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/guess', guessRoutes);
app.use('/api/streetview', streetviewRoutes);

// Fallback to Frontend/index.html for SPA / root requests
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(frontendDir, 'index.html'), (err) => {
    if (err) {
      next();
    }
  });
});

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`[OrtenauGuesser] Backend listening on http://${HOST}:${PORT}`);
  });
}

module.exports = app;
