import React from 'react';

const JobsView = () => {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Job Discovery</h1>
        <p className="text-green-100">
          Discover job opportunities that match your skills and career goals
        </p>
      </div>

      <div className="card text-center py-12">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2h8z" />
          </svg>
        </div>
        
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Job Discovery Module
        </h2>
        
        <p className="text-gray-600 mb-6">
          This is a placeholder for the Job Discovery feature.
        </p>

        <button className="btn-primary">
          Coming Soon
        </button>
      </div>
    </div>
  );
};

export default JobsView;
