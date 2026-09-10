# Visitor Demo Deployment Plan

This plan is for showing the StudentCarr frontend publicly before the backend is deployed. The recommended approach is to host the Vite React frontend on AWS Amplify, buy and manage the domain in Cloudflare, and add a frontend-only visitor mode when you are ready to demo the main app.

## Goal

- Let visitors open the public website from a custom domain.
- Let visitors enter the main app without creating an account.
- Avoid depending on the backend during this demo phase.
- Make backend-only features clear, disabled, or backed by demo data so the app does not show broken API errors.

## 1. Buy Domain From Cloudflare

1. Go to Cloudflare Dashboard.
2. Open **Domain Registration**.
3. Search for the domain name you want.
4. Buy the domain.
5. Complete registrant/contact verification if Cloudflare asks.
6. Keep DNS hosted in Cloudflare.

Important note: if you buy the domain from Cloudflare Registrar, Cloudflare normally manages the nameservers. That is fine. You do not need AWS Route 53 for this phase.

## 2. Host Frontend On AWS

Recommended service: **AWS Amplify Hosting**.

Why Amplify is the best fit now:

- Your frontend is a Vite React app in `App/`.
- Amplify can build and host static frontend apps directly from GitHub.
- It includes CDN hosting and HTTPS.
- It handles custom domains.
- It is simpler than manually setting up S3, CloudFront, cache rules, and SPA redirects.

## 3. Prepare GitHub Repo

1. Push the project to GitHub.
2. Confirm the frontend app builds from the `App/` folder.
3. Make sure `App/package.json` has:

```json
{
  "scripts": {
    "build": "vite build"
  }
}
```

4. Locally test before deployment:

```powershell
cd App
npm ci
npm run build
npm run preview
```

## 4. Create AWS Amplify App

1. Open AWS Console.
2. Go to **AWS Amplify**.
3. Choose **Deploy an app**.
4. Connect GitHub.
5. Select your repository and branch.
6. Set the app root to:

```text
App
```

7. Use build settings similar to:

```yaml
version: 1
applications:
  - appRoot: App
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: dist
        files:
          - "**/*"
      cache:
        paths:
          - node_modules/**/*
```

8. Deploy the app.
9. Confirm the default Amplify URL loads.

## 5. Add SPA Redirect Rule

Because the app uses React Router paths like `/dashboard`, `/profile`, and `/jobs`, direct page refreshes need to return `index.html`.

In Amplify, add a rewrite rule:

```text
Source: </^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2)$)([^.]+$)/>
Target: /index.html
Type: 200
```

Then test direct navigation:

```text
https://your-amplify-url/dashboard
https://your-amplify-url/profile
https://your-amplify-url/jobs
```

## 6. Connect Cloudflare Domain To Amplify

1. In AWS Amplify, open **Domain management**.
2. Add your Cloudflare domain.
3. Amplify will show DNS records to add.
4. In Cloudflare DNS, add the records Amplify provides.

Common records:

- `www` as a `CNAME` pointing to the Amplify target.
- Root/apex domain using the record Amplify provides, often supported through Cloudflare CNAME flattening.
- Certificate validation records if Amplify asks for them.

5. Wait for DNS propagation and SSL validation.
6. Test:

```text
https://yourdomain.com
https://www.yourdomain.com
https://yourdomain.com/dashboard
```

## 7. Estimated AWS Cost

For frontend-only demo hosting, expected AWS cost is usually very low.

| Item | Estimate |
| --- | ---: |
| Amplify build minutes | Usually $0 or cents/month for light usage |
| Amplify storage | Usually under $0.10/month |
| Amplify data transfer | Usually $0 to $2/month for small demo traffic |
| SSL certificate | $0 with Amplify-managed public certificate |
| Route 53 | $0 if DNS stays in Cloudflare |

Expected total:

```text
Small demo: $0 to $3/month
Larger demo traffic: $5 to $20/month
Cloudflare domain: separate yearly cost, often around $10 to $20/year depending on TLD
```

Avoid AWS WAF for now unless you have a real security need, because it can add a noticeable monthly cost.

## 8. Frontend Changes Needed Later

The current app has:

- Public routes: `/login`, `/signup`
- Protected app routes behind `ProtectedRoute`
- Auth state in `App/src/contexts/AuthContext.jsx`
- Login UI in `App/src/components/auth/LoginView.jsx`
- API calls in `ProfileContext` and `ProgressContext`

To support visitor login cleanly, make these changes later.

### 8.1 Add Visitor Auth State

In `App/src/contexts/AuthContext.jsx`, add a `loginAsVisitor` function.

The visitor user should look like:

```js
{
  id: "visitor-demo",
  name: "Visitor Demo",
  email: "visitor@studentcarr.demo",
  authProvider: "visitor",
  role: "visitor"
}
```

Set:

```js
isAuthenticated = true
accessToken = null
```

Use `localStorage` or `sessionStorage` so refreshes keep the visitor session.

Also expose:

```js
isVisitor: user?.authProvider === "visitor"
```

### 8.2 Add Visitor Button To Login

In `App/src/components/auth/LoginView.jsx`, add:

```text
Continue as Visitor
```

Click behavior:

1. Call `loginAsVisitor()`.
2. Navigate to `/dashboard`.

### 8.3 Keep Protected Routes Working

`ProtectedRoute` can continue checking `isAuthenticated`.

Visitor mode should count as authenticated so routes like these work:

```text
/dashboard
/profile
/jobs
/progress
/skills
/applications
/interview
```

### 8.4 Add Demo Data

Create a frontend-only data file such as:

```text
App/src/data/visitorDemoData.js
```

Include demo data for:

- Profile
- Skills
- Projects
- Documents
- Applications
- Progress emails
- Interview invitation draft

### 8.5 Prevent Backend Calls In Visitor Mode

In `ProfileContext`:

- If `isVisitor`, load demo profile data.
- Do not call profile API endpoints.
- Let manual edits update local React state only.
- Disable document upload/download.
- Disable AI generation.

In `ProgressContext`:

- If `isVisitor`, load demo applications.
- Do not call Gmail/progress API endpoints.
- Disable Gmail connect, sync, disconnect, and send.
- Let visitors expand demo applications and preview demo emails.

### 8.6 Label Visitor Mode Clearly

Add visible labels in:

- Header: `Visitor Mode`
- Sidebar/account area: `Demo Preview` or `Visitor session`
- Backend-only pages: explain the feature needs the backend.

This prevents confusion when showing people the product.

### 8.7 Disable Backend-Only Features

Disable or clearly gate:

- Gmail sync
- Gmail connect/disconnect
- Document upload
- Document download
- AI profile generation
- API key generation
- Claude Desktop/MCP setup
- Any real send or automation action

Recommended message:

```text
This feature is disabled in visitor mode until the backend is deployed.
```

## 9. Demo QA Checklist

Before showing people:

- Login page loads.
- Visitor login enters `/dashboard`.
- Refreshing `/dashboard` keeps the visitor session.
- Sidebar navigation works.
- Dashboard shows useful demo metrics.
- Profile shows demo profile data.
- Progress page shows demo applications/emails.
- No backend fetch errors appear in the browser console during visitor mode.
- Backend-only buttons are disabled or show friendly messages.
- Logout returns to `/login`.
- Direct URL refresh works on hosted routes.
- Mobile layout is readable.

## 10. Recommended Work Order

1. Add visitor auth state.
2. Add visitor login button.
3. Add demo data.
4. Make profile/progress contexts visitor-aware.
5. Disable backend-only actions for visitor mode.
6. Add visitor labels in the UI.
7. Run local build and preview.
8. Push to GitHub.
9. Deploy to AWS Amplify.
10. Connect Cloudflare domain.
11. Test public demo links.

## 11. Later Backend Phase

When the backend is ready to deploy, revisit:

- API hosting service choice.
- Database choice.
- Environment variables.
- CORS and cookie settings.
- OAuth callback URLs.
- Production JWT/refresh-token settings.
- File upload storage.
- Monitoring and logs.

At that point, the visitor mode can remain as a demo entry, while real users use normal signup/login.
