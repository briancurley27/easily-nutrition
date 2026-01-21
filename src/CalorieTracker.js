import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Send, LogOut, Trash2, Edit2, X, ChevronLeft, ChevronRight, Target, Eye, EyeOff, GripVertical, Plus } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from './supabase';

// Auth Modal Component - defined outside to prevent re-mounting on state changes
const AuthModal = ({
  authMode,
  setAuthMode,
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  authError,
  setAuthError,
  authMessage,
  setAuthMessage,
  authLoading,
  showPassword,
  setShowPassword,
  handleAuthSubmit,
  handleGoogleSignIn,
  onClose
}) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            {authMode === 'signup' ? 'Create Account' : authMode === 'reset' ? 'Reset Password' : 'Log In'}
          </h2>
          <p className="text-sm text-gray-600 mt-1">Save your data and track across devices</p>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <X size={24} />
        </button>
      </div>

      {authMessage && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg text-sm">{authMessage}</div>
      )}
      {authError && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{authError}</div>
      )}

      {/* Google Sign-In Button - only show for login/signup, not password reset */}
      {authMode !== 'reset' && (
        <>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={authLoading}
            className="w-full bg-white border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 hover:border-gray-400 transition disabled:opacity-50 flex items-center justify-center gap-3"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.20454C17.64 8.56636 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20454Z" fill="#4285F4"/>
              <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4205 9 14.4205C6.65591 14.4205 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"/>
              <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957275C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
              <path d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z" fill="#EA4335"/>
            </svg>
            {authLoading ? 'Please wait...' : `${authMode === 'signup' ? 'Sign up' : 'Sign in'} with Google`}
          </button>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or continue with email</span>
            </div>
          </div>
        </>
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

  const parseSource = (source) => {
    if (!source || source === 'unknown' || source === 'error') {
      return { displayName: source || 'unknown', url: null };
    }

    // Handle user corrections
    if (source === 'user correction') {
      return { displayName: 'User', url: null };
    }

    // Handle USDA sources
    if (source.toLowerCase().includes('usda') || source.toLowerCase().includes('fooddata central')) {
      return { displayName: 'USDA', url: 'https://fdc.nal.usda.gov/' };
    }

    // Try to extract URL from the source
    const urlMatch = source.match(/(https?:\/\/[^\s,)]+)/);

    if (urlMatch) {
      const url = urlMatch[1];
      // Extract domain/brand name from URL
      try {
        const urlObj = new URL(url);
        let domain = urlObj.hostname.replace('www.', '');

        // Get the main part of the domain (e.g., "mcdonalds" from "mcdonalds.com")
        const mainDomain = domain.split('.')[0];

        // Capitalize first letter
        const displayName = mainDomain.charAt(0).toUpperCase() + mainDomain.slice(1);

        return { displayName, url };
      } catch (e) {
        // If URL parsing fails, try to extract domain manually
        const domainMatch = url.match(/\/\/([^/]+)/);
        if (domainMatch) {
          const domain = domainMatch[1].replace('www.', '').split('.')[0];
          const displayName = domain.charAt(0).toUpperCase() + domain.slice(1);
          return { displayName, url };
        }
      }
    }

    // For other sources, try to extract just the main brand/source name
    // Remove parentheses and everything after them
    let displayName = source.split('(')[0].trim();

    // If it's still too long, take first few words
    const words = displayName.split(' ');
    if (words.length > 2) {
      displayName = words.slice(0, 2).join(' ');
    }

    // Limit length
    if (displayName.length > 30) {
      displayName = displayName.substring(0, 27) + '...';
    }

    return { displayName, url: null };
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
  const [corrections, setCorrections] = useState({});
  const [editingNutrition, setEditingNutrition] = useState(null);
  const [nutritionEditValues, setNutritionEditValues] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [goals, setGoals] = useState(null);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [goalInputs, setGoalInputs] = useState({ calories: '', protein: '', carbs: '', fat: '' });
  const [visibleSourceKey, setVisibleSourceKey] = useState(null);
  const [processingError, setProcessingError] = useState(null); // { message, details }
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null); // { entryId, itemIndex }
  const [touchDragState, setTouchDragState] = useState(null); // { entryId, itemIndex, startY, currentY }
  const [dragPreview, setDragPreview] = useState(null); // { x, y, item } for visual feedback

  // Anonymous user states
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [hasCompletedFirstEntry, setHasCompletedFirstEntry] = useState(false);

  // Chat and confirmation states
  const [messages, setMessages] = useState([]); // Conversation history
  const [pendingFoods, setPendingFoods] = useState(null); // {items: [], selectionState: {0: true, 1: true, ...}}
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualEntryInputs, setManualEntryInputs] = useState({
    item: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: ''
  });
  const chatEndRef = useRef(null);

  // Swipe state for individual items
  const [swipedItem, setSwipedItem] = useState(null); // { entryId, itemIndex, offsetX }
  const swipeStartRef = useRef(null); // { x, entryId, itemIndex }

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        // Only clear if user logged out (not on initial load)
        if (_event === 'SIGNED_OUT') {
          setEntries({});
          setCorrections({});
          setGoals(null);
          setHasCompletedFirstEntry(false);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!visibleSourceKey) return;

    const handlePointerDown = (event) => {
      if (event.target.closest('[data-source-tooltip="true"]')) return;
      setVisibleSourceKey(null);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [visibleSourceKey]);

  // Data loading functions
  const loadEntries = useCallback(async () => {
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
  }, [session?.user?.id]);

  const loadCorrections = useCallback(async () => {
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
  }, [session?.user?.id]);

  const loadGoals = useCallback(async () => {
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (error) {
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
  }, [session?.user?.id]);

  const loadAllData = useCallback(async () => {
    if (!session?.user) return;
    setIsLoading(true);
    await Promise.all([loadEntries(), loadCorrections(), loadGoals()]);
    setIsLoading(false);
  }, [loadEntries, loadCorrections, loadGoals, session?.user]);

  useEffect(() => {
    if (session?.user) {
      loadAllData();
    }
  }, [loadAllData, session?.user]);

  useEffect(() => {
    setSelectedDate(getLocalDateString());
  }, []);

  // Auto-scroll chat to bottom when messages change
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, pendingFoods]);

  // Clear chat and pending foods when date changes (new conversation for each day)
  useEffect(() => {
    setMessages([]);
    setPendingFoods(null);
  }, [selectedDate]);

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

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError('');
    setAuthMessage('');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });

    setAuthLoading(false);

    if (error) {
      setAuthError(error.message);
    }
    // Note: If successful, user will be redirected to Google OAuth page
    // and then back to the app, so we don't need to handle success here
  };

  // Food processing with conversation context
  const processFood = async (foodText, conversationHistory = []) => {
    const perfStart = performance.now();
    console.log('[PERF] processFood: Starting for:', foodText);

    setIsProcessing(true);
    setProcessingError(null);
    setShowErrorDetails(false);

    try {
      // Only include corrections that might be relevant (limit to 10 most recent to reduce token usage)
      const relevantCorrections = Object.keys(corrections).length > 0
        ? Object.fromEntries(Object.entries(corrections).slice(-10))
        : {};

      const correctionsContext = Object.keys(relevantCorrections).length > 0
        ? `\n\nUSER'S SAVED CORRECTIONS (use these exact values if the food matches - match case-insensitively):\n${JSON.stringify(relevantCorrections, null, 2)}`
        : '';

      // Build messages array with conversation history
      const apiMessages = [
        {
          role: 'system',
          content: `You are a friendly nutrition tracking assistant. You have two response modes:

MODE 1 - INITIAL RESPONSE (ALWAYS DO THIS FIRST):
Provide nutrition data immediately with reasonable assumptions. Return a JSON array with the food items.

ASSUMPTIONS TO MAKE:
- "Glass of milk" = 8 oz whole milk
- "Coffee" = black coffee with optional mention of adding cream/sugar
- "Banana" = medium banana (120g)
- "Chicken breast" = 6 oz cooked
- "Steak" = 8 oz
- Generic items = standard serving sizes

After the JSON array, you may add a brief friendly suggestion for refinement (optional, keep it natural):
"These are the values for whole milk - let me know if you had skim, 2%, or another type for more precise tracking!"

MODE 2 - CLARIFYING QUESTIONS (Only when truly necessary):
Only ask clarifying questions if the food is genuinely ambiguous and you cannot make a reasonable assumption.
Examples: "pasta" (need to know if plain, with sauce, etc.), "salad" (countless variations)

When asking questions, still provide an initial estimate with assumptions stated clearly.

FORMATTING RULES:
1. Clean up food names: Fix typos, capitalize properly, use official brand names
2. Emoji: Use only if clearly representative (🍌 🍎 🍕 🍟 🥚). Skip for branded items
3. Quantity: Put number BEFORE name ("2 Eggs" not "Eggs (2)")
4. Portions: Add assumed portions for proteins ("Chicken Breast (6 oz)")

Examples:
"2 eggs" → {"item":"🥚 2 Eggs","calories":140,"protein":12,"carbs":2,"fat":10,"source":"USDA"}
"glass of milk" → {"item":"🥛 Glass of Milk (8 oz, Whole)","calories":150,"protein":8,"carbs":12,"fat":8,"source":"USDA"} + suggestion about milk types
"chicken breast" → {"item":"🍗 Chicken Breast (6 oz)","calories":280,"protein":53,"carbs":0,"fat":6,"source":"USDA"}
"large fries from McDonald's" → {"item":"🍟 Large McDonald's French Fries","calories":490,"protein":6,"carbs":66,"fat":23,"source":"McDonald's nutrition"}

Return format: [{"item":"name","calories":100,"protein":10,"carbs":20,"fat":5,"source":"source"}]`
        },
        // Add conversation history (limit to last 10 messages to manage token usage)
        ...conversationHistory.slice(-10),
        {
          role: 'user',
          content: `Parse "${foodText}" and return nutrition for each item.${correctionsContext}`
        }
      ];

      const apiStart = performance.now();
      console.log('[PERF] processFood: Starting API call');
      const response = await fetch('/api/openai/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-5-mini-2025-08-07',
          max_completion_tokens: 4000,
          messages: apiMessages
        })
      });

      const apiEnd = performance.now();
      const apiDuration = ((apiEnd - apiStart) / 1000).toFixed(2);
      console.log(`[PERF] processFood: API call completed in ${apiDuration}s`);

      if (!response.ok) {
        const errorText = await response.text();
        const errorMsg = `API error (${response.status}): ${errorText}`;
        console.error('[processFood] API error:', errorMsg);
        setProcessingError({
          message: 'Unable to connect to AI service. Please try again.',
          details: `HTTP ${response.status}: ${errorText}`
        });
        throw new Error(errorMsg);
      }

      const parseStart = performance.now();
      console.log('[PERF] processFood: Parsing response');
      const data = await response.json();
      console.log('[processFood] Full API response:', JSON.stringify(data, null, 2));

      // Extract text from OpenAI response format
      let allText = '';
      let refusalReason = null;
      let finishReason = null;

      if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        const message = data.choices[0].message;
        const choice = data.choices[0];

        allText = message.content || '';
        refusalReason = message.refusal;
        finishReason = choice.finish_reason;

        console.log('[processFood] Message details:', {
          hasContent: !!message.content,
          contentType: typeof message.content,
          contentLength: message.content?.length,
          content: message.content,
          refusal: message.refusal,
          finishReason: choice.finish_reason
        });
      } else {
        console.error('[processFood] Unexpected response structure:', {
          hasChoices: !!data.choices,
          choicesLength: data.choices?.length,
          hasMessage: !!data.choices?.[0]?.message,
          fullData: data
        });
      }

      // Check for refusal
      if (refusalReason) {
        const errorMsg = `AI refused to process: ${refusalReason}`;
        console.error('[processFood] AI refusal:', refusalReason);
        setProcessingError({
          message: 'Unable to process your request. Try rephrasing your food description.',
          details: `AI Refusal: ${refusalReason}`
        });
        throw new Error(errorMsg);
      }

      if (!allText || allText.trim() === '') {
        // Provide user-friendly message and technical details based on finish reason
        let userMessage = 'Unable to process your food. Please try again.';
        let technicalDetails = 'No text content in API response.';

        if (finishReason === 'content_filter') {
          userMessage = 'Your request was blocked. Try rephrasing your food description.';
          technicalDetails = `Finish reason: content_filter. The AI's content filter blocked this request.`;
        } else if (finishReason === 'length') {
          userMessage = 'Too many items at once. Try entering fewer items.';
          technicalDetails = `Finish reason: length. Response was cut off due to token length limits.`;
        } else if (data.error) {
          userMessage = 'AI service error. Please try again in a moment.';
          technicalDetails = `OpenAI API error: ${data.error.message || JSON.stringify(data.error)}`;
        } else {
          userMessage = 'Temporary issue with AI service. Please try again.';
          technicalDetails = `No text content in API response. Finish reason: ${finishReason || 'unknown'}. Full response: ${JSON.stringify(data)}`;
        }

        console.error('[processFood]', technicalDetails, 'Full response:', data);
        setProcessingError({
          message: userMessage,
          details: technicalDetails
        });
        throw new Error(technicalDetails);
      }

      console.log('[processFood] Extracted text preview:', allText.substring(0, 300));

      // Clean markdown code blocks
      let content = allText.trim().replace(/```json\s*/g, '').replace(/```\s*/g, '');

      // Try to find JSON array
      const arrayMatch = content.match(/\[\s*\{[\s\S]*?\}\s*\]/);
      if (!arrayMatch) {
        const errorMsg = 'Could not find JSON array in response';
        console.error('[processFood]', errorMsg);
        console.error('[processFood] Response content:', content);
        setProcessingError({
          message: 'AI returned an unexpected format. Please try again.',
          details: `Could not find JSON array in response. Content received: ${content.substring(0, 500)}`
        });
        throw new Error(errorMsg);
      }

      console.log('[processFood] Found JSON array:', arrayMatch[0].substring(0, 200));

      // Parse the JSON
      let foodItems;
      try {
        foodItems = JSON.parse(arrayMatch[0]);
      } catch (parseError) {
        const errorMsg = `JSON parse error: ${parseError.message}`;
        console.error('[processFood]', errorMsg);
        console.error('[processFood] Attempted to parse:', arrayMatch[0]);
        setProcessingError({
          message: 'Failed to parse AI response. Please try again.',
          details: `JSON parse error: ${parseError.message}. Attempted to parse: ${arrayMatch[0]}`
        });
        throw parseError;
      }

      console.log('[processFood] Parsed food items:', foodItems);

      // Validate and map items
      const mappedItems = foodItems.map((item, index) => {
        const hasCalories = item.calories && parseInt(item.calories) > 0;
        if (!hasCalories) {
          console.warn(`[processFood] Item ${index} has no calories:`, item);
        }
        return {
          item: item.item || 'Unknown',
          calories: parseInt(item.calories) || 0,
          protein: parseInt(item.protein) || 0,
          carbs: parseInt(item.carbs) || 0,
          fat: parseInt(item.fat) || 0,
          source: item.source || 'estimate',
          error: !hasCalories
        };
      });

      const parseEnd = performance.now();
      const parseDuration = ((parseEnd - parseStart) / 1000).toFixed(2);
      console.log(`[PERF] processFood: Response parsing took ${parseDuration}s`);

      const perfEnd = performance.now();
      const totalDuration = ((perfEnd - perfStart) / 1000).toFixed(2);
      console.log(`[PERF] processFood: Total time ${totalDuration}s (API: ${apiDuration}s, Parse: ${parseDuration}s)`);
      console.log('[processFood] Success! Returning', mappedItems.length, 'items');
      return mappedItems;

    } catch (error) {
      console.error('[processFood] Exception:', error.message);
      console.error('[processFood] Stack:', error.stack);

      // Set user-friendly error message if not already set
      if (!processingError) {
        setProcessingError({
          message: 'Failed to process your food. Please try again.',
          details: `Error: ${error.message}\n\nStack trace:\n${error.stack}`
        });
      }

      return [{
        item: foodText,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        source: 'error',
        error: true
      }];
    } finally {
      setIsProcessing(false);
    }
  };

  // Entry management with conversational flow
  const handleSubmit = async () => {
    if (!currentInput.trim() || isProcessing) return;

    const submitStart = performance.now();
    console.log('[PERF] handleSubmit: Starting');

    const userMessage = currentInput;

    // Add user message to chat
    const newUserMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, newUserMessage]);
    setCurrentInput('');

    // Process food with conversation history
    const foodItems = await processFood(userMessage, messages);

    if (foodItems.length > 0 && !foodItems[0].error) {
      // Add AI response message to chat
      const aiMessage = {
        role: 'assistant',
        content: `I found ${foodItems.length} item${foodItems.length > 1 ? 's' : ''}: ${foodItems.map(item => item.item).join(', ')}`,
        timestamp: new Date().toISOString(),
        items: foodItems
      };

      setMessages(prev => [...prev, aiMessage]);

      // Set pending foods for confirmation (all selected by default)
      const selectionState = {};
      foodItems.forEach((_, index) => {
        selectionState[index] = true;
      });

      setPendingFoods({
        items: foodItems,
        selectionState: selectionState,
        originalInput: userMessage
      });
    } else {
      // Error case
      const aiMessage = {
        role: 'assistant',
        content: 'Sorry, I had trouble processing that. Please try again.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, aiMessage]);
    }

    const submitEnd = performance.now();
    const totalSubmitDuration = ((submitEnd - submitStart) / 1000).toFixed(2);
    console.log(`[PERF] handleSubmit: Total submission time ${totalSubmitDuration}s`);
  };

  // Add confirmed foods to log
  const addConfirmedFoodsToLog = async () => {
    if (!pendingFoods) return;

    const { items, selectionState, originalInput } = pendingFoods;

    // Get only selected items
    const selectedItems = items.filter((_, index) => selectionState[index]);

    if (selectedItems.length === 0) {
      setPendingFoods(null);
      return;
    }

    const dbStart = performance.now();
    console.log('[PERF] addConfirmedFoodsToLog: Starting database operations');
    const now = new Date();

    const newEntry = {
      date: selectedDate,
      timestamp: now.toISOString(),
      local_time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      input: originalInput,
      items: selectedItems,
      total_calories: selectedItems.reduce((sum, item) => sum + (item.calories || 0), 0),
      total_protein: selectedItems.reduce((sum, item) => sum + (item.protein || 0), 0),
      total_carbs: selectedItems.reduce((sum, item) => sum + (item.carbs || 0), 0),
      total_fat: selectedItems.reduce((sum, item) => sum + (item.fat || 0), 0)
    };

    if (session?.user) {
      // Authenticated user: save to Supabase
      newEntry.user_id = session.user.id;

      let data, error;
      let retries = 0;
      const maxRetries = 3;

      // Retry logic for network errors
      while (retries < maxRetries) {
        const result = await supabase.from('entries').insert(newEntry).select().single();
        data = result.data;
        error = result.error;

        if (!error) break;

        // If it's a network error, retry after a delay
        if (error.message?.includes('Load failed') || error.message?.includes('network')) {
          retries++;
          if (retries < maxRetries) {
            console.log(`Network error, retrying (${retries}/${maxRetries})...`);
            const delay = 1000 * retries; // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        break;
      }

      if (error) {
        console.error('Error saving entry:', error);
        setProcessingError({
          message: 'Failed to save your entry. Your food was processed but not saved.',
          details: `Database error: ${error.message || 'Unknown database connection error'}\n\nError object: ${JSON.stringify(error, null, 2)}`
        });
        return;
      }

      const dbEnd = performance.now();
      const dbDuration = ((dbEnd - dbStart) / 1000).toFixed(2);
      console.log(`[PERF] addConfirmedFoodsToLog: Database save took ${dbDuration}s`);

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
    } else {
      // Anonymous user: keep in memory only with temporary ID
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      const updatedEntries = { ...entries };
      if (!updatedEntries[selectedDate]) updatedEntries[selectedDate] = [];
      updatedEntries[selectedDate].push({
        id: tempId,
        timestamp: newEntry.timestamp,
        localTime: newEntry.local_time,
        input: newEntry.input,
        items: newEntry.items,
        totalCalories: newEntry.total_calories,
        totalProtein: newEntry.total_protein,
        totalCarbs: newEntry.total_carbs,
        totalFat: newEntry.total_fat
      });

      setEntries(updatedEntries);

      // Show signup prompt after first entry (with delay so users can see results)
      if (!hasCompletedFirstEntry) {
        setHasCompletedFirstEntry(true);
        // Dynamic delay based on number of items: 5s for 1 item, +0.5s per additional item, max 10s
        const itemCount = selectedItems.length;
        const delayMs = Math.min(5000 + (itemCount - 1) * 500, 10000);
        setTimeout(() => {
          setShowSignupPrompt(true);
        }, delayMs);
      }
    }

    // Clear pending foods
    setPendingFoods(null);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Toggle food selection in pending foods
  const toggleFoodSelection = (index) => {
    if (!pendingFoods) return;

    setPendingFoods(prev => ({
      ...prev,
      selectionState: {
        ...prev.selectionState,
        [index]: !prev.selectionState[index]
      }
    }));
  };

  // Manual entry submission
  const submitManualEntry = async () => {
    const { item, calories, protein, carbs, fat } = manualEntryInputs;

    if (!item.trim()) {
      setProcessingError({ message: 'Please enter a food name.' });
      return;
    }

    const now = new Date();
    const foodItem = {
      item: item.trim(),
      calories: parseInt(calories) || 0,
      protein: parseInt(protein) || 0,
      carbs: parseInt(carbs) || 0,
      fat: parseInt(fat) || 0,
      source: 'manual entry'
    };

    const newEntry = {
      date: selectedDate,
      timestamp: now.toISOString(),
      local_time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      input: `Manual: ${item.trim()}`,
      items: [foodItem],
      total_calories: foodItem.calories,
      total_protein: foodItem.protein,
      total_carbs: foodItem.carbs,
      total_fat: foodItem.fat
    };

    if (session?.user) {
      // Authenticated user: save to Supabase
      newEntry.user_id = session.user.id;

      const { data, error } = await supabase.from('entries').insert(newEntry).select().single();

      if (error) {
        console.error('Error saving manual entry:', error);
        setProcessingError({
          message: 'Failed to save your entry.',
          details: error.message
        });
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
    } else {
      // Anonymous user: keep in memory only
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      const updatedEntries = { ...entries };
      if (!updatedEntries[selectedDate]) updatedEntries[selectedDate] = [];
      updatedEntries[selectedDate].push({
        id: tempId,
        timestamp: newEntry.timestamp,
        localTime: newEntry.local_time,
        input: newEntry.input,
        items: newEntry.items,
        totalCalories: newEntry.total_calories,
        totalProtein: newEntry.total_protein,
        totalCarbs: newEntry.total_carbs,
        totalFat: newEntry.total_fat
      });

      setEntries(updatedEntries);
    }

    // Reset form and close modal
    setManualEntryInputs({
      item: '',
      calories: '',
      protein: '',
      carbs: '',
      fat: ''
    });
    setShowManualEntry(false);
  };

  const deleteEntry = async (date, entryId) => {
    // Only delete from database if user is authenticated
    if (session?.user) {
      const { error } = await supabase.from('entries').delete().eq('id', entryId);
      if (error) {
        console.error('Error deleting entry:', error);
        return;
      }
    }

    // Update local state (works for both authenticated and anonymous)
    const updatedEntries = { ...entries };
    updatedEntries[date] = updatedEntries[date].filter(entry => entry.id !== entryId);
    if (updatedEntries[date].length === 0) delete updatedEntries[date];
    setEntries(updatedEntries);
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

    // Only save correction to database if user is authenticated
    if (session?.user) {
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
    }

    // Update the item in the entry
    const updatedItems = [...entry.items];
    updatedItems[itemIndex] = {
      ...item,
      calories: parseInt(nutritionEditValues.calories) || 0,
      protein: parseInt(nutritionEditValues.protein) || 0,
      carbs: parseInt(nutritionEditValues.carbs) || 0,
      fat: parseInt(nutritionEditValues.fat) || 0,
      source: session?.user ? 'user correction' : 'manual edit'
    };

    const newTotals = {
      total_calories: updatedItems.reduce((sum, i) => sum + (i.calories || 0), 0),
      total_protein: updatedItems.reduce((sum, i) => sum + (i.protein || 0), 0),
      total_carbs: updatedItems.reduce((sum, i) => sum + (i.carbs || 0), 0),
      total_fat: updatedItems.reduce((sum, i) => sum + (i.fat || 0), 0)
    };

    // Only update database if user is authenticated
    if (session?.user) {
      await supabase.from('entries').update({ items: updatedItems, ...newTotals }).eq('id', entryId);
    }

    // Update local state (works for both authenticated and anonymous)
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

  // Swipe handlers for individual items
  const handleItemTouchStart = (e, entryId, itemIndex) => {
    // Don't start swipe if editing nutrition
    if (editingNutrition !== null) return;

    const touch = e.touches[0];
    swipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      entryId,
      itemIndex,
      startTime: Date.now()
    };
  };

  const handleItemTouchMove = (e, entryId, itemIndex) => {
    if (!swipeStartRef.current ||
        swipeStartRef.current.entryId !== entryId ||
        swipeStartRef.current.itemIndex !== itemIndex) {
      return;
    }

    const touch = e.touches[0];
    const deltaX = touch.clientX - swipeStartRef.current.x;
    const deltaY = Math.abs(touch.clientY - swipeStartRef.current.y);

    // Only register horizontal swipes (not vertical scrolling)
    if (Math.abs(deltaX) > 10 && deltaY < 30) {
      e.preventDefault(); // Prevent scrolling when swiping horizontally

      // Limit swipe distance
      const maxSwipe = 100;
      const limitedDeltaX = Math.max(-maxSwipe, Math.min(maxSwipe, deltaX));

      setSwipedItem({
        entryId,
        itemIndex,
        offsetX: limitedDeltaX
      });
    }
  };

  const handleItemTouchEnd = (e, entryId, itemIndex) => {
    if (!swipedItem || !swipeStartRef.current) {
      swipeStartRef.current = null;
      return;
    }

    const { offsetX } = swipedItem;
    const swipeThreshold = 50; // Minimum swipe distance to trigger action

    // Swipe right = Edit
    if (offsetX > swipeThreshold) {
      const entry = entries[selectedDate].find(e => e.id === entryId);
      if (entry && entry.items[itemIndex]) {
        startEditNutrition(entryId, itemIndex, entry.items[itemIndex]);
      }
    }
    // Swipe left = Delete
    else if (offsetX < -swipeThreshold) {
      deleteIndividualItem(selectedDate, entryId, itemIndex);
    }

    // Reset swipe state
    setSwipedItem(null);
    swipeStartRef.current = null;
  };

  // Delete individual item from entry
  const deleteIndividualItem = async (date, entryId, itemIndex) => {
    const entry = entries[date].find(e => e.id === entryId);
    if (!entry) return;

    const updatedItems = entry.items.filter((_, idx) => idx !== itemIndex);

    // If no items left, delete the entire entry
    if (updatedItems.length === 0) {
      await deleteEntry(date, entryId);
      return;
    }

    // Calculate new totals
    const newTotals = {
      total_calories: updatedItems.reduce((sum, i) => sum + (i.calories || 0), 0),
      total_protein: updatedItems.reduce((sum, i) => sum + (i.protein || 0), 0),
      total_carbs: updatedItems.reduce((sum, i) => sum + (i.carbs || 0), 0),
      total_fat: updatedItems.reduce((sum, i) => sum + (i.fat || 0), 0)
    };

    // Update database if authenticated
    if (session?.user) {
      await supabase.from('entries').update({ items: updatedItems, ...newTotals }).eq('id', entryId);
    }

    // Update local state
    const updatedEntries = { ...entries };
    const entryIndexInList = updatedEntries[date].findIndex(e => e.id === entryId);
    if (entryIndexInList !== -1) {
      updatedEntries[date][entryIndexInList] = {
        ...entry,
        items: updatedItems,
        totalCalories: newTotals.total_calories,
        totalProtein: newTotals.total_protein,
        totalCarbs: newTotals.total_carbs,
        totalFat: newTotals.total_fat
      };
    }
    setEntries(updatedEntries);
  };

  // Drag and drop for reordering items
  const handleDragStart = (e, entryId, itemIndex) => {
    e.stopPropagation(); // Prevent bubbling
    setDraggedItem({ entryId, itemIndex });

    // Get the item data for preview
    const entry = entries[selectedDate]?.find(e => e.id === entryId);
    if (entry && entry.items[itemIndex]) {
      setDragPreview({
        x: e.clientX,
        y: e.clientY,
        item: entry.items[itemIndex]
      });
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // Allow drop

    // Update preview position during drag
    if (draggedItem && dragPreview) {
      setDragPreview(prev => ({
        ...prev,
        x: e.clientX,
        y: e.clientY
      }));
    }
  };

  const handleDragEnd = () => {
    // Clear preview when drag ends (for desktop)
    setDragPreview(null);
  };

  const handleDrop = async (targetEntryId, targetItemIndex) => {
    if (!draggedItem) return;

    const { entryId: sourceEntryId, itemIndex: sourceItemIndex } = draggedItem;

    // Don't do anything if dropped in the same position
    if (sourceEntryId === targetEntryId && sourceItemIndex === targetItemIndex) {
      setDraggedItem(null);
      return;
    }

    const updatedEntries = { ...entries };
    const sourceEntry = updatedEntries[selectedDate].find(e => e.id === sourceEntryId);
    const targetEntry = updatedEntries[selectedDate].find(e => e.id === targetEntryId);

    if (!sourceEntry || !targetEntry) {
      setDraggedItem(null);
      return;
    }

    // Get the item being moved
    const movedItem = sourceEntry.items[sourceItemIndex];

    if (sourceEntryId === targetEntryId) {
      // Reordering within same entry
      const newItems = [...sourceEntry.items];
      newItems.splice(sourceItemIndex, 1);
      newItems.splice(targetItemIndex, 0, movedItem);

      // Update totals
      const newTotals = {
        total_calories: newItems.reduce((sum, i) => sum + (i.calories || 0), 0),
        total_protein: newItems.reduce((sum, i) => sum + (i.protein || 0), 0),
        total_carbs: newItems.reduce((sum, i) => sum + (i.carbs || 0), 0),
        total_fat: newItems.reduce((sum, i) => sum + (i.fat || 0), 0)
      };

      // Update database only if user is authenticated
      if (session?.user) {
        await supabase.from('entries').update({ items: newItems, ...newTotals }).eq('id', sourceEntryId);
      }

      // Update state
      const entryIndex = updatedEntries[selectedDate].findIndex(e => e.id === sourceEntryId);
      updatedEntries[selectedDate][entryIndex] = {
        ...sourceEntry,
        items: newItems,
        totalCalories: newTotals.total_calories,
        totalProtein: newTotals.total_protein,
        totalCarbs: newTotals.total_carbs,
        totalFat: newTotals.total_fat
      };
    } else {
      // Moving between entries
      const sourceItems = [...sourceEntry.items];
      const targetItems = [...targetEntry.items];

      // Remove from source
      sourceItems.splice(sourceItemIndex, 1);
      // Add to target
      targetItems.splice(targetItemIndex, 0, movedItem);

      // Calculate new totals for both entries
      const sourceTotals = {
        total_calories: sourceItems.reduce((sum, i) => sum + (i.calories || 0), 0),
        total_protein: sourceItems.reduce((sum, i) => sum + (i.protein || 0), 0),
        total_carbs: sourceItems.reduce((sum, i) => sum + (i.carbs || 0), 0),
        total_fat: sourceItems.reduce((sum, i) => sum + (i.fat || 0), 0)
      };

      const targetTotals = {
        total_calories: targetItems.reduce((sum, i) => sum + (i.calories || 0), 0),
        total_protein: targetItems.reduce((sum, i) => sum + (i.protein || 0), 0),
        total_carbs: targetItems.reduce((sum, i) => sum + (i.carbs || 0), 0),
        total_fat: targetItems.reduce((sum, i) => sum + (i.fat || 0), 0)
      };

      // Update database for both entries only if user is authenticated
      if (session?.user) {
        await supabase.from('entries').update({ items: sourceItems, ...sourceTotals }).eq('id', sourceEntryId);
        await supabase.from('entries').update({ items: targetItems, ...targetTotals }).eq('id', targetEntryId);
      }

      // Update state
      const sourceIndex = updatedEntries[selectedDate].findIndex(e => e.id === sourceEntryId);
      const targetIndex = updatedEntries[selectedDate].findIndex(e => e.id === targetEntryId);

      updatedEntries[selectedDate][sourceIndex] = {
        ...sourceEntry,
        items: sourceItems,
        totalCalories: sourceTotals.total_calories,
        totalProtein: sourceTotals.total_protein,
        totalCarbs: sourceTotals.total_carbs,
        totalFat: sourceTotals.total_fat
      };

      updatedEntries[selectedDate][targetIndex] = {
        ...targetEntry,
        items: targetItems,
        totalCalories: targetTotals.total_calories,
        totalProtein: targetTotals.total_protein,
        totalCarbs: targetTotals.total_carbs,
        totalFat: targetTotals.total_fat
      };
    }

    setEntries(updatedEntries);
    setDraggedItem(null);
    setDragPreview(null);
  };

  // Touch event handlers for mobile drag and drop
  const handleTouchStart = (e, entryId, itemIndex) => {
    // Only start drag if not editing
    if (editingNutrition !== null) return;

    e.stopPropagation(); // Prevent bubbling

    const touch = e.touches[0];
    setTouchDragState({
      entryId,
      itemIndex,
      startY: touch.clientY,
      currentY: touch.clientY,
      startX: touch.clientX,
      isDragging: false // Only set to true after moving a bit
    });
    setDraggedItem({ entryId, itemIndex });

    // Get the item data for preview
    const entry = entries[selectedDate]?.find(e => e.id === entryId);
    if (entry && entry.items[itemIndex]) {
      setDragPreview({
        x: touch.clientX,
        y: touch.clientY,
        item: entry.items[itemIndex]
      });
    }
  };

  const handleTouchMove = (e) => {
    if (!touchDragState) return;

    const touch = e.touches[0];
    const deltaY = Math.abs(touch.clientY - touchDragState.startY);
    const deltaX = Math.abs(touch.clientX - touchDragState.startX);

    // Update preview position
    if (dragPreview) {
      setDragPreview(prev => ({
        ...prev,
        x: touch.clientX,
        y: touch.clientY
      }));
    }

    // If moved more than 10px, consider it a drag and prevent scrolling
    if (deltaY > 10 || deltaX > 10) {
      e.preventDefault();
      setTouchDragState({
        ...touchDragState,
        currentY: touch.clientY,
        isDragging: true
      });
    }
  };

  const handleTouchEnd = async (e) => {
    if (!touchDragState) return;

    // Only process if it was actually a drag
    if (!touchDragState.isDragging) {
      setTouchDragState(null);
      setDraggedItem(null);
      setDragPreview(null);
      return;
    }

    const touch = e.changedTouches[0];
    const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);

    // Find the closest item div
    const itemDiv = targetElement?.closest('[data-item-drop-target]');

    if (itemDiv) {
      const targetEntryId = itemDiv.getAttribute('data-entry-id');
      const targetItemIndex = parseInt(itemDiv.getAttribute('data-item-index'), 10);

      if (targetEntryId && !isNaN(targetItemIndex)) {
        await handleDrop(targetEntryId, targetItemIndex);
      }
    }

    setTouchDragState(null);
    setDraggedItem(null);
    setDragPreview(null);
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
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center">
        <div className="text-purple-600 text-lg">Loading...</div>
      </div>
    );
  }

  // Main app
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Manual Entry Modal */}
      {showManualEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">Manual Entry</h2>
              <button onClick={() => setShowManualEntry(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">Add a food entry manually with exact nutrition values.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Food Name *</label>
                <input
                  type="text"
                  value={manualEntryInputs.item}
                  onChange={(e) => setManualEntryInputs({...manualEntryInputs, item: e.target.value})}
                  placeholder="e.g., Chicken Breast"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Calories *</label>
                <input
                  type="number"
                  value={manualEntryInputs.calories}
                  onChange={(e) => setManualEntryInputs({...manualEntryInputs, calories: e.target.value})}
                  placeholder="e.g., 280"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Protein (g)</label>
                  <input
                    type="number"
                    value={manualEntryInputs.protein}
                    onChange={(e) => setManualEntryInputs({...manualEntryInputs, protein: e.target.value})}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Carbs (g)</label>
                  <input
                    type="number"
                    value={manualEntryInputs.carbs}
                    onChange={(e) => setManualEntryInputs({...manualEntryInputs, carbs: e.target.value})}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fat (g)</label>
                  <input
                    type="number"
                    value={manualEntryInputs.fat}
                    onChange={(e) => setManualEntryInputs({...manualEntryInputs, fat: e.target.value})}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowManualEntry(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={submitManualEntry}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                Add Entry
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Signup Prompt Modal */}
      {showSignupPrompt && !session && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg">
            <div className="text-center mb-6">
              <div className="text-5xl mb-4">🎉</div>
              <h2 className="text-3xl font-bold text-gray-800 mb-3">Great start!</h2>
              <p className="text-lg text-gray-700 mb-4">
                You just logged your first meal! Want to save your progress and track your nutrition over time?
              </p>
              <p className="text-gray-600 mb-2">
                Create a <strong className="text-purple-600">free account</strong> to:
              </p>
              <ul className="text-left text-gray-600 space-y-2 mb-6 max-w-md mx-auto">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span><strong>Save your entries</strong> — Never lose your nutrition data</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span><strong>Track your progress</strong> — See trends and reach your goals</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span><strong>Access anywhere</strong> — Sync across all your devices</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => {
                  setShowSignupPrompt(false);
                  setAuthMode('signup');
                  setShowAuthModal(true);
                }}
                className="w-full px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-lg rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 transition shadow-lg"
              >
                Sign Up Now
              </button>
              <button
                onClick={() => setShowSignupPrompt(false)}
                className="text-sm text-gray-500 hover:text-gray-700 transition underline"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          authMode={authMode}
          setAuthMode={setAuthMode}
          authEmail={authEmail}
          setAuthEmail={setAuthEmail}
          authPassword={authPassword}
          setAuthPassword={setAuthPassword}
          authError={authError}
          setAuthError={setAuthError}
          authMessage={authMessage}
          setAuthMessage={setAuthMessage}
          authLoading={authLoading}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          handleAuthSubmit={handleAuthSubmit}
          handleGoogleSignIn={handleGoogleSignIn}
          onClose={() => setShowAuthModal(false)}
        />
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
            <p className="text-sm text-gray-600">
              {session ? session.user.email : 'Track your food. Easily'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {session ? (
              <>
                <button onClick={openGoalsModal} className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition" title="Set daily goals">
                  <Target size={20} /><span className="hidden sm:inline">Goals</span>
                </button>
                <button onClick={handleLogout} className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition">
                  <LogOut size={20} /><span className="hidden sm:inline">Logout</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
                  className="text-gray-600 hover:text-gray-800 transition font-medium"
                >
                  Log In
                </button>
                <button
                  onClick={() => { setAuthMode('signup'); setShowAuthModal(true); }}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 transition"
                >
                  Sign Up
                </button>
              </>
            )}
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
          <div className="bg-gradient-to-br from-purple-50 to-white rounded-xl shadow-sm p-4 lg:p-8 mb-6">
            {/* Mobile Layout: Macros left, Calories right */}
            <div className="lg:hidden">
              <div className={`flex gap-3 ${session && 'mb-4'}`}>
                {/* Macros - Left Side */}
                <div className={`flex-1 ${goals ? 'space-y-2' : 'space-y-1'}`}>
                  {['protein', 'carbs', 'fat'].map(macro => (
                    <div key={macro}>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs text-gray-600 w-12 capitalize">{macro}</span>
                        <span className="text-lg font-bold text-purple-600">
                          {getDailyTotal(selectedDate, macro)}<span className="text-sm text-gray-500">g</span>
                          {goals?.[macro] && <span className="text-xs text-gray-400 ml-1">/ {goals[macro]}g</span>}
                        </span>
                      </div>
                      {goals?.[macro] && (
                        <div className="h-1 bg-gray-200 rounded-full overflow-hidden ml-14">
                          <div className={`h-full ${getGoalColor(getDailyTotal(selectedDate, macro), goals[macro])} transition-all`} style={{ width: `${getGoalProgress(getDailyTotal(selectedDate, macro), goals[macro])}%` }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Calories - Right Side */}
                <div className="flex-shrink-0">
                  <div className="bg-white rounded-xl shadow-lg px-5 py-3 text-center">
                    <div className="text-3xl font-bold text-purple-600 leading-none">{getDailyTotal(selectedDate, 'calories')}</div>
                    <div className="text-xs text-gray-600 mt-1">Calories</div>
                    {goals?.calories && (
                      <>
                        <div className="text-xs text-gray-400 mt-0.5">/ {goals.calories}</div>
                        <div className="h-1 bg-gray-200 rounded-full overflow-hidden mt-1.5 w-16 mx-auto">
                          <div className={`h-full ${getGoalColor(getDailyTotal(selectedDate, 'calories'), goals.calories)} transition-all`} style={{ width: `${getGoalProgress(getDailyTotal(selectedDate, 'calories'), goals.calories)}%` }} />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Chart - Only show for authenticated users */}
              {session && (
                <div className="w-full">
                  <div className="text-center mb-2"><p className="text-sm text-gray-600">7-Day Trend</p></div>
                  <ResponsiveContainer width="100%" height={100}>
                    <LineChart data={getWeeklyData()}>
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px' }} formatter={(value) => [`${value} cal`, 'Calories']} />
                      <Line type="monotone" dataKey="calories" stroke="#9333ea" strokeWidth={3} dot={{ fill: '#9333ea', r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Desktop Layout: Original side by side layout */}
            <div className="hidden lg:flex items-center justify-between gap-12">
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

          {/* Chat Interface - Unified Box */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-6 overflow-hidden">
            {/* Chat Messages */}
            {messages.length > 0 && (
              <div className="max-h-60 overflow-y-auto p-4 border-b border-gray-200">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`mb-3 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                    <div className={`inline-block max-w-[80%] px-4 py-2 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      <p className="text-sm">{msg.content}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            )}

            {/* Pending Foods Confirmation */}
            {pendingFoods && (
              <div className="p-4 bg-purple-50 border-b border-purple-200">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Select items to add to your log:</h3>
                <div className="space-y-2 mb-4">
                  {pendingFoods.items.map((item, idx) => (
                    <label
                      key={idx}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition ${
                        pendingFoods.selectionState[idx]
                          ? 'bg-white border-2 border-purple-400'
                          : 'bg-white border-2 border-gray-200 opacity-60'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={pendingFoods.selectionState[idx]}
                        onChange={() => toggleFoodSelection(idx)}
                        className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                      />
                      <div className="flex-1">
                        <span className="text-gray-800 font-medium">{item.item}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-purple-600">{item.calories} cal</span>
                        <div className="text-xs text-gray-600">
                          P: {item.protein}g • C: {item.carbs}g • F: {item.fat}g
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setPendingFoods(null)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addConfirmedFoodsToLog}
                    disabled={!Object.values(pendingFoods.selectionState).some(v => v)}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add to Log ({Object.values(pendingFoods.selectionState).filter(v => v).length})
                  </button>
                </div>
              </div>
            )}

            {/* Error Message */}
            {processingError && (
              <div className="p-4 bg-red-50 border-b border-red-200">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <p className="text-sm text-red-800 font-semibold">Error</p>
                    <p className="text-sm text-red-700 mt-1">{processingError.message || processingError}</p>

                    {processingError.details && (
                      <div className="mt-3">
                        <button
                          onClick={() => setShowErrorDetails(!showErrorDetails)}
                          className="text-xs text-red-600 hover:text-red-800 underline font-medium"
                        >
                          {showErrorDetails ? 'Hide Details' : 'Show Technical Details'}
                        </button>

                        {showErrorDetails && (
                          <div className="mt-2 p-3 bg-red-100 rounded border border-red-300">
                            <p className="text-xs font-mono text-red-900 whitespace-pre-wrap break-words">
                              {processingError.details}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setProcessingError(null);
                      setShowErrorDetails(false);
                    }}
                    className="text-red-400 hover:text-red-600 flex-shrink-0"
                    aria-label="Dismiss error"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="p-4">
              <div className="flex gap-3">
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
                  {isProcessing ? 'Processing...' : <><Send size={20} />Send</>}
                </button>
              </div>

              {/* Manual Entry Link */}
              <div className="mt-3 text-center">
                <button
                  onClick={() => setShowManualEntry(true)}
                  className="text-xs text-gray-500 hover:text-purple-600 transition flex items-center gap-1 mx-auto"
                >
                  <Plus size={14} />
                  Add manually
                </button>
              </div>
            </div>
          </div>

          {/* Entries */}
          <div className="space-y-4 mb-6">
            {entries[selectedDate]?.map((entry) => (
              <div key={entry.id} className="bg-white rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-500">{entry.localTime || new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
                  <button onClick={() => deleteEntry(selectedDate, entry.id)} className="text-red-600 hover:text-red-800 p-1"><Trash2 size={16} /></button>
                </div>

                <div className="space-y-2 mb-3">
                  {entry.items.map((item, idx) => {
                    const isThisItemSwiped = swipedItem?.entryId === entry.id && swipedItem?.itemIndex === idx;
                    const swipeOffset = isThisItemSwiped ? swipedItem.offsetX : 0;

                    return (
                    <div
                      key={idx}
                      className="relative overflow-hidden"
                    >
                      {/* Swipe Action Backgrounds */}
                      {isThisItemSwiped && (
                        <>
                          {/* Edit background (right swipe) */}
                          {swipeOffset > 0 && (
                            <div className="absolute inset-y-0 left-0 flex items-center px-4 bg-purple-500">
                              <Edit2 size={20} className="text-white" />
                            </div>
                          )}
                          {/* Delete background (left swipe) */}
                          {swipeOffset < 0 && (
                            <div className="absolute inset-y-0 right-0 flex items-center px-4 bg-red-500">
                              <Trash2 size={20} className="text-white" />
                            </div>
                          )}
                        </>
                      )}

                      <div
                        data-item-drop-target="true"
                        data-entry-id={entry.id}
                        data-item-index={idx}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(entry.id, idx)}
                        onTouchStart={(e) => handleItemTouchStart(e, entry.id, idx)}
                        onTouchMove={(e) => handleItemTouchMove(e, entry.id, idx)}
                        onTouchEnd={(e) => handleItemTouchEnd(e, entry.id, idx)}
                        className={`bg-gray-50 rounded-lg p-3 transition-transform ${draggedItem?.entryId === entry.id && draggedItem?.itemIndex === idx ? 'opacity-50' : ''}`}
                        style={{ transform: `translateX(${swipeOffset}px)` }}
                      >
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
                              <div className="flex items-center gap-2 flex-1">
                                {editingNutrition === null && (
                                  <div
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, entry.id, idx)}
                                    onDragEnd={handleDragEnd}
                                    onTouchStart={(e) => handleTouchStart(e, entry.id, idx)}
                                    onTouchMove={handleTouchMove}
                                    onTouchEnd={handleTouchEnd}
                                    className="cursor-grab active:cursor-grabbing p-1 -ml-1 touch-none"
                                    style={{ touchAction: 'none' }}
                                  >
                                    <GripVertical size={20} className="text-gray-400 flex-shrink-0" />
                                  </div>
                                )}
                                <span className="text-gray-800 font-medium">{item.item}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="relative" data-source-tooltip="true">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const key = `${entry.id}-${idx}`;
                                      setVisibleSourceKey(prev => (prev === key ? null : key));
                                    }}
                                    onMouseEnter={() => setVisibleSourceKey(`${entry.id}-${idx}`)}
                                    onMouseLeave={() => setVisibleSourceKey(prev => (prev === `${entry.id}-${idx}` ? null : prev))}
                                    onFocus={() => setVisibleSourceKey(`${entry.id}-${idx}`)}
                                    onBlur={() => setVisibleSourceKey(prev => (prev === `${entry.id}-${idx}` ? null : prev))}
                                    className="font-semibold text-gray-900 underline decoration-dotted underline-offset-2"
                                    title={`Source: ${item.source || 'unknown'}`}
                                    aria-label={`Calories source: ${item.source || 'unknown'}`}
                                  >
                                    {item.error ? '?' : item.calories} cal
                                  </button>
                                  {visibleSourceKey === `${entry.id}-${idx}` && (() => {
                                    const { displayName, url } = parseSource(item.source);
                                    return (
                                      <div className="absolute right-0 top-full mt-1 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg z-10">
                                        Source: {url ? (
                                          <a
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="underline hover:text-purple-300"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            {displayName}
                                          </a>
                                        ) : displayName}
                                      </div>
                                    );
                                  })()}
                                </div>
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
                    </div>
                    );
                  })}
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
          </div>
        </div>
      </div>

      {/* Drag Preview */}
      {dragPreview && (
        <div
          style={{
            position: 'fixed',
            left: dragPreview.x,
            top: dragPreview.y,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 1000,
            opacity: 0.9,
            maxWidth: '300px'
          }}
        >
          <div className="bg-purple-100 border-2 border-purple-400 rounded-lg p-3 shadow-2xl">
            <div className="flex justify-between items-start mb-2">
              <span className="text-gray-800 font-medium">{dragPreview.item.item}</span>
              <span className="font-semibold text-purple-600 ml-2">{dragPreview.item.calories} cal</span>
            </div>
            <div className="flex gap-3 text-sm text-gray-600">
              <span>P: {dragPreview.item.protein}g</span>
              <span>C: {dragPreview.item.carbs}g</span>
              <span>F: {dragPreview.item.fat}g</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalorieTracker;
