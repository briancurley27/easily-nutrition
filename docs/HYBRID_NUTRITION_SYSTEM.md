# Hybrid Nutrition System

A new architecture for nutrition lookup that combines USDA data accuracy with GPT flexibility.

## Overview

The hybrid system separates concerns:
1. **GPT** handles natural language parsing (what it's good at)
2. **USDA** provides authoritative nutrition data for generic foods
3. **GPT with web search** handles restaurants and brands not in USDA
4. **Caching** speeds up repeated lookups and reduces costs

## Architecture

```
User Input: "a banana and a Big Mac"
                    │
                    ▼
           ┌───────────────────┐
           │   GPT PARSING     │
           │   (lean prompt)   │
           └─────────┬─────────┘
                     │
     ┌───────────────┴───────────────┐
     ▼                               ▼
┌─────────────┐              ┌─────────────┐
│   banana    │              │   Big Mac   │
│  (generic)  │              │(restaurant) │
└──────┬──────┘              └──────┬──────┘
       │                            │
       ▼                            ▼
┌─────────────┐              ┌─────────────┐
│    USDA     │              │  GPT + Web  │
│  Database   │              │   Search    │
└──────┬──────┘              └──────┬──────┘
       │                            │
       └───────────┬────────────────┘
                   ▼
           ┌───────────────────┐
           │   Combined Result │
           │   with sources    │
           └───────────────────┘
```

## Data Source Priority

1. **Global Corrections** - Admin-verified overrides (highest trust)
2. **Cache** - Recent successful lookups
3. **USDA Database** - For generic foods and many brands
4. **GPT with Web Search** - For restaurants and brands not in USDA
5. **GPT Estimation** - Final fallback for unknowns

## Files Structure

```
easily-nutrition/
├── api/
│   ├── openai/
│   │   └── messages.js           # Original GPT endpoint (unchanged)
│   └── nutrition/
│       └── lookup.js             # NEW: Hybrid nutrition endpoint
├── src/
│   ├── services/
│   │   ├── usda.js               # USDA API service
│   │   └── nutritionOrchestrator.js  # Orchestration logic
│   ├── NutritionTest.js          # A/B comparison test page
│   └── App.js                    # Updated with /test route
├── supabase/
│   └── migrations/
│       └── 001_nutrition_hybrid_system.sql  # Database schema
└── docs/
    └── HYBRID_NUTRITION_SYSTEM.md  # This file
```

## Setup

### 1. Get a USDA API Key (Free)

1. Go to https://fdc.nal.usda.gov/api-key-signup.html
2. Sign up for a free API key
3. Add to `.env.local`:
   ```
   USDA_API_KEY=your_key_here
   ```

### 2. Run Database Migration

1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/migrations/001_nutrition_hybrid_system.sql`
3. Run the migration

### 3. Test the System

1. Start the dev server: `npm run dev`
2. Open http://localhost:3001/test
3. Try various inputs to compare old vs new system

## API Endpoints

### New: POST /api/nutrition/lookup

Hybrid nutrition lookup with USDA + GPT.

**Request:**
```json
{
  "input": "a banana and a Big Mac"
}
```

**Response:**
```json
{
  "items": [
    {
      "name": "banana",
      "quantity": 1,
      "unit": "piece",
      "calories": 105,
      "protein": 1,
      "carbs": 27,
      "fat": 0,
      "source": "USDA",
      "sourceDetail": "SR Legacy",
      "fdcId": 173944
    },
    {
      "name": "Big Mac",
      "quantity": 1,
      "unit": "piece",
      "calories": 590,
      "protein": 25,
      "carbs": 46,
      "fat": 34,
      "source": "GPT (web search)",
      "sourceDetail": "McDonald's official nutrition"
    }
  ],
  "timing": {
    "parse": 0.45,
    "lookup": 0.32,
    "total": 0.77
  },
  "sources": {
    "USDA": 1,
    "GPT (web search)": 1
  }
}
```

## Database Tables

### nutrition_cache
Caches successful lookups to reduce API calls.

| Column | Type | Description |
|--------|------|-------------|
| cache_key | text | Normalized food key (e.g., "mcdonald's:big_mac") |
| source_type | text | 'usda', 'gpt_web', 'gpt_estimate' |
| nutrition | jsonb | Cached nutrition data |
| expires_at | timestamptz | TTL varies by source |
| hit_count | integer | Popularity tracking |

### global_corrections
Admin-verified nutrition data that overrides everything.

| Column | Type | Description |
|--------|------|-------------|
| food_key | text | Normalized key for matching |
| food_name | text | Display name |
| brand | text | Brand if applicable |
| restaurant | text | Restaurant if applicable |
| calories/protein/carbs/fat | numeric | Verified values |
| verified_by | uuid | Admin who approved |

### pending_corrections
GPT web search results awaiting admin review.

| Column | Type | Description |
|--------|------|-------------|
| food_query | text | Original search query |
| gpt_result | jsonb | What GPT returned |
| status | text | pending/approved/rejected |

## Routing Logic

The system routes items based on keywords:

**Restaurant Keywords:**
- mcdonald, burger king, wendy, taco bell, chipotle, starbucks...
- Items matching these go to GPT with web search

**Brand Keywords:**
- fairlife, chobani, quest, cheerios, oreo, doritos...
- First tried in USDA, fallback to GPT web search

**Generic Foods:**
- Everything else → USDA first, GPT estimate fallback

## Benefits

| Metric | Old System | New System |
|--------|------------|------------|
| Speed (generic) | 1-2s | 0.3-0.5s |
| Speed (restaurant) | 2-4s | 1-2s |
| Accuracy (generic) | AI estimate | USDA verified |
| Consistency | Varies | Deterministic |
| Cost | ~2000 tokens | ~500 tokens + API |

## Future Enhancements

1. **Local USDA Database** - Download USDA data for faster lookups
2. **Admin Dashboard** - Review and approve pending corrections
3. **Smart Caching** - Learn user preferences and pre-cache
4. **Retry Button** - Let users trigger GPT web search for better results

## Testing

Visit `/test` in development to:
- Compare old vs new system side-by-side
- Run predefined test cases
- See timing and source breakdowns
- Verify routing logic

## Troubleshooting

**USDA returns no results:**
- Check API key is set in `.env.local`
- Verify key at https://api.nal.usda.gov/fdc/v1/foods/search?api_key=YOUR_KEY&query=banana

**GPT parsing fails:**
- Check OpenAI API key
- Check server logs for error details

**Cache not working:**
- Ensure database migration has been run
- Check Supabase connection
