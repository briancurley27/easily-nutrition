// Performance test script for easily-nutrition
// This script simulates a food entry request and measures timing

// Load .env.local manually
const fs = require('fs');
const path = require('path');
try {
  const envPath = path.join(__dirname, '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  });
} catch (e) {
  // .env.local not found, will use process.env
}

const testFoodInput = "2 eggs and toast with butter";

async function testPerformance() {
  console.log('='.repeat(60));
  console.log('PERFORMANCE TEST: Food Entry Processing');
  console.log('='.repeat(60));
  console.log(`\nTest Input: "${testFoodInput}"`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const totalStart = Date.now();

  // Simulate the exact request that the frontend makes
  const requestBody = {
    model: 'gpt-5-mini-2025-08-07',
    max_completion_tokens: 4000,
    messages: [
      {
        role: 'system',
        content: 'You are a nutrition data assistant. Return ONLY valid JSON arrays with nutrition data. Never ask questions or add explanations.'
      },
      {
        role: 'user',
        content: `Parse "${testFoodInput}" and return nutrition for each item.

FORMATTING RULES:
1. CLEAN UP food names: Fix typos, capitalize properly, use official brand names (e.g., "macdonald fry" → "McDonald's French Fries")

2. EMOJI USAGE - BE SELECTIVE:
   - ONLY add emoji if it's truly representative of the food
   - When in doubt, NO EMOJI is better than a misleading emoji
   - Examples of GOOD emoji use: 🍌 banana, 🍎 apple, 🍕 pizza, 🍟 fries, 🥚 eggs, 🐟 fish sticks, 🥬 butter lettuce
   - Examples of BAD emoji use: 🥩 for Slim Jim (not representative), 🍪 for Oreos (that's chocolate chip cookie)
   - Skip emoji for: specific branded snacks (Oreos, Slim Jims, protein bars) without good match

3. QUANTITY FORMATTING:
   - Put quantity NUMBER BEFORE the food name, not after in parentheses
   - CORRECT: "2 Eggs", "4 Oreos", "10 Fish Sticks", "1 Chicken Wing"
   - WRONG: "Eggs (2)", "Oreo Cookies (4 cookies)", "Fish Sticks (10)", "Chicken Wing (1 wing)"
   - Use parentheses ONLY for measurement clarification with different units: "Chicken Breast (6 oz)", "Banana (50g)"
   - For ambiguous proteins (chicken, beef, fish) when user didn't specify amount, ADD portion: "Chicken Breast (6 oz)"

4. PORTION DETAILS:
   - If user specified portion/weight, include it: "50g of banana" → "Banana (50g)"
   - For ambiguous items, add assumed portion in parentheses: "chicken breast" → "Chicken Breast (6 oz)"
   - For countable items, put number before name: "4 oreos" → "4 Oreos"
   - Don't add technical details for simple items: "banana" → "Banana" NOT "Banana (medium, 118g)"

SELECTIVE EMOJI EXAMPLES (only use when truly representative):
✓ Good matches: 🍌 banana, 🍎 apple, 🍊 orange, 🍇 grapes, 🍓 strawberry, 🍑 peach, 🥭 mango, 🍉 watermelon
✓ Good matches: 🥕 carrot, 🥦 broccoli, 🍅 tomato, 🥒 cucumber, 🥔 potato, 🌽 corn, 🥬 lettuce/leafy greens
✓ Good matches: 🍗 chicken wings/drumsticks, 🥚 eggs, 🥩 steak/beef cuts, 🐟 fish/salmon/fish sticks
✓ Good matches: 🍞 bread/toast, 🥯 bagel, 🥐 croissant, 🍚 rice, 🍝 pasta
✓ Good matches: 🍟 fries, 🍕 pizza, 🍔 burger, 🌮 taco, 🌯 burrito, 🌭 hot dog
✓ Good matches: 🥛 milk, ☕ coffee, 🧃 juice, 🥤 soda
✗ Skip emoji for: Oreos, Slim Jims, protein bars, most branded snacks without exact match

FORMATTING EXAMPLES:
Input: "a banana" → {"item":"🍌 Banana",...}
Input: "50g of banana" → {"item":"🍌 Banana (50g)",...}
Input: "green apple" → {"item":"🍎 Green Apple",...}
Input: "2 eggs" → {"item":"🥚 2 Eggs",...}
Input: "4 oreos" → {"item":"4 Oreos",...} (no cookie emoji - not representative)
Input: "10 fish sticks" → {"item":"🐟 10 Fish Sticks",...}
Input: "2 cups butter lettuce" → {"item":"🥬 2 Cups Butter Lettuce",...}
Input: "a chicken wing" → {"item":"🍗 1 Chicken Wing",...}
Input: "chicken breast" → {"item":"🍗 Chicken Breast (6 oz)",...}
Input: "a slim jim" → {"item":"1 Slim Jim",...} (no emoji - not like any emoji)
Input: "1 med macdonald fry" → {"item":"🍟 Large McDonald's French Fries",...}
Input: "large fries from McDonald's" → {"item":"🍟 Large McDonald's French Fries",...}
Input: "chick fil a waffle fries" → {"item":"🍟 Chick-fil-A Waffle Fries",...}
Input: "sweet potato fries" → {"item":"🍠 Sweet Potato Fries",...}
Input: "chicken soup" → {"item":"🍲 Chicken Soup",...}
Input: "slice of pepperoni pizza" → {"item":"🍕 1 Slice Pepperoni Pizza",...}
Input: "cup of white rice" → {"item":"🍚 1 Cup White Rice",...}
Input: "6 oz salmon" → {"item":"🐟 Salmon (6 oz)",...}
Input: "ribeye steak" → {"item":"🥩 Ribeye Steak (8 oz)",...}
Input: "cup of milk" → {"item":"🥛 1 Cup Milk",...}

Return ONLY a JSON array:
[{"item":"optional emoji + clean name with quantity before","calories":100,"protein":10,"carbs":20,"fat":5,"source":"source"}]`
      }
    ]
  };

  // Calculate approximate token count
  const totalPromptLength = JSON.stringify(requestBody.messages).length;
  const estimatedTokens = Math.ceil(totalPromptLength / 4); // Rough estimate: 1 token ≈ 4 characters
  console.log(`Prompt Statistics:`);
  console.log(`  - Total prompt characters: ${totalPromptLength}`);
  console.log(`  - Estimated input tokens: ~${estimatedTokens}`);
  console.log(`  - Max completion tokens: ${requestBody.max_completion_tokens}`);
  console.log(`  - Model: ${requestBody.model}\n`);

  // Make the API call
  console.log('Starting API call to OpenAI...\n');
  const apiStart = Date.now();

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    const apiEnd = Date.now();
    const apiDuration = ((apiEnd - apiStart) / 1000).toFixed(2);

    console.log(`API call completed in ${apiDuration}s`);
    console.log(`HTTP Status: ${response.status}\n`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ERROR:', errorText);
      return;
    }

    const data = await response.json();

    // Extract usage information
    const usage = data.usage || {};
    console.log(`Token Usage:`);
    console.log(`  - Prompt tokens: ${usage.prompt_tokens || 'N/A'}`);
    console.log(`  - Completion tokens: ${usage.completion_tokens || 'N/A'}`);
    console.log(`  - Total tokens: ${usage.total_tokens || 'N/A'}\n`);

    // Extract response
    const content = data.choices?.[0]?.message?.content || '';
    console.log(`Response Preview:`);
    console.log(content.substring(0, 500));
    console.log('\n');

    const totalEnd = Date.now();
    const totalDuration = ((totalEnd - totalStart) / 1000).toFixed(2);

    console.log('='.repeat(60));
    console.log('RESULTS SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Time: ${totalDuration}s`);
    console.log(`  - API Call: ${apiDuration}s (${((apiDuration / totalDuration) * 100).toFixed(1)}%)`);
    console.log(`  - Other: ${((totalDuration - apiDuration) / 1000).toFixed(2)}s`);
    console.log(`\nPrompt tokens: ${usage.prompt_tokens || 'N/A'}`);
    console.log(`Completion tokens: ${usage.completion_tokens || 'N/A'}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\nERROR:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testPerformance().catch(console.error);
