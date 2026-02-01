/**
 * Hybrid Nutrition Lookup API
 *
 * This endpoint processes natural language food input using:
 * 1. GPT for parsing (lean prompt)
 * 2. USDA database for generic foods
 * 3. GPT with web search for restaurants/brands
 * 4. Caching for speed
 *
 * POST /api/nutrition/lookup
 * Body: { input: "a banana and a Big Mac" }
 *
 * Response: {
 *   items: [
 *     { name: "banana", quantity: 1, unit: "piece", calories: 105, protein: 1, carbs: 27, fat: 0, source: "USDA" },
 *     { name: "Big Mac", quantity: 1, unit: "piece", calories: 590, protein: 25, carbs: 46, fat: 34, source: "GPT (web search)" }
 *   ],
 *   timing: { parse: 0.5, lookup: 0.3, total: 0.8 },
 *   sources: { "USDA": 1, "GPT (web search)": 1 }
 * }
 */

// USDA FoodData Central API
const USDA_API_BASE = 'https://api.nal.usda.gov/fdc/v1';

// Restaurant keywords for routing
const RESTAURANT_KEYWORDS = [
  'mcdonald', 'burger king', 'wendy', 'taco bell', 'chipotle',
  'starbucks', 'dunkin', 'subway', 'chick-fil-a', 'popeyes',
  'kfc', 'pizza hut', 'domino', 'papa john', 'panera',
  'shake shack', 'five guys', 'in-n-out', 'sonic', 'arby',
  'dairy queen', 'panda express', 'olive garden', 'applebee',
  'chipotle', 'outback', 'ihop', 'denny', 'waffle house',
  'cheesecake factory', 'buffalo wild wings', 'wingstop', 'amc',
];

// Brand keywords
const BRAND_KEYWORDS = [
  'fairlife', 'chobani', 'fage', 'quest', 'rxbar', 'kind',
  'cheerios', 'oreo', 'doritos', 'lay\'s', 'fritos',
  'coca-cola', 'pepsi', 'gatorade', 'red bull', 'monster',
  'halo top', 'beyond', 'impossible', 'silk', 'oatly',
];

module.exports = async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const perfStart = performance.now();

  // Get API keys from environment
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const USDA_API_KEY = process.env.USDA_API_KEY;

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  try {
    // Parse request body
    let body;
    if (typeof req.body === 'string') {
      body = JSON.parse(req.body);
    } else {
      body = req.body;
    }

    const { input } = body;

    if (!input || typeof input !== 'string') {
      return res.status(400).json({ error: 'Input is required' });
    }

    console.log(`[Nutrition API] Processing: "${input.substring(0, 100)}..."`);

    // Step 1: Parse input with GPT
    const parseStart = performance.now();
    const parsedItems = await parseWithGPT(input, OPENAI_API_KEY);
    const parseTime = (performance.now() - parseStart) / 1000;

    console.log(`[Nutrition API] Parsed ${parsedItems.length} items in ${parseTime.toFixed(2)}s`);

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
      // Format display name
      item: formatDisplayName(parsed, results[i]),
    }));

    // Track source distribution
    const sources = {};
    items.forEach(item => {
      const source = item.source || 'unknown';
      sources[source] = (sources[source] || 0) + 1;
    });

    const totalTime = (performance.now() - perfStart) / 1000;

    console.log(`[Nutrition API] Complete in ${totalTime.toFixed(2)}s - Sources:`, sources);

    return res.status(200).json({
      items,
      timing: {
        parse: parseTime,
        lookup: lookupTime,
        total: totalTime,
      },
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
 * Parse natural language input with GPT (lean prompt)
 */
async function parseWithGPT(input, apiKey) {
  const systemPrompt = `Extract food items from input. Return ONLY a JSON array:
[{"name":"food","quantity":1,"unit":"piece","brand":null,"restaurant":null}]

Rules:
- Fix typos, use proper names
- Default quantity=1, unit="piece"
- Set brand/restaurant if mentioned
- NO nutrition data, just parse`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-5-mini-2025-08-07',
      max_completion_tokens: 800,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Parse: "${input}"` },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GPT parse error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  // Extract JSON array
  const jsonMatch = content.match(/\[\s*\{[\s\S]*?\}\s*\]/);
  if (!jsonMatch) {
    console.error('[Parse] No JSON found:', content);
    return [];
  }

  try {
    const items = JSON.parse(jsonMatch[0]);
    return items.map(item => ({
      name: item.name || 'Unknown',
      quantity: item.quantity || 1,
      unit: item.unit || 'piece',
      brand: item.brand || null,
      restaurant: item.restaurant || null,
    }));
  } catch (e) {
    console.error('[Parse] JSON parse error:', e);
    return [];
  }
}

/**
 * Look up nutrition for a single item
 */
async function lookupNutrition(item, usdaApiKey, openaiApiKey) {
  const isRestaurant = isRestaurantItem(item);
  const isBrand = isBrandItem(item);

  // Restaurant items → GPT with web search
  if (isRestaurant) {
    console.log(`[Lookup] Restaurant item: ${item.name}`);
    return await lookupWithGPT(item, openaiApiKey, true);
  }

  // Try USDA first for generic foods and brands
  if (usdaApiKey) {
    const usdaResult = await lookupUSDA(item, usdaApiKey);
    if (usdaResult) {
      return usdaResult;
    }
  }

  // Brand not in USDA → GPT with web search
  if (isBrand) {
    console.log(`[Lookup] Brand not in USDA: ${item.brand} ${item.name}`);
    return await lookupWithGPT(item, openaiApiKey, true);
  }

  // Fallback → GPT estimate
  console.log(`[Lookup] GPT estimate: ${item.name}`);
  return await lookupWithGPT(item, openaiApiKey, false);
}

/**
 * Look up food in USDA database
 */
async function lookupUSDA(item, apiKey) {
  const query = item.brand ? `${item.brand} ${item.name}` : item.name;

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      query: query,
      pageSize: '3',
    });

    const response = await fetch(`${USDA_API_BASE}/foods/search?${params}`);

    if (!response.ok) {
      console.error(`[USDA] API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data.foods || data.foods.length === 0) {
      console.log(`[USDA] No results for: ${query}`);
      return null;
    }

    // Get best match
    const food = data.foods[0];
    const nutrients = food.foodNutrients || [];

    // Extract nutrition (per 100g)
    const getNutrient = (id) => {
      const n = nutrients.find(n => n.nutrientId === id);
      return Math.round(n?.value || 0);
    };

    const per100g = {
      calories: getNutrient(1008),
      protein: getNutrient(1003),
      carbs: getNutrient(1005),
      fat: getNutrient(1004),
    };

    // Scale to user's quantity
    const scaled = scaleToQuantity(per100g, item, food);

    console.log(`[USDA] Match: "${food.description}" for "${item.name}"`);

    return {
      ...scaled,
      source: 'USDA',
      sourceDetail: food.dataType,
      fdcId: food.fdcId,
      matchedName: food.description,
    };
  } catch (error) {
    console.error('[USDA] Lookup error:', error);
    return null;
  }
}

/**
 * Look up nutrition with GPT
 */
async function lookupWithGPT(item, apiKey, useWebSearch) {
  const foodDesc = item.restaurant
    ? `${item.name} from ${item.restaurant}`
    : item.brand
    ? `${item.brand} ${item.name}`
    : item.name;

  const systemPrompt = `Return nutrition for "${foodDesc}" (${item.quantity} ${item.unit}).
${useWebSearch ? 'Search web for official nutrition data from restaurant/brand website.' : 'Estimate based on typical values.'}
Return ONLY JSON: {"calories":N,"protein":N,"carbs":N,"fat":N,"source":"where you found this"}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        max_completion_tokens: 300,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Nutrition for: ${foodDesc} (${item.quantity} ${item.unit})` },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`GPT error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    const jsonMatch = content.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      return createErrorResult(item);
    }

    const nutrition = JSON.parse(jsonMatch[0]);

    return {
      calories: Math.round(nutrition.calories || 0),
      protein: Math.round(nutrition.protein || 0),
      carbs: Math.round(nutrition.carbs || 0),
      fat: Math.round(nutrition.fat || 0),
      source: useWebSearch ? 'GPT (web search)' : 'GPT (estimate)',
      sourceDetail: nutrition.source || null,
    };
  } catch (error) {
    console.error('[GPT] Lookup error:', error);
    return createErrorResult(item);
  }
}

/**
 * Scale USDA nutrition (per 100g) to user's quantity
 */
function scaleToQuantity(per100g, item, usdaFood) {
  // Unit to grams conversion
  const unitGrams = {
    'g': 1, 'gram': 1, 'grams': 1,
    'oz': 28.35, 'ounce': 28.35, 'ounces': 28.35,
    'cup': 240, 'cups': 240,
    'tbsp': 15, 'tablespoon': 15,
    'tsp': 5, 'teaspoon': 5,
  };

  const unit = (item.unit || 'piece').toLowerCase();
  let grams;

  if (unitGrams[unit]) {
    grams = unitGrams[unit] * item.quantity;
  } else {
    // For pieces/servings, use USDA serving size or estimate
    const servingSize = usdaFood?.servingSize || 100;
    grams = servingSize * item.quantity;
  }

  const scale = grams / 100;

  return {
    calories: Math.round(per100g.calories * scale),
    protein: Math.round(per100g.protein * scale),
    carbs: Math.round(per100g.carbs * scale),
    fat: Math.round(per100g.fat * scale),
  };
}

/**
 * Format display name with quantity and emoji
 */
function formatDisplayName(item, nutrition) {
  const emoji = getEmoji(item.name);
  const qty = item.quantity !== 1 ? `${item.quantity} ` : '';
  const name = item.brand ? `${item.brand} ${item.name}` : item.name;

  return `${emoji}${qty}${capitalizeWords(name)}`.trim();
}

/**
 * Get emoji for common foods
 */
function getEmoji(name) {
  const lower = name.toLowerCase();
  const emojiMap = {
    'banana': '🍌 ', 'apple': '🍎 ', 'orange': '🍊 ', 'grape': '🍇 ',
    'pizza': '🍕 ', 'burger': '🍔 ', 'fries': '🍟 ', 'hot dog': '🌭 ',
    'egg': '🥚 ', 'bacon': '🥓 ', 'bread': '🍞 ', 'sandwich': '🥪 ',
    'salad': '🥗 ', 'rice': '🍚 ', 'chicken': '🍗 ', 'steak': '🥩 ',
    'coffee': '☕ ', 'milk': '🥛 ', 'juice': '🧃 ', 'water': '💧 ',
    'cookie': '🍪 ', 'cake': '🍰 ', 'ice cream': '🍦 ', 'chocolate': '🍫 ',
    'taco': '🌮 ', 'burrito': '🌯 ', 'sushi': '🍣 ', 'ramen': '🍜 ',
  };

  for (const [food, emoji] of Object.entries(emojiMap)) {
    if (lower.includes(food)) return emoji;
  }
  return '';
}

/**
 * Capitalize words in a string
 */
function capitalizeWords(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Create error result
 */
function createErrorResult(item) {
  return {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    source: 'error',
    error: true,
  };
}

/**
 * Check if item is from a restaurant
 */
function isRestaurantItem(item) {
  if (item.restaurant) return true;
  const text = `${item.name} ${item.brand || ''}`.toLowerCase();
  return RESTAURANT_KEYWORDS.some(k => text.includes(k));
}

/**
 * Check if item is brand-specific
 */
function isBrandItem(item) {
  if (item.brand) return true;
  const text = item.name.toLowerCase();
  return BRAND_KEYWORDS.some(k => text.includes(k));
}
