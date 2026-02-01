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
 * Uses two-step process: search, then get detailed food data with portions
 */
async function lookupUSDA(item, apiKey) {
  const query = item.brand ? `${item.brand} ${item.name}` : item.name;
  const hasBrand = !!item.brand;

  try {
    // Step 1: Search for the food
    const params = new URLSearchParams({
      api_key: apiKey,
      query: query,
      pageSize: '25', // Get more results for better matching
    });

    // Note: We fetch all data types and use smart matching to filter
    // The dataType filter with comma-separated values doesn't work well

    const searchResponse = await fetch(`${USDA_API_BASE}/foods/search?${params}`);

    if (!searchResponse.ok) {
      console.error(`[USDA] Search API error: ${searchResponse.status}`);
      return null;
    }

    const searchData = await searchResponse.json();

    if (!searchData.foods || searchData.foods.length === 0) {
      console.log(`[USDA] No results for: ${query}`);
      return null;
    }

    console.log(`[USDA] Got ${searchData.foods.length} results for "${query}"`);

    // Find the best match using smart matching logic
    const food = findBestFoodMatch(searchData.foods, item, hasBrand);

    if (!food) {
      console.log(`[USDA] No suitable match found for: ${query}`);
      return null;
    }

    console.log(`[USDA] Selected: "${food.description}" (FDC ID: ${food.fdcId}, Type: ${food.dataType})`);
    console.log(`[USDA] Top 5 results:`, searchData.foods.slice(0, 5).map(f => `${f.description} [${f.dataType}]`));

    // Step 2: Get detailed food data with portions
    const detailResponse = await fetch(`${USDA_API_BASE}/food/${food.fdcId}?api_key=${apiKey}`);

    if (!detailResponse.ok) {
      console.error(`[USDA] Detail API error: ${detailResponse.status}`);
      // Fall back to search data scaling if detail fails
      return lookupUSDAFallback(food, item);
    }

    const detailData = await detailResponse.json();

    // Get available portions from USDA
    const portions = detailData.foodPortions || [];
    console.log(`[USDA] Available portions:`, portions.map(p =>
      `${p.portionDescription || p.modifier || 'unnamed'} (${p.gramWeight}g)`
    ));

    // Find the best matching portion for user's input
    const matchedPortion = findBestPortion(portions, item);

    if (matchedPortion) {
      // Use USDA's portion data - much more accurate!
      const portionDesc = matchedPortion.portionDescription || matchedPortion.modifier || 'serving';
      console.log(`[USDA] Using portion: "${portionDesc}" (${matchedPortion.gramWeight}g)`);

      // Get nutrients and calculate for this portion
      const nutrients = detailData.foodNutrients || [];
      const result = calculateNutritionForPortion(nutrients, matchedPortion, item.quantity);

      return {
        ...result,
        source: 'USDA',
        sourceDetail: `${food.dataType} - ${portionDesc}`,
        fdcId: food.fdcId,
        matchedName: food.description,
        portion: portionDesc,
        portionGrams: matchedPortion.gramWeight,
        debug: {
          availablePortions: portions.map(p => `${p.portionDescription || p.modifier} (${p.gramWeight}g)`).slice(0, 6),
          usedPortion: portionDesc,
          portionGrams: matchedPortion.gramWeight,
          method: 'USDA portion (no scaling needed)',
        },
      };
    }

    // No good portion match - fall back to per-100g scaling
    console.log(`[USDA] No portion match found, falling back to per-100g scaling`);
    return lookupUSDAFallback(food, item, detailData.foodNutrients);

  } catch (error) {
    console.error('[USDA] Lookup error:', error);
    return null;
  }
}

/**
 * Find the best food match from USDA search results
 * Prioritizes: raw over cooked, non-branded for generic queries (only if good alternatives exist)
 */
function findBestFoodMatch(foods, item, hasBrand = false) {
  if (!foods || foods.length === 0) return null;
  if (foods.length === 1) return foods[0];

  const queryLower = item.name.toLowerCase().trim();

  // Words that indicate a processed/cooked version (avoid for generic queries)
  const cookedIndicators = ['baked', 'cooked', 'fried', 'roasted', 'grilled', 'steamed', 'boiled', 'sauteed', 'braised'];

  // Words that indicate it's a recipe/dish, not the base food (penalize heavily)
  const recipeIndicators = ['sandwich', 'salad', 'soup', 'stew', 'casserole', 'pie', 'cake', 'with', 'and'];

  // Score each food item (WITHOUT branded penalty first)
  const scored = foods.map(food => {
    const desc = food.description.toLowerCase();
    let score = 0;

    // Exact match or starts with query is best
    if (desc === queryLower || desc.startsWith(queryLower + ',') || desc.startsWith(queryLower + ' ')) {
      score += 100;
    }

    // Contains "raw" is good for produce/meat
    if (desc.includes('raw')) {
      score += 50;
    }

    // Penalize cooked/processed versions (unless user specified)
    const userSpecifiedCooked = cookedIndicators.some(c => queryLower.includes(c));
    if (!userSpecifiedCooked) {
      cookedIndicators.forEach(indicator => {
        if (desc.includes(indicator)) {
          score -= 40;
        }
      });
    }

    // Penalize recipes/dishes that contain the food but aren't the food itself
    recipeIndicators.forEach(indicator => {
      if (desc.includes(indicator) && !queryLower.includes(indicator)) {
        score -= 50;
      }
    });

    // Prefer Survey (FNDDS) for common foods - has good portion data
    if (food.dataType === 'Survey (FNDDS)') {
      score += 30;
    }

    // Prefer SR Legacy for comprehensive data
    if (food.dataType === 'SR Legacy') {
      score += 25;
    }

    // Foundation is also good
    if (food.dataType === 'Foundation') {
      score += 20;
    }

    // Penalize very long descriptions (usually too specific)
    if (desc.length > 60) {
      score -= 15;
    }

    // Bonus if description contains the exact query word
    if (desc.includes(queryLower)) {
      score += 25;
    }

    // Bonus for simple, short descriptions
    if (desc.length < 30) {
      score += 10;
    }

    return { food, score, desc, isBranded: food.dataType === 'Branded' };
  });

  // Check if there are good non-branded alternatives
  const nonBrandedResults = scored.filter(s => !s.isBranded);
  const bestNonBrandedScore = nonBrandedResults.length > 0
    ? Math.max(...nonBrandedResults.map(s => s.score))
    : -999;

  // Only penalize branded items if there's a good non-branded alternative (score >= 50)
  // This way "Whopper" still matches the branded Whopper, but "banana" prefers the generic
  if (!hasBrand && bestNonBrandedScore >= 50) {
    scored.forEach(s => {
      if (s.isBranded) {
        s.score -= 200;
        s.penalizedForBranded = true;
      }
    });
    console.log(`[USDA] Good non-branded alternatives exist (best score: ${bestNonBrandedScore}), penalizing branded items`);
  } else {
    console.log(`[USDA] No good non-branded alternatives (best: ${bestNonBrandedScore}), keeping branded items`);
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  console.log(`[USDA] Match scores:`, scored.slice(0, 8).map(s =>
    `"${s.food.description.substring(0, 35)}" [${s.food.dataType}] = ${s.score}${s.penalizedForBranded ? ' (branded penalty)' : ''}`
  ));

  return scored[0].food;
}

/**
 * Find the best USDA portion match for user's input
 */
function findBestPortion(portions, item) {
  if (!portions || portions.length === 0) return null;

  const unit = (item.unit || 'piece').toLowerCase();
  const foodName = item.name.toLowerCase();

  // First priority: look for a portion that matches the food name (e.g., "1 banana" for banana)
  const foodNamePortion = portions.find(p => {
    const desc = (p.portionDescription || p.modifier || '').toLowerCase();
    return desc.includes(`1 ${foodName}`) || desc === foodName;
  });
  if (foodNamePortion) return foodNamePortion;

  // Second: match by unit type
  const unitMappings = {
    'piece': ['quantity not specified', '1 '],
    'slice': ['slice'],
    'cup': ['cup'],
    'tbsp': ['tablespoon', 'tbsp'],
    'tsp': ['teaspoon', 'tsp'],
    'oz': ['ounce', 'oz'],
  };

  const unitMatches = unitMappings[unit] || [unit];
  const unitPortion = portions.find(p => {
    const desc = (p.portionDescription || p.modifier || '').toLowerCase();
    return unitMatches.some(u => desc.includes(u));
  });
  if (unitPortion) return unitPortion;

  // Third: "quantity not specified" is often the default serving
  const defaultPortion = portions.find(p => {
    const desc = (p.portionDescription || p.modifier || '').toLowerCase();
    return desc.includes('quantity not specified');
  });
  if (defaultPortion) return defaultPortion;

  // Last resort: first non-100g portion
  const nonBasePortion = portions.find(p => p.gramWeight && p.gramWeight !== 100);
  return nonBasePortion || null;
}

/**
 * Calculate nutrition values for a specific USDA portion
 * USDA nutrients are per 100g, so we scale by the portion's gram weight
 */
function calculateNutritionForPortion(nutrients, portion, quantity) {
  const scale = (portion.gramWeight / 100) * quantity;

  const getNutrient = (id) => {
    // Detail API uses nested nutrient object
    const n = nutrients.find(n => n.nutrient?.id === id || n.nutrientId === id);
    const value = n?.amount ?? n?.value ?? 0;
    return value * scale;
  };

  return {
    calories: Math.round(getNutrient(1008)),
    protein: Math.round(getNutrient(1003) * 10) / 10, // 1 decimal
    carbs: Math.round(getNutrient(1005) * 10) / 10,
    fat: Math.round(getNutrient(1004) * 10) / 10,
  };
}

/**
 * Fallback when portion data isn't available - use per-100g scaling
 */
function lookupUSDAFallback(food, item, detailNutrients = null) {
  const nutrients = detailNutrients || food.foodNutrients || [];

  const getNutrient = (id) => {
    const n = nutrients.find(n => n.nutrientId === id || n.nutrient?.id === id);
    return n?.value ?? n?.amount ?? 0;
  };

  const per100g = {
    calories: getNutrient(1008),
    protein: getNutrient(1003),
    carbs: getNutrient(1005),
    fat: getNutrient(1004),
  };

  console.log(`[USDA Fallback] Per 100g: cal=${per100g.calories}, p=${per100g.protein}, c=${per100g.carbs}, f=${per100g.fat}`);

  const scaled = scaleToQuantity(per100g, item, food);

  return {
    ...scaled,
    source: 'USDA',
    sourceDetail: `${food.dataType} (scaled from 100g)`,
    fdcId: food.fdcId,
    matchedName: food.description,
    debug: {
      per100g,
      method: 'Scaled from 100g (no portion match)',
      scaledGrams: scaled.grams,
    },
  };
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

  // Common food serving sizes in grams (for "piece" units)
  const defaultServingSizes = {
    'banana': 118,      // medium banana
    'apple': 182,       // medium apple
    'orange': 131,      // medium orange
    'egg': 50,          // large egg
    'eggs': 50,
    'slice': 30,        // slice of bread
  };

  const unit = (item.unit || 'piece').toLowerCase();
  let grams;
  let gramsSource;

  if (unitGrams[unit]) {
    grams = unitGrams[unit] * item.quantity;
    gramsSource = `unit conversion (${unit} = ${unitGrams[unit]}g)`;
  } else {
    // For pieces/servings, check if we have a default serving size for this food
    const foodLower = item.name.toLowerCase();
    const defaultSize = Object.entries(defaultServingSizes).find(([food]) =>
      foodLower.includes(food)
    );

    if (defaultSize) {
      grams = defaultSize[1] * item.quantity;
      gramsSource = `default serving size (${defaultSize[0]} = ${defaultSize[1]}g)`;
    } else if (usdaFood?.servingSize && usdaFood.servingSize > 0) {
      grams = usdaFood.servingSize * item.quantity;
      gramsSource = `USDA serving size (${usdaFood.servingSize}g)`;
    } else {
      // Last resort: assume 100g per piece
      grams = 100 * item.quantity;
      gramsSource = 'default (100g per piece)';
    }
  }

  const scale = grams / 100;

  console.log(`[USDA Scale] ${item.quantity} ${item.unit} of "${item.name}" = ${grams}g (${gramsSource}), scale=${scale.toFixed(2)}`);

  return {
    calories: Math.round(per100g.calories * scale),
    protein: Math.round(per100g.protein * scale),
    carbs: Math.round(per100g.carbs * scale),
    fat: Math.round(per100g.fat * scale),
    grams,
    gramsSource,
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
