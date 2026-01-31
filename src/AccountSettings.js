import React, { useState, useEffect, useRef } from 'react';
import { X, User, Mail, Lock, Download, Target, Check, AlertCircle, LogOut } from 'lucide-react';
import { supabase } from './supabase';

const AccountSettings = ({
  isOpen,
  onClose,
  session,
  goals,
  setGoals,
  entries,
  username,
  setUsername
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
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [usernameError, setUsernameError] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);

  // Track previous isOpen value to detect modal open/close
  const prevIsOpenRef = useRef(isOpen);

  // Initialize form values when modal opens
  useEffect(() => {
    const wasJustOpened = isOpen && !prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (isOpen && session) {
      setUsernameInput(username || '');
      setEmailInput(session.user.email || '');
      setGoalInputs({
        calories: goals?.calories?.toString() || '',
        protein: goals?.protein?.toString() || '',
        carbs: goals?.carbs?.toString() || '',
        fat: goals?.fat?.toString() || ''
      });
      // Only clear message when modal first opens, not when username/goals update
      if (wasJustOpened) {
        setMessage({ type: '', text: '' });
        setUsernameError('');
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

  // Check username availability
  const checkUsernameAvailability = async (value) => {
    if (!value || value === username) {
      setUsernameError('');
      return true;
    }

    const validationError = validateUsername(value);
    if (validationError) {
      setUsernameError(validationError);
      return false;
    }

    setIsCheckingUsername(true);
    const startTime = Date.now();

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', value.toLowerCase())
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error checking username:', error);
        setUsernameError('Error checking username availability');
        return false;
      }

      if (data) {
        setUsernameError('Username is already taken');
        return false;
      }

      setUsernameError('');
      return true;
    } finally {
      // Ensure minimum 500ms delay so the "Checking..." message doesn't flash
      const elapsed = Date.now() - startTime;
      const remainingDelay = Math.max(0, 500 - elapsed);
      await new Promise(resolve => setTimeout(resolve, remainingDelay));
      setIsCheckingUsername(false);
    }
  };

  // Handle username update
  const handleUsernameUpdate = async (e) => {
    e.preventDefault();
    const trimmedUsername = usernameInput.trim();

    const isAvailable = await checkUsernameAvailability(trimmedUsername);
    if (!isAvailable) return;

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
      setMessage({ type: 'error', text: error.message || 'Failed to update username' });
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
        });

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

  if (!isOpen) return null;

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'account', label: 'Account', icon: Mail },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'data', label: 'Data', icon: Download }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-end z-50">
      <div className="bg-white h-full w-full max-w-2xl shadow-xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">Account Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6">
          <div className="flex gap-8">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setMessage({ type: '', text: '' });
                  }}
                  className={`flex items-center gap-2 py-4 border-b-2 transition ${
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
                      onBlur={() => checkUsernameAvailability(usernameInput.trim())}
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
                    {isCheckingUsername && (
                      <p className="text-sm text-gray-500 mt-1">Checking availability...</p>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={loading || isCheckingUsername || !!usernameError || !usernameInput.trim()}
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

          {/* Goals Tab */}
          {activeTab === 'goals' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Daily Goals</h3>
              <p className="text-sm text-gray-600 mb-6">
                Set your daily nutrition targets. Leave blank for any goal you don't want to track.
              </p>
              <form onSubmit={handleGoalsUpdate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Calories
                    </label>
                    <input
                      type="number"
                      value={goalInputs.calories}
                      onChange={(e) => setGoalInputs({ ...goalInputs, calories: e.target.value })}
                      placeholder="e.g., 2000"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Protein (g)
                    </label>
                    <input
                      type="number"
                      value={goalInputs.protein}
                      onChange={(e) => setGoalInputs({ ...goalInputs, protein: e.target.value })}
                      placeholder="e.g., 150"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      min="0"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Carbs (g)
                    </label>
                    <input
                      type="number"
                      value={goalInputs.carbs}
                      onChange={(e) => setGoalInputs({ ...goalInputs, carbs: e.target.value })}
                      placeholder="e.g., 200"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      min="0"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fat (g)
                    </label>
                    <input
                      type="number"
                      value={goalInputs.fat}
                      onChange={(e) => setGoalInputs({ ...goalInputs, fat: e.target.value })}
                      placeholder="e.g., 65"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      min="0"
                      step="0.1"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Updating...' : 'Update Goals'}
                </button>
              </form>
            </div>
          )}

          {/* Data Tab */}
          {activeTab === 'data' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Export Data</h3>
              <p className="text-sm text-gray-600 mb-6">
                Download all your nutrition data as a CSV file. The export includes all food entries with detailed nutrition information.
              </p>
              <button
                onClick={handleExportCSV}
                disabled={Object.keys(entries).length === 0}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Download size={18} />
                {Object.keys(entries).length === 0 ? 'No Data to Export' : 'Export as CSV'}
              </button>
              {Object.keys(entries).length > 0 && (
                <p className="text-sm text-gray-500 mt-3">
                  Your export will include {Object.values(entries).flat().reduce((acc, entry) => acc + entry.items.length, 0)} food items
                  across {Object.keys(entries).length} days.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;
