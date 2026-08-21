# StudentCarr Frontend Demo

This repository contains the frontend-only visitor demo for StudentCarr. It is a Vite + React single-page application in `App/` and does not require a backend.

## Demo behaviour

- `Continue as Visitor` opens the protected application routes.
- The visitor session survives page refreshes in the current browser tab.
- Profile, documents, applications, and email threads use local sample data.
- Profile edits are kept in React state for the current session only.
- Gmail, file transfer, AI generation, API keys, Claude Desktop, sending, and automation actions are visibly disabled.
- No API request is made by the demo.

## Run locally

```powershell
cd App
npm ci
npm run dev
```

Build and preview the production bundle:

```powershell
cd App
npm ci
npm run build
npm run preview
```

Vite writes the production build to `App/dist/`.

## Deploy with AWS Amplify

Connect the repository in AWS Amplify and use `App` as the application root. The checked-in `amplify.yml` installs dependencies and builds the Vite bundle.

Because this is a React Router SPA, configure Amplify to rewrite application routes to `/index.html` with a `200` response. Then verify direct navigation to routes such as `/dashboard`, `/profile`, and `/progress`.
