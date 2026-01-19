#!/usr/bin/env node
/**
 * Test script for GPT-5 mini integration
 * Run with: OPENAI_API_KEY=your_key node test-gpt5-integration.js
 * Or export OPENAI_API_KEY first
 */

const testGPT5Integration = async () => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not found in environment');
    console.error('   Run with: OPENAI_API_KEY=your_key node test-gpt5-integration.js');
    process.exit(1);
  }

  console.log('🧪 Testing GPT-5 mini integration...\n');

  const testRequest = {
    model: 'gpt-5-mini-2025-08-07',
    max_completion_tokens: 600,
    messages: [{
      role: 'user',
      content: `Parse "a banana" - return nutrition for EVERY item mentioned.

CRITICAL: Include ALL items, even if from different brands. Use web search and your knowledge to look up accurate nutrition data.
- Brand items (Chick-fil-A, Nature's Bakery, etc): Search for exact brand nutrition data
- Generic (banana, egg): Use USDA standards

JSON array with ALL items:
[{"item":"name","calories":100,"protein":10,"carbs":20,"fat":5,"source":"source"}]`
    }]
  };

  try {
    console.log('📤 Sending request to OpenAI API...');
    console.log(`   Model: ${testRequest.model}`);
    console.log(`   Max completion tokens: ${testRequest.max_completion_tokens}\n`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(testRequest)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error (${response.status}):`, errorText);
      process.exit(1);
    }

    const data = await response.json();

    console.log('✅ Response received successfully!\n');
    console.log('📥 Response structure:');
    console.log(`   - Has choices: ${!!data.choices}`);
    console.log(`   - Choices count: ${data.choices?.length}`);
    console.log(`   - Has message: ${!!data.choices?.[0]?.message}\n`);

    if (data.choices && data.choices[0] && data.choices[0].message) {
      const content = data.choices[0].message.content;
      console.log('📝 Response content:');
      console.log(content);
      console.log('');

      // Try to parse JSON
      const jsonMatch = content.match(/\[\s*\{[\s\S]*?\}\s*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('✅ Successfully parsed JSON response:');
        console.log(JSON.stringify(parsed, null, 2));

        if (parsed.length > 0 && parsed[0].item && parsed[0].calories) {
          console.log('\n🎉 Integration test PASSED!');
          console.log('   - Model responds correctly');
          console.log('   - Response format is valid');
          console.log('   - JSON parsing works');
          process.exit(0);
        }
      } else {
        console.error('⚠️  Could not find JSON array in response');
        process.exit(1);
      }
    } else {
      console.error('❌ Unexpected response structure');
      console.error(JSON.stringify(data, null, 2));
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

testGPT5Integration();
