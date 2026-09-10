import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLogin } from '../../hooks/useLogin';
import { demoAccountApi } from '../../lib/apiClient';

// Login View - Pure UI component with no business logic
//
// Google login and self-service signup are removed from this demo deploy —
// accounts are provisioned server-side only, via Backend/scripts/create-user.js
// (normal users) and grant-admin.js (admins) — except for the self-service
// "Create demo account" button below, which calls a dedicated, rate-limited
// public endpoint (Backend/src/demoAccounts/) rather than /auth/signup.
const LoginView = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();
  const { formData, errors, loading, handleInputChange, handleLogin } = useLogin();
  const loginMessage = new URLSearchParams(location.search).get("message");

  const [demoState, setDemoState] = useState({
    loading: false,
    error: '',
    credentials: null,
    continuing: false,
  });

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleCreateDemoAccount = async () => {
    setDemoState({ loading: true, error: '', credentials: null, continuing: false });
    try {
      const response = await demoAccountApi.create();
      setDemoState({ loading: false, error: '', credentials: response.data, continuing: false });
    } catch (error) {
      setDemoState({
        loading: false,
        error: error.message || 'Could not create a demo account. Please try again.',
        credentials: null,
        continuing: false,
      });
    }
  };

  const handleContinueWithDemo = async () => {
    if (!demoState.credentials) return;
    setDemoState((prev) => ({ ...prev, continuing: true, error: '' }));
    const { email, password } = demoState.credentials;
    const result = await login(email, password);
    if (result.success) {
      navigate('/dashboard');
      return;
    }
    setDemoState((prev) => ({
      ...prev,
      continuing: false,
      error: result.error || 'Demo account login failed. Please try again.',
    }));
  };

  return (
    <div className="sc-auth sc-dark">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="card">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome Back
            </h2>
            <p className="text-gray-600">
              Sign in to your Student Career account
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {errors.general && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {errors.general}
              </div>
            )}
            {loginMessage && !errors.general && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {loginMessage}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  errors.email ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter your email"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  errors.password ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter your password"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full btn-primary ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="relative mt-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-gray-500">or</span>
            </div>
          </div>

          <div className="mt-6">
            {!demoState.credentials ? (
              <>
                <button
                  type="button"
                  onClick={handleCreateDemoAccount}
                  disabled={demoState.loading}
                  className={`w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {demoState.loading ? 'Creating demo account...' : 'Create demo account'}
                </button>
                <p className="mt-2 text-xs text-gray-500 text-center">
                  Try StudentCarr instantly with a pre-filled sample account. Expires after 10 minutes.
                </p>
                {demoState.error && (
                  <p className="mt-2 text-sm text-red-600 text-center">{demoState.error}</p>
                )}
              </>
            ) : (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
                {/* Explicit blue-* text (not gray-*) — this panel keeps its
                    light tinted fill even inside the dark auth theme
                    (.sc-dark only remaps text-gray-*, see index.css), so
                    gray text here would end up light-on-light. */}
                <p className="text-sm font-medium text-blue-900">Demo account created</p>
                <dl className="text-sm text-blue-900 space-y-1">
                  <div className="flex justify-between gap-2">
                    <dt className="text-blue-600">Email</dt>
                    <dd className="font-mono break-all">{demoState.credentials.email}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-blue-600">Password</dt>
                    <dd className="font-mono break-all">{demoState.credentials.password}</dd>
                  </div>
                </dl>
                <p className="text-xs text-blue-700">
                  This account and its data expire at{' '}
                  {new Date(demoState.credentials.expiresAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  — about 10 minutes from now.
                </p>
                {demoState.error && (
                  <p className="text-sm text-red-600">{demoState.error}</p>
                )}
                <button
                  type="button"
                  onClick={handleContinueWithDemo}
                  disabled={demoState.continuing}
                  className={`w-full btn-primary ${demoState.continuing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {demoState.continuing ? 'Signing in...' : 'Continue to Dashboard'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginView;
