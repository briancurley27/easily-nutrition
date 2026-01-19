# Easily - AI Nutrition Tracker

Track your daily nutrition with natural language powered by AI.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Add your environment variables in `.env.local`:
   ```bash
   REACT_APP_SUPABASE_URL=...
   REACT_APP_SUPABASE_ANON_KEY=...
   OPENAI_API_KEY=...
   ```

3. Start the development servers:

   **Option A: With API Routes (Recommended for full testing)**
   ```bash
   # Terminal 1: Start React dev server
   npm start

   # Terminal 2: Start API proxy server
   npm run dev
   ```
   Then open [http://localhost:3001](http://localhost:3001) in your browser.

   **Option B: Frontend only (UI development)**
   ```bash
   npm start
   ```
   Then open [http://localhost:3000](http://localhost:3000) in your browser.
   Note: API calls won't work without the proxy server.

## Vercel Deployment

This app calls `/api/anthropic/messages`, which is implemented as a Vercel serverless function.

1. Add the following environment variable in Vercel:
   - `OPENAI_API_KEY`
2. Deploy the project. The API route lives at `api/anthropic/messages.js`.

## Features

- Natural language food logging ("2 eggs and toast with butter")
- AI-powered nutrition lookup with web search capability
- Daily calorie and macro tracking
- Optional daily goals
- 7-day trend visualization
- Cross-device sync with Supabase
- User corrections that persist

## Tech Stack

- React
- Supabase (Auth + Database)
- Recharts (Charts)
- Lucide React (Icons)
- OpenAI GPT-5.0 mini (AI processing with web search)
