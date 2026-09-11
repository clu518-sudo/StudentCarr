# AWS Demo Migration: Amplify + EC2

## Summary

Deploy the existing `origin/AWS-full-stack-demo-deploy` branch unchanged as the application baseline. Do not create, rename, merge, or bootstrap-push a branch. Host the React app on the existing Amplify app and replace its current custom-domain mapping. Host the backend stack on one Sydney EC2 instance; exclude Chroma entirely.

## Migration steps

1. Add AWS runtime files to `AWS-full-stack-demo-deploy` only:
   - Multi-architecture Dockerfiles for `Backend`, `AIServices`, and `mcp-server`.
   - A production Compose stack containing Backend, AI Services, MCP server, and Caddy; it must not contain Chroma.
   - Caddy routes `https://api.<domain>/api/*` and `/health` to Backend, preserving SSE streaming.
   - Backend and AI/MCP services remain private Docker-network services; expose only Caddy ports 80/443.

2. Make container configuration production-safe:
   - Bind AI Services to `0.0.0.0` inside its container.
   - Set internal URLs: Backend -> `http://ai:10002`; AI Services -> `http://mcp:10004`.
   - Persist SQLite at `/app/data/studentcarr.db` and uploads at `/app/uploads` on encrypted EBS-backed host directories, preserving the paths stored in the database.
   - Run `prisma migrate deploy` before starting Backend.
   - Keep all secrets out of Git; generate production JWT, refresh-token, field-encryption, and MCP-token secrets.

3. Configure AWS in `ap-southeast-2`:
   - Launch one Amazon Linux 2023 `t4g.small` EC2 instance (2 GiB RAM, ARM) with a 30-GB encrypted gp3 EBS volume and a 2-GB swap file.
   - Attach one Elastic IP; use an IAM instance role for SSM, read-only Parameter Store access, and writes only to the demo-backup S3 bucket.
   - Security group: allow public TCP 80/443 only; use Session Manager rather than opening SSH.
   - Create an encrypted, versioned Sydney S3 backup bucket. Schedule a daily SQLite-consistent database backup plus compressed uploads backup; retain 14 daily copies.

4. Configure runtime values in Standard SSM Parameter Store:
   - `NODE_ENV=production`, database path, `CORS_ORIGIN=https://<domain>`, `APP_BASE_URL=https://<domain>`, API/AI/MCP internal URLs, LLM settings, and generated application secrets.
   - Do not configure `GOOGLE_LOGIN_CLIENT_ID`, `GOOGLE_LOGIN_CLIENT_SECRET`, `GOOGLE_LOGIN_REDIRECT_URI`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, or `GMAIL_REDIRECT_URI`; this demo uses password/demo-account authentication only.
   - Leave Google Cloud OAuth out of scope; Gmail connection and mailbox-sync functionality are not configured for this deployment.

5. Connect public DNS and hosting:
   - In Cloudflare, point `api.<domain>` to the EC2 Elastic IP. Enable Full (strict) TLS after Caddy has obtained its certificate.
   - In Amplify, add the already-pushed `AWS-full-stack-demo-deploy` branch, set `App` as the Vite monorepo root, build with `npm ci && npm run build`, and publish `dist`.
   - Set branch environment variable `VITE_API_BASE_URL=https://api.<domain>/api`.
   - Reassign the existing root and `www` custom-domain mappings to this Amplify branch.

6. Deploy manually from the existing branch:
   - On EC2, clone and explicitly check out `origin/AWS-full-stack-demo-deploy`.
   - Fetch that branch, rebuild the Compose images, run migrations, and restart the stack through a documented SSM Run Command.
   - Do not configure GitHub Actions, SSH deployment, or any other automatic post-push deployment workflow.

## Verification

- Build the frontend, run Backend tests, type-check AI Services, and build ARM Docker images before the EC2 rollout.
- Confirm `https://<domain>` loads, API health succeeds, CORS works, sign-up/login/refresh work, and streamed chat/profile-generation responses arrive incrementally.
- Confirm uploads can be uploaded, parsed, downloaded, survive a Compose restart, and appear in the daily backup.
- Confirm password login, demo-account login, and token refresh work.
- Confirm no Chroma container, vector database endpoint, or Chroma-related AWS charge exists.

## Cost defaults

- One `t4g.small`, one 30-GB gp3 EBS volume, one Elastic IPv4, small S3 backups, and the existing Amplify Hosting app.
- Deliberately exclude RDS, NAT Gateway, ALB, ECS/Fargate, Chroma, and managed vector databases.
- Public IPv4 adds USD 0.005/hour (about USD 3.60/month) independently of EC2 compute; configure an AWS monthly budget alert before launch.
- Use Standard Parameter Store values to avoid an additional parameter-storage charge.

## References

- [AWS Amplify branch deployments](https://docs.aws.amazon.com/amplify/latest/userguide/multi-environments.html)
- [AWS IPv4 pricing](https://aws.amazon.com/vpc/pricing/)
- [AWS Systems Manager pricing](https://aws.amazon.com/systems-manager/pricing/)
