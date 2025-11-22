import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import LoginView from './components/auth/LoginView';
import DashboardLayout from './components/layout/DashboardLayout';
import DashboardView from './components/dashboard/DashboardView';
import ProfileView from './components/profile/ProfileView';
import JobsView from './components/jobs/JobsView';
import ProgressView from './components/progress/ProgressView';
import SkillManagementView from './components/skills/SkillManagementView';
import SkillGapAnalysisView from './components/skills/SkillGapAnalysisView';
import LearningPathView from './components/skills/LearningPathView';
import ApplicationManagementView from './components/applications/ApplicationManagementView';
import ResumeBuilderView from './components/applications/ResumeBuilderView';
import ApplicationAutomationView from './components/applications/ApplicationAutomationView';
import ProtectedRoute from './components/auth/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginView />} />
            
            {/* Protected Routes */}
            <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardView />} />
              <Route path="profile" element={<ProfileView />} />
              <Route path="jobs" element={<JobsView />} />
              <Route path="progress" element={<ProgressView />} />
              
              {/* Skills Management with nested routes */}
              <Route path="skills" element={<SkillManagementView />} />
              <Route path="skills/gap-analysis" element={<SkillGapAnalysisView />} />
              <Route path="skills/learning-path" element={<LearningPathView />} />
              
              {/* Application Management with nested routes */}
              <Route path="applications" element={<ApplicationManagementView />} />
              <Route path="applications/resume-builder" element={<ResumeBuilderView />} />
              <Route path="applications/automation" element={<ApplicationAutomationView />} />
            </Route>
            
            {/* Catch all route */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
