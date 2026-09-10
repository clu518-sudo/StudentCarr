# StudentCarr AWS Console Deployment Guide

This guide deploys StudentCarr to AWS using the AWS web console as much as possible. The app should use Amazon Bedrock for AI features, not OpenAI/DashScope keys.

## Target Architecture

StudentCarr should be deployed as a static single-page frontend plus dynamic backend services.

- The frontend is static after `npm run build` because Vite outputs HTML, CSS, and JavaScript files in `App/dist`.
- S3 should store those static frontend files.
- CloudFront should serve the frontend to users and route `/api/*` requests to the backend.
- The backend, AI service, and document worker are the dynamic services.

```text
User
  -> CloudFront
      -> S3 frontend: React/Vite static files
      -> ALB /api/*: Express backend
            -> RDS PostgreSQL
            -> S3 private document bucket
            -> SQS document parsing queue
            -> Valkey for rate limit/SSE pubsub
            -> Private AI service
                    -> Amazon Bedrock Nova model
```

Default choices:

- Region: `ap-southeast-2` / Asia Pacific Sydney
- Frontend: static Vite React app in `App`, hosted by private S3 plus CloudFront
- Backend: dynamic Express/Prisma API service in `Backend`, hosted on ECS Fargate
- AI service: separate dynamic `AIServices` service on ECS Fargate
- Document worker: separate ECS Fargate worker for background PDF parsing
- Database: Amazon RDS PostgreSQL
- LLM: Amazon Bedrock, default model `amazon.nova-lite-v1:0`
- First URL: AWS temporary CloudFront URL

## Service Split Guidance

Use a small service split, not many microservices.

Recommended services:

```text
Backend API service
AI service
Document worker service
```

This is a good practice for StudentCarr because AI calls and document parsing are slower and have different scaling/failure behavior from normal API requests.

Do not split every feature into separate microservices yet. Keep auth, profile management, Gmail OAuth, progress tracking APIs, and database writes inside the backend API service for now. Extra microservices would add more deployment complexity, IAM policies, logs, networking, and debugging work before the app needs it.

Responsibilities:

- Backend API service: auth, profile APIs, Gmail OAuth, progress tracking APIs, database writes, user-facing API endpoints.
- AI service: profile generation, Gmail email analysis, reply draft generation, Bedrock calls.
- Document worker service: consumes SQS, reads uploaded PDFs from S3, parses/OCRs documents, updates document status.

## Step 1: Select Region

In the AWS Console top-right region selector, choose:

```text
Asia Pacific (Sydney) ap-southeast-2
```

Use the same region for Bedrock, RDS, ECS, S3, SQS, Valkey, and Secrets Manager.

## Step 2: Enable And Test Amazon Bedrock

1. Open `Amazon Bedrock`.
2. Go to `Model access` or `Model catalog`.
3. Find Amazon Nova models.
4. Use `Amazon Nova Lite` first.
5. Confirm the model ID is:

```text
amazon.nova-lite-v1:0
```

6. Open the Bedrock chat playground.
7. Test a prompt:

```text
Return JSON only:
{"summary":"hello"}
```

If the playground works, the account and region are ready for Bedrock inference.

## Step 3: Create S3 Buckets

Open `S3 -> Create bucket`.

Create:

```text
studentcarr-frontend-prod
studentcarr-documents-prod
```

For both buckets:

- Enable `Block all public access`.
- Enable server-side encryption.
- Do not use public bucket policies.

Usage:

- `studentcarr-frontend-prod`: built static React files from `App/dist`.
- `studentcarr-documents-prod`: private uploaded PDFs.

Important frontend hosting rule:

```text
Users should visit CloudFront, not the raw S3 bucket URL.
```

S3 is the private storage origin. CloudFront is the public HTTPS host.

## Step 4: Create RDS PostgreSQL

Open `RDS -> Create database`.

Use:

```text
Creation method: Standard create
Engine: PostgreSQL
Template: Production, or Dev/Test for lower cost
DB name: studentcarr
Public access: No
Storage encryption: Yes
```

Networking:

- Put RDS in private subnets.
- Create or use an RDS security group.
- Allow inbound PostgreSQL `5432` only from backend and worker ECS services.

After creation, keep these values:

- Endpoint
- Port
- Database name : studentcarr-db
- Username : studentcarr
- Password : studentcarr_admin

The production `DATABASE_URL` format is:

```text
postgresql://studentcarr:PASSWORD@studentcarr-db.c5wie8ca2d91.ap-southeast-2.rds.amazonaws.com:5432/studentcarr?schema=public&sslmode=verify-full (updated)
```

## Step 5: Store Secrets In Secrets Manager

Open `Secrets Manager -> Store a new secret`.

Create:

```text
studentcarr/prod/app
```

Store values like:

```json
{
  "DATABASE_URL": "postgresql://USER:PASSWORD@HOST:5432/studentcarr?schema=public",
  "JWT_ACCESS_SECRET": "replace-with-strong-secret",
  "JWT_REFRESH_SECRET": "replace-with-strong-secret",
  "FIELD_ENCRYPTION_KEY": "replace-with-valid-encryption-key",
  "GMAIL_CLIENT_ID": "replace-with-google-client-id",
  "GMAIL_CLIENT_SECRET": "replace-with-google-client-secret",
  "GOOGLE_LOGIN_CLIENT_ID": "replace-with-google-client-id",
  "GOOGLE_LOGIN_CLIENT_SECRET": "replace-with-google-client-secret"
}
```

Do not put secrets directly into ECS plain environment variables.

## Step 6: Create SQS Queue

Open `SQS -> Create queue`.

Create:

```text
studentcarr-document-parsing-prod
```

Use:

```text
Type: Standard queue
```

This replaces the backend's current in-memory document parsing queue.

Target flow:

```text
Backend uploads PDF
  -> saves object in S3
  -> creates ProfileDocument row in RDS
  -> sends SQS message with documentId
Worker reads SQS
  -> downloads PDF from S3
  -> parses/OCRs document
  -> updates RDS
```

## Step 7: Create Valkey

Open `ElastiCache -> Serverless cache`.

Choose:

```text
Create Valkey
```

Create:

```text
studentcarr-Valkey-prod
```

Use Valkey for:

- login/signup rate limiting
- SSE event pub/sub across multiple backend tasks

The current `RateLimiterMemory` works locally but is not suitable for multiple ECS tasks. Valkey is Redis OSS-compatible for the rate limiting and pub/sub patterns this app needs.

## Step 8: Create ECR Repositories

Open `ECR -> Private repositories -> Create repository`.

Create:

```text
studentcarr-backend
studentcarr-ai-service
studentcarr-document-worker
```

These repositories store Docker images built by CodeBuild/CodePipeline.

## Step 9: Create ECS Cluster

Open `ECS -> Clusters -> Create cluster`.

Create:

```text
studentcarr-prod
```

Use:

```text
Infrastructure: AWS Fargate
```

## Step 10: Create IAM Roles

Open `IAM -> Roles`.

Create ECS task roles.

Backend task role needs:

- Read `studentcarr/prod/app` from Secrets Manager.
- Read/write/delete objects in `studentcarr-documents-prod`.
- Send messages to `studentcarr-document-parsing-prod`.
- Write CloudWatch logs.

Worker task role needs:

- Read `studentcarr/prod/app` from Secrets Manager.
- Read objects from `studentcarr-documents-prod`.
- Receive/delete/change visibility on SQS messages.
- Write CloudWatch logs.

AI service task role needs:

```text
bedrock:Converse
bedrock:InvokeModel
```

For the first deployment, Bedrock permissions can be broad enough to prove the app works. After that, restrict the policy to the approved Amazon Nova model ARN.

## Step 11: Create ECS Task Definitions

Open `ECS -> Task definitions -> Create new task definition`.

Create three task definitions.

### Backend Task

```text
Name: studentcarr-backend
Launch type: Fargate
Container image: ECR studentcarr-backend image
Container port: 10001
```

Plain environment variables:

```text
NODE_ENV=production
PORT=10001
APP_BASE_URL=https://<cloudfront-domain>
CORS_ORIGIN=https://<cloudfront-domain>
DOCUMENT_BUCKET=studentcarr-documents-prod
DOCUMENT_QUEUE_URL=<sqs-queue-url>
REDIS_URL=<redis-endpoint>
PROGRESS_TRACKING_SERVICE_BASE_URL=http://studentcarr-ai-service:10002
PROFILE_GENERATION_SERVICE_URL=http://studentcarr-ai-service:10002/generate-profile
```

Secrets from Secrets Manager:

```text
DATABASE_URL
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
FIELD_ENCRYPTION_KEY
GMAIL_CLIENT_ID
GMAIL_CLIENT_SECRET
GOOGLE_LOGIN_CLIENT_ID
GOOGLE_LOGIN_CLIENT_SECRET
```

### AI Service Task

```text
Name: studentcarr-ai-service
Launch type: Fargate
Container image: ECR studentcarr-ai-service image
Container port: 10002
```

Environment:

```text
NODE_ENV=production
LANGGRAPH_PORT=10002
AWS_REGION=ap-southeast-2
BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
BEDROCK_TEMPERATURE=0.2
BEDROCK_MAX_TOKENS=2000
```

The AI service should call Bedrock using its ECS task role, not static AWS access keys.

### Worker Task

```text
Name: studentcarr-document-worker
Launch type: Fargate
Container image: ECR studentcarr-document-worker image
No public port required
```

Environment:

```text
NODE_ENV=production
DOCUMENT_BUCKET=studentcarr-documents-prod
DOCUMENT_QUEUE_URL=<sqs-queue-url>
REDIS_URL=<redis-endpoint>
```

## Step 12: Create Application Load Balancer

Open `EC2 -> Load Balancers -> Create load balancer`.

Choose:

```text
Application Load Balancer
Internet-facing
```

Listener:

```text
HTTP 80
```

Target group:

```text
Target type: IP
Protocol: HTTP
Port: 10001
Health check path: /health
```

Only the backend service should be behind this public ALB. The AI service and worker should stay private.

## Step 13: Create ECS Services

Open:

```text
ECS -> studentcarr-prod -> Services -> Create
```

Create backend service:

```text
Task definition: studentcarr-backend
Launch type: Fargate
Desired tasks: 1
Load balancer: Application Load Balancer
Target group: backend target group
```

Create AI service:

```text
Task definition: studentcarr-ai-service
Launch type: Fargate
Desired tasks: 1
Load balancer: None
Networking: private subnets
Service discovery: enabled
```

Create worker service:

```text
Task definition: studentcarr-document-worker
Launch type: Fargate
Desired tasks: 1
Load balancer: None
Networking: private subnets
```

## Step 14: Create CloudFront Distribution

Open `CloudFront -> Create distribution`.

Create two origins.

Origin 1:

```text
Origin type: S3
Origin: studentcarr-frontend-prod
Origin access: Origin Access Control
```

Origin 2:

```text
Origin type: Custom origin
Origin domain: ALB DNS name
Protocol: HTTP
```

Default behavior:

```text
Path: *
Origin: S3 frontend
Caching: enabled
```

API behavior:

```text
Path pattern: /api/*
Origin: ALB
Caching: disabled
Allowed methods: GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
Forward cookies: all
Forward query strings: all
Forward headers: Authorization, Cookie, Content-Type, Origin
```

SPA fallback:

```text
Custom error response:
403 -> /index.html -> 200
404 -> /index.html -> 200
```

## Step 15: Deploy Static Frontend

The frontend is static after build. Production should use:

```text
Vite build output -> S3 private bucket -> CloudFront public URL
```

### Recommended Option: S3 Plus CloudFront

Use CodePipeline/CodeBuild from the AWS Console:

```text
Source: GitHub
Build: npm ci && npm run build
Deploy: S3 bucket studentcarr-frontend-prod
Post-deploy: CloudFront invalidation
```

Build settings:

```text
App root: App
Build command: npm ci && npm run build
Output directory: dist
Environment variable: VITE_API_BASE_URL=/api
```

The deployed frontend files are static:

```text
index.html
assets/*.js
assets/*.css
other static assets
```

The app is still dynamic overall because React calls the backend API for login, profile data, Gmail sync, uploads, and AI features.

### Optional Simpler Hosting Option: Amplify Hosting

Amplify Hosting can also host the static Vite frontend from GitHub.

Open:

```text
AWS Amplify -> Host web app
```

Connect the GitHub repository.

Use:

```text
App root: App
Build command: npm run build
Output directory: dist
Environment variable: VITE_API_BASE_URL=/api
```

If you use Amplify, still keep the backend on ECS and keep AI calls in the private AI service. For the cleanest single public URL, S3 plus CloudFront is preferred.

## Step 16: Configure Google OAuth

In Google Cloud Console, add redirect URLs:

```text
https://<cloudfront-domain>/api/auth/google/callback
https://<cloudfront-domain>/api/process-tracking/gmail/callback
```

Then configure backend environment/secrets:

```text
GOOGLE_LOGIN_REDIRECT_URI=https://<cloudfront-domain>/api/auth/google/callback
GMAIL_REDIRECT_URI=https://<cloudfront-domain>/api/process-tracking/gmail/callback
```

## Step 17: Run Database Migrations From AWS Console

Open:

```text
ECS -> Task definitions -> studentcarr-backend -> Run task
```

Use command override:

```text
npx prisma migrate deploy
```

Run this before starting or updating the backend service.

This action is launched from the AWS Console. No local AWS CLI is required.

## Step 18: Add CI/CD With AWS Web UI

CI/CD makes sense for this project because StudentCarr has several deploy targets:

```text
Frontend -> build Vite -> deploy to S3 -> invalidate CloudFront
Backend -> build Docker image -> push to ECR -> update ECS service
AI service -> build Docker image -> push to ECR -> update ECS service
Worker -> build Docker image -> push to ECR -> update ECS service
Database -> run Prisma migrate deploy before backend rollout
```

Use AWS Console services:

```text
CodePipeline
CodeBuild
ECR
ECS
S3
CloudFront
```

### Recommended Pipeline Split

Start with two pipelines:

```text
studentcarr-services-pipeline
studentcarr-frontend-pipeline
```

This keeps the first CI/CD setup manageable.

Later, split into separate pipelines if deployments become too slow:

```text
studentcarr-backend-pipeline
studentcarr-ai-service-pipeline
studentcarr-worker-pipeline
studentcarr-frontend-pipeline
```

### Services Pipeline

Open:

```text
CodePipeline -> Create pipeline
```

Create:

```text
Name: studentcarr-services-pipeline
Source: GitHub repository
Build provider: CodeBuild
Deploy provider: Amazon ECS
```

The pipeline should:

```text
1. Pull code from GitHub.
2. Run backend tests.
3. Run AI service typecheck.
4. Build backend Docker image.
5. Build AI service Docker image.
6. Build worker Docker image.
7. Push all images to ECR.
8. Run Prisma migration using ECS one-off task.
9. Update ECS backend service.
10. Update ECS AI service.
11. Update ECS worker service.
```

Use one CodeBuild project first. If the build becomes slow, split it into multiple CodeBuild projects.

### Frontend Pipeline

Open:

```text
CodePipeline -> Create pipeline
```

Create:

```text
Name: studentcarr-frontend-pipeline
Source: GitHub repository
Build provider: CodeBuild
Deploy target: S3
```

The pipeline should:

```text
1. Pull code from GitHub.
2. Install frontend dependencies in App.
3. Build with VITE_API_BASE_URL=/api.
4. Upload App/dist to studentcarr-frontend-prod.
5. Delete old removed files from S3.
6. Invalidate CloudFront cache.
```

Frontend build settings:

```text
Working directory: App
Install command: npm ci
Build command: npm run build
Output directory: dist
Environment variable: VITE_API_BASE_URL=/api
```

### CI/CD IAM Permissions

The CodeBuild/CodePipeline roles need only the deployment permissions they use.

Services pipeline role needs:

- Pull source from GitHub connection.
- Build Docker images.
- Push to ECR repositories.
- Update ECS services.
- Run ECS task for `prisma migrate deploy`.
- Read deployment-related Secrets Manager values if needed.
- Write CloudWatch build logs.

Frontend pipeline role needs:

- Pull source from GitHub connection.
- Upload/delete objects in `studentcarr-frontend-prod`.
- Create CloudFront invalidations.
- Write CloudWatch build logs.

Do not store AWS access keys in GitHub or the repo.

### Deployment Safety Rules

Use these rules for the first production setup:

```text
Only deploy from main branch.
Run Prisma migrations before backend service update.
Do not deploy frontend before backend API changes are compatible.
Keep previous ECS task definitions available for rollback.
Keep S3 frontend versioning enabled if possible.
Use CloudWatch logs to verify each deploy.
```

For database migrations, avoid destructive schema changes until the app has backups and rollback procedures.

## Step 19: Required Code Changes Before Deployment

The AWS resources alone are not enough. The repo needs these changes:

1. Change Prisma from SQLite to PostgreSQL.
2. Replace local disk upload storage with S3.
3. Replace in-memory document queue with SQS.
4. Replace in-memory rate limiting with Valkey.
5. Replace process-local SSE event delivery with Valkey pub/sub.
6. Replace OpenAI/DashScope AI calls with Bedrock calls.
7. Make AI service use ECS task IAM role, not static AWS keys.

Keep this service structure:

```text
Frontend static app
Backend API service
AI service
Document worker service
```

Do not convert every backend module into its own microservice. The current backend/AI separation plus one worker is the right level for this project.

For Bedrock, keep this boundary:

```text
Frontend
  -> Backend
      -> AIServices
          -> Amazon Bedrock
```

Do not call Bedrock directly from the frontend.

## Step 20: Production Smoke Test

Test in this order:

```text
1. CloudFront URL loads React app.
2. /api/health returns success.
3. Signup works.
4. Login works.
5. Refresh token works after page reload.
6. Google login works.
7. Gmail connect works.
8. Gmail sync triggers AI service.
9. AI service calls Bedrock successfully.
10. Bedrock returns valid structured JSON.
11. PDF upload stores file in S3.
12. SQS receives document parsing job.
13. Worker parses document and updates RDS.
14. UI receives document parsing progress.
15. Push a small frontend change and confirm CI/CD updates S3 and invalidates CloudFront.
16. Push a small backend change and confirm CI/CD updates the ECS backend service.
```

## Step 21: Monitoring And Cost Controls

Create CloudWatch alarms for:

- ECS task stopped
- ALB 5xx errors
- CloudFront 5xx errors
- Backend high CPU/memory
- AI service high errors
- RDS CPU/storage/connections
- SQS oldest message age
- Bedrock error rate

Create an AWS Budget:

```text
Monthly budget: your expected maximum spend
Alerts: 50%, 80%, 100%
```

## Recommended Implementation Order

```text
1. Replace AI implementation with Bedrock in AIServices.
2. Convert Prisma from SQLite to PostgreSQL.
3. Replace local PDF upload storage with S3.
4. Replace document parsing queue with SQS.
5. Add Valkey for rate limiting and SSE pub/sub.
6. Create AWS resources through the Console.
7. Deploy backend, AI service, and worker to ECS Fargate.
8. Deploy static frontend to private S3 and serve it through CloudFront.
9. Configure Google/Gmail OAuth callback URLs.
10. Add CodePipeline/CodeBuild CI/CD.
11. Add CloudWatch alarms and AWS Budget.
```

## References

- Bedrock model access: https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html
- CloudFront distribution console: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-web-creating-console.html
- CloudFront OAC for S3: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html
- RDS PostgreSQL console guide: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_GettingStarted.CreatingConnecting.PostgreSQL.html
