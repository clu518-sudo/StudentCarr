import React from 'react';

const ProfileView = () => {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Profile Management</h1>
        <p className="text-purple-100">
          Manage your personal information, preferences, and career profile
        </p>
      </div>

      <div className="card text-center py-12">
        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Profile Management Module
        </h2>
        
        <p className="text-gray-600 mb-6">
          This is a placeholder for the Profile Management feature.
        </p>

        <button className="btn-primary">
          Coming Soon
        </button>
      </div>
    </div>
  );
};

export default ProfileView;
