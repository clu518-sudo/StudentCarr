import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AuthShell from '../auth/AuthShell';

// Admin login gate. Reachable only by typing /admin directly — nothing in
// the app links here, the same way McpSetupView is deliberately unrouted.
// This page is a login gate only, not a separate console: once authenticated
// as an admin, the account uses the normal dashboard, where Settings and the
// upload controls become visible via AdminRoute / role checks.
const AdminLoginView = () => {
  const { isAuthenticated, isAdmin, initializing, login, logout } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Already signed in as an admin — go straight to the dashboard.
  if (!initializing && isAuthenticated && isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formData.email || !formData.password) {
      setError('Email and password are required.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await login(formData.email, formData.password);
      if (!result.success) {
        setError(
          result.status === 401
            ? 'Incorrect email or password.'
            : result.error || 'Login failed',
        );
        return;
      }

      // Credentials alone don't imply admin access — a normal account that
      // finds this page is signed back out immediately.
      if (result.user?.role !== 'admin') {
        await logout();
        setError('This account is not an administrator.');
        return;
      }

      navigate('/dashboard', { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell eyebrow="Administrator access">
        <div className="card sc-auth-card">
          <div className="text-center mb-8">
            <p className="sc-auth-kicker">Restricted area</p>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Administrator Sign In
            </h2>
            <p className="text-gray-600">
              This area is restricted to StudentCarr administrators.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="admin-email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="admin-email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="admin@example.com"
                autoComplete="username"
              />
            </div>

            <div>
              <label htmlFor="admin-password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={`w-full btn-primary ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
    </AuthShell>
  );
};

export default AdminLoginView;
