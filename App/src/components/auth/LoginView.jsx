import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const LoginView = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loginAsVisitor } = useAuth();

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const continueAsVisitor = () => {
    loginAsVisitor();
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="sc-auth sc-dark">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="card">
          <div className="text-center mb-8">
            <div className="sc-logo mx-auto mb-4">SC</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Explore StudentCarr</h1>
            <p className="text-gray-600">
              Open a guided frontend demo with sample profile and application data.
            </p>
          </div>

          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900 mb-6">
            <strong className="block mb-1">Frontend-only visitor preview</strong>
            No account is required. Backend features such as Gmail sync, file uploads,
            AI generation, and real sending are disabled.
          </div>

          <button type="button" onClick={continueAsVisitor} className="w-full btn-primary">
            Continue as Visitor
          </button>

          <p className="mt-5 text-center text-xs text-gray-500">
            Demo changes stay only for this browser session and are not uploaded.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginView;
