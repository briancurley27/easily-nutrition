/**
 * Nutrition Orchestrator Service
 *
 * Coordinates the hybrid nutrition lookup system:
 * 1. GPT parses natural language → structured food items
 * 2. Route each item to the appropriate source (USDA, cache, GPT)
 * 3. Return unified results
 *
 * Data source priority:
 * 1. Global corrections (admin-verified overrides)
 * 2. Cache (recent successful lookups)
 * 3. USDA database (for generic foods)
 * 4. GPT with web search (for restaurants, brands not in USDA)
 * 5. GPT estimation (final fallback)
 */

import { searchFoods, scaleNutrition } from './usda.js';

// Restaurant/chain keywords for routing
const RESTAURANT_KEYWORDS = [
  'mcdonald', 'burger king', 'wendy', 'taco bell', 'chipotle',
  'starbucks', 'dunkin', 'subway', 'chick-fil-a', 'popeyes',
  'kfc', 'pizza hut', 'domino', 'papa john', 'little caesar',
  'panera', 'shake shack', 'five guys', 'in-n-out', 'whataburger',
  'sonic', 'arby', 'jack in the box', 'carl\'s jr', 'hardee',
  'dairy queen', 'baskin', 'cold stone', 'krispy kreme',
  'panda express', 'olive garden', 'applebee', 'chili\'s',
  'outback', 'red lobster', 'cracker barrel', 'ihop', 'denny',
  'waffle house', 'cheesecake factory', 'buffalo wild wings',
  'wingstop', 'raising cane', 'culver', 'zaxby', 'bojangle',
  'el pollo loco', 'del taco', 'qdoba', 'moe\'s', 'wawa',
  'sheetz', '7-eleven', 'tim horton', 'auntie anne', 'cinnabon',
  'jamba', 'smoothie king', 'tropical smoothie', 'amc', 'regal',
  'costco', 'sam\'s club', 'trader joe', 'whole foods',
];

// Brand keywords that suggest looking beyond USDA generic data
const BRAND_KEYWORDS = [
  'fairlife', 'chobani', 'fage', 'siggi', 'oikos', 'yoplait',
  'quest', 'rxbar', 'kind', 'clif', 'larabar', 'nature valley',
  'cheerios', 'special k', 'frosted flakes', 'lucky charms',
  'oreo', 'chips ahoy', 'goldfish', 'cheez-it', 'ritz',
  'doritos', 'cheetos', 'lay\'s', 'fritos', 'pringles', 'tostitos',
  'coca-cola', 'pepsi', 'sprite', 'fanta', 'dr pepper', 'mountain dew',
  'gatorade', 'powerade', 'body armor', 'prime', 'celsius',
  'red bull', 'monster', 'bang', 'reign',
  'halo top', 'enlightened', 'ben & jerry', 'haagen-dazs', 'talenti',
  'beyond', 'impossible', 'morningstar', 'boca', 'gardein',
  'muscle milk', 'premier protein', 'fairlife', 'core power',
  'silk', 'almond breeze', 'oatly', 'califia',
];

/**
 * Main entry point: Process natural language food input
 * @param {string} input - User's natural language food description
 * @param {Object} config - Configuration object
 * @returns {Promise<Object>} Processed results with nutrition data
 */
export async function processNutritionInput(input, config) {
  const {
    usdaApiKey,
    openaiApiKey,
    supabaseClient,
    enableCache = true,
    enableGlobalCorrections = true,
  } = config;

  const perfStart = performance.now();
  const results = {
    items: [],
    parseTime: 0,
    lookupTime: 0,
    totalTime: 0,
    sources: {},
  };

  try {
    // Step 1: Parse input with GPT (lean prompt - extraction only)
    console.log('[Orchestrator] Step 1: Parsing input with GPT...');
    const parseStart = performance.now();
    const parsedItems = await parseWithGPT(input, openaiApiKey);
    results.parseTime = performance.now() - parseStart;
    console.log(`[Orchestrator] Parsed ${parsedItems.length} items in ${(results.parseTime / 1000).toFixed(2)}s`);

    if (parsedItems.length === 0) {
      console.warn('[Orchestrator] No items parsed from input');
      return results;
    }

    // Step 2: Look up nutrition for each item
    console.log('[Orchestrator] Step 2: Looking up nutrition data...');
    const lookupStart = performance.now();

    const lookupPromises = parsedItems.map(item =>
      lookupNutrition(item, {
        usdaApiKey,
        openaiApiKey,
        supabaseClient,
        enableCache,
        enableGlobalCorrections,
      })
    );

    const nutritionResults = await Promise.all(lookupPromises);
    results.lookupTime = performance.now() - lookupStart;

    // Step 3: Compile results
    results.items = nutritionResults.map((nutrition, index) => ({
      ...parsedItems[index],
      ...nutrition,
    }));

    // Track source distribution
    results.items.forEach(item => {
      const source = item.source || 'unknown';
      results.sources[source] = (results.sources[source] || 0) + 1;
    });

    results.totalTime = performance.now() - perfStart;
    console.log(`[Orchestrator] Complete in ${(results.totalTime / 1000).toFixed(2)}s - Sources:`, results.sources);

    return results;
  } catch (error) {
    console.error('[Orchestrator] Error:', error);
    throw error;
  }
}

/**
 * Parse natural language input into structured food items using GPT
 * This is a LEAN prompt - just extraction, no nutrition lookup
 */
async function parseWithGPT(input, apiKey) {
  const systemPrompt = `You are a food parser. Extract food items from the user's input.

OUTPUT FORMAT: Return ONLY a JSON array. No other text.
[
  {"name": "food name", "quantity": 1, "unit": "piece", "brand": null, "restaurant": null},
  ...
]

RULES:
- Extract the canonical food name (e.g., "Big Mac" not "a big mac")
- Determine quantity (default 1 if not specified)
- Determine unit: piece, cup, oz, slice, serving, g, etc. (default "piece")
- If a brand is mentioned (e.g., "Fairlife milk"), set brand field
- If a restaurant is mentioned (e.g., "McDonald's fries"), set restaurant field
- Fix typos and use proper names
- Do NOT include nutrition data - just parse the input

EXAMPLES:
Input: "a banana and 2 eggs"
Output: [{"name": "banana", "quantity": 1, "unit": "piece", "brand": null, "restaurant": null}, {"name": "eggs", "quantity": 2, "unit": "piece", "brand": null, "restaurant": null}]

Input: "Big Mac and large fries from McDonald's"
Output: [{"name": "Big Mac", "quantity": 1, "unit": "piece", "brand": null, "restaurant": "McDonald's"}, {"name": "large fries", "quantity": 1, "unit": "serving", "brand": null, "restaurant": "McDonald's"}]

Input: "cup of Fairlife chocolate milk"
Output: [{"name": "chocolate milk", "quantity": 1, "unit": "cup", "brand": "Fairlife", "restaurant": null}]`;

  try {
    const response = await fetch('/api/openai/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        max_completion_tokens: 1000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Parse: "${input}"` },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`GPT API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Extract JSON array from response
    const jsonMatch = content.match(/\[\s*\{[\s\S]*?\}\s*\]/);
    if (!jsonMatch) {
      console.error('[Orchestrator] No JSON found in GPT parse response:', content);
      return [];
    }

    const items = JSON.parse(jsonMatch[0]);
    return items.map(item => ({
      name: item.name || 'Unknown',
      quantity: item.quantity || 1,
      unit: item.unit || 'piece',
      brand: item.brand || null,
      restaurant: item.restaurant || null,
      originalInput: input,
    }));
  } catch (error) {
    console.error('[Orchestrator] GPT parse error:', error);
    throw error;
  }
}

/**
 * Look up nutrition for a single parsed food item
 * Routes to the appropriate source based on item characteristics
 */
async function lookupNutrition(item, config) {
  const { usdaApiKey, openaiApiKey, supabaseClient, enableCache, enableGlobalCorrections } = config;

  const cacheKey = normalizeCacheKey(item);
  console.log(`[Orchestrator] Looking up: "${item.name}" (${item.quantity} ${item.unit})`);

  // 1. Check global corrections first
  if (enableGlobalCorrections && supabaseClient) {
    const correction = await checkGlobalCorrections(cacheKey, supabaseClient);
    if (correction) {
      console.log(`[Orchestrator] Found global correction for "${item.name}"`);
      return scaleNutritionResult(correction, item);
    }
  }

  // 2. Check cache
  if (enableCache && supabaseClient) {
    const cached = await checkCache(cacheKey, supabaseClient);
    if (cached) {
      console.log(`[Orchestrator] Cache hit for "${item.name}"`);
      return scaleNutritionResult(cached, item);
    }
  }

  // 3. Determine routing: restaurant vs generic
  const isRestaurant = isRestaurantItem(item);
  const isBrandSpecific = isBrandItem(item);

  if (isRestaurant) {
    // Route to GPT with web search for restaurant items
    console.log(`[Orchestrator] Restaurant item detected, using GPT web search`);
    return await lookupWithGPT(item, openaiApiKey, true, supabaseClient, cacheKey);
  }

  // 4. Try USDA for generic foods and many brands
  if (usdaApiKey) {
    try {
      const searchQuery = item.brand
        ? `${item.brand} ${item.name}`
        : item.name;

      const usdaResults = await searchFoods(searchQuery, usdaApiKey, {
        pageSize: 3,
        // If brand specified, search branded foods first
        dataType: item.brand ? 'Branded' : null,
      });

      if (usdaResults.length > 0) {
        const best = selectBestUSDAMatch(usdaResults, item);
        if (best) {
          console.log(`[Orchestrator] USDA match for "${item.name}": ${best.name}`);

          // Scale to user's quantity
          const scaled = scaleNutrition(best, item.quantity, item.unit);
          const result = {
            calories: scaled.calories,
            protein: scaled.protein,
            carbs: scaled.carbs,
            fat: scaled.fat,
            source: 'USDA',
            sourceDetail: best.dataType,
            fdcId: best.fdcId,
            matchedName: best.name,
          };

          // Cache the result
          if (enableCache && supabaseClient) {
            await saveToCache(cacheKey, result, 'usda', supabaseClient);
          }

          return result;
        }
      }
    } catch (error) {
      console.error(`[Orchestrator] USDA lookup failed for "${item.name}":`, error);
      // Fall through to GPT
    }
  }

  // 5. Brand not in USDA - try GPT with web search
  if (isBrandSpecific) {
    console.log(`[Orchestrator] Brand "${item.brand}" not in USDA, using GPT web search`);
    return await lookupWithGPT(item, openaiApiKey, true, supabaseClient, cacheKey);
  }

  // 6. Final fallback: GPT estimation (no web search)
  console.log(`[Orchestrator] Using GPT estimation for "${item.name}"`);
  return await lookupWithGPT(item, openaiApiKey, false, supabaseClient, cacheKey);
}

/**
 * Select the best USDA match from search results
 */
function selectBestUSDAMatch(results, item) {
  if (results.length === 0) return null;

  // If brand specified, prefer branded match
  if (item.brand) {
    const brandMatch = results.find(r =>
      r.brand && r.brand.toLowerCase().includes(item.brand.toLowerCase())
    );
    if (brandMatch) return brandMatch;
  }

  // Otherwise return the first (most relevant) result
  return results[0];
}

/**
 * Look up nutrition using GPT (with optional web search)
 */
async function lookupWithGPT(item, apiKey, useWebSearch, supabaseClient, cacheKey) {
  const systemPrompt = `You are a nutrition lookup assistant. Return nutrition data for the specified food.

OUTPUT FORMAT: Return ONLY a JSON object. No other text.
{
  "calories": number,
  "protein": number (grams),
  "carbs": number (grams),
  "fat": number (grams),
  "source": "string describing where you found this data",
  "confidence": "high" | "medium" | "low"
}

${useWebSearch ? `
IMPORTANT: This is a restaurant/brand item. Search the web to find accurate nutrition information from:
- The restaurant's official website
- The brand's official website
- Reliable nutrition databases

Use the OFFICIAL nutrition data, not estimates.` : `
This is a generic food item. Use your knowledge to provide a reasonable estimate.
Base your estimate on USDA data or standard nutrition references.`}

RULES:
- Return nutrition for the EXACT quantity specified
- Be accurate - users are tracking their nutrition
- If you searched the web, cite the source
- Round to whole numbers`;

  const userMessage = item.restaurant
    ? `${item.name} from ${item.restaurant} (${item.quantity} ${item.unit})`
    : item.brand
    ? `${item.brand} ${item.name} (${item.quantity} ${item.unit})`
    : `${item.name} (${item.quantity} ${item.unit})`;

  try {
    const response = await fetch('/api/openai/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        max_completion_tokens: 500,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        // Enable web search for restaurant/brand lookups
        ...(useWebSearch && { web_search: { enabled: true } }),
      }),
    });

    if (!response.ok) {
      throw new Error(`GPT API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      console.error('[Orchestrator] No JSON in GPT nutrition response:', content);
      return createFallbackResult(item);
    }

    const nutrition = JSON.parse(jsonMatch[0]);

    const result = {
      calories: Math.round(nutrition.calories || 0),
      protein: Math.round(nutrition.protein || 0),
      carbs: Math.round(nutrition.carbs || 0),
      fat: Math.round(nutrition.fat || 0),
      source: useWebSearch ? 'GPT (web search)' : 'GPT (estimate)',
      sourceDetail: nutrition.source || null,
      confidence: nutrition.confidence || 'medium',
    };

    // Cache successful lookups
    if (supabaseClient && result.calories > 0) {
      const cacheType = useWebSearch ? 'gpt_web' : 'gpt_estimate';
      await saveToCache(cacheKey, result, cacheType, supabaseClient);

      // If web search was used and confidence is high, log for admin review
      if (useWebSearch && result.confidence === 'high') {
        await logForReview(item, result, supabaseClient);
      }
    }

    return result;
  } catch (error) {
    console.error('[Orchestrator] GPT nutrition lookup failed:', error);
    return createFallbackResult(item);
  }
}

/**
 * Create a fallback result when all lookups fail
 */
function createFallbackResult(item) {
  return {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    source: 'error',
    error: true,
    message: `Could not find nutrition data for "${item.name}"`,
  };
}

/**
 * Scale nutrition result based on item quantity
 */
function scaleNutritionResult(nutrition, item) {
  // If nutrition is already for the correct quantity, return as-is
  // Otherwise, would need base values and scaling logic
  return {
    ...nutrition,
    source: nutrition.source || 'cached',
  };
}

/**
 * Normalize cache key from item
 */
function normalizeCacheKey(item) {
  const parts = [];
  if (item.restaurant) parts.push(item.restaurant.toLowerCase());
  if (item.brand) parts.push(item.brand.toLowerCase());
  parts.push(item.name.toLowerCase().trim());
  return parts.join(':').replace(/\s+/g, '_');
}

/**
 * Check global corrections table
 */
async function checkGlobalCorrections(cacheKey, supabase) {
  try {
    const { data, error } = await supabase
      .from('global_corrections')
      .select('*')
      .eq('food_key', cacheKey)
      .single();

    if (error || !data) return null;

    return {
      calories: data.calories,
      protein: data.protein,
      carbs: data.carbs,
      fat: data.fat,
      source: 'verified',
      sourceDetail: data.source,
    };
  } catch {
    return null;
  }
}

/**
 * Check cache table
 */
async function checkCache(cacheKey, supabase) {
  try {
    const { data, error } = await supabase
      .from('nutrition_cache')
      .select('*')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) return null;

    // Increment hit count
    await supabase
      .from('nutrition_cache')
      .update({ hit_count: (data.hit_count || 0) + 1 })
      .eq('cache_key', cacheKey);

    return data.nutrition;
  } catch {
    return null;
  }
}

/**
 * Save result to cache
 */
async function saveToCache(cacheKey, result, sourceType, supabase) {
  // TTL based on source type
  const ttlDays = {
    usda: 365,
    gpt_web: 90,
    gpt_estimate: 30,
  };

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (ttlDays[sourceType] || 30));

  try {
    await supabase
      .from('nutrition_cache')
      .upsert({
        cache_key: cacheKey,
        source_type: sourceType,
        nutrition: result,
        created_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        hit_count: 0,
      });
  } catch (error) {
    console.error('[Orchestrator] Cache save failed:', error);
  }
}

/**
 * Log GPT web search result for admin review
 */
async function logForReview(item, result, supabase) {
  try {
    await supabase
      .from('pending_corrections')
      .insert({
        food_query: `${item.restaurant || item.brand || ''} ${item.name}`.trim(),
        food_key: normalizeCacheKey(item),
        gpt_result: result,
        quantity: item.quantity,
        unit: item.unit,
        status: 'pending',
        created_at: new Date().toISOString(),
      });
  } catch (error) {
    console.error('[Orchestrator] Failed to log for review:', error);
  }
}

/**
 * Check if item is from a restaurant
 */
function isRestaurantItem(item) {
  if (item.restaurant) return true;

  const searchText = `${item.name} ${item.brand || ''}`.toLowerCase();
  return RESTAURANT_KEYWORDS.some(keyword => searchText.includes(keyword));
}

/**
 * Check if item is brand-specific
 */
function isBrandItem(item) {
  if (item.brand) return true;

  const searchText = item.name.toLowerCase();
  return BRAND_KEYWORDS.some(keyword => searchText.includes(keyword));
}

export default {
  processNutritionInput,
};
