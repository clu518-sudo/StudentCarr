# StudentCarr

StudentCarr is an in-progress career development platform for students and early-career job seekers.  
The product is being built to centralize profile data, skills growth, job discovery, application tracking, and interview preparation into one workflow-driven system.

## Project Status

This repository is currently under active development.

- Core product areas are already scaffolded and partially implemented.
- Authentication and protected app routing are in place.
- Profile Management has an implemented backend module and a full dual-mode UI (manual data entry + document upload).
- Several modules are live as functional foundations and are being expanded iteratively.

## What This Project Is Building

The current direction of StudentCarr is to support the full student-to-job pipeline:

- **Identity and profile foundation**
  - Build a structured career profile from manual form data.
  - Upload profile-supporting documents (resume, transcript, projects, certifications, and related files) for future AI-assisted parsing.
- **Career opportunity workflow**
  - Surface and organize job opportunities aligned with user goals.
  - Connect profile and skills data to improve relevance over time.
- **Skills and growth planning**
  - Track skills and identify gaps.
  - Support learning-path style progression from current skill state to target roles.
- **Application lifecycle management**
  - Prepare application assets (including resume workflows).
  - Support automation-oriented application tasks in future iterations.
- **Interview readiness**
  - Provide an AI-assistant-oriented interview preparation module that will evolve with richer data from profile and application history.

## Current Feature Areas in the App

- Dashboard and progress tracking
- Profile management (manual profile + PDF document management)
- Job exploration area
- Skills management, including gap analysis and learning path views
- Application management, including resume builder and automation section
- AI interview assistant area

## Technical Overview (Brief)

### Frontend

- **React 18** single-page application
- **Vite** for development/build tooling
- **React Router** for authenticated and nested app routing
- **Tailwind CSS** for UI styling and consistent component-level layout patterns
- Context-based auth state and API client integration for protected requests

### Backend

- **Node.js + Express** API service
- **Prisma ORM** for data access
- **SQLite-backed Prisma models** in current development setup
- **JWT + refresh-token auth flow** with cookie handling
- Validation and security middleware, including:
  - schema validation (**Zod**),
  - rate limiting,
  - security headers and CORS,
  - password hashing and token utilities
- **Multer-based document upload pipeline** for profile files (PDF-focused flow)

## Architecture Direction

StudentCarr is organized as a full-stack codebase with:

- `App/` for the web client
- `Backend/` for the API and persistence layer

The development approach is modular: each domain area (auth, profile management, skills, applications, interview support) is implemented as an independently evolvable feature slice so downstream AI and workflow automation capabilities can be integrated incrementally.