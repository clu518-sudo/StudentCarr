# Student Career App

A comprehensive web application designed to help students find jobs, built with React.js following the MVP (Model-View-Presenter) architectural pattern.

## 🏗️ Architecture

This application strictly follows the **MVP (Model-View-Presenter)** pattern:

- **Model**: Data types and state structure managed through React Context
- **View**: Pure UI components (JSX) that only display data and trigger events - NO business logic
- **Presenter**: Custom Hooks that handle business logic, API calls, and state management

## 🚀 Features

### Phase A: Authentication
- Clean login interface with email/password
- Mock authentication system
- Automatic redirect to dashboard upon successful login

### Phase B: Main Dashboard
- Central landing page with navigation menu
- Quick action cards for common tasks
- Statistics overview and recent activity

### Phase C: Core Modules
- **Profile Management**: Manage personal information and preferences
- **Job Discovery**: Find and explore job opportunities
- **Skill Management**: Analyze skills and create learning paths
  - Skill Gap Analysis
  - Learning Path Generation
- **Application Management**: Handle job applications and resumes
  - Resume/CV Builder
  - Application Automation
- **Progress Tracking**: Monitor career development progress

## 📁 Project Structure

```
src/
├── components/
│   ├── auth/
│   │   ├── LoginView.js          # Login UI component
│   │   └── ProtectedRoute.js     # Route protection component
│   ├── layout/
│   │   ├── DashboardLayout.js    # Main layout wrapper
│   │   ├── Header.js             # Top navigation header
│   │   └── Sidebar.js            # Side navigation menu
│   ├── dashboard/
│   │   └── DashboardView.js      # Main dashboard page
│   ├── profile/
│   │   └── ProfileView.js        # Profile management page
│   ├── jobs/
│   │   └── JobsView.js           # Job discovery page
│   ├── skills/
│   │   ├── SkillManagementView.js    # Skills overview page
│   │   ├── SkillGapAnalysisView.js   # Gap analysis page
│   │   └── LearningPathView.js       # Learning path page
│   ├── applications/
│   │   ├── ApplicationManagementView.js  # Applications overview
│   │   ├── ResumeBuilderView.js          # Resume builder page
│   │   └── ApplicationAutomationView.js  # Automation page
│   └── progress/
│       └── ProgressView.js       # Progress tracking page
├── hooks/
│   └── useLogin.js               # Login presenter (business logic)
├── contexts/
│   └── AuthContext.js            # Authentication state management
├── App.js                        # Main app component with routing
├── index.js                      # App entry point
└── index.css                     # Global styles with Tailwind
```

## 🛠️ Technology Stack

- **Framework**: React.js 18
- **Routing**: React Router DOM v6
- **Styling**: Tailwind CSS
- **State Management**: React Context API
- **Architecture**: MVP Pattern

## 📋 Setup Instructions

1. **Install Dependencies**
   ```bash
   cd App
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm start
   ```

3. **Build for Production**
   ```bash
   npm run build
   ```
   - Creates an optimized production build in the `build/` folder
   - Minifies JavaScript and CSS files
   - Optimizes assets for best performance
   - Ready to deploy to any static hosting service

4. **Access the Application**
   - Development: Open [http://localhost:10003](http://localhost:10003)
   - Production: Serve the `build/` folder using a web server
   - Use any email and password (minimum 6 characters) to login

## 🔨 Build Commands

### Development
```bash
npm start
```
- Starts the development server with hot-reload
- Runs on http://localhost:10003
- Includes source maps and error overlays

### Production Build
```bash
npm run build
```
- Creates optimized production build in `build/` directory
- Minifies and bundles all JavaScript and CSS
- Optimizes images and assets
- Generates source maps for debugging
- Build output is ready for deployment

### Testing
```bash
npm test
```
- Runs the test suite in watch mode
- Uses Jest and React Testing Library

### Build Output
After running `npm run build`, you'll find:
```
build/
├── asset-manifest.json    # Asset mapping file
├── index.html            # Main HTML file
└── static/
    ├── css/              # Minified CSS files
    └── js/               # Minified JavaScript bundles
```

### Serving the Production Build Locally
To test the production build locally:
```bash
# Install a simple HTTP server (if not already installed)
npm install -g serve

# Serve the build folder
serve -s build

# Or use Python's built-in server
cd build
python -m http.server 8000
```

## 🔐 Demo Credentials

The application uses mock authentication. You can login with:
- **Email**: Any valid email format (e.g., `demo@example.com`)
- **Password**: Any password with at least 6 characters

## 🧭 Navigation Structure

```
/login                              # Authentication page
/dashboard                          # Main dashboard
/profile                           # Profile management
/jobs                              # Job discovery
/progress                          # Progress tracking
/skills                            # Skill management overview
├── /skills/gap-analysis           # Skill gap analysis
└── /skills/learning-path          # Learning path generation
/applications                      # Application management overview
├── /applications/resume-builder   # Resume/CV builder
└── /applications/automation       # Application automation
```

## 🎨 Design Features

- **Clean, Modern UI**: Student-friendly interface with intuitive navigation
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Consistent Styling**: Tailwind CSS utility classes for rapid development
- **Interactive Elements**: Hover effects, transitions, and visual feedback
- **Accessibility**: Proper ARIA labels and keyboard navigation support

## 🏛️ MVP Pattern Implementation

### Views (Pure UI Components)
- Receive data via props from presenters
- Handle user interactions by calling presenter functions
- Contain NO business logic or direct state management
- Focus solely on rendering and user interaction

### Presenters (Custom Hooks)
- Handle all business logic and state management
- Make API calls and data transformations
- Provide data and functions to views
- Manage form validation and error handling

### Models (Context & State)
- Define data structures and types
- Manage global application state
- Provide data access patterns
- Handle state persistence and synchronization

## 🚧 Current Status

This is a **skeleton/MVP implementation** with:
- ✅ Complete authentication flow
- ✅ Full navigation structure
- ✅ Responsive dashboard layout
- ✅ Skill management with nested routing example
- ✅ All placeholder pages for future development

## 🔮 Future Development

Each module is designed as a placeholder ready for implementation:
- API integration points are clearly defined
- Component structure supports easy feature addition
- Consistent patterns across all modules
- Scalable architecture for team development

## 📝 Notes

- All components follow React best practices
- Consistent naming conventions throughout
- Modular structure for easy maintenance
- Ready for production deployment with proper backend integration
