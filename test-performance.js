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

  // Simulate the exact request that the frontend makes (OPTIMIZED VERSION)
  const requestBody = {
    model: 'gpt-5-mini-2025-08-07',
    max_completion_tokens: 4000,
    messages: [
      {
        role: 'system',
        content: `You are a nutrition data assistant. Return ONLY valid JSON arrays with nutrition data. Never ask questions or add explanations.

FORMATTING RULES:
1. Clean up food names: Fix typos, capitalize properly, use official brand names
2. Emoji: Use only if clearly representative (🍌 🍎 🍕 🍟 🥚). Skip for branded items without exact matches
3. Quantity: Put number BEFORE name ("2 Eggs" not "Eggs (2)")
4. Portions: Add assumed portions for ambiguous proteins ("Chicken Breast (6 oz)"), include user-specified weights ("Banana (50g)")

Examples:
"2 eggs" → {"item":"🥚 2 Eggs","calories":140,"protein":12,"carbs":2,"fat":10,"source":"USDA"}
"chicken breast" → {"item":"🍗 Chicken Breast (6 oz)","calories":280,"protein":53,"carbs":0,"fat":6,"source":"USDA"}
"large fries from McDonald's" → {"item":"🍟 Large McDonald's French Fries","calories":490,"protein":6,"carbs":66,"fat":23,"source":"McDonald's nutrition"}
"4 oreos" → {"item":"4 Oreos","calories":160,"protein":2,"carbs":25,"fat":7,"source":"Oreo nutrition"} (no emoji)
"50g banana" → {"item":"🍌 Banana (50g)","calories":45,"protein":1,"carbs":12,"fat":0,"source":"USDA"}

Return format: [{"item":"name","calories":100,"protein":10,"carbs":20,"fat":5,"source":"source"}]`
      },
      {
        role: 'user',
        content: `Parse "${testFoodInput}" and return nutrition for each item.`
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
