/**
 * USDA FoodData Central Service
 *
 * This service provides an abstraction for looking up nutrition data from USDA.
 * Currently uses the USDA API, but designed to be swappable to a local database.
 *
 * USDA API Documentation: https://fdc.nal.usda.gov/api-guide.html
 *
 * API Key: Free, get one at https://fdc.nal.usda.gov/api-key-signup.html
 * Rate Limits: 1,000 requests/hour, 3,600 requests/day
 */

// USDA FoodData Central API base URL
const USDA_API_BASE = 'https://api.nal.usda.gov/fdc/v1';

// Data types in priority order (most relevant first)
// SR Legacy = common foods, Survey = what Americans eat, Branded = packaged products
const DATA_TYPE_PRIORITY = ['SR Legacy', 'Survey (FNDDS)', 'Branded', 'Foundation'];

/**
 * Search for foods in USDA database
 * @param {string} query - Food search query (e.g., "banana", "chocolate milk")
 * @param {string} apiKey - USDA API key
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Array of matching foods with nutrition data
 */
export async function searchFoods(query, apiKey, options = {}) {
  const {
    pageSize = 5,          // Number of results to return
    dataType = null,       // Filter by data type (e.g., 'Branded', 'SR Legacy')
    brandOwner = null,     // Filter by brand (for branded foods)
  } = options;

  const perfStart = performance.now();

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      query: query,
      pageSize: pageSize.toString(),
    });

    // Add optional filters
    if (dataType) {
      params.append('dataType', dataType);
    }
    if (brandOwner) {
      params.append('brandOwner', brandOwner);
    }

    const response = await fetch(`${USDA_API_BASE}/foods/search?${params}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[USDA] API error:', response.status, errorText);
      throw new Error(`USDA API error: ${response.status}`);
    }

    const data = await response.json();
    const perfEnd = performance.now();
    console.log(`[USDA] Search "${query}" returned ${data.foods?.length || 0} results in ${((perfEnd - perfStart) / 1000).toFixed(2)}s`);

    if (!data.foods || data.foods.length === 0) {
      return [];
    }

    // Sort by data type priority and relevance
    const sortedFoods = sortByRelevance(data.foods, query);

    // Transform to our standard nutrition format
    return sortedFoods.map(food => transformUSDAFood(food));
  } catch (error) {
    console.error('[USDA] Search failed:', error);
    throw error;
  }
}

/**
 * Get detailed nutrition data for a specific food by FDC ID
 * @param {number} fdcId - USDA FDC ID
 * @param {string} apiKey - USDA API key
 * @returns {Promise<Object>} Food with complete nutrition data
 */
export async function getFoodById(fdcId, apiKey) {
  const perfStart = performance.now();

  try {
    const response = await fetch(
      `${USDA_API_BASE}/food/${fdcId}?api_key=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`USDA API error: ${response.status}`);
    }

    const food = await response.json();
    const perfEnd = performance.now();
    console.log(`[USDA] Get food ${fdcId} completed in ${((perfEnd - perfStart) / 1000).toFixed(2)}s`);

    return transformUSDAFood(food);
  } catch (error) {
    console.error('[USDA] Get food failed:', error);
    throw error;
  }
}

/**
 * Sort foods by relevance to the query
 * Prioritizes: exact matches, data type, description length
 */
function sortByRelevance(foods, query) {
  const queryLower = query.toLowerCase().trim();

  return foods.sort((a, b) => {
    // Prioritize exact description matches
    const aDesc = (a.description || '').toLowerCase();
    const bDesc = (b.description || '').toLowerCase();
    const aExact = aDesc === queryLower || aDesc.startsWith(queryLower + ',');
    const bExact = bDesc === queryLower || bDesc.startsWith(queryLower + ',');
    if (aExact && !bExact) return -1;
    if (bExact && !aExact) return 1;

    // Then prioritize by data type
    const aTypeIndex = DATA_TYPE_PRIORITY.indexOf(a.dataType);
    const bTypeIndex = DATA_TYPE_PRIORITY.indexOf(b.dataType);
    const aTypePriority = aTypeIndex === -1 ? 999 : aTypeIndex;
    const bTypePriority = bTypeIndex === -1 ? 999 : bTypeIndex;
    if (aTypePriority !== bTypePriority) {
      return aTypePriority - bTypePriority;
    }

    // Then prefer shorter descriptions (usually more generic/common)
    return (a.description?.length || 0) - (b.description?.length || 0);
  });
}

/**
 * Transform USDA food data to our standard format
 * @param {Object} usdaFood - Raw USDA food object
 * @returns {Object} Standardized nutrition object
 */
function transformUSDAFood(usdaFood) {
  // Extract nutrients - USDA uses nutrient IDs
  const nutrients = usdaFood.foodNutrients || [];

  // Nutrient IDs: 1008 = Energy (kcal), 1003 = Protein, 1005 = Carbs, 1004 = Fat
  const getNutrient = (nutrientId) => {
    const nutrient = nutrients.find(n =>
      n.nutrientId === nutrientId ||
      n.nutrient?.id === nutrientId ||
      n.nutrientNumber === nutrientId.toString()
    );
    return Math.round(nutrient?.value || nutrient?.amount || 0);
  };

  // Get serving size info
  const servingSize = usdaFood.servingSize || 100;
  const servingSizeUnit = usdaFood.servingSizeUnit || 'g';
  const householdServing = usdaFood.householdServingFullText || null;

  return {
    fdcId: usdaFood.fdcId,
    name: cleanFoodDescription(usdaFood.description),
    brand: usdaFood.brandOwner || usdaFood.brandName || null,
    dataType: usdaFood.dataType,
    // Nutrition per 100g (USDA standard) or per serving
    calories: getNutrient(1008),
    protein: getNutrient(1003),
    carbs: getNutrient(1005),
    fat: getNutrient(1004),
    // Serving info for scaling
    servingSize,
    servingSizeUnit,
    householdServing,
    // Source attribution
    source: 'USDA',
    sourceDetail: usdaFood.dataType,
  };
}

/**
 * Clean up USDA food descriptions
 * USDA descriptions are often in format: "Bananas, raw" or "Milk, chocolate, fluid"
 */
function cleanFoodDescription(description) {
  if (!description) return 'Unknown food';

  // Remove trailing commas and extra spaces
  let clean = description.trim();

  // Capitalize first letter of each word for display
  clean = clean
    .split(/,\s*/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(', ');

  return clean;
}

/**
 * Scale nutrition values based on quantity
 * USDA data is typically per 100g, need to scale to actual serving
 * @param {Object} nutrition - Nutrition data from USDA
 * @param {number} quantity - User's quantity
 * @param {string} unit - User's unit (e.g., "cup", "oz", "piece")
 * @returns {Object} Scaled nutrition values
 */
export function scaleNutrition(nutrition, quantity, unit) {
  // Common unit conversions to grams
  const unitToGrams = {
    'g': 1,
    'gram': 1,
    'grams': 1,
    'oz': 28.35,
    'ounce': 28.35,
    'ounces': 28.35,
    'lb': 453.6,
    'pound': 453.6,
    'pounds': 453.6,
    'kg': 1000,
    'cup': 240,      // Approximate, varies by food
    'cups': 240,
    'tbsp': 15,
    'tablespoon': 15,
    'tablespoons': 15,
    'tsp': 5,
    'teaspoon': 5,
    'teaspoons': 5,
    'ml': 1,         // Approximate (water-based)
    'liter': 1000,
    'l': 1000,
  };

  // For piece/serving units, use the food's serving size if available
  const pieceUnits = ['piece', 'pieces', 'serving', 'servings', 'slice', 'slices', 'item', 'items', ''];

  let grams;
  const unitLower = (unit || '').toLowerCase().trim();

  if (pieceUnits.includes(unitLower)) {
    // Use the food's serving size, or default to 100g
    grams = (nutrition.servingSize || 100) * quantity;
  } else if (unitToGrams[unitLower]) {
    grams = unitToGrams[unitLower] * quantity;
  } else {
    // Unknown unit, assume it's a serving
    grams = (nutrition.servingSize || 100) * quantity;
    console.warn(`[USDA] Unknown unit "${unit}", assuming serving size`);
  }

  // USDA data is per 100g, scale accordingly
  const scale = grams / 100;

  return {
    ...nutrition,
    calories: Math.round(nutrition.calories * scale),
    protein: Math.round(nutrition.protein * scale),
    carbs: Math.round(nutrition.carbs * scale),
    fat: Math.round(nutrition.fat * scale),
    calculatedGrams: grams,
    scaleFactor: scale,
  };
}

/**
 * Check if USDA API is available and key is valid
 * @param {string} apiKey - USDA API key
 * @returns {Promise<boolean>} True if API is accessible
 */
export async function testConnection(apiKey) {
  try {
    const response = await fetch(
      `${USDA_API_BASE}/foods/search?api_key=${apiKey}&query=test&pageSize=1`
    );
    return response.ok;
  } catch {
    return false;
  }
}

export default {
  searchFoods,
  getFoodById,
  scaleNutrition,
  testConnection,
};
