# Easily - AI Nutrition Tracker

## Project Overview

Easily is a natural-language nutrition tracking tool that allows users to log food intake the way they would tell a friend (e.g., "a slice of pepperoni pizza, a green apple, half a cup of rice, and a small fry from McDonald's"). The AI then returns detailed nutrition data (calories, protein, carbs, fat) for each item.

### Key Value Propositions
- **No searching**: Users don't search and add foods individually like traditional calorie trackers
- **No unit conversion**: Users can use natural measurements and the AI handles conversions
- **Brand awareness**: AI can look up nutrition data for brand name and chain restaurant foods
- **Smart estimation**: AI accurately estimates generic foods based on context
- **Anonymous access**: Users can try the app without creating an account (with optional signup)
- **History tracking**: App saves and tracks user information to help reach health goals
- **Cross-device sync**: Data syncs across devices via Supabase

## Architecture

### Tech Stack
- **Frontend**: React 18 with Create React App
- **Backend**: Express.js proxy server + Vercel serverless functions
- **Database & Auth**: Supabase (PostgreSQL + Auth)
- **AI**: OpenAI API (GPT-5 mini) for natural language processing with web search
- **Charts**: Recharts for 7-day trend visualization
- **Icons**: Lucide React
- **Deployment**: Vercel (production), localhost (development)

### Application Flow
1. User enters natural language food description
2. Frontend sends request to `/api/openai/messages`
3. API proxy/serverless function forwards to OpenAI API with structured prompt
4. OpenAI GPT-5 mini uses web search and knowledge to return structured JSON with nutrition data for each food item
5. Frontend displays results and saves to Supabase
6. User can view history, edit entries, and track progress over time

## Project Structure

```
easily-nutrition/
├── api/
│   └── openai/
│       └── messages.js         # Vercel serverless function for OpenAI API proxy
├── public/
│   ├── index.html              # Main HTML template
│   └── [icons/manifests]       # PWA assets
├── src/
│   ├── App.js                  # Root component
│   ├── CalorieTracker.js       # Main application component (1400+ lines)
│   ├── supabase.js             # Supabase client configuration
│   ├── index.js                # React entry point
│   └── index.css               # Global styles
├── server.js                   # Express proxy for local development
├── package.json                # Dependencies and scripts
└── .env.local                  # Environment variables (gitignored)
```

## Database Schema (Supabase)

### Tables

**entries**
- `id` (uuid, primary key)
- `user_id` (uuid, foreign key to auth.users)
- `date` (text, format: YYYY-MM-DD)
- `timestamp` (timestamptz)
- `local_time` (text, format: HH:MM)
- `input` (text) - Original user input
- `items` (jsonb) - Array of food items with nutrition data
- `total_calories` (integer)
- `total_protein` (numeric)
- `total_carbs` (numeric)
- `total_fat` (numeric)

**corrections**
- `id` (uuid, primary key)
- `user_id` (uuid, foreign key to auth.users)
- `food_name` (text) - Normalized food name (lowercase, trimmed)
- `correction` (jsonb) - User's corrected nutrition values
- `created_at` (timestamptz)

**goals**
- `user_id` (uuid, primary key, foreign key to auth.users)
- `calories` (integer, nullable)
- `protein` (numeric, nullable)
- `carbs` (numeric, nullable)
- `fat` (numeric, nullable)
- `updated_at` (timestamptz)

### Row Level Security (RLS)
All tables should have RLS enabled with policies ensuring users can only access their own data:
- `user_id = auth.uid()`

## Environment Variables

### Required for Development (.env.local)
```bash
REACT_APP_SUPABASE_URL=your_supabase_project_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
```

### Required for Vercel Deployment
- `OPENAI_API_KEY` - Set in Vercel environment variables
- Supabase keys are embedded in frontend code (public anon key is safe)

## Development Workflow

### Local Development

**Option A: Full Stack (Recommended)**
```bash
# Runs both React dev server and API proxy concurrently
npm run dev

# Open http://localhost:3001
```

**Option B: API Server Only**
```bash
# Run only the API proxy server (port 3001)
npm run server
```

**Option C: Frontend Only**
```bash
# Run only the React dev server (port 3000)
npm start
# Note: API calls won't work without proxy
```

### Build & Deploy
```bash
npm run build    # Creates production build in /build
# Deploy to Vercel (automatic via git push)
```

### Testing
```bash
npm test         # Run tests (not yet implemented)
```

## Key Components & Files

### src/CalorieTracker.js
The main application component containing all core functionality:
- **Authentication**: Login/signup UI and Supabase auth integration with anonymous user support
- **Food logging**: Natural language input processing with emoji display for common foods
- **Entry management**: CRUD operations for food entries with drag-and-drop reordering
- **Corrections system**: User-specific nutrition overrides
- **Goals tracking**: Optional daily calorie/macro goals
- **Charts**: 7-day trend visualization using Recharts
- **Date navigation**: Browse entries by date
- **Anonymous mode**: First-time users can use the app without signing up, with optional signup prompt

**Important State Variables:**
- `entries` - Object keyed by date (YYYY-MM-DD) containing daily food entries
- `corrections` - Object keyed by normalized food name with user corrections
- `goals` - User's daily nutrition goals (nullable)
- `selectedDate` - Currently viewed date
- `session` - Supabase auth session (null for anonymous users)
- `showSignupPrompt` - Controls display of signup prompt for anonymous users
- `hasCompletedFirstEntry` - Tracks if anonymous user has completed their first entry

### api/openai/messages.js
Serverless function that proxies requests to OpenAI API:
- Handles POST requests to `/api/openai/messages`
- Forwards request body to `https://api.openai.com/v1/chat/completions`
- Includes API key from environment variables
- Logs requests/responses for debugging
- Returns response directly to client

### server.js
Express development proxy server:
- Runs on port 3001
- Handles `/api/openai/messages` route locally
- Proxies all other requests to React dev server (port 3000)
- Enables hot reload via WebSocket proxy

## AI Integration

### OpenAI API Usage
The app uses OpenAI GPT-5 mini with structured prompts to:
1. Parse natural language food descriptions
2. Look up nutrition data using its training data and web search
3. Return structured JSON responses

**Important Notes:**
- Model: gpt-5-mini-2025-08-07 (latest cost-effective model with web search)
- Rate limiting: Retry logic in place for API errors
- Web search: Can search the web for brand/restaurant nutrition data
- Nutrition knowledge: Uses built-in knowledge, web search capability, and USDA data
- Prompt optimization: Optimized to reduce token usage and minimize costs

### Recent AI-Related Improvements
- Switched from Claude to GPT-5 mini for cost savings and newer features
- Updated response parsing to handle OpenAI's response format
- Maintained retry logic with exponential backoff for API errors
- Optimized prompts to reduce token usage by ~75% with prompt caching
- Added web search capability for accurate brand nutrition lookups
- Instructed AI to prefer training data over web search for faster responses
- Enhanced food display with emoji support for common foods
- Improved quantity formatting and food name cleanup in AI responses
- Added performance instrumentation for debugging and optimization

## Important Patterns & Conventions

### Date Handling
- All dates stored as strings in `YYYY-MM-DD` format
- Use `getLocalDateString()` helper for consistency
- Time stored separately in `HH:MM` format as `local_time`

### Food Name Normalization
- Use `normalizeFoodName()` to convert to lowercase and trim spaces
- Used for matching user corrections to food items
- Ensures consistent lookups regardless of capitalization/spacing

### Anonymous User Support
- Users can use the app without authentication for trial purposes
- Anonymous entries are stored in-memory only (not persisted to database)
- Signup prompt appears after first entry completion (timing is dynamic based on entry complexity)
- Anonymous users have access to all features except persistent storage and cross-device sync
- Authentication modal can be manually opened to sign up or log in at any time

### Data Flow
1. User input → OpenAI API (via proxy)
2. OpenAI response → Frontend state
3. Frontend state → Supabase (automatic save for authenticated users, in-memory only for anonymous)
4. Supabase → Frontend state (on load/auth change for authenticated users)

### Error Handling
- Database connection errors: Retry logic implemented
- API rate limiting: Exponential backoff retry strategy
- Missing foods: Recent fixes ensure AI processes ALL items

## Common Tasks

### Adding a New Feature
1. Modify `src/CalorieTracker.js` (main app logic)
2. Update Supabase schema if database changes needed
3. Test locally with `npm run dev`
4. Deploy to Vercel (automatic on push to main)

### Debugging API Issues
1. Check browser console for frontend errors
2. Check server logs (Terminal 2) for proxy errors
3. Check Vercel function logs for production errors
4. Verify environment variables are set correctly

### Modifying the AI Prompt
- Edit the prompt construction in `CalorieTracker.js`
- Look for the OpenAI API call (search for `/api/openai/messages`)
- Be mindful of prompt length to avoid rate limiting
- Always emphasize ALL items must be processed
- Mention web search for brand items to get accurate nutrition data

## Known Issues & Gotchas

### AI Skipping Items
**Issue**: AI sometimes skipped food items in the response
**Solution**: Prompt now emphasizes "YOU MUST INCLUDE ALL ITEMS" multiple times
**Files**: src/CalorieTracker.js (commits 45d7a19, 1dd2cf0)

### Rate Limiting
**Issue**: API returns 429 errors during heavy usage
**Solution**: Optimized prompt length, added retry logic with exponential backoff
**Files**: api/openai/messages.js, src/CalorieTracker.js (commits d44280e, ec4a069)

### Database Connection Errors
**Issue**: Intermittent connection issues with Supabase
**Solution**: Added retry logic for database operations
**Files**: src/CalorieTracker.js (commit ec4a069)

## Security Considerations

- **API Keys**: Never commit `.env.local` or expose `OPENAI_API_KEY`
- **RLS**: All Supabase tables must have Row Level Security enabled
- **Auth**: Supabase handles authentication - trust `session.user.id`
- **Input Validation**: User input sent to AI - OpenAI handles validation
- **CORS**: API proxy prevents exposing API keys to client

## Future Improvements

Potential areas for enhancement:
- Add meal planning features
- Implement barcode scanning
- Add social features (share meals, friends)
- Export data to CSV/PDF
- Recipe nutrition calculator
- Meal presets and favorites
- Integration with fitness trackers
- Mobile app (React Native)
- Global corrections system: Admin-curated corrections table that applies accurate nutrition data (e.g., AMC popcorn = 550 cal) to all users, overriding inaccurate AI responses. Doesn't save tokens but improves accuracy for known-bad items.

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [React Documentation](https://react.dev)
- [Recharts Documentation](https://recharts.org)
- [Lucide Icons](https://lucide.dev)

## Getting Help

For issues or questions:
1. Check this document first
2. Review recent git commits for context
3. Check browser console and server logs
4. Review Supabase dashboard for data issues
5. Test API calls directly using curl/Postman
