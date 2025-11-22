import React from 'react';
import { Link } from 'react-router-dom';

const ApplicationAutomationView = () => {
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-4">
          <li>
            <Link to="/applications" className="text-gray-500 hover:text-gray-700">
              Application Management
            </Link>
          </li>
          <li>
            <svg className="flex-shrink-0 h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </li>
          <li>
            <span className="text-gray-900 font-medium">Application Automation</span>
          </li>
        </ol>
      </nav>

      <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Application Automation</h1>
        <p className="text-purple-100">
          Automate your job application process and track application status
        </p>
      </div>

      <div className="card text-center py-12">
        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Application Automation Module
        </h2>
        
        <p className="text-gray-600 mb-6">
          This is a placeholder for the Application Automation feature.
        </p>

        <div className="flex justify-center space-x-4">
          <Link to="/applications" className="btn-secondary">
            Back to Applications
          </Link>
          <button className="btn-primary">
            Setup Automation (Coming Soon)
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApplicationAutomationView;
