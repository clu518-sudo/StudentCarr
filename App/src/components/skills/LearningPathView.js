import React from 'react';
import { Link } from 'react-router-dom';

const LearningPathView = () => {
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
            <span className="text-gray-900 font-medium">Learning Path</span>
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Learning Path Generation</h1>
        <p className="text-green-100">
          Get personalized learning recommendations based on your career goals and skill gaps
        </p>
      </div>

      {/* Placeholder Content */}
      <div className="card text-center py-12">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Learning Path Generation Module
        </h2>
        
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          This is a placeholder for the Learning Path Generation feature. Here you would be able to:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto mb-8">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Personalized Paths</h3>
            <p className="text-sm text-gray-600">Custom learning routes for your goals</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Resource Library</h3>
            <p className="text-sm text-gray-600">Curated courses and materials</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Progress Tracking</h3>
            <p className="text-sm text-gray-600">Monitor your learning journey</p>
          </div>
        </div>

        <div className="flex justify-center space-x-4">
          <Link to="/skills" className="btn-secondary">
            Back to Skills
          </Link>
          <button className="btn-primary">
            Generate Path (Coming Soon)
          </button>
        </div>
      </div>
    </div>
  );
};

export default LearningPathView;
