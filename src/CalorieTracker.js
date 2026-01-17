import React, { useState, useEffect } from 'react';
import { Send, Calendar, LogOut, Trash2, Edit2, X, Check, ChevronLeft, ChevronRight, Target, Eye, EyeOff } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from './supabase';

const CalorieTracker = () => {
  // Helper functions
  const getLocalDateString = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const normalizeFoodName = (name) => {
    return name.toLowerCase().trim().replace(/\s+/g, ' ');
  };

  // Auth states
  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // App states
  const [currentInput, setCurrentInput] = useState('');
  const [entries, setEntries] = useState({});
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString());
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [editText, setEditText] = useState('');
  const [corrections, setCorrections] = useState({});
  const [editingNutrition, setEditingNutrition] = useState(null);
  const [nutritionEditValues, setNutritionEditValues] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [goals, setGoals] = useState(null);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [goalInputs, setGoalInputs] = useState({ calories: '', protein: '', carbs: '', fat: '' });

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setEntries({});
        setCorrections({});
        setGoals(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      const loadAllData = async () => {
        setIsLoading(true);
        await Promise.all([loadEntries(), loadCorrections(), loadGoals()]);
        setIsLoading(false);
      };
      loadAllData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    setSelectedDate(getLocalDateString());
  }, []);

  const loadEntries = async () => {
    const { data, error } = await supabase
      .from('entries')
      .select('*')
      .eq('user_id', session.user.id)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Error loading entries:', error);
      return;
    }

    const grouped = {};
    data.forEach(entry => {
      if (!grouped[entry.date]) grouped[entry.date] = [];
      grouped[entry.date].push({
        id: entry.id,
        timestamp: entry.timestamp,
        localTime: entry.local_time,
        input: entry.input,
        items: entry.items,
        totalCalories: entry.total_calories,
        totalProtein: entry.total_protein,
        totalCarbs: entry.total_carbs,
        totalFat: entry.total_fat
      });
    });
    setEntries(grouped);
  };

  const loadCorrections = async () => {
    const { data, error } = await supabase
      .from('corrections')
      .select('*')
      .eq('user_id', session.user.id);

    if (error) {
      console.error('Error loading corrections:', error);
      return;
    }

    const correctionsMap = {};
    data.forEach(c => {
      correctionsMap[c.food_key] = {
        calories: c.calories,
        protein: c.protein,
        carbs: c.carbs,
        fat: c.fat,
        source: 'user correction'
      };
    });
    setCorrections(correctionsMap);
  };

  const loadGoals = async () => {
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', session.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error loading goals:', error);
      return;
    }

    if (data) {
      setGoals({
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fat: data.fat
      });
    }
  };

  // Auth functions
  const handleSignUp = async () => {
    setAuthLoading(true);
    setAuthError('');
    setAuthMessage('');

    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password: authPassword
    });

    setAuthLoading(false);

    if (error) {
      setAuthError(error.message);
    } else if (data.user && !data.session) {
      setAuthMessage('Check your email for a confirmation link!');
      setAuthMode('login');
    }
  };

  const handleLogin = async () => {
    setAuthLoading(true);
    setAuthError('');
    setAuthMessage('');

    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword
    });

    setAuthLoading(false);
    if (error) setAuthError(error.message);
  };

  const handlePasswordReset = async () => {
    setAuthLoading(true);
    setAuthError('');
    setAuthMessage('');

    const { error } = await supabase.auth.resetPasswordForEmail(authEmail, {
      redirectTo: window.location.origin
    });

    setAuthLoading(false);

    if (error) {
      setAuthError(error.message);
    } else {
      setAuthMessage('Check your email for a password reset link!');
      setAuthMode('login');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleAuthSubmit = (e) => {
    e.preventDefault();
    if (authMode === 'signup') handleSignUp();
    else if (authMode === 'reset') handlePasswordReset();
    else handleLogin();
  };

  // Food processing
  const processFood = async (foodText) => {
    setIsProcessing(true);
    
    try {
      const correctionsContext = Object.keys(corrections).length > 0 
        ? `\n\nUSER'S SAVED CORRECTIONS (use these exact values if the food matches - match case-insensitively):\n${JSON.stringify(corrections, null, 2)}`
        : '';

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{
            role: 'user',
            content: `Parse "${foodText}" into food items with accurate nutrition data (calories, protein, carbs, fat).

CRITICAL INSTRUCTIONS:
1. For BRAND-SPECIFIC items (Fishwife, Cava, McDonald's, etc.), you MUST use web_search to find official nutrition data
2. For generic items (banana, egg, chicken breast), use USDA values or search if uncertain
3. If quantity mentioned (like "6 dumplings"), create ONE entry with TOTAL nutrition
4. Split different foods into separate array items
5. When checking user corrections, match CASE-INSENSITIVELY${correctionsContext}

Return ONLY valid JSON array:
[{"item":"Food name","calories":100,"protein":10,"carbs":20,"fat":5,"source":"official website / USDA / user correction"}]`
          }]
        })
      });

      const data = await response.json();
      
      let allText = '';
      if (data.content) {
        for (const block of data.content) {
          if (block.type === 'text') allText += block.text + '\n';
        }
      }
      
      if (!allText) throw new Error('No text in response');
      
      let content = allText.trim().replace(/```json\s*/g, '').replace(/```\s*/g, '');
      const arrayMatch = content.match(/\[\s*\{[\s\S]*?\}\s*\]/);
      if (!arrayMatch) throw new Error('Could not find JSON array');
      
      const foodItems = JSON.parse(arrayMatch[0]);
      
      return foodItems.map(item => ({
        item: item.item || 'Unknown',
        calories: parseInt(item.calories) || 0,
        protein: parseInt(item.protein) || 0,
        carbs: parseInt(item.carbs) || 0,
        fat: parseInt(item.fat) || 0,
        source: item.source || 'estimate',
        error: !item.calories || parseInt(item.calories) === 0
      }));
      
    } catch (error) {
      console.error('Processing error:', error);
      return [{ item: foodText, calories: 0, protein: 0, carbs: 0, fat: 0, source: 'error', error: true }];
    } finally {
      setIsProcessing(false);
    }
  };

  // Entry management
  const handleSubmit = async () => {
    if (!currentInput.trim() || isProcessing) return;

    const foodItems = await processFood(currentInput);
    const now = new Date();
    
    const newEntry = {
      user_id: session.user.id,
      date: selectedDate,
      timestamp: now.toISOString(),
      local_time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      input: currentInput,
      items: foodItems,
      total_calories: foodItems.reduce((sum, item) => sum + (item.calories || 0), 0),
      total_protein: foodItems.reduce((sum, item) => sum + (item.protein || 0), 0),
      total_carbs: foodItems.reduce((sum, item) => sum + (item.carbs || 0), 0),
      total_fat: foodItems.reduce((sum, item) => sum + (item.fat || 0), 0)
    };

    const { data, error } = await supabase.from('entries').insert(newEntry).select().single();

    if (error) {
      console.error('Error saving entry:', error);
      return;
    }

    const updatedEntries = { ...entries };
    if (!updatedEntries[selectedDate]) updatedEntries[selectedDate] = [];
    updatedEntries[selectedDate].push({
      id: data.id,
      timestamp: data.timestamp,
      localTime: data.local_time,
      input: data.input,
      items: data.items,
      totalCalories: data.total_calories,
      totalProtein: data.total_protein,
      totalCarbs: data.total_carbs,
      totalFat: data.total_fat
    });
    
    setEntries(updatedEntries);
    setCurrentInput('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const deleteEntry = async (date, entryId) => {
    const { error } = await supabase.from('entries').delete().eq('id', entryId);
    if (error) {
      console.error('Error deleting entry:', error);
      return;
    }

    const updatedEntries = { ...entries };
    updatedEntries[date] = updatedEntries[date].filter(entry => entry.id !== entryId);
    if (updatedEntries[date].length === 0) delete updatedEntries[date];
    setEntries(updatedEntries);
  };

  const startEdit = (entry) => {
    setEditingEntry(entry.id);
    setEditText(entry.input);
  };

  const cancelEdit = () => {
    setEditingEntry(null);
    setEditText('');
  };

  const saveEdit = async (date, entryId) => {
    if (!editText.trim() || isProcessing) return;

    const foodItems = await processFood(editText);
    
    const updates = {
      input: editText,
      items: foodItems,
      total_calories: foodItems.reduce((sum, item) => sum + (item.calories || 0), 0),
      total_protein: foodItems.reduce((sum, item) => sum + (item.protein || 0), 0),
      total_carbs: foodItems.reduce((sum, item) => sum + (item.carbs || 0), 0),
      total_fat: foodItems.reduce((sum, item) => sum + (item.fat || 0), 0)
    };

    const { error } = await supabase.from('entries').update(updates).eq('id', entryId);
    if (error) {
      console.error('Error updating entry:', error);
      return;
    }

    const updatedEntries = { ...entries };
    const entryIndex = updatedEntries[date].findIndex(e => e.id === entryId);
    
    if (entryIndex !== -1) {
      updatedEntries[date][entryIndex] = {
        ...updatedEntries[date][entryIndex],
        input: editText,
        items: foodItems,
        totalCalories: updates.total_calories,
        totalProtein: updates.total_protein,
        totalCarbs: updates.total_carbs,
        totalFat: updates.total_fat
      };
    }
    
    setEntries(updatedEntries);
    setEditingEntry(null);
    setEditText('');
  };

  // Nutrition correction
  const startEditNutrition = (entryId, itemIndex, item) => {
    setEditingNutrition({ entryId, itemIndex });
    setNutritionEditValues({
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat
    });
  };

  const cancelEditNutrition = () => {
    setEditingNutrition(null);
    setNutritionEditValues({});
  };

  const saveNutritionCorrection = async (date, entryId, itemIndex) => {
    const entry = entries[date].find(e => e.id === entryId);
    if (!entry || !entry.items[itemIndex]) return;
    
    const item = entry.items[itemIndex];
    const correctionKey = normalizeFoodName(item.item);
    
    await supabase.from('corrections').upsert({
      user_id: session.user.id,
      food_key: correctionKey,
      calories: parseInt(nutritionEditValues.calories) || 0,
      protein: parseInt(nutritionEditValues.protein) || 0,
      carbs: parseInt(nutritionEditValues.carbs) || 0,
      fat: parseInt(nutritionEditValues.fat) || 0
    }, { onConflict: 'user_id,food_key' });

    const newCorrections = {
      ...corrections,
      [correctionKey]: {
        calories: parseInt(nutritionEditValues.calories) || 0,
        protein: parseInt(nutritionEditValues.protein) || 0,
        carbs: parseInt(nutritionEditValues.carbs) || 0,
        fat: parseInt(nutritionEditValues.fat) || 0,
        source: 'user correction'
      }
    };
    setCorrections(newCorrections);

    const updatedItems = [...entry.items];
    updatedItems[itemIndex] = {
      ...item,
      calories: parseInt(nutritionEditValues.calories) || 0,
      protein: parseInt(nutritionEditValues.protein) || 0,
      carbs: parseInt(nutritionEditValues.carbs) || 0,
      fat: parseInt(nutritionEditValues.fat) || 0,
      source: 'user correction'
    };

    const newTotals = {
      total_calories: updatedItems.reduce((sum, i) => sum + (i.calories || 0), 0),
      total_protein: updatedItems.reduce((sum, i) => sum + (i.protein || 0), 0),
      total_carbs: updatedItems.reduce((sum, i) => sum + (i.carbs || 0), 0),
      total_fat: updatedItems.reduce((sum, i) => sum + (i.fat || 0), 0)
    };

    await supabase.from('entries').update({ items: updatedItems, ...newTotals }).eq('id', entryId);

    const updatedEntries = { ...entries };
    const entryIndex = updatedEntries[date].findIndex(e => e.id === entryId);
    if (entryIndex !== -1) {
      updatedEntries[date][entryIndex] = {
        ...updatedEntries[date][entryIndex],
        items: updatedItems,
        totalCalories: newTotals.total_calories,
        totalProtein: newTotals.total_protein,
        totalCarbs: newTotals.total_carbs,
        totalFat: newTotals.total_fat
      };
    }
    setEntries(updatedEntries);
    setEditingNutrition(null);
    setNutritionEditValues({});
  };

  // Goals
  const openGoalsModal = () => {
    if (goals) {
      setGoalInputs({
        calories: goals.calories?.toString() || '',
        protein: goals.protein?.toString() || '',
        carbs: goals.carbs?.toString() || '',
        fat: goals.fat?.toString() || ''
      });
    } else {
      setGoalInputs({ calories: '', protein: '', carbs: '', fat: '' });
    }
    setShowGoalsModal(true);
  };

  const saveGoalsFromModal = async () => {
    const hasAnyGoal = goalInputs.calories || goalInputs.protein || goalInputs.carbs || goalInputs.fat;
    
    if (hasAnyGoal) {
      const newGoals = {
        user_id: session.user.id,
        calories: goalInputs.calories ? parseInt(goalInputs.calories) : null,
        protein: goalInputs.protein ? parseInt(goalInputs.protein) : null,
        carbs: goalInputs.carbs ? parseInt(goalInputs.carbs) : null,
        fat: goalInputs.fat ? parseInt(goalInputs.fat) : null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from('goals').upsert(newGoals, { onConflict: 'user_id' });
      if (error) {
        console.error('Error saving goals:', error);
        return;
      }

      setGoals({
        calories: newGoals.calories,
        protein: newGoals.protein,
        carbs: newGoals.carbs,
        fat: newGoals.fat
      });
    } else {
      await clearGoals();
    }
    setShowGoalsModal(false);
  };

  const clearGoals = async () => {
    await supabase.from('goals').delete().eq('user_id', session.user.id);
    setGoals(null);
    setGoalInputs({ calories: '', protein: '', carbs: '', fat: '' });
    setShowGoalsModal(false);
  };

  // Utility functions
  const getDailyTotal = (date, type = 'calories') => {
    if (!entries[date]) return 0;
    const key = type === 'calories' ? 'totalCalories' : 
                type === 'protein' ? 'totalProtein' :
                type === 'carbs' ? 'totalCarbs' : 'totalFat';
    return entries[date].reduce((sum, entry) => sum + (entry[key] || 0), 0);
  };

  const changeDate = (direction) => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const current = new Date(year, month - 1, day);
    current.setDate(current.getDate() + direction);
    setSelectedDate(getLocalDateString(current));
  };

  const goToToday = () => setSelectedDate(getLocalDateString());
  const isToday = selectedDate === getLocalDateString();

  const getWeeklyData = () => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const today = new Date(year, month - 1, day);
    const weekData = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = getLocalDateString(date);
      weekData.push({
        date: dateStr,
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        calories: getDailyTotal(dateStr, 'calories')
      });
    }
    return weekData;
  };

  const getGoalProgress = (current, goal) => goal ? Math.min((current / goal) * 100, 100) : null;
  
  const getGoalColor = (current, goal) => {
    if (!goal) return 'bg-purple-600';
    const ratio = current / goal;
    if (ratio < 0.8) return 'bg-purple-600';
    if (ratio <= 1.0) return 'bg-green-500';
    return 'bg-red-500';
  };

  const formatDate = (dateStr) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Loading state
  if (isLoading && !session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center">
        <div className="text-purple-600 text-lg">Loading...</div>
      </div>
    );
  }

  // Auth screen
  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Easily</h1>
            <p className="text-gray-600">Track your nutrition with AI</p>
          </div>

          {authMessage && (
            <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg text-sm">{authMessage}</div>
          )}
          {authError && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{authError}</div>
          )}

          <form onSubmit={handleAuthSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                required
              />
            </div>

            {authMode !== 'reset' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none pr-12"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {authMode === 'signup' && (
                  <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters</p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-purple-600 text-white py-3 rounded-lg font-medium hover:bg-purple-700 transition disabled:opacity-50"
            >
              {authLoading ? 'Please wait...' : 
               authMode === 'signup' ? 'Create Account' :
               authMode === 'reset' ? 'Send Reset Link' : 'Log In'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm">
            {authMode === 'login' && (
              <>
                <p className="text-gray-600">
                  Don't have an account?{' '}
                  <button onClick={() => { setAuthMode('signup'); setAuthError(''); setAuthMessage(''); }} className="text-purple-600 hover:text-purple-800 font-medium">Sign up</button>
                </p>
                <p className="text-gray-600 mt-2">
                  <button onClick={() => { setAuthMode('reset'); setAuthError(''); setAuthMessage(''); }} className="text-purple-600 hover:text-purple-800 font-medium">Forgot password?</button>
                </p>
              </>
            )}
            {authMode === 'signup' && (
              <p className="text-gray-600">
                Already have an account?{' '}
                <button onClick={() => { setAuthMode('login'); setAuthError(''); setAuthMessage(''); }} className="text-purple-600 hover:text-purple-800 font-medium">Log in</button>
              </p>
            )}
            {authMode === 'reset' && (
              <p className="text-gray-600">
                <button onClick={() => { setAuthMode('login'); setAuthError(''); setAuthMessage(''); }} className="text-purple-600 hover:text-purple-800 font-medium">Back to login</button>
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main app
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Goals Modal */}
      {showGoalsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">Daily Goals</h2>
              <button onClick={() => setShowGoalsModal(false)} className="text-gray-500 hover:text-gray-700"><X size={24} /></button>
            </div>
            <p className="text-sm text-gray-600 mb-4">Set your daily nutrition targets. Leave blank any goals you don't want to track.</p>
            <div className="space-y-4">
              {['calories', 'protein', 'carbs', 'fat'].map(field => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">{field} {field !== 'calories' && '(g)'}</label>
                  <input
                    type="number"
                    value={goalInputs[field]}
                    onChange={(e) => setGoalInputs({...goalInputs, [field]: e.target.value})}
                    placeholder={field === 'calories' ? 'e.g., 2000' : field === 'protein' ? 'e.g., 150' : field === 'carbs' ? 'e.g., 250' : 'e.g., 65'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={clearGoals} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">Clear Goals</button>
              <button onClick={saveGoalsFromModal} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">Save Goals</button>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-40">
          <div className="text-purple-600 text-lg">Loading your data...</div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Easily</h1>
            <p className="text-sm text-gray-600">{session.user.email}</p>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={openGoalsModal} className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition" title="Set daily goals">
              <Target size={20} /><span className="hidden sm:inline">Goals</span>
            </button>
            <button onClick={handleLogout} className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition">
              <LogOut size={20} /><span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Date Navigation */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between py-3">
          <button onClick={() => changeDate(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition"><ChevronLeft size={20} /></button>
          <div className="text-center">
            <p className="text-sm text-gray-600">{formatDate(selectedDate)}</p>
            {!isToday && <button onClick={goToToday} className="text-xs text-purple-600 hover:text-purple-800 mt-1">Go to today</button>}
          </div>
          <button onClick={() => changeDate(1)} className="p-2 hover:bg-gray-100 rounded-lg transition" disabled={isToday}>
            <ChevronRight size={20} className={isToday ? 'text-gray-300' : ''} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-4xl mx-auto">
          {/* Stats Card */}
          <div className="bg-gradient-to-br from-purple-50 to-white rounded-xl shadow-sm p-6 lg:p-8 mb-6">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-12">
              {/* Macros */}
              <div className="flex-1 space-y-4 w-full">
                {['protein', 'carbs', 'fat'].map(macro => (
                  <div key={macro}>
                    <div className="flex items-baseline gap-4 mb-1">
                      <span className="text-sm text-gray-600 w-12 capitalize">{macro}</span>
                      <span className="text-2xl lg:text-3xl font-bold text-purple-600">
                        {getDailyTotal(selectedDate, macro)}<span className="text-lg text-gray-500">g</span>
                        {goals?.[macro] && <span className="text-sm text-gray-400 ml-2">/ {goals[macro]}g</span>}
                      </span>
                    </div>
                    {goals?.[macro] && (
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full ${getGoalColor(getDailyTotal(selectedDate, macro), goals[macro])} transition-all`} style={{ width: `${getGoalProgress(getDailyTotal(selectedDate, macro), goals[macro])}%` }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Chart */}
              <div className="flex-1 w-full">
                <div className="text-center mb-2"><p className="text-sm text-gray-600">7-Day Trend</p></div>
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={getWeeklyData()}>
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px' }} formatter={(value) => [`${value} cal`, 'Calories']} />
                    <Line type="monotone" dataKey="calories" stroke="#9333ea" strokeWidth={3} dot={{ fill: '#9333ea', r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              {/* Calories */}
              <div className="flex-shrink-0">
                <div className="bg-white rounded-2xl shadow-lg px-8 lg:px-10 py-6 lg:py-8 text-center">
                  <div className="text-5xl lg:text-7xl font-bold text-purple-600 leading-none">{getDailyTotal(selectedDate, 'calories')}</div>
                  <div className="text-sm text-gray-600 mt-3">Calories{goals?.calories && <span className="text-gray-400"> / {goals.calories}</span>}</div>
                  {goals?.calories && (
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden mt-3">
                      <div className={`h-full ${getGoalColor(getDailyTotal(selectedDate, 'calories'), goals.calories)} transition-all`} style={{ width: `${getGoalProgress(getDailyTotal(selectedDate, 'calories'), goals.calories)}%` }} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Entries */}
          <div className="space-y-4 mb-6">
            {entries[selectedDate]?.map((entry) => (
              <div key={entry.id} className="bg-white rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-500">{entry.localTime || new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
                  {editingEntry !== entry.id && (
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(entry)} className="text-purple-600 hover:text-purple-800 p-1"><Edit2 size={16} /></button>
                      <button onClick={() => deleteEntry(selectedDate, entry.id)} className="text-red-600 hover:text-red-800 p-1"><Trash2 size={16} /></button>
                    </div>
                  )}
                </div>
                
                {editingEntry === entry.id ? (
                  <div className="mb-3 flex gap-2">
                    <input type="text" value={editText} onChange={(e) => setEditText(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" disabled={isProcessing} />
                    <button onClick={() => saveEdit(selectedDate, entry.id)} disabled={isProcessing} className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"><Check size={20} /></button>
                    <button onClick={cancelEdit} disabled={isProcessing} className="bg-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50"><X size={20} /></button>
                  </div>
                ) : (
                  <p className="text-gray-700 mb-4 italic">"{entry.input}"</p>
                )}
                
                <div className="space-y-2 mb-3">
                  {entry.items.map((item, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-3">
                      {editingNutrition?.entryId === entry.id && editingNutrition?.itemIndex === idx ? (
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-gray-800 font-medium">{item.item}</span>
                          </div>
                          <div className="grid grid-cols-4 gap-2 mb-2">
                            {['calories', 'protein', 'carbs', 'fat'].map(field => (
                              <div key={field}>
                                <label className="text-xs text-gray-600 block mb-1 capitalize">{field === 'calories' ? 'Calories' : `${field} (g)`}</label>
                                <input type="number" value={nutritionEditValues[field]} onChange={(e) => setNutritionEditValues({...nutritionEditValues, [field]: e.target.value})} className="w-full px-2 py-1 border rounded text-sm" />
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => saveNutritionCorrection(selectedDate, entry.id, idx)} className="flex-1 bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">Save & Remember</button>
                            <button onClick={cancelEditNutrition} className="px-3 py-1 bg-gray-300 rounded text-sm hover:bg-gray-400">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-gray-800 font-medium">{item.item}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900">{item.error ? '?' : item.calories} cal</span>
                              <button onClick={() => startEditNutrition(entry.id, idx, item)} className="text-purple-600 hover:text-purple-800 text-xs">Edit</button>
                            </div>
                          </div>
                          <div className="flex gap-4 text-sm text-gray-600">
                            <span>P: {item.protein}g</span>
                            <span>C: {item.carbs}g</span>
                            <span>F: {item.fat}g</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="pt-3 border-t border-gray-200">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600 font-medium">Total</span>
                    <span className="text-lg font-bold text-purple-600">{entry.totalCalories} cal</span>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span className="text-purple-600">P: {entry.totalProtein}g</span>
                    <span className="text-purple-600">C: {entry.totalCarbs}g</span>
                    <span className="text-purple-600">F: {entry.totalFat}g</span>
                  </div>
                </div>
              </div>
            ))}
            
            {(!entries[selectedDate] || entries[selectedDate].length === 0) && (
              <div className="text-center py-12 bg-white rounded-xl">
                <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">No entries for this day yet.</p>
                <p className="text-sm text-gray-500 mt-2">Start logging your meals below!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex gap-3">
          <input
            type="text"
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="What did you eat? (e.g., 2 eggs, toast with butter)"
            disabled={isProcessing}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100"
          />
          <button
            onClick={handleSubmit}
            disabled={isProcessing || !currentInput.trim()}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isProcessing ? 'Processing...' : <><Send size={20} />Log</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CalorieTracker;
