import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const SkillManagementView = () => {
  const location = useLocation();

  const skillModules = [
    {
      title: 'Skill Gap Analysis',
      description: 'Identify gaps between your current skills and job requirements',
      path: '/skills/gap-analysis',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      color: 'from-blue-500 to-blue-600',
      features: ['Skill assessment', 'Gap identification', 'Priority ranking']
    },
    {
      title: 'Learning Path Generation',
      description: 'Get personalized learning recommendations based on your career goals',
      path: '/skills/learning-path',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      color: 'from-green-500 to-green-600',
      features: ['Personalized paths', 'Resource recommendations', 'Progress tracking']
    }
  ];

  const currentSkills = [
    { name: 'JavaScript', level: 85, category: 'Programming' },
    { name: 'React', level: 78, category: 'Frontend' },
    { name: 'Node.js', level: 65, category: 'Backend' },
    { name: 'SQL', level: 70, category: 'Database' },
    { name: 'Git', level: 80, category: 'Tools' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Skill Management</h1>
          <p className="text-gray-600 mt-1">
            Analyze your skills, identify gaps, and create learning paths for career growth
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <Link
            to="/skills"
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              location.pathname === '/skills'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Overview
          </Link>
          <Link
            to="/skills/gap-analysis"
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              location.pathname === '/skills/gap-analysis'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Gap Analysis
          </Link>
          <Link
            to="/skills/learning-path"
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              location.pathname === '/skills/learning-path'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Learning Path
          </Link>
        </nav>
      </div>

      {/* Skill Modules Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {skillModules.map((module, index) => (
          <Link
            key={index}
            to={module.path}
            className="group block"
          >
            <div className="card hover:shadow-lg transition-all duration-200 group-hover:scale-105">
              <div className={`bg-gradient-to-r ${module.color} p-4 rounded-lg mb-4`}>
                <div className="text-white">
                  {module.icon}
                </div>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors duration-200">
                {module.title}
              </h3>
              
              <p className="text-gray-600 mb-4">
                {module.description}
              </p>
              
              <ul className="space-y-2">
                {module.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-center text-sm text-gray-500">
                    <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </Link>
        ))}
      </div>

      {/* Current Skills Overview */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Current Skills</h2>
          <button className="btn-secondary text-sm">
            Add Skill
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentSkills.map((skill, index) => (
            <div key={index} className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900">{skill.name}</h3>
                <span className="text-sm text-gray-500">{skill.category}</span>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div 
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${skill.level}%` }}
                ></div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{skill.level}% proficiency</span>
                <button className="text-xs text-primary-600 hover:text-primary-700">
                  Update
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card text-center">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
            </svg>
          </div>
          <h3 className="font-medium text-gray-900 mb-2">Take Assessment</h3>
          <p className="text-sm text-gray-600 mb-4">Evaluate your current skill levels</p>
          <button className="btn-primary w-full">Start Assessment</button>
        </div>

        <div className="card text-center">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="font-medium text-gray-900 mb-2">Skill Recommendations</h3>
          <p className="text-sm text-gray-600 mb-4">Get AI-powered skill suggestions</p>
          <button className="btn-primary w-full">Get Recommendations</button>
        </div>

        <div className="card text-center">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="font-medium text-gray-900 mb-2">Progress Report</h3>
          <p className="text-sm text-gray-600 mb-4">View your learning progress</p>
          <button className="btn-primary w-full">View Report</button>
        </div>
      </div>
    </div>
  );
};

export default SkillManagementView;
