Build the "Progress Tracking" feature for this repository.

Repository context:

- Frontend lives in `App/src`
- Backend lives in `Backend/src`
- The backend feature for this work must be implemented in a new folder: `Backend/src/processTracking`
- The real Gmail ingestion and AI workflow will be implemented later in `AIServices/`, so only add clear extension points for that future integration

Goal:
Create a frontend and backend-ready scaffold that helps users track job application progress based on job-hunt-related emails. The product flow is:

- user sees a list of job positions with current application status
- user expands a position to see all related emails
- user selects an email to view its full content
- if the selected email is classified as an invitation, the UI also shows an AI-generated reply draft
- user can edit that draft and confirm sending through a dummy flow

Important constraints:

- Do not connect to real Gmail yet
- Do not send real emails
- Do not build the final AI workflow yet
- Use dummy/mock backend data first so the frontend can be completed and wired immediately

Feature requirements:

1. Frontend application progress list

- Add a Progress Tracking screen or section in `App/src`
- Render a list of job position components
- Each job position item should briefly show:
  - company name
  - position title
  - application status
  - last updated time
- Example statuses:
  - applied
  - under review
  - invited
  - rejected
  - offer

2. Expandable position details

- When the user clicks a job position component, it should expand and show all related emails for that application
- Each email in that list should be rendered as its own component
- Each email component should show summary fields such as:
  - sender
  - subject
  - date
  - classified intention

3. Email detail view

- When the user clicks an email component, show the full email content
- If the email intention classification is `invite`, also show an AI-generated reply draft
- The reply draft must:
  - be editable by the user
  - have a confirm action
  - trigger a dummy send handler for now
- After confirm, update the UI in a simple mock way so the action feels complete

4. Backend mock interface

- Build backend interfaces with dummy data first for frontend use
- Create the new feature folder under `Backend/src/processTracking`
- Keep this feature separated from existing backend domains
- Provide mock API endpoints or service functions for:
  - listing job applications
  - getting emails related to one application
  - retrieving one email detail
  - retrieving or generating a mock reply draft for invite emails
  - confirming a mock reply send action

5. Future architecture

- The real workflow will be implemented later in `AIServices/`
- Design this feature so Gmail fetching, email classification, and AI reply generation can be swapped in later without rewriting the frontend
- Add small, clear extension points or placeholder interfaces where future Gmail and AI integrations will plug in

Implementation guidance:

Frontend in `App/src`:

- Build reusable components for:
  - progress tracking list
  - job/application item
  - related email list
  - email item
  - email detail panel
  - editable invite reply panel
- Keep component responsibilities clear
- Support expand/collapse for the position item
- Support email selection and active-state highlighting
- Keep state predictable and easy to replace with real API data later
- Prefer a clean data-fetching boundary rather than scattering mock data directly through presentational components

Backend in `Backend/src/processTracking`:

- Add a self-contained module structure for this feature
- Include clear data models/types or object shapes for:
  - `JobApplication`
  - `ApplicationEmail`
  - `EmailIntent`
  - `ReplyDraft`
- Add mock data and API/controller/service wiring that matches the existing backend style as closely as practical
- Expose enough endpoints for the frontend to work end-to-end with dummy data

Behavior rules:

- One job application can have multiple related emails
- Emails should be classified into intentions such as:
  - applied_confirmation
  - follow_up
  - invite
  - rejection
  - unknown
- The application status shown in the list should reflect the latest meaningful email classification or equivalent mock logic
- Only invitation emails should show the editable AI reply panel
- The confirm/send action should simulate success and return a stable mock response

Code quality expectations:

- Match the existing project patterns where possible
- Keep the feature modular and easy to extend
- Avoid unnecessary complexity
- Add brief comments only where future integration points are not obvious
- Do not overbuild the AI layer yet

Suggested deliverables:

1. Frontend Progress Tracking UI under `App/src`
2. Backend mock feature module under `Backend/src/processTracking`
3. Mock routes/services/controllers for the frontend to consume
4. Typed or well-defined data contracts for applications, emails, intents, and reply drafts
5. Dummy reply confirmation flow in the UI
6. Clear placeholders for later Gmail and AIService integration

Expected user outcome:
After implementation, a user should be able to open the Progress Tracking feature, scan job applications and statuses, expand an application, inspect related emails, read the full email content, and edit/confirm a mock AI-generated reply when the selected email is an invitation.
