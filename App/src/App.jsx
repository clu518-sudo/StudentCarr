import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProfileProvider } from "./contexts/ProfileContext";
import { ProgressProvider } from "./contexts/ProgressContext";
import LoginView from "./components/auth/LoginView";
import SignupView from "./components/auth/SignupView";
import DashboardLayout from "./components/layout/DashboardLayout";
import DashboardView from "./components/dashboard/DashboardView";
import ProfileView from "./components/profile/ProfileView";
import ProfileEntryAddView from "./components/profile/ProfileEntryAddView";
import JobsView from "./components/jobs/JobsView";
import ProgressView from "./components/progress/ProgressView";
import SkillManagementView from "./components/skills/SkillManagementView";
import SkillGapAnalysisView from "./components/skills/SkillGapAnalysisView";
import LearningPathView from "./components/skills/LearningPathView";
import ApplicationManagementView from "./components/applications/ApplicationManagementView";
import ResumeBuilderView from "./components/applications/ResumeBuilderView";
import ApplicationAutomationView from "./components/applications/ApplicationAutomationView";
import AIInterviewAssistantView from "./components/interview/AIInterviewAssistantView";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import McpSetupView from "./components/mcp/McpSetupView";
import SettingsView from "./components/settings/SettingsView";

function App() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <ProgressProvider>
          <Router>
            <div className="App">
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<LoginView />} />
                <Route path="/signup" element={<SignupView />} />

                {/* Protected Routes */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <DashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<DashboardView />} />
                  <Route path="profile" element={<ProfileView />} />
                  {/* Dedicated add page per repeatable profile section, shown
                      in the workspace column. */}
                  <Route
                    path="profile/add/:section"
                    element={<ProfileEntryAddView />}
                  />
                  <Route path="jobs" element={<JobsView />} />
                  <Route path="progress" element={<ProgressView />} />
                  <Route path="mcp" element={<McpSetupView />} />
                  <Route path="settings" element={<SettingsView />} />

                  {/* Skills Management with nested routes */}
                  <Route path="skills" element={<SkillManagementView />} />
                  <Route
                    path="skills/gap-analysis"
                    element={<SkillGapAnalysisView />}
                  />
                  <Route
                    path="skills/learning-path"
                    element={<LearningPathView />}
                  />

                  {/* Application Management with nested routes */}
                  <Route
                    path="applications"
                    element={<ApplicationManagementView />}
                  />
                  <Route
                    path="applications/resume-builder"
                    element={<ResumeBuilderView />}
                  />
                  <Route
                    path="applications/automation"
                    element={<ApplicationAutomationView />}
                  />

                  {/* AI Interview Assistant */}
                  <Route
                    path="interview"
                    element={<AIInterviewAssistantView />}
                  />
                </Route>

                {/* Catch all route */}
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </div>
          </Router>
        </ProgressProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}

export default App;