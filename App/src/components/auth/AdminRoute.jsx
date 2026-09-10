import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// Gates a route (already inside ProtectedRoute) to admin accounts only.
// A non-admin who reaches this route by typing the URL is bounced back to
// the dashboard rather than shown a 403 page.
const AdminRoute = ({ children }) => {
  const { isAdmin, initializing } = useAuth();

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Loading session...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default AdminRoute;
