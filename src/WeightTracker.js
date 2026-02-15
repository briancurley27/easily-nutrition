import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Trash2, Target, Upload, TrendingDown, TrendingUp, Minus, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { supabase } from './supabase';

const LBS_PER_KG = 2.20462;

const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Parse various date formats to YYYY-MM-DD
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  dateStr = dateStr.trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  // MM/DD/YYYY or M/D/YYYY
  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, m, d, y] = slashMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // MM-DD-YYYY
  const dashMatch = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const [, m, d, y] = dashMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Try Date.parse as fallback
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return getLocalDateString(parsed);
  }

  return null;
};

const WeightTracker = ({ session }) => {
  // Weight data
  const [weightEntries, setWeightEntries] = useState([]); // [{ id, date, weightLbs }] sorted by date asc
  const [goalWeight, setGoalWeight] = useState(null); // in lbs

  // Display unit
  const [unit, setUnit] = useState(() => {
    try { return localStorage.getItem('easily-weight-unit') || 'lbs'; }
    catch { return 'lbs'; }
  });

  // Form inputs
  const [weightInput, setWeightInput] = useState('');
  const [dateInput, setDateInput] = useState(getLocalDateString());
  const [goalInput, setGoalInput] = useState('');
  const [showGoalForm, setShowGoalForm] = useState(false);

  // Chart
  const [chartPeriod, setChartPeriod] = useState('3m');

  // CSV
  const fileInputRef = useRef(null);
  const [csvMessage, setCsvMessage] = useState(null);

  // UI
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState(null);

  // Conversion helpers
  const toDisplay = useCallback((lbs) => {
    if (lbs == null) return null;
    const val = unit === 'kg' ? lbs / LBS_PER_KG : lbs;
    return Math.round(val * 10) / 10;
  }, [unit]);

  const toLbs = useCallback((value) => {
    if (value == null) return null;
    return unit === 'kg' ? value * LBS_PER_KG : value;
  }, [unit]);

  // Save unit preference
  useEffect(() => {
    try { localStorage.setItem('easily-weight-unit', unit); }
    catch { /* ignore */ }
  }, [unit]);

  // Load data
  const loadData = useCallback(async () => {
    if (!session?.user) {
      setIsLoading(false);
      return;
    }

    try {
      const [entriesResult, goalResult] = await Promise.all([
        supabase
          .from('weight_entries')
          .select('*')
          .eq('user_id', session.user.id)
          .order('date', { ascending: true }),
        supabase
          .from('weight_goals')
          .select('*')
          .eq('user_id', session.user.id)
          .single()
      ]);

      if (entriesResult.data) {
        setWeightEntries(entriesResult.data.map(e => ({
          id: e.id,
          date: e.date,
          weightLbs: parseFloat(e.weight_lbs)
        })));
      }

      if (goalResult.data) {
        setGoalWeight(parseFloat(goalResult.data.target_weight_lbs));
      }
    } catch (err) {
      console.error('Error loading weight data:', err);
    }

    setIsLoading(false);
  }, [session?.user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Log weight
  const logWeight = async () => {
    const weight = parseFloat(weightInput);
    if (isNaN(weight) || weight <= 0) {
      setMessage({ type: 'error', text: 'Please enter a valid weight' });
      return;
    }

    const weightLbs = toLbs(weight);
    const date = dateInput || getLocalDateString();

    if (session?.user) {
      const { data, error } = await supabase
        .from('weight_entries')
        .upsert({
          user_id: session.user.id,
          date,
          weight_lbs: weightLbs
        }, { onConflict: 'user_id,date' })
        .select()
        .single();

      if (error) {
        setMessage({ type: 'error', text: 'Failed to save weight entry' });
        return;
      }

      setWeightEntries(prev => {
        const filtered = prev.filter(e => e.date !== date);
        const newEntry = { id: data.id, date, weightLbs: parseFloat(data.weight_lbs) };
        return [...filtered, newEntry].sort((a, b) => a.date.localeCompare(b.date));
      });
    } else {
      // Anonymous - store in memory
      const tempId = `temp-${Date.now()}`;
      setWeightEntries(prev => {
        const filtered = prev.filter(e => e.date !== date);
        return [...filtered, { id: tempId, date, weightLbs }].sort((a, b) => a.date.localeCompare(b.date));
      });
    }

    setWeightInput('');
    setMessage({ type: 'success', text: `Weight logged: ${weight} ${unit}` });
    setTimeout(() => setMessage(null), 3000);
  };

  // Delete entry
  const deleteEntry = async (id) => {
    if (session?.user && !String(id).startsWith('temp-')) {
      const { error } = await supabase
        .from('weight_entries')
        .delete()
        .eq('id', id);

      if (error) {
        setMessage({ type: 'error', text: 'Failed to delete entry' });
        return;
      }
    }

    setWeightEntries(prev => prev.filter(e => e.id !== id));
  };

  // Save goal
  const saveGoal = async () => {
    const weight = parseFloat(goalInput);
    if (isNaN(weight) || weight <= 0) {
      setMessage({ type: 'error', text: 'Please enter a valid goal weight' });
      return;
    }

    const weightLbs = toLbs(weight);

    if (session?.user) {
      const { error } = await supabase
        .from('weight_goals')
        .upsert({
          user_id: session.user.id,
          target_weight_lbs: weightLbs
        });

      if (error) {
        setMessage({ type: 'error', text: 'Failed to save goal' });
        return;
      }
    }

    setGoalWeight(weightLbs);
    setShowGoalForm(false);
    setGoalInput('');
    setMessage({ type: 'success', text: `Goal set: ${weight} ${unit}` });
    setTimeout(() => setMessage(null), 3000);
  };

  // Clear goal
  const clearGoal = async () => {
    if (session?.user) {
      await supabase
        .from('weight_goals')
        .delete()
        .eq('user_id', session.user.id);
    }

    setGoalWeight(null);
    setShowGoalForm(false);
    setMessage({ type: 'success', text: 'Goal cleared' });
    setTimeout(() => setMessage(null), 3000);
  };

  // CSV Upload
  const handleCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (fileInputRef.current) fileInputRef.current.value = '';

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());

    if (lines.length < 2) {
      setCsvMessage({ type: 'error', text: 'CSV must have a header row and at least one data row' });
      return;
    }

    // Parse header
    const header = lines[0].toLowerCase().split(',').map(h => h.trim());
    const dateCol = header.findIndex(h => h.includes('date'));
    const weightCol = header.findIndex(h => h.includes('weight'));

    if (dateCol === -1 || weightCol === -1) {
      setCsvMessage({ type: 'error', text: 'CSV must have "date" and "weight" columns' });
      return;
    }

    // Check for unit column
    const unitCol = header.findIndex(h => h.includes('unit'));

    const entries = [];
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      const dateStr = parseDate(cols[dateCol]);
      const weightVal = parseFloat(cols[weightCol]);

      if (!dateStr) {
        errors.push(`Row ${i + 1}: Invalid date "${cols[dateCol]}"`);
        continue;
      }

      if (isNaN(weightVal) || weightVal <= 0) {
        errors.push(`Row ${i + 1}: Invalid weight "${cols[weightCol]}"`);
        continue;
      }

      // Determine unit for this row
      let rowUnit = unit; // default to current display unit
      if (unitCol !== -1 && cols[unitCol]) {
        const rowUnitStr = cols[unitCol].toLowerCase().trim();
        if (['kg', 'kgs', 'kilogram', 'kilograms'].includes(rowUnitStr)) {
          rowUnit = 'kg';
        } else if (['lb', 'lbs', 'pound', 'pounds'].includes(rowUnitStr)) {
          rowUnit = 'lbs';
        }
      }

      const weightLbs = rowUnit === 'kg' ? weightVal * LBS_PER_KG : weightVal;
      entries.push({ date: dateStr, weightLbs });
    }

    if (entries.length === 0) {
      setCsvMessage({ type: 'error', text: `No valid entries found.${errors.length ? ' ' + errors.slice(0, 3).join('; ') : ''}` });
      return;
    }

    // Save to database or memory
    if (session?.user) {
      const rows = entries.map(e => ({
        user_id: session.user.id,
        date: e.date,
        weight_lbs: e.weightLbs
      }));

      const { error } = await supabase
        .from('weight_entries')
        .upsert(rows, { onConflict: 'user_id,date' });

      if (error) {
        setCsvMessage({ type: 'error', text: 'Failed to import entries to database' });
        return;
      }

      await loadData();
    } else {
      // Anonymous - merge into local state
      setWeightEntries(prev => {
        const map = {};
        prev.forEach(e => { map[e.date] = e; });
        entries.forEach(e => {
          map[e.date] = {
            id: `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            date: e.date,
            weightLbs: e.weightLbs
          };
        });
        return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
      });
    }

    const errorSummary = errors.length > 0 ? ` (${errors.length} rows skipped)` : '';
    setCsvMessage({ type: 'success', text: `Imported ${entries.length} entries${errorSummary}` });
    setTimeout(() => setCsvMessage(null), 5000);
  };

  // Computed values
  const currentWeight = weightEntries.length > 0 ? weightEntries[weightEntries.length - 1] : null;
  const previousWeight = weightEntries.length > 1 ? weightEntries[weightEntries.length - 2] : null;

  const trend = (() => {
    if (!currentWeight || !previousWeight) return null;
    const diff = currentWeight.weightLbs - previousWeight.weightLbs;
    if (Math.abs(diff) < 0.1) return 'same';
    return diff > 0 ? 'up' : 'down';
  })();

  // Goal-aware trend coloring
  const getTrendColor = () => {
    if (!trend || trend === 'same') return 'text-gray-400';
    if (goalWeight) {
      const isLosingGoal = goalWeight < currentWeight.weightLbs;
      if (isLosingGoal) {
        return trend === 'down' ? 'text-green-500' : 'text-red-500';
      } else {
        return trend === 'up' ? 'text-green-500' : 'text-red-500';
      }
    }
    return trend === 'down' ? 'text-green-500' : 'text-red-500';
  };

  const progressToGoal = (() => {
    if (!goalWeight || weightEntries.length === 0) return null;
    const startWeight = weightEntries[0].weightLbs;
    const current = currentWeight.weightLbs;
    const goal = goalWeight;

    if (startWeight === goal) return 100;

    const totalChange = Math.abs(startWeight - goal);
    const currentChange = startWeight > goal
      ? Math.max(0, startWeight - current)
      : Math.max(0, current - startWeight);

    return Math.min(100, Math.round((currentChange / totalChange) * 100));
  })();

  // Chart data
  const getChartData = () => {
    const now = new Date();
    let cutoffDate;

    switch (chartPeriod) {
      case '1m': cutoffDate = new Date(now); cutoffDate.setMonth(cutoffDate.getMonth() - 1); break;
      case '3m': cutoffDate = new Date(now); cutoffDate.setMonth(cutoffDate.getMonth() - 3); break;
      case '6m': cutoffDate = new Date(now); cutoffDate.setMonth(cutoffDate.getMonth() - 6); break;
      case '1y': cutoffDate = new Date(now); cutoffDate.setFullYear(cutoffDate.getFullYear() - 1); break;
      default: cutoffDate = null;
    }

    const cutoff = cutoffDate ? getLocalDateString(cutoffDate) : null;

    return weightEntries
      .filter(e => !cutoff || e.date >= cutoff)
      .map(e => ({
        date: e.date,
        weight: toDisplay(e.weightLbs),
        label: new Date(e.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }));
  };

  const chartData = getChartData();

  // Format date for display
  const formatDisplayDate = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-purple-600 text-lg">Loading...</div>
      </div>
    );
  }

  const weightDiff = currentWeight && goalWeight
    ? toDisplay(currentWeight.weightLbs - goalWeight)
    : null;

  return (
    <div className="space-y-6">
      {/* Message */}
      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message.text}
        </div>
      )}

      {/* Unit Toggle + Goal Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setUnit('lbs')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${unit === 'lbs' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
          >
            lbs
          </button>
          <button
            onClick={() => setUnit('kg')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${unit === 'kg' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
          >
            kg
          </button>
        </div>
        <button
          onClick={() => {
            setShowGoalForm(!showGoalForm);
            if (goalWeight && !showGoalForm) setGoalInput(toDisplay(goalWeight)?.toString() || '');
          }}
          className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800 transition font-medium"
        >
          <Target size={16} />
          {goalWeight ? 'Edit Goal' : 'Set Goal'}
        </button>
      </div>

      {/* Goal Form */}
      {showGoalForm && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">Goal Weight</h3>
            <button onClick={() => setShowGoalForm(false)} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="number"
                step="0.1"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveGoal(); } }}
                placeholder={`Goal weight (${unit})`}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">{unit}</span>
            </div>
            <button
              onClick={saveGoal}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 transition"
            >
              Save
            </button>
          </div>
          {goalWeight && (
            <button onClick={clearGoal} className="text-xs text-red-500 hover:text-red-700 mt-2">
              Clear goal
            </button>
          )}
        </div>
      )}

      {/* Stats Card */}
      <div className="bg-gradient-to-br from-purple-50 to-white rounded-xl shadow-sm p-6">
        {currentWeight ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Current Weight</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-purple-600">
                  {toDisplay(currentWeight.weightLbs)}
                </span>
                <span className="text-lg text-gray-500">{unit}</span>
                {trend && (
                  <span className={`flex items-center ${getTrendColor()}`}>
                    {trend === 'down' ? <TrendingDown size={18} /> : trend === 'up' ? <TrendingUp size={18} /> : <Minus size={18} />}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">{formatDisplayDate(currentWeight.date)}</p>
            </div>

            {goalWeight && (
              <div className="text-right">
                <p className="text-sm text-gray-600 mb-1">Goal</p>
                <div className="text-2xl font-bold text-gray-700">
                  {toDisplay(goalWeight)} <span className="text-sm text-gray-500">{unit}</span>
                </div>
                {weightDiff !== null && (
                  <p className={`text-sm mt-1 ${Math.abs(weightDiff) < 0.5 ? 'text-green-600 font-semibold' : 'text-gray-500'}`}>
                    {Math.abs(weightDiff) < 0.5
                      ? 'Goal reached!'
                      : `${Math.abs(weightDiff).toFixed(1)} ${unit} to go`
                    }
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-500">No weight entries yet</p>
            <p className="text-sm text-gray-400 mt-1">Log your first weight below</p>
          </div>
        )}

        {/* Progress Bar */}
        {goalWeight && weightEntries.length > 0 && progressToGoal !== null && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Start: {toDisplay(weightEntries[0].weightLbs)} {unit}</span>
              <span>{progressToGoal}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${progressToGoal >= 100 ? 'bg-green-500' : 'bg-purple-500'}`}
                style={{ width: `${Math.min(100, progressToGoal)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      {chartData.length >= 2 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Weight History</h3>
            <div className="flex gap-1">
              {['1m', '3m', '6m', '1y', 'all'].map(period => (
                <button
                  key={period}
                  onClick={() => setChartPeriod(period)}
                  className={`px-2 py-1 text-xs rounded font-medium transition ${
                    chartPeriod === period
                      ? 'bg-purple-100 text-purple-700'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {period.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={['dataMin - 2', 'dataMax + 2']}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                width={45}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px' }}
                formatter={(value) => [`${value} ${unit}`, 'Weight']}
                labelFormatter={(label) => label}
              />
              {goalWeight && (
                <ReferenceLine
                  y={toDisplay(goalWeight)}
                  stroke="#22c55e"
                  strokeDasharray="5 5"
                  label={{ value: `Goal`, position: 'right', fontSize: 10, fill: '#22c55e' }}
                />
              )}
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#9333ea"
                strokeWidth={2}
                dot={{ fill: '#9333ea', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Log Weight Form */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Log Weight</h3>
        <div className="flex gap-2">
          <input
            type="date"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
          />
          <div className="flex-1 relative">
            <input
              type="number"
              step="0.1"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  logWeight();
                }
              }}
              placeholder={`Weight (${unit})`}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none pr-12"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">{unit}</span>
          </div>
          <button
            onClick={logWeight}
            disabled={!weightInput.trim()}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 transition"
          >
            Log
          </button>
        </div>
      </div>

      {/* CSV Upload */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-800">Import from CSV</h3>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800 transition font-medium"
          >
            <Upload size={16} />
            Upload CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleCSVUpload}
            className="hidden"
          />
        </div>
        <p className="text-xs text-gray-500">
          CSV should have "date" and "weight" columns. Optionally include a "unit" column (lbs/kg).
          Dates can be YYYY-MM-DD, MM/DD/YYYY, or MM-DD-YYYY. Weights without a unit column are assumed to be in your currently selected unit ({unit}).
          {!session && <span className="text-amber-600 ml-1">Sign in to persist imported data.</span>}
        </p>
        {csvMessage && (
          <div className={`mt-2 p-2 rounded text-sm ${csvMessage.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {csvMessage.text}
          </div>
        )}
      </div>

      {/* Recent Entries */}
      {weightEntries.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Recent Entries</h3>
          <div className="space-y-0 max-h-64 overflow-y-auto">
            {[...weightEntries].reverse().map(entry => (
              <div key={entry.id} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-600">{formatDisplayDate(entry.date)}</span>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-purple-600">{toDisplay(entry.weightLbs)} {unit}</span>
                  <button
                    onClick={() => deleteEntry(entry.id)}
                    className="text-red-400 hover:text-red-600 transition p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WeightTracker;
