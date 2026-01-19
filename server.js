// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const openaiHandler = require('./api/anthropic/messages');

const app = express();
const PORT = 3001;

// Parse JSON bodies for API routes
app.use('/api', express.json());

// API route - handle OpenAI messages (kept as /api/anthropic/messages for backwards compatibility)
app.post('/api/anthropic/messages', openaiHandler);

// Proxy everything else to React dev server
app.use('/', createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  ws: true, // proxy websockets for hot reload
}));

app.listen(PORT, () => {
  console.log(`\n🚀 Local development proxy running!`);
  console.log(`\n   Frontend + API: http://localhost:${PORT}`);
  console.log(`   React dev:      http://localhost:3000 (background)`);
  console.log(`\n✅ Open http://localhost:${PORT} in your browser\n`);
});
