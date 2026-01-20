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

   **Option A: Full Stack (Recommended)**
   ```bash
   # Runs both React dev server and API proxy concurrently
   npm run dev
   ```
   Then open [http://localhost:3001](http://localhost:3001) in your browser.

   **Option B: API Server Only**
   ```bash
   # Run only the API proxy server (port 3001)
   npm run server
   ```

   **Option C: Frontend Only**
   ```bash
   # Run only the React dev server (port 3000)
   npm start
   ```
   Then open [http://localhost:3000](http://localhost:3000) in your browser.
   Note: API calls won't work without the proxy server.

## Vercel Deployment

This app calls `/api/openai/messages`, which is implemented as a Vercel serverless function.

1. Add the following environment variable in Vercel:
   - `OPENAI_API_KEY`
2. Deploy the project. The API route lives at `api/openai/messages.js`.

## Features

- Natural language food logging ("2 eggs and toast with butter")
- AI-powered nutrition lookup with web search capability
- Anonymous access (try without signing up)
- Daily calorie and macro tracking with emoji display
- Optional daily goals
- 7-day trend visualization
- Drag-and-drop entry reordering
- Cross-device sync with Supabase
- User corrections that persist

## Tech Stack

- React
- Supabase (Auth + Database)
- Recharts (Charts)
- Lucide React (Icons)
- OpenAI GPT-5 mini (AI processing with web search)
