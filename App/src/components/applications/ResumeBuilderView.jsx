import React from 'react';
import { Link } from 'react-router-dom';

const ResumeBuilderView = () => {
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
            <span className="text-gray-900 font-medium">Resume Builder</span>
          </li>
        </ol>
      </nav>

      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Resume/CV Builder</h1>
        <p className="text-blue-100">
          Create professional resumes tailored to specific job applications
        </p>
      </div>

      <div className="card text-center py-12">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Resume Builder Module
        </h2>
        
        <p className="text-gray-600 mb-6">
          This is a placeholder for the Resume Builder feature.
        </p>

        <div className="flex justify-center space-x-4">
          <Link to="/applications" className="btn-secondary">
            Back to Applications
          </Link>
          <button className="btn-primary" disabled title="This feature is disabled in visitor mode until the backend is deployed.">
            Create Resume (Coming Soon)
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResumeBuilderView;
