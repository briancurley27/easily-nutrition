/**
 * Hybrid Nutrition Lookup API - GPT-to-USDA Translation Approach
 *
 * The key insight: GPT is good at understanding natural language,
 * USDA is good at providing accurate nutrition data.
 *
 * Flow:
 * 1. GPT parses natural language AND outputs USDA-compatible food names
 * 2. We query USDA with GPT's suggested names (exact or near-exact matches)
 * 3. For brands/restaurants, GPT provides nutrition directly
 *
 * This eliminates: complex scoring, keyword lists, threshold tuning
 */

const USDA_API_BASE = 'https://api.nal.usda.gov/fdc/v1';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const perfStart = performance.now();
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const USDA_API_KEY = process.env.USDA_API_KEY;

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  try {
    let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { input } = body;

    if (!input || typeof input !== 'string') {
      return res.status(400).json({ error: 'Input is required' });
    }

    console.log(`[Nutrition API] Processing: "${input.substring(0, 100)}..."`);

    // Step 1: GPT parses AND maps to USDA
    const parseStart = performance.now();
    const parsedItems = await parseAndMapWithGPT(input, OPENAI_API_KEY);
    const parseTime = (performance.now() - parseStart) / 1000;

    console.log(`[Nutrition API] GPT parsed ${parsedItems.length} items in ${parseTime.toFixed(2)}s`);

    if (parsedItems.length === 0) {
      return res.status(200).json({
        items: [],
        timing: { parse: parseTime, lookup: 0, total: parseTime },
        sources: {},
        message: 'No food items found in input',
      });
    }

    // Step 2: Look up nutrition for each item
    const lookupStart = performance.now();
    const results = await Promise.all(
      parsedItems.map(item => lookupNutrition(item, USDA_API_KEY, OPENAI_API_KEY))
    );
    const lookupTime = (performance.now() - lookupStart) / 1000;

    // Combine parsed items with nutrition results
    const items = parsedItems.map((parsed, i) => ({
      ...parsed,
      ...results[i],
      item: formatDisplayName(parsed),
    }));

    // Track sources
    const sources = {};
    items.forEach(item => {
      const source = item.source || 'unknown';
      sources[source] = (sources[source] || 0) + 1;
    });

    const totalTime = (performance.now() - perfStart) / 1000;
    console.log(`[Nutrition API] Complete in ${totalTime.toFixed(2)}s - Sources:`, sources);

    return res.status(200).json({
      items,
      timing: { parse: parseTime, lookup: lookupTime, total: totalTime },
      sources,
    });
  } catch (error) {
    console.error('[Nutrition API] Error:', error);
    return res.status(500).json({
      error: 'Failed to process nutrition request',
      message: error.message,
    });
  }
}

/**
 * GPT parses natural language AND outputs USDA-compatible queries
 * This is the key innovation - GPT knows USDA naming conventions
 */
async function parseAndMapWithGPT(input, apiKey) {
  const systemPrompt = `You are a nutrition assistant that parses food input and maps foods to USDA database names.

IMPORTANT: Most foods are GENERIC and exist in USDA. Only set isGeneric=false for:
- Specific BRAND names (Fairlife, Sweet Loren's, Kirkland, Sweet Baby Ray's, Want Want, etc.)
- Restaurant items (McDonald's, Chipotle, Starbucks, etc.)

Common brands to recognize (isGeneric=false):
- Fairlife, Chobani, Oatly (dairy/milk alternatives)
- Sweet Loren's, Lenny & Larry's (cookies)
- Kirkland, Great Value, Trader Joe's (store brands)
- Sweet Baby Ray's, Heinz (sauces)
- Want Want, Pocky (Asian snacks)

These ARE generic (isGeneric=true) - they exist in USDA:
- Soups (even "broccoli leek potato soup" → search "Soup, vegetable")
- Crackers (wheat crackers, saltines, etc.)
- Homemade items (homemade margarita → "Margarita")
- Basic foods with descriptors (popcorn kernels popped → "Popcorn, air-popped")
- Condiments (honey mustard → "Honey mustard dressing")
- Oils → "Oil, coconut" or "Oil, olive" (NOT null!)
- Breaded chicken → "Chicken, breaded, fried"

For each food item, return:
- name: Display name (INCLUDE brand if applicable: "Fairlife Low Fat Milk" not just "Low Fat Milk")
- quantity: Number (default 1)
- unit: Serving unit (piece, cup, slice, tbsp, etc.)
- usdaSearch: USDA search term (for generic foods). Use USDA naming style:
  - "Popcorn, air-popped" (NOT "popcorn kernels" which matches kernel oil)
  - "Soup, vegetable" for vegetable soups
  - "Crackers, wheat" for wheat crackers
  - "Margarita" for margaritas
  - "Chicken, breaded, cooked" for breaded chicken
- usdaPortion: USDA portion to look for
- isGeneric: true for most foods, false ONLY for specific brands/restaurants
- brand: Brand name if it's a branded product (Fairlife, Sweet Loren's, Kirkland, etc.)
- restaurant: Restaurant name if applicable

Return ONLY a JSON array. Examples:
[
  {"name":"banana","quantity":1,"unit":"piece","usdaSearch":"Banana, raw","usdaPortion":"1 medium","isGeneric":true,"brand":null,"restaurant":null},
  {"name":"Fairlife Low Fat Milk","quantity":1,"unit":"cup","usdaSearch":null,"usdaPortion":null,"isGeneric":false,"brand":"Fairlife","restaurant":null},
  {"name":"vegetable soup","quantity":1,"unit":"bowl","usdaSearch":"Soup, vegetable","usdaPortion":"1 cup","isGeneric":true,"brand":null,"restaurant":null},
  {"name":"wheat crackers","quantity":6,"unit":"piece","usdaSearch":"Crackers, wheat","usdaPortion":"1 cracker","isGeneric":true,"brand":null,"restaurant":null},
  {"name":"popcorn","quantity":6,"unit":"tbsp","usdaSearch":"Popcorn, air-popped","usdaPortion":"1 cup","isGeneric":true,"brand":null,"restaurant":null},
  {"name":"Big Mac","quantity":1,"unit":"piece","usdaSearch":null,"usdaPortion":null,"isGeneric":false,"brand":null,"restaurant":"McDonald's"}
]`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_completion_tokens: 1500,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Parse and map to USDA: "${input}"` },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GPT error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  const jsonMatch = content.match(/\[\s*\{[\s\S]*?\}\s*\]/);
  if (!jsonMatch) {
    console.error('[GPT Parse] No JSON found:', content);
    return [];
  }

  try {
    const items = JSON.parse(jsonMatch[0]);
    console.log('[GPT Parse] Mapped items:', items.map(i =>
      `${i.name} → ${i.isGeneric ? `USDA: "${i.usdaSearch}"` : `${i.brand || i.restaurant || 'GPT'}`}`
    ));
    return items;
  } catch (e) {
    console.error('[GPT Parse] JSON parse error:', e);
    return [];
  }
}

/**
 * Look up nutrition - use USDA for generics, GPT for brands/restaurants
 */
async function lookupNutrition(item, usdaApiKey, openaiApiKey) {
  // Generic foods with USDA mapping → query USDA
  if (item.isGeneric && item.usdaSearch && usdaApiKey) {
    const usdaResult = await lookupUSDA(item, usdaApiKey);
    if (usdaResult) {
      return usdaResult;
    }
    // USDA failed - fall back to GPT
    console.log(`[Lookup] USDA lookup failed for "${item.usdaSearch}", using GPT`);
  }

  // Brands/restaurants or USDA fallback → GPT with web search
  const useWebSearch = !item.isGeneric || item.brand || item.restaurant;
  console.log(`[Lookup] Using GPT ${useWebSearch ? '(web search)' : '(estimate)'} for: ${item.name}`);
  return await lookupWithGPT(item, openaiApiKey, useWebSearch);
}

/**
 * Look up food in USDA using GPT's suggested search term
 * Much simpler - we trust GPT's USDA mapping
 */
async function lookupUSDA(item, apiKey) {
  const query = item.usdaSearch;

  try {
    // Search USDA with GPT's suggested term
    // Note: dataType filter with comma-separated values causes 400 errors, so we skip it
    const params = new URLSearchParams({
      api_key: apiKey,
      query: query,
      pageSize: '10',
    });

    const searchResponse = await fetch(`${USDA_API_BASE}/foods/search?${params}`);
    if (!searchResponse.ok) {
      console.error(`[USDA] Search error: ${searchResponse.status}`);
      return null;
    }

    const searchData = await searchResponse.json();
    if (!searchData.foods || searchData.foods.length === 0) {
      console.log(`[USDA] No results for: ${query}`);
      return null;
    }

    // Take the first result - GPT gave us a good search term
    const food = searchData.foods[0];
    console.log(`[USDA] Found: "${food.description}" for query "${query}"`);

    // Get detailed food data with portions
    const detailResponse = await fetch(`${USDA_API_BASE}/food/${food.fdcId}?api_key=${apiKey}`);
    if (!detailResponse.ok) {
      console.error(`[USDA] Detail error: ${detailResponse.status}`);
      return calculateFromSearch(food, item);
    }

    const detailData = await detailResponse.json();
    const portions = detailData.foodPortions || [];

    console.log(`[USDA] Portions available:`, portions.slice(0, 5).map(p =>
      `${p.portionDescription || p.modifier || 'unnamed'} (${p.gramWeight}g)`
    ));

    // Find the portion GPT suggested, or a reasonable match
    const portion = findPortion(portions, item);

    if (portion) {
      const nutrients = detailData.foodNutrients || [];
      const result = calculateNutrition(nutrients, portion.gramWeight, item.quantity);

      return {
        ...result,
        source: 'USDA',
        fdcId: food.fdcId,
        matchedName: food.description,
        portion: portion.portionDescription || portion.modifier || 'serving',
        portionGrams: portion.gramWeight,
      };
    }

    // No portion match - use per-100g scaling
    return calculateFromSearch(food, item);

  } catch (error) {
    console.error('[USDA] Error:', error);
    return null;
  }
}

/**
 * Find a portion that matches what GPT suggested
 * Uses scoring to find the best match, not first match
 */
function findPortion(portions, item) {
  if (!portions || portions.length === 0) return null;

  const suggestedPortion = (item.usdaPortion || '').toLowerCase();
  const foodName = (item.name || '').toLowerCase();
  const unit = (item.unit || 'piece').toLowerCase();

  // Score each portion
  const scored = portions.map(p => {
    const desc = (p.portionDescription || p.modifier || '').toLowerCase();
    let score = 0;

    // Exact match with GPT's suggestion is best
    if (desc === suggestedPortion) {
      score += 200;
    } else if (desc.includes(suggestedPortion) && suggestedPortion.length > 3) {
      score += 100;
    }

    // Match food name in portion (e.g., "1 banana" for banana)
    if (desc.includes(foodName) || desc.includes(foodName.replace(/s$/, ''))) {
      score += 150;
    }

    // "medium" or "regular" is preferred for unspecified sizes
    if (desc.includes('medium') || desc.includes('regular')) {
      score += 80;
    }

    // Match unit type
    if (unit === 'slice' && desc.includes('slice')) {
      // Prefer regular slice over snack-size or thin
      if (!desc.includes('snack') && !desc.includes('thin') && !desc.includes('small')) {
        score += 70;
      } else {
        score += 30;
      }
    }
    if (unit === 'cup' && desc.includes('cup') && !desc.includes('mashed')) {
      score += 70;
    }
    if (unit === 'tbsp' && (desc.includes('tablespoon') || desc.includes('tbsp'))) {
      score += 70;
    }

    // "quantity not specified" is a decent fallback
    if (desc.includes('quantity not specified')) {
      score += 40;
    }

    // Penalize unusual portions
    if (desc.includes('mashed') || desc.includes('pureed') || desc.includes('baby')) {
      score -= 50;
    }
    if (desc.includes('snack') || desc.includes('mini') || desc.includes('thin')) {
      score -= 30;
    }
    if (desc.includes('crust not eaten') || desc.includes('without crust')) {
      score -= 40;  // "crust not eaten" is not a normal slice
    }

    return { portion: p, score, desc };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  console.log(`[USDA] Portion scores for "${suggestedPortion}":`, scored.slice(0, 4).map(s =>
    `"${s.desc}" = ${s.score}`
  ));

  // Return best match if it has any positive score
  if (scored[0] && scored[0].score > 0) {
    return scored[0].portion;
  }

  // Fall back to first reasonable portion
  return portions.find(p => p.gramWeight && p.gramWeight !== 100);
}

/**
 * Calculate nutrition from nutrients array and portion
 */
function calculateNutrition(nutrients, gramWeight, quantity) {
  const scale = (gramWeight / 100) * quantity;

  const getNutrient = (id) => {
    const n = nutrients.find(n => n.nutrient?.id === id || n.nutrientId === id);
    return (n?.amount ?? n?.value ?? 0) * scale;
  };

  return {
    calories: Math.round(getNutrient(1008)),
    protein: Math.round(getNutrient(1003) * 10) / 10,
    carbs: Math.round(getNutrient(1005) * 10) / 10,
    fat: Math.round(getNutrient(1004) * 10) / 10,
  };
}

/**
 * Calculate from search result (fallback when detail API fails)
 */
function calculateFromSearch(food, item) {
  const nutrients = food.foodNutrients || [];

  const getNutrient = (id) => {
    const n = nutrients.find(n => n.nutrientId === id);
    return n?.value ?? 0;
  };

  // Estimate serving size based on unit
  const servingSizes = {
    'piece': 100,
    'cup': 240,
    'slice': 30,
    'tbsp': 15,
    'tsp': 5,
    'oz': 28,
  };

  const grams = (servingSizes[item.unit] || 100) * item.quantity;
  const scale = grams / 100;

  return {
    calories: Math.round(getNutrient(1008) * scale),
    protein: Math.round(getNutrient(1003) * scale * 10) / 10,
    carbs: Math.round(getNutrient(1005) * scale * 10) / 10,
    fat: Math.round(getNutrient(1004) * scale * 10) / 10,
    source: 'USDA (estimated)',
    fdcId: food.fdcId,
    matchedName: food.description,
  };
}

/**
 * Look up with GPT (for brands, restaurants, or fallback)
 */
async function lookupWithGPT(item, apiKey, useWebSearch) {
  const foodDesc = item.restaurant
    ? `${item.name} from ${item.restaurant}`
    : item.brand
    ? `${item.brand} ${item.name}`
    : item.name;

  const systemPrompt = `Return accurate nutrition for "${foodDesc}" (${item.quantity} ${item.unit}).
${useWebSearch ? 'Search the web for official nutrition data from the brand/restaurant website.' : 'Provide your best estimate based on typical values.'}
Return ONLY JSON: {"calories":N,"protein":N,"carbs":N,"fat":N}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_completion_tokens: 300,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Nutrition for: ${foodDesc}` },
        ],
      }),
    });

    if (!response.ok) throw new Error(`GPT error: ${response.status}`);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*?\}/);

    if (!jsonMatch) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0, source: 'error' };
    }

    const nutrition = JSON.parse(jsonMatch[0]);
    return {
      calories: Math.round(nutrition.calories || 0),
      protein: Math.round((nutrition.protein || 0) * 10) / 10,
      carbs: Math.round((nutrition.carbs || 0) * 10) / 10,
      fat: Math.round((nutrition.fat || 0) * 10) / 10,
      source: useWebSearch ? 'GPT (web search)' : 'GPT (estimate)',
    };
  } catch (error) {
    console.error('[GPT] Error:', error);
    return { calories: 0, protein: 0, carbs: 0, fat: 0, source: 'error' };
  }
}

/**
 * Format display name
 */
function formatDisplayName(item) {
  const emoji = getEmoji(item.name);
  const qty = item.quantity !== 1 ? `${item.quantity} ` : '';
  return `${emoji}${qty}${capitalizeWords(item.name)}`.trim();
}

function getEmoji(name) {
  const lower = name.toLowerCase();
  const emojiMap = {
    'banana': '🍌 ', 'apple': '🍎 ', 'orange': '🍊 ', 'grape': '🍇 ',
    'pizza': '🍕 ', 'burger': '🍔 ', 'fries': '🍟 ', 'egg': '🥚 ',
    'bread': '🍞 ', 'chicken': '🍗 ', 'rice': '🍚 ', 'salad': '🥗 ',
    'coffee': '☕ ', 'milk': '🥛 ', 'cookie': '🍪 ', 'taco': '🌮 ',
  };
  for (const [food, emoji] of Object.entries(emojiMap)) {
    if (lower.includes(food)) return emoji;
  }
  return '';
}

function capitalizeWords(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}
