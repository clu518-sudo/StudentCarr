import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const ApplicationManagementView = () => {
  const location = useLocation();

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Application Management</h1>
        <p className="text-orange-100">
          Manage your job applications, resumes, and application automation
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <Link
            to="/applications"
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              location.pathname === '/applications'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Overview
          </Link>
          <Link
            to="/applications/resume-builder"
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              location.pathname === '/applications/resume-builder'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Resume Builder
          </Link>
          <Link
            to="/applications/automation"
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              location.pathname === '/applications/automation'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Automation
          </Link>
        </nav>
      </div>

      <div className="card text-center py-12">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Application Management Module
        </h2>
        
        <p className="text-gray-600 mb-6">
          This is a placeholder for the Application Management feature.
        </p>

        <div className="flex justify-center space-x-4">
          <Link to="/applications/resume-builder" className="btn-secondary">
            Resume Builder
          </Link>
          <Link to="/applications/automation" className="btn-primary">
            Automation Tools
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ApplicationManagementView;
