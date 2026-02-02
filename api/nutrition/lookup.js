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
  const systemPrompt = `You are a nutrition assistant that parses food input and maps generic foods to USDA database names.

For each food item, return:
- name: The user-friendly display name
- quantity: Number (default 1)
- unit: Serving unit (piece, cup, slice, tbsp, etc.)
- usdaSearch: The EXACT USDA database search term (for generic foods only)
- usdaPortion: The USDA portion description to look for
- isGeneric: true if this is a generic food that exists in USDA, false for brands/restaurants
- brand: Brand name if applicable (null otherwise)
- restaurant: Restaurant name if applicable (null otherwise)

USDA naming conventions:
- "Banana, raw" not "banana"
- "Bread, white" not "white bread"
- "Grapes, raw" not "grapes"
- "Egg, whole, raw" or "Egg, whole, cooked, scrambled"
- "Chicken breast, cooked, grilled"
- "Rice, white, cooked"

USDA portion examples:
- "1 medium" for banana
- "1 slice" for bread
- "1 grape" for grapes (we'll multiply by quantity)
- "1 large" for eggs
- "1 cup" for rice

Return ONLY a JSON array. Example:
[
  {"name":"banana","quantity":1,"unit":"piece","usdaSearch":"Banana, raw","usdaPortion":"1 medium","isGeneric":true,"brand":null,"restaurant":null},
  {"name":"Fairlife milk","quantity":1,"unit":"cup","usdaSearch":null,"usdaPortion":null,"isGeneric":false,"brand":"Fairlife","restaurant":null},
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
    const params = new URLSearchParams({
      api_key: apiKey,
      query: query,
      pageSize: '10',
      dataType: 'Survey (FNDDS),SR Legacy,Foundation', // Prefer non-branded
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
 */
function findPortion(portions, item) {
  if (!portions || portions.length === 0) return null;

  const suggestedPortion = (item.usdaPortion || '').toLowerCase();
  const unit = (item.unit || 'piece').toLowerCase();

  // Try to find exact match first
  for (const p of portions) {
    const desc = (p.portionDescription || p.modifier || '').toLowerCase();
    if (desc.includes(suggestedPortion) || suggestedPortion.includes(desc)) {
      console.log(`[USDA] Portion match: "${desc}" for "${suggestedPortion}"`);
      return p;
    }
  }

  // Try to find by unit type
  const unitMappings = {
    'cup': ['cup'],
    'slice': ['slice'],
    'piece': ['whole', 'medium', '1 '],
    'tbsp': ['tablespoon', 'tbsp'],
    'tsp': ['teaspoon', 'tsp'],
  };

  const matches = unitMappings[unit] || [unit];
  for (const p of portions) {
    const desc = (p.portionDescription || p.modifier || '').toLowerCase();
    if (matches.some(m => desc.includes(m))) {
      console.log(`[USDA] Unit match: "${desc}" for unit "${unit}"`);
      return p;
    }
  }

  // Fall back to "quantity not specified" or first reasonable portion
  const defaultPortion = portions.find(p => {
    const desc = (p.portionDescription || '').toLowerCase();
    return desc.includes('quantity not specified') || desc.includes('medium');
  });

  return defaultPortion || portions.find(p => p.gramWeight && p.gramWeight !== 100);
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
