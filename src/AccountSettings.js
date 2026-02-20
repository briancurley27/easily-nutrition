import React, { useState, useEffect, useRef } from 'react';
import { X, User, Mail, Lock, Download, Upload, Target, Check, AlertCircle, LogOut } from 'lucide-react';
import { supabase } from './supabase';

const AccountSettings = ({
  isOpen,
  onClose,
  session,
  goals,
  setGoals,
  entries,
  username,
  setUsername,
  macroToggles,
  setMacroToggles,
  onWeightDataImported
}) => {
  // Form states
  const [usernameInput, setUsernameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [goalInputs, setGoalInputs] = useState({
    calories: '',
    protein: '',
    carbs: '',
    fat: ''
  });

  // UI states
  const [activeTab, setActiveTab] = useState('goals');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [usernameError, setUsernameError] = useState('');

  // Track previous isOpen value to detect modal open/close
  const prevIsOpenRef = useRef(isOpen);

  // Initialize form values when modal opens
  useEffect(() => {
    const wasJustOpened = isOpen && !prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (isOpen) {
      if (session) {
        setUsernameInput(username || '');
        setEmailInput(session.user.email || '');
        setGoalInputs({
          calories: goals?.calories?.toString() || '',
          protein: goals?.protein?.toString() || '',
          carbs: goals?.carbs?.toString() || '',
          fat: goals?.fat?.toString() || ''
        });
      }
      // Only clear message when modal first opens, not when username/goals update
      if (wasJustOpened) {
        setMessage({ type: '', text: '' });
        setUsernameError('');
        // Default to goals tab, especially for anonymous users
        if (!session) setActiveTab('goals');
      }
    }
  }, [isOpen, session, username, goals]);

  // Username validation
  const validateUsername = (value) => {
    if (!value) {
      return 'Username is required';
    }
    if (value.length < 3) {
      return 'Username must be at least 3 characters';
    }
    if (value.length > 20) {
      return 'Username must be 20 characters or less';
    }
    if (!/^[a-zA-Z0-9_.]+$/.test(value)) {
      return 'Username can only contain letters, numbers, periods, and underscores';
    }
    return '';
  };

  // Handle username update
  const handleUsernameUpdate = async (e) => {
    e.preventDefault();
    const trimmedUsername = usernameInput.trim();

    // Validate without the delay (already validated on blur)
    const validationError = validateUsername(trimmedUsername);
    if (validationError) {
      setUsernameError(validationError);
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: session.user.id,
          username: trimmedUsername.toLowerCase()
        });

      if (error) throw error;

      setUsername(trimmedUsername.toLowerCase());
      setMessage({ type: 'success', text: 'Username updated successfully!' });
    } catch (error) {
      console.error('Error updating username:', error);
      // Check if it's a uniqueness constraint error
      if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
        setMessage({ type: 'error', text: 'Username is already taken' });
      } else {
        setMessage({ type: 'error', text: error.message || 'Failed to update username' });
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle email update
  const handleEmailUpdate = async (e) => {
    e.preventDefault();
    const trimmedEmail = emailInput.trim();

    if (trimmedEmail === session.user.email) {
      setMessage({ type: 'info', text: 'This is already your email address' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const { error } = await supabase.auth.updateUser({ email: trimmedEmail });

      if (error) throw error;

      setMessage({
        type: 'success',
        text: 'Verification email sent! Please check your inbox to confirm the change.'
      });
    } catch (error) {
      console.error('Error updating email:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to update email' });
    } finally {
      setLoading(false);
    }
  };

  // Handle password reset
  const handlePasswordReset = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(session.user.email, {
        redirectTo: window.location.origin
      });

      if (error) throw error;

      setMessage({
        type: 'success',
        text: 'Password reset email sent! Check your inbox.'
      });
    } catch (error) {
      console.error('Error sending password reset:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to send password reset email' });
    } finally {
      setLoading(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      onClose(); // Close settings modal after logout
    } catch (error) {
      console.error('Error logging out:', error);
      setMessage({ type: 'error', text: 'Failed to log out' });
    } finally {
      setLoading(false);
    }
  };

  // Handle goals update
  const handleGoalsUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const newGoals = {
        calories: goalInputs.calories ? parseInt(goalInputs.calories) : null,
        protein: goalInputs.protein ? parseFloat(goalInputs.protein) : null,
        carbs: goalInputs.carbs ? parseFloat(goalInputs.carbs) : null,
        fat: goalInputs.fat ? parseFloat(goalInputs.fat) : null
      };

      const { error } = await supabase
        .from('goals')
        .upsert({
          user_id: session.user.id,
          ...newGoals
        }, { onConflict: 'user_id' });

      if (error) throw error;

      setGoals(newGoals);
      setMessage({ type: 'success', text: 'Goals updated successfully!' });
    } catch (error) {
      console.error('Error updating goals:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to update goals' });
    } finally {
      setLoading(false);
    }
  };

  // Handle CSV export
  const handleExportCSV = () => {
    try {
      // Prepare CSV data
      const rows = [
        ['Date', 'Time', 'Food Item', 'Quantity', 'Calories', 'Protein (g)', 'Carbs (g)', 'Fat (g)', 'Source']
      ];

      // Sort dates and add all entries
      const sortedDates = Object.keys(entries).sort();
      sortedDates.forEach(date => {
        entries[date].forEach(entry => {
          entry.items.forEach(item => {
            rows.push([
              date,
              entry.localTime || '',
              item.food || '',
              item.quantity || '',
              item.calories || 0,
              item.protein || 0,
              item.carbs || 0,
              item.fat || 0,
              item.source || ''
            ]);
          });
        });
      });

      // Convert to CSV string
      const csvContent = rows.map(row =>
        row.map(cell => {
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          const cellStr = String(cell);
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return '"' + cellStr.replace(/"/g, '""') + '"';
          }
          return cellStr;
        }).join(',')
      ).join('\n');

      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `easily-nutrition-export-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setMessage({ type: 'success', text: 'Data exported successfully!' });
    } catch (error) {
      console.error('Error exporting CSV:', error);
      setMessage({ type: 'error', text: 'Failed to export data' });
    }
  };

  // Handle weight CSV export
  const handleExportWeightCSV = async () => {
    try {
      const { data, error } = await supabase
        .from('weight_entries')
        .select('*')
        .eq('user_id', session.user.id)
        .order('date', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        setMessage({ type: 'error', text: 'No weight data to export' });
        return;
      }

      const unit = localStorage.getItem('easily-weight-unit') || 'lbs';
      const LBS_PER_KG = 2.20462;

      const rows = [['Date', `Weight (${unit})`]];
      data.forEach(entry => {
        const weight = unit === 'kg'
          ? (parseFloat(entry.weight_lbs) / LBS_PER_KG).toFixed(1)
          : parseFloat(entry.weight_lbs).toFixed(1);
        rows.push([entry.date, weight]);
      });

      const csvContent = rows.map(row => row.join(',')).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `easily-weight-export-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setMessage({ type: 'success', text: `Exported ${data.length} weight entries!` });
    } catch (error) {
      console.error('Error exporting weight CSV:', error);
      setMessage({ type: 'error', text: 'Failed to export weight data' });
    }
  };

  // Handle weight CSV import
  const handleImportWeightCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());

      if (lines.length < 2) {
        setMessage({ type: 'error', text: 'CSV must have a header row and at least one data row' });
        return;
      }

      const header = lines[0].toLowerCase().split(',').map(h => h.trim());
      const dateCol = header.findIndex(h => h.includes('date'));
      const weightCol = header.findIndex(h => h.includes('weight'));

      if (dateCol === -1 || weightCol === -1) {
        setMessage({ type: 'error', text: 'CSV must have "date" and "weight" columns' });
        return;
      }

      const unitCol = header.findIndex(h => h.includes('unit'));
      const displayUnit = localStorage.getItem('easily-weight-unit') || 'lbs';
      const LBS_PER_KG = 2.20462;

      const parsed = [];
      const errors = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        const weightVal = parseFloat(cols[weightCol]);

        // Parse date - support YYYY-MM-DD, MM/DD/YYYY, MM-DD-YYYY
        let dateStr = cols[dateCol]?.trim();
        if (dateStr) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            // already YYYY-MM-DD
          } else {
            const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            const dashMatch = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
            const match = slashMatch || dashMatch;
            if (match) {
              const [, m, d, y] = match;
              dateStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            } else {
              const fallback = new Date(dateStr);
              if (!isNaN(fallback.getTime())) {
                const y = fallback.getFullYear();
                const m = String(fallback.getMonth() + 1).padStart(2, '0');
                const d = String(fallback.getDate()).padStart(2, '0');
                dateStr = `${y}-${m}-${d}`;
              } else {
                dateStr = null;
              }
            }
          }
        } else {
          dateStr = null;
        }

        if (!dateStr) { errors.push(`Row ${i + 1}: Invalid date`); continue; }
        if (isNaN(weightVal) || weightVal <= 0) { errors.push(`Row ${i + 1}: Invalid weight`); continue; }

        let rowUnit = displayUnit;
        if (unitCol !== -1 && cols[unitCol]) {
          const u = cols[unitCol].toLowerCase().trim();
          if (['kg', 'kgs', 'kilogram', 'kilograms'].includes(u)) rowUnit = 'kg';
          else if (['lb', 'lbs', 'pound', 'pounds'].includes(u)) rowUnit = 'lbs';
        }

        const weightLbs = rowUnit === 'kg' ? weightVal * LBS_PER_KG : weightVal;
        parsed.push({ date: dateStr, weight_lbs: weightLbs });
      }

      if (parsed.length === 0) {
        setMessage({ type: 'error', text: `No valid entries found.${errors.length ? ' ' + errors.slice(0, 3).join('; ') : ''}` });
        return;
      }

      const rows = parsed.map(e => ({
        user_id: session.user.id,
        date: e.date,
        weight_lbs: e.weight_lbs
      }));

      const { error } = await supabase
        .from('weight_entries')
        .upsert(rows, { onConflict: 'user_id,date' });

      if (error) throw error;

      const errorSummary = errors.length > 0 ? ` (${errors.length} rows skipped)` : '';
      setMessage({ type: 'success', text: `Imported ${parsed.length} weight entries${errorSummary}` });
      if (onWeightDataImported) onWeightDataImported();
    } catch (error) {
      console.error('Error importing weight CSV:', error);
      setMessage({ type: 'error', text: 'Failed to import weight data' });
    }
  };

  if (!isOpen) return null;

  const allTabs = [
    { id: 'goals', label: 'Goals', icon: Target, requiresAuth: false },
    { id: 'profile', label: 'Profile', icon: User, requiresAuth: true },
    { id: 'account', label: 'Account', icon: Mail, requiresAuth: true },
    { id: 'data', label: 'Data', icon: Download, requiresAuth: true }
  ];
  const tabs = allTabs.filter(tab => !tab.requiresAuth || session);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-end z-50">
      <div className="bg-white h-full w-full max-w-2xl shadow-xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">{session ? 'Account Settings' : 'Settings'}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 overflow-x-auto scrollbar-hide">
          <div className="flex gap-6 px-6 min-w-max">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setMessage({ type: '', text: '' });
                  }}
                  className={`flex items-center gap-2 py-4 border-b-2 transition flex-shrink-0 whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <Icon size={18} />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Message Display */}
          {message.text && (
            <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
              message.type === 'success' ? 'bg-green-100 text-green-800' :
              message.type === 'error' ? 'bg-red-100 text-red-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {message.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
              <span>{message.text}</span>
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Username</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Your username will be displayed throughout the app instead of your email.
                  {!username && ' Set one to personalize your account!'}
                </p>
                <form onSubmit={handleUsernameUpdate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      value={usernameInput}
                      onChange={(e) => {
                        setUsernameInput(e.target.value);
                        setUsernameError('');
                      }}
                      placeholder="Enter username"
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none ${
                        usernameError ? 'border-red-500' : 'border-gray-300'
                      }`}
                      maxLength={20}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      3-20 characters, letters, numbers, periods, and underscores only
                    </p>
                    {usernameError && (
                      <p className="text-sm text-red-600 mt-1">{usernameError}</p>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !!usernameError || !usernameInput.trim()}
                    className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Updating...' : username ? 'Update Username' : 'Set Username'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Account Tab */}
          {activeTab === 'account' && (
            <div className="space-y-8">
              {/* Email Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Email Address</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Update your email address. You'll need to verify the new email before the change takes effect.
                </p>
                <form onSubmit={handleEmailUpdate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !emailInput.trim()}
                    className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Updating...' : 'Update Email'}
                  </button>
                </form>
              </div>

              {/* Password Section */}
              <div className="border-t border-gray-200 pt-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Password</h3>
                <p className="text-sm text-gray-600 mb-4">
                  We'll send you an email with a link to reset your password.
                </p>
                <button
                  onClick={handlePasswordReset}
                  disabled={loading}
                  className="px-6 py-3 bg-gray-100 text-gray-800 rounded-lg font-medium hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Lock size={18} />
                  {loading ? 'Sending...' : 'Send Password Reset Email'}
                </button>
              </div>

              {/* Logout Section */}
              <div className="border-t border-gray-200 pt-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Logout</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Sign out of your account on this device.
                </p>
                <button
                  onClick={handleLogout}
                  disabled={loading}
                  className="px-6 py-3 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <LogOut size={18} />
                  {loading ? 'Logging out...' : 'Logout'}
                </button>
              </div>
            </div>
          )}

          {/* Goals Tab (combined tracking + goals) */}
          {activeTab === 'goals' && (
            <div>
              {/* Macronutrient Toggles Section */}
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Macronutrient Tracking</h3>
              <p className="text-sm text-gray-600 mb-4">
                Choose which macronutrients to track alongside calories. Disabling macros reduces AI response time.
              </p>

              {/* Calories is always on */}
              <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg mb-3">
                <div>
                  <p className="font-medium text-gray-800">Calories</p>
                  <p className="text-sm text-gray-500">Always tracked</p>
                </div>
                <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-purple-600 cursor-not-allowed opacity-60">
                  <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6" />
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {[
                  { key: 'protein', label: 'Protein' },
                  { key: 'carbs', label: 'Carbs' },
                  { key: 'fat', label: 'Fat' }
                ].map(macro => (
                  <div key={macro.key}>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{macro.label}</p>
                      </div>
                      {/* Goal input inline when toggled on & authenticated */}
                      {macroToggles[macro.key] && session && (
                        <div className="flex items-center gap-2 mr-4">
                          <label className="text-xs text-gray-500 whitespace-nowrap">Goal (g)</label>
                          <input
                            type="number"
                            value={goalInputs[macro.key]}
                            onChange={(e) => setGoalInputs({ ...goalInputs, [macro.key]: e.target.value })}
                            placeholder="—"
                            className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                            min="0"
                            step="0.1"
                          />
                        </div>
                      )}
                      <button
                        onClick={() => setMacroToggles(prev => ({ ...prev, [macro.key]: !prev[macro.key] }))}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                          macroToggles[macro.key] ? 'bg-purple-600' : 'bg-gray-300'
                        }`}
                        role="switch"
                        aria-checked={macroToggles[macro.key]}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            macroToggles[macro.key] ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Calorie Goal Section (authenticated users) */}
              {session && (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Daily Calorie Goal</h3>
                  <form onSubmit={handleGoalsUpdate} className="space-y-4">
                    <div>
                      <input
                        type="number"
                        value={goalInputs.calories}
                        onChange={(e) => setGoalInputs({ ...goalInputs, calories: e.target.value })}
                        placeholder="e.g., 2000 calories"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                        min="0"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Saving...' : 'Save Goals'}
                    </button>
                  </form>
                </div>
              )}

              {/* Info note */}
              <div className="mt-6 p-4 bg-purple-50 rounded-lg">
                <p className="text-sm text-purple-800">
                  <strong>Currently tracking:</strong>{' '}
                  {(() => {
                    const enabled = ['protein', 'carbs', 'fat'].filter(m => macroToggles[m]);
                    if (enabled.length === 0) return 'Calories only';
                    return 'Calories + ' + enabled.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(', ');
                  })()}
                </p>
                <p className="text-xs text-purple-600 mt-1">
                  Existing entries retain all their stored data regardless of these settings.
                </p>
              </div>
            </div>
          )}

          {/* Data Tab */}
          {activeTab === 'data' && (
            <div className="space-y-8">
              {/* Food Export */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Export Food Data</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Download all your nutrition data as a CSV file.
                </p>
                <button
                  onClick={handleExportCSV}
                  disabled={Object.keys(entries).length === 0}
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Download size={18} />
                  {Object.keys(entries).length === 0 ? 'No Food Data to Export' : 'Export Food Data'}
                </button>
                {Object.keys(entries).length > 0 && (
                  <p className="text-sm text-gray-500 mt-3">
                    Your export will include {Object.values(entries).flat().reduce((acc, entry) => acc + entry.items.length, 0)} food items
                    across {Object.keys(entries).length} days.
                  </p>
                )}
              </div>

              {/* Weight Export */}
              <div className="border-t border-gray-200 pt-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Export Weight Data</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Download your weight history as a CSV file.
                </p>
                <button
                  onClick={handleExportWeightCSV}
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Download size={18} />
                  Export Weight Data
                </button>
              </div>

              {/* Weight Import */}
              <div className="border-t border-gray-200 pt-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Import Weight Data</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Upload a CSV file with your weight history. The file should have "date" and "weight" columns.
                  Optionally include a "unit" column (lbs/kg). Supported date formats: YYYY-MM-DD, MM/DD/YYYY, MM-DD-YYYY.
                </p>
                <label className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-800 rounded-lg font-medium hover:bg-gray-200 transition cursor-pointer">
                  <Upload size={18} />
                  Upload Weight CSV
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleImportWeightCSV}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;
