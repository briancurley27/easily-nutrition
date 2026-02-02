/**
 * Nutrition System Test Page
 *
 * A/B comparison of:
 * - Old system: GPT does everything (parse + lookup)
 * - New system: GPT parse + USDA/GPT hybrid lookup
 *
 * Access via: localhost:3001/test (when server is running)
 */

import React, { useState } from 'react';
import { Search, Zap, Database, Clock, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

// Test cases covering different scenarios
const TEST_CASES = [
  // Generic foods (should use USDA)
  { input: 'a banana', expected: 'USDA', category: 'Generic' },
  { input: '2 eggs', expected: 'USDA', category: 'Generic' },
  { input: 'cup of rice', expected: 'USDA', category: 'Generic' },
  { input: 'chicken breast', expected: 'USDA', category: 'Generic' },
  { input: 'glass of milk', expected: 'USDA', category: 'Generic' },

  // USDA branded products
  { input: 'bag of Fritos', expected: 'USDA', category: 'USDA Branded' },
  { input: 'Cheerios cereal', expected: 'USDA', category: 'USDA Branded' },
  { input: 'almond butter sandwich on wheat', expected: 'USDA', category: 'USDA Branded' },

  // Brands NOT in USDA (should use GPT web search)
  { input: 'Fairlife chocolate milk', expected: 'GPT (web search)', category: 'Brand' },
  { input: 'Quest protein bar', expected: 'GPT (web search)', category: 'Brand' },
  { input: 'Celsius energy drink', expected: 'GPT (web search)', category: 'Brand' },

  // Restaurant items (should use GPT web search)
  { input: 'Big Mac from McDonald\'s', expected: 'GPT (web search)', category: 'Restaurant' },
  { input: 'Starbucks grande latte', expected: 'GPT (web search)', category: 'Restaurant' },
  { input: 'Chipotle burrito bowl', expected: 'GPT (web search)', category: 'Restaurant' },
  { input: 'Chick-fil-A sandwich', expected: 'GPT (web search)', category: 'Restaurant' },

  // Complex inputs (multiple items)
  { input: 'banana, 2 eggs, and a coffee', expected: 'Mixed', category: 'Multi-item' },
  { input: 'Big Mac, large fries, and a Coke', expected: 'GPT (web search)', category: 'Multi-item' },
];

export default function NutritionTest() {
  const [input, setInput] = useState('');
  const [oldResult, setOldResult] = useState(null);
  const [newResult, setNewResult] = useState(null);
  const [loading, setLoading] = useState({ old: false, new: false });
  const [testResults, setTestResults] = useState([]);
  const [runningTests, setRunningTests] = useState(false);

  // Run comparison between old and new systems
  const runComparison = async (testInput) => {
    const inputToUse = testInput || input;
    if (!inputToUse.trim()) return;

    setLoading({ old: true, new: true });
    setOldResult(null);
    setNewResult(null);

    // Run both systems in parallel
    const [oldRes, newRes] = await Promise.all([
      runOldSystem(inputToUse),
      runNewSystem(inputToUse),
    ]);

    setOldResult(oldRes);
    setNewResult(newRes);
    setLoading({ old: false, new: false });

    return { old: oldRes, new: newRes };
  };

  // Old system: GPT does everything
  const runOldSystem = async (text) => {
    const start = performance.now();
    try {
      const response = await fetch('/api/openai/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-5-mini-2025-08-07',
          max_completion_tokens: 4000,
          messages: [
            {
              role: 'system',
              content: `You are a nutrition assistant. Parse the food input and return nutrition data.
Return ONLY a JSON array: [{"item":"food name","calories":N,"protein":N,"carbs":N,"fat":N,"source":"USDA/estimate"}]`
            },
            { role: 'user', content: `Parse and return nutrition for: "${text}"` },
          ],
        }),
      });

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/\[\s*\{[\s\S]*?\}\s*\]/);

      const time = (performance.now() - start) / 1000;

      if (jsonMatch) {
        const items = JSON.parse(jsonMatch[0]);
        return { items, time, error: null, source: 'GPT (all-in-one)' };
      }
      return { items: [], time, error: 'No JSON in response', source: 'GPT (all-in-one)' };
    } catch (err) {
      return { items: [], time: (performance.now() - start) / 1000, error: err.message, source: 'GPT (all-in-one)' };
    }
  };

  // New system: Hybrid lookup
  const runNewSystem = async (text) => {
    const start = performance.now();
    try {
      const response = await fetch('/api/nutrition/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: text }),
      });

      const data = await response.json();
      const time = (performance.now() - start) / 1000;

      return {
        items: data.items || [],
        time,
        timing: data.timing,
        sources: data.sources,
        parseMethod: data.parseMethod,
        error: data.error || null,
        source: 'Hybrid (GPT parse + USDA/GPT lookup)',
      };
    } catch (err) {
      return { items: [], time: (performance.now() - start) / 1000, error: err.message, source: 'Hybrid' };
    }
  };

  // Run all test cases
  const runAllTests = async () => {
    setRunningTests(true);
    setTestResults([]);

    const results = [];
    for (const testCase of TEST_CASES) {
      const { old, new: newRes } = await runComparison(testCase.input);

      results.push({
        ...testCase,
        oldTime: old.time,
        newTime: newRes.time,
        oldItems: old.items,
        newItems: newRes.items,
        newSources: newRes.sources,
        speedup: old.time / newRes.time,
        passed: newRes.items.length > 0 && !newRes.error,
      });

      setTestResults([...results]);

      // Small delay between tests to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
    }

    setRunningTests(false);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1 style={{ marginBottom: '10px' }}>Nutrition System Test</h1>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        Compare old (GPT-only) vs new (Hybrid GPT + USDA) systems
      </p>

      {/* Manual Test Input */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter food to test (e.g., 'a banana and a Big Mac')"
            style={{
              flex: 1,
              padding: '12px 16px',
              fontSize: '16px',
              border: '2px solid #ddd',
              borderRadius: '8px',
            }}
            onKeyDown={(e) => e.key === 'Enter' && runComparison()}
          />
          <button
            onClick={() => runComparison()}
            disabled={loading.old || loading.new}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Search size={18} />
            Compare
          </button>
        </div>

        {/* Quick test buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['banana', 'a banana, white bread, 12 grapes', 'Big Mac', 'Fairlife milk', '2 eggs and toast', 'Chipotle bowl'].map(test => (
            <button
              key={test}
              onClick={() => { setInput(test); runComparison(test); }}
              style={{
                padding: '6px 12px',
                background: '#f0f0f0',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              {test}
            </button>
          ))}
        </div>
      </div>

      {/* Side-by-side Results */}
      {(oldResult || newResult || loading.old || loading.new) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '40px' }}>
          <ResultCard
            title="Old System (GPT Only)"
            result={oldResult}
            loading={loading.old}
            color="#dc3545"
          />
          <ResultCard
            title="New System (Hybrid)"
            result={newResult}
            loading={loading.new}
            color="#28a745"
          />
        </div>
      )}

      {/* Run All Tests Button */}
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={runAllTests}
          disabled={runningTests}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            background: runningTests ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: runningTests ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {runningTests ? <RefreshCw className="spin" size={18} /> : <Zap size={18} />}
          {runningTests ? 'Running Tests...' : 'Run All Test Cases'}
        </button>
      </div>

      {/* Test Results Table */}
      {testResults.length > 0 && (
        <div>
          <h2>Test Results</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={thStyle}>Input</th>
                <th style={thStyle}>Category</th>
                <th style={thStyle}>Expected</th>
                <th style={thStyle}>Actual Sources</th>
                <th style={thStyle}>Old Time</th>
                <th style={thStyle}>New Time</th>
                <th style={thStyle}>Speedup</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {testResults.map((result, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={tdStyle}>{result.input}</td>
                  <td style={tdStyle}>{result.category}</td>
                  <td style={tdStyle}>{result.expected}</td>
                  <td style={tdStyle}>
                    {result.newSources ? Object.entries(result.newSources).map(([k, v]) => `${k}: ${v}`).join(', ') : '-'}
                  </td>
                  <td style={tdStyle}>{result.oldTime?.toFixed(2)}s</td>
                  <td style={tdStyle}>{result.newTime?.toFixed(2)}s</td>
                  <td style={{ ...tdStyle, color: result.speedup > 1 ? '#28a745' : '#dc3545' }}>
                    {result.speedup?.toFixed(1)}x
                  </td>
                  <td style={tdStyle}>
                    {result.passed ? (
                      <CheckCircle size={16} color="#28a745" />
                    ) : (
                      <AlertCircle size={16} color="#dc3545" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary */}
          <div style={{ marginTop: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
            <h3 style={{ margin: '0 0 10px 0' }}>Summary</h3>
            <p>Tests passed: {testResults.filter(r => r.passed).length} / {testResults.length}</p>
            <p>Average old time: {(testResults.reduce((a, r) => a + r.oldTime, 0) / testResults.length).toFixed(2)}s</p>
            <p>Average new time: {(testResults.reduce((a, r) => a + r.newTime, 0) / testResults.length).toFixed(2)}s</p>
            <p>Average speedup: {(testResults.reduce((a, r) => a + r.speedup, 0) / testResults.length).toFixed(1)}x</p>
          </div>
        </div>
      )}

      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Result Card Component
function ResultCard({ title, result, loading, color }) {
  return (
    <div style={{
      border: `2px solid ${color}`,
      borderRadius: '12px',
      padding: '20px',
      background: 'white',
    }}>
      <h3 style={{ color, marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
        {title.includes('Hybrid') ? <Database size={20} /> : <Zap size={20} />}
        {title}
      </h3>

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
          <RefreshCw className="spin" size={24} />
          <p>Processing...</p>
        </div>
      )}

      {result && !loading && (
        <>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '15px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Clock size={16} />
              <strong>{result.time?.toFixed(2)}s</strong>
            </div>
            {result.timing && (
              <div style={{ fontSize: '12px', color: '#666' }}>
                (Parse: {result.timing.parse?.toFixed(2)}s, Lookup: {result.timing.lookup?.toFixed(2)}s)
              </div>
            )}
            {result.parseMethod && (
              <div style={{
                fontSize: '12px',
                padding: '2px 8px',
                borderRadius: '4px',
                background: result.parseMethod === 'local' ? '#d4edda' : '#fff3cd',
                color: result.parseMethod === 'local' ? '#155724' : '#856404',
              }}>
                Parse: {result.parseMethod === 'local' ? '⚡ Local (instant)' : '🤖 GPT'}
              </div>
            )}
          </div>

          {result.sources && (
            <div style={{ marginBottom: '15px', fontSize: '14px' }}>
              <strong>Sources:</strong>{' '}
              {Object.entries(result.sources).map(([k, v]) => `${k}: ${v}`).join(', ')}
            </div>
          )}

          {result.error && (
            <div style={{ color: '#dc3545', marginBottom: '15px' }}>
              Error: {result.error}
            </div>
          )}

          <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ddd' }}>
                <th style={{ textAlign: 'left', padding: '8px' }}>Item</th>
                <th style={{ textAlign: 'right', padding: '8px' }}>Cal</th>
                <th style={{ textAlign: 'right', padding: '8px' }}>P</th>
                <th style={{ textAlign: 'right', padding: '8px' }}>C</th>
                <th style={{ textAlign: 'right', padding: '8px' }}>F</th>
                <th style={{ textAlign: 'left', padding: '8px' }}>Source</th>
              </tr>
            </thead>
            <tbody>
              {result.items?.map((item, i) => (
                <React.Fragment key={i}>
                  <tr style={{ borderBottom: item.debug ? 'none' : '1px solid #eee' }}>
                    <td style={{ padding: '8px' }}>{item.item || item.name}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{item.calories}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{item.protein}g</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{item.carbs}g</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{item.fat}g</td>
                    <td style={{ padding: '8px', fontSize: '12px', color: '#666' }}>{item.source}</td>
                  </tr>
                  {/* Debug info row for USDA items */}
                  {(item.matchedName || item.fdcId || item.debug) && (
                    <tr style={{ borderBottom: '1px solid #eee', background: '#f9f9f9' }}>
                      <td colSpan={6} style={{ padding: '4px 8px', fontSize: '11px', color: '#888' }}>
                        {item.matchedName && (
                          <span>USDA: <strong>{item.matchedName}</strong></span>
                        )}
                        {item.fdcId && (
                          <span> | <a href={`https://fdc.nal.usda.gov/food-details/${item.fdcId}/nutrients`} target="_blank" rel="noreferrer">FDC #{item.fdcId}</a></span>
                        )}
                        {item.portion && (
                          <span> | Portion: <strong>{item.portion}</strong> ({item.portionGrams}g)</span>
                        )}
                        {item.debug?.method && (
                          <span> | {item.debug.method}</span>
                        )}
                        {item.debug?.per100g && !item.portion && (
                          <span> | Per 100g: {item.debug.per100g.calories}cal, {item.debug.per100g.protein?.toFixed(1)}p</span>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

const thStyle = { textAlign: 'left', padding: '10px', borderBottom: '2px solid #ddd' };
const tdStyle = { padding: '10px' };
