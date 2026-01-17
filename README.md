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
   ANTHROPIC_API_KEY=...
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Vercel Deployment

This app calls `/api/anthropic/messages`, which is implemented as a Vercel serverless function.

1. Add the following environment variable in Vercel:
   - `ANTHROPIC_API_KEY`
2. Deploy the project. The API route lives at `api/anthropic/messages.js`.

## Features

- Natural language food logging ("2 eggs and toast with butter")
- AI-powered nutrition lookup with web search
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
- Claude API (AI processing)
