import React from 'react';
import { Link } from 'react-router-dom';

const SkillGapAnalysisView = () => {
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-4">
          <li>
            <Link to="/skills" className="text-gray-500 hover:text-gray-700">
              Skill Management
            </Link>
          </li>
          <li>
            <svg className="flex-shrink-0 h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </li>
          <li>
            <span className="text-gray-900 font-medium">Gap Analysis</span>
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Skill Gap Analysis</h1>
        <p className="text-blue-100">
          Identify the gaps between your current skills and your target job requirements
        </p>
      </div>

      {/* Placeholder Content */}
      <div className="card text-center py-12">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2-2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Skill Gap Analysis Module
        </h2>
        
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          This is a placeholder for the Skill Gap Analysis feature. Here you would be able to:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto mb-8">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Assess Current Skills</h3>
            <p className="text-sm text-gray-600">Evaluate your existing skill levels</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Compare with Jobs</h3>
            <p className="text-sm text-gray-600">Match against job requirements</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Identify Gaps</h3>
            <p className="text-sm text-gray-600">Find areas for improvement</p>
          </div>
        </div>

        <div className="flex justify-center space-x-4">
          <Link to="/skills" className="btn-secondary">
            Back to Skills
          </Link>
          <button className="btn-primary">
            Start Analysis (Coming Soon)
          </button>
        </div>
      </div>
    </div>
  );
};

export default SkillGapAnalysisView;
