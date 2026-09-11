# StudentCarr — AWS Configuration and Architecture

Recorded: 11 September 2026 (Pacific/Auckland). Deployment screenshots/logs are dated 10 September 2026 UTC.

## 1. Scope and verification status

This is a handover record based on the deployment conversation, supplied screenshots/logs, and local repository configuration inspected at commit `bc9d3c0`. It is **not a live AWS account audit**. Settings recorded earlier should be checked in the console before operational changes. Local code may be newer than the containers running on EC2.

Passwords, API keys, signing secrets, and encryption-key values are deliberately excluded. Resource identifiers are included for administration; treat this document as internal operational information.

| Component | Last known status |
|---|---|
| New Amplify frontend | Successfully deployed from `AWS-full-stack-demo` after pinning npm to `11.6.2` |
| EC2 Docker stack | Backend, AI, and MCP reported healthy; Caddy running |
| Public API HTTPS | `https://api.studentcarr.com/health` returned HTTP/2 200 with `success: true` and `status: ok` |
| Custom frontend domain | SSL creation and configuration passed; latest screenshot still showed **Domain activation** in progress, not Available |
| Parameter Store loading | 27 parameters loaded into the EC2 environment file; mode `600` confirmed |
| Backups | Script and two-day timer configuration exist; installation, successful upload, and restore have **not been confirmed** |
| Administrator | User confirmed `No admin accounts.`; creation command supplied afterward, but success not yet confirmed |
| Shared AI provider key | Implementation inspected; admin configuration and end-to-end AI use not yet confirmed |
| EC2 resize | Larger instances discussed; no resize confirmed. Record retains original `t4g.small` |

## 2. Service inventory

Primary AWS account: `918520381565`.

Primary region: **Asia Pacific (Sydney), `ap-southeast-2`**. CloudFront delivery and IAM are global services. Amplify's frontend certificate/distribution are managed through Amplify; their exact certificate ARN and distribution ID were not captured.

| Service/component | Purpose | Management |
|---|---|---|
| AWS Amplify Hosting | Build and host the Vite/React frontend | GitHub-connected app |
| Amazon CloudFront | Deliver frontend assets and custom-domain HTTPS | Managed by Amplify |
| AWS Certificate Manager / Amplify-managed certificate | Certificate for frontend root and `www` domains | Requested/managed through Amplify; DNS validation in Cloudflare |
| Amazon EC2 | Run backend, AI, MCP, and Caddy containers | User-managed Linux server |
| Amazon EBS | Persistent OS, application database, uploads, and Docker storage | EC2-attached root volume |
| Amazon VPC, subnet, security group | EC2 network placement and inbound access control | Existing VPC/subnet and dedicated security group |
| EC2 Elastic IP | Stable public IPv4 address for the API | Associated with the EC2 instance |
| AWS IAM | EC2 access to Session Manager, configuration, and backup destination | Instance role |
| AWS Systems Manager Session Manager | Browser-based EC2 shell access | No inbound SSH needed for this access method |
| AWS Systems Manager Parameter Store | Runtime settings and encrypted secrets | `/studentcarr/production/` namespace |
| AWS KMS | Encryption underlying Parameter Store SecureString values | Exact key selection/ARN not recorded |
| Amazon S3 | Store database and uploads backups | Dedicated private bucket |
| AWS CloudShell | Interactive AWS CLI administration, including parameter creation | Console user's permissions; separate from EC2 |
| AWS Budgets | Cost tracking | Earlier setup record notes a USD 10 monthly budget; alert details not captured |
| Cloudflare (not AWS) | Authoritative DNS for `studentcarr.com` | DNS-only records; no Route 53 migration |
| GitHub (not AWS) | Source code and Amplify build trigger | `clu518-sudo/StudentCarr` |
| Docker, Caddy, SQLite, systemd (not AWS services) | Container runtime, API TLS/reverse proxy, database, backup scheduling | Installed/run on EC2 |
| External AI provider (not an AWS service in this setup) | Model inference using administrator-selected credentials | Configured in application admin settings |

Not configured in the documented architecture: Route 53 hosted zone, RDS, ECS/EKS, ECR image registry, API Gateway, ALB, Lambda, Amplify Gen 2 backend, or AWS Secrets Manager. No dedicated CloudWatch log shipping/alarm configuration was demonstrated. Chroma, Google login, and Gmail OAuth are not started/configured by this production Compose stack.

## 3. How the components connect

```text
GitHub: clu518-sudo/StudentCarr / AWS-full-stack-demo
  |
  +-- Amplify build: App/ -> Vite dist/ -> Amplify-managed CloudFront
  |                                        |
  |                                  Browser downloads frontend
  |                                  studentcarr.com / www.studentcarr.com
  |
  +-- Manual git pull + Docker build on EC2 (separate deployment)

Cloudflare DNS
  +-- root and www -> new Amplify CloudFront target
  +-- certificate validation CNAME -> ACM validation target
  +-- api -> Elastic IP 32.236.104.60 -> EC2 security group TCP 80/443
                                             |
Browser's frontend JavaScript -- HTTPS ------> Caddy
                                             |
                                    backend:10001
                                      |     |
                                      |     +--> SQLite + uploaded files on EBS
                                      |
                                      +--> ai:10002 --> external AI provider
                                               |
                                               +--> mcp:10004 --> backend:10001

Administrator -> Session Manager -> EC2 shell
EC2 instance role -> Parameter Store -> deploy/.env.production -> Compose
EC2 systemd backup timer -> SQLite snapshot + uploads archive -> S3
```

Important distinctions:

- Amplify serves the browser application; **the browser calls the API directly**. Amplify is not the API server or reverse proxy in this design.
- Frontend HTTPS terminates at Amplify/CloudFront. API HTTPS terminates separately at Caddy on EC2.
- GitHub pushes can trigger Amplify frontend builds. They do **not** automatically rebuild/restart EC2 containers in the recorded workflow.
- Cloudflare is currently DNS-only: traffic resolves through Cloudflare DNS but is not sent through its HTTP proxy.
- Parameter Store values are fetched by the deployment script, not continuously synchronized. A parameter edit alone does not change a running container.
- SQLite runs on EC2 storage, not RDS. S3 contains backup copies, not the live database.

## 4. Amplify frontend configuration

| Setting | Recorded value |
|---|---|
| App name | `StudentCarr` |
| Current app ID | `d8nsnge07zz6h` |
| Repository | `https://github.com/clu518-sudo/StudentCarr` |
| Production branch | `AWS-full-stack-demo` |
| App root | `App` — case-sensitive |
| Frontend | React with Vite |
| Build command | `npm run build` |
| Output directory | `dist`, relative to `App` |
| Build compute | Standard: 8 GiB RAM, 4 vCPUs, 128 GB disk, as reported by build logs |
| Node reported by Amplify | `22.18.0` |
| npm originally reported | `10.9.3` |
| npm pinned for successful build | `11.6.2` |
| Default URL | `https://aws-full-stack-demo.d8nsnge07zz6h.amplifyapp.com` |
| Custom domains | `studentcarr.com` and `www.studentcarr.com`, both mapped to the production branch |
| Root-to-www redirect | Unchecked during domain setup |
| Certificate | Amplify managed |
| Gen 2 backend | Not enabled; application backend is EC2 |

Environment variables configured during setup:

| Name | Value |
|---|---|
| `AMPLIFY_DIFF_DEPLOY` | `false` |
| `AMPLIFY_MONOREPO_APP_ROOT` | `App` |
| `VITE_API_BASE_URL` | `https://api.studentcarr.com/api` |

`VITE_` values are embedded in the public frontend build. Never put secrets in them. The `/api` suffix is required by the frontend API client.

Successful build configuration supplied in the Amplify console:

```yaml
version: 1
applications:
  - appRoot: App
    frontend:
      phases:
        preBuild:
          commands:
            - npm install --global npm@11.6.2
            - node --version
            - npm --version
            - npm ci --cache .npm --prefer-offline
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: dist
        files:
          - '**/*'
      cache:
        paths:
          - '.npm/**/*'
```

History: the old Amplify app was deleted by the user and this app was recreated. The old production branch was `AWS-demo-deploy`. The earlier default hostname, custom-domain association, and CloudFront target must not be reused as the new deployment target. The build initially failed on a missing `@floating-ui/dom@1.8.0` lockfile entry under npm 10; the user reported success after pinning npm 11.6.2. Local builds used Node 24.12.0 / npm 11.6.2.

## 5. DNS and certificates

DNS stays in Cloudflare. Manual configuration was selected in Amplify; no Route 53 hosted zone or nameserver change is required.

### Target DNS records

These are the targets shown/specified during the latest setup. Final Cloudflare saved values were not independently audited; the later Amplify screenshot showed SSL setup passing and activation in progress.

| Type in Cloudflare | Name | Target | Proxy / TTL |
|---|---|---|---|
| CNAME | `@` | `d20sy61aojwenv.cloudfront.net` | DNS only / Auto |
| CNAME | `www` | `d20sy61aojwenv.cloudfront.net` | DNS only / Auto |
| A | `api` | `32.236.104.60` | DNS only / Auto |
| CNAME | ACM validation hostname beginning `_f70ea74a166c8...` | ACM validation target beginning `_a3d0c0242edeb9...` | DNS only / Auto |

Copy the **complete** certificate-validation hostname and target from Amplify's Domain configuration screen. The abbreviated values above are identifiers, not usable DNS record values. Retain the validation record for certificate renewal. Compare an existing record before adding a duplicate.

Amplify labels the root target ANAME; Cloudflare supports a root CNAME through automatic apex flattening. Do not disable root flattening or enable flattening for all validation records.

The API A record is independent of the frontend CNAMEs. Do not replace it with the CloudFront target.

Certificate ownership:

- Frontend root/www: Amplify-managed certificate with DNS validation.
- API: Caddy automatically obtains/renews its own certificate using `API_DOMAIN` and `CADDY_EMAIL`; issuer not recorded. It is not the Amplify certificate.

Observed incident: domain activation initially failed because DNS still pointed at another CloudFront distribution. After the DNS correction/retry sequence, SSL creation/configuration passed. Final Available status and browser login on the custom domain remain to be confirmed.

## 6. EC2, storage, and networking

| Setting | Recorded value |
|---|---|
| Instance name | `StudentCarrDemoServer` |
| Instance ID | `i-01c773ed920898d9f` |
| Original instance type | `t4g.small` — 2 vCPUs, 2 GiB RAM; no later resize confirmed |
| OS / architecture | Amazon Linux 2023 / `aarch64` (ARM64) |
| OS release shown | `Amazon Linux 2023.12.20260909` |
| Region | `ap-southeast-2` |
| Root EBS | Earlier setup record: 30 GiB, gp3, encrypted; volume ID, IOPS, throughput, and delete-on-termination flag not captured |
| Swap | 2 GiB `/swapfile`; active and recorded in `/etc/fstab` |
| Elastic IP | `32.236.104.60`, recorded name `StudentCarrDemoElasticIP` |
| VPC | `vpc-0154b901f94e4eccc` |
| Subnet | `subnet-021a821094b67dab1` |
| Security group | `StudentCarrDemoWebSG`, `sg-093288c660855a928` |
| Inbound rules | Earlier setup: TCP 80 and 443 from IPv4 `0.0.0.0/0`; no inbound SSH rule |
| Outbound rules | Earlier setup: allow all outbound |
| Instance role | `StudentCarrDemoEc2Role` |
| Metadata | Earlier setup: IMDSv2 required |
| CPU credit setting | Earlier setup: Standard, not Unlimited |
| Protection / shutdown | Earlier setup: termination protection on; stop protection off; shutdown behavior Stop |
| Administration | Session Manager, OS user `ssm-user` |
| Git checkout | `/opt/studentcarr`, branch `AWS-full-stack-demo` |

Exact route-table entries, Internet Gateway ID, IPv6 rules, NACLs, AZ, AMI ID, Elastic IP allocation ID, and disk snapshot policies were not captured. Outbound connectivity was demonstrated by GitHub downloads and Docker pulls; this does not by itself document the route table.

A larger ARM instance (`t4g.medium` 4 GiB or `t4g.large` 8 GiB) was discussed, not implemented/verified. Swap helps with memory pressure but is slower than RAM. It does not override a hard-coded Node heap limit.

### Host software and containers

- Docker reported `25.0.14`; enabled at boot using systemd. Package-install output differed from the CLI version, so verify before relying on the exact patch version.
- Docker Compose plugin `v2.38.2`, ARM64 binary, manually installed at `/usr/local/lib/docker/cli-plugins/docker-compose`; checksum verified.
- Git reported `2.50.1`.
- `ssm-user` added to the `docker` group; new session confirmed Docker commands work without sudo. Docker-group access is highly privileged.
- Compose project name: `studentcarr`; bridge network: `studentcarr_app`.

| Container service | Internal port | Host exposure | Dependencies / role |
|---|---|---|---|
| `backend` | TCP 10001 | None directly | API, auth, database, AI orchestration; runs Prisma migrations before `node src/server.js` |
| `ai` | TCP 10002 | None directly | AI service; waits for healthy MCP |
| `mcp` | TCP 10004 | None directly | Tool service; calls backend via `STUDENTCARR_API_URL` |
| `caddy` | TCP 80/443 | TCP 80/443 | `caddy:2.8-alpine`; waits for healthy backend; proxies to `backend:10001` |

All services use `restart: unless-stopped`. Backend/AI/MCP health checks call `/health`; interval 15 seconds, timeout 5 seconds, 5 retries. Start period is 30 seconds for backend/AI and 15 seconds for MCP. No Caddy healthcheck is defined in this Compose file.

Caddy enables gzip/zstd and `flush_interval -1` for streaming AI responses. UDP 443 is not published by this Compose file, even if the image reports it internally.

Persistent paths:

| Host storage | Container storage | Contents |
|---|---|---|
| `/opt/studentcarr/runtime/backend-data` | `/app/data` | SQLite `studentcarr.db` and associated database files |
| `/opt/studentcarr/runtime/uploads` | `/app/uploads` | Uploaded documents |
| Docker volume `studentcarr_caddy_data` | `/data` | Caddy certificate/account state |
| Docker volume `studentcarr_caddy_config` | `/config` | Caddy configuration state |

The AI Docker build uses a 512 MiB Node heap and TypeScript `--noCheck --noResolve` to emit JavaScript. Full type checking must be run locally before deployment using `npm --prefix AIServices run typecheck`. This avoids the previous 1.5 GiB compiler out-of-memory failure; it does not replace semantic type checking.

## 7. IAM and Systems Manager

### EC2 instance role: StudentCarrDemoEc2Role

Earlier setup recorded the following access; exact inline policy names/JSON and KMS key policy were not captured:

- AWS-managed `AmazonSSMManagedInstanceCore` for Systems Manager access.
- `ssm:GetParameter`, `ssm:GetParameters`, and `ssm:GetParametersByPath` for `/studentcarr/production/*` in the account/region.
- `s3:PutObject` and `s3:AbortMultipartUpload` for objects in `studentcarr-demo-backup`.

Do not assume this grants S3 list/read/restore access. Restore operations may require separately authorized `s3:GetObject` permissions. Customer-managed KMS keys may also require explicit decrypt/key-policy access; no such key configuration was verified.

### Session Manager versus CloudShell

- **Session Manager:** command execution on the EC2 machine. Use it for `/opt/studentcarr`, Docker, local files, and systemd.
- **CloudShell:** separate AWS-managed shell using the console identity. Used to create Parameter Store entries. CloudShell files and installed processes are not EC2 files/processes.
- The CloudShell identity can have different permissions from the EC2 role. A successful CloudShell command does not prove EC2 has the same access.

### Parameter Store

Namespace: `/studentcarr/production/`; region `ap-southeast-2`; Standard tier. Non-secret configuration uses String; sensitive values use SecureString.

The following values were recorded during setup, not reread from AWS for this document:

| Parameter suffix | Type | Recorded value / purpose |
|---|---|---|
| `NODE_ENV` | String | `production` |
| `DATABASE_URL` | String | `file:/app/data/studentcarr.db` — no password in this SQLite URL |
| `CORS_ORIGIN` | String | `https://studentcarr.com,https://www.studentcarr.com` |
| `APP_BASE_URL` | String | `https://studentcarr.com` |
| `APP_DOMAIN` | String | `studentcarr.com`; required by loader, not directly consumed in current Compose environment mappings |
| `API_DOMAIN` | String | `api.studentcarr.com` |
| `CADDY_EMAIL` | String | Administrator's reachable email; intentionally omitted here |
| `ACCESS_TOKEN_TTL` | String | `15m` |
| `REFRESH_TOKEN_TTL` | String | `30d` |
| `REFRESH_COOKIE_NAME` | String | `refresh_token` |
| `PROGRESS_TRACKING_SERVICE_BASE_URL` | String | `http://ai:10002` |
| `PROFILE_GENERATION_SERVICE_URL` | String | `http://ai:10002/generate-profile` |
| `MCP_SERVER_URL` | String | `http://mcp:10004` |
| `STUDENTCARR_API_URL` | String | `http://backend:10001` |
| `DOCUMENT_PARSER_CONCURRENCY` | String | `1` |
| `DOCUMENT_PARSER_MIN_CHARACTERS` | String | `200` |
| `DOCUMENT_PARSER_RENDER_SCALE` | String | `1.5` |
| `OPENAI_MODEL` | String | `gpt-4.1-mini` fallback setting; admin-selected model may differ |
| `OPENAI_TIMEOUT_MS` | String | `45000` |
| `OPENAI_MAX_RETRIES` | String | `2` |
| `CHAT_MAX_STEPS` | String | `8` |
| `CHAT_TURN_TIMEOUT_MS` | String | `60000` |
| `MCP_TOOLS_TIMEOUT_MS` | String | `10000` |
| `JWT_ACCESS_SECRET` | SecureString | Random signing secret; value omitted |
| `JWT_REFRESH_SECRET` | SecureString | Random signing secret; value omitted |
| `FIELD_ENCRYPTION_KEY` | SecureString | 32 random bytes represented as 64 hexadecimal characters; value omitted |
| `MCP_TOKEN_SECRET` | SecureString | Random signing secret; value omitted |

Loader: `deploy/load-ssm-env.sh` calls Parameter Store recursively with decryption and writes `/opt/studentcarr/deploy/.env.production`. Observed file owner: `ssm-user:ssm-user`; permissions `0600`. It validates required fields and the encryption-key format. Decrypted values exist locally in this protected file and container environments; they are not encrypted there simply because their Parameter Store type is SecureString.

After a setting changes, reload the file and recreate affected containers. A plain Docker restart does not import newly changed Compose environment values. Never commit the generated file or print it in shared logs.

## 8. Administrator and shared AI settings

- No default admin login/password is created automatically.
- `Backend/scripts/grant-admin.js --list` returned `No admin accounts.` on EC2, according to the user.
- The script can create a new admin with email/password or promote an existing account. Admin creation was instructed but not confirmed.
- Do not promote a temporary demo account: it retains demo-expiry behavior.
- Admin credentials and AI credentials are application data, not IAM identities.
- Admin-only LLM settings allow saving/selecting a provider, model, optional base URL, and key. Keys are stored encrypted in SQLite using `FIELD_ENCRYPTION_KEY`.
- Current effective-key logic: use the user's selected key if one exists; administrators otherwise receive no fallback. A non-admin without an own key falls back to the **earliest-created admin's** selected key. With multiple admins, the application does not search every admin for a usable selected key.
- An environment-wide `OPENAI_API_KEY` was not created for the intended shared-admin workflow. Compose permits optional fallback environment values, but other legacy integrations may have separate requirements.
- Preserve `FIELD_ENCRYPTION_KEY` alongside recoverable database backups. Replacing it without a key migration can make saved AI credentials unreadable.

The production refresh cookie is `HttpOnly`, `Secure`, `SameSite=Strict`, scoped to `/api/auth`. The Amplify preview hostname is cross-site relative to `api.studentcarr.com`; it was also absent from the recorded CORS allowlist. A preview network error was observed, but browser-console confirmation of its exact cause was not provided. Full login testing is intended on the custom root/www domains.

## 9. S3 backup configuration

| Setting | Recorded configuration |
|---|---|
| Bucket | `studentcarr-demo-backup` |
| Operational region | `ap-southeast-2` |
| Public access | Earlier setup: blocked |
| Encryption | Earlier setup: SSE-S3 |
| Versioning | Earlier setup: enabled |
| Current-object expiration | Earlier setup: 14 days |
| Noncurrent-version expiration | Earlier setup: 1 day |
| Incomplete multipart cleanup | Earlier setup: 7 days |
| Upload key pattern | `backups/<UTC timestamp>/studentcarr.db` and `backups/<UTC timestamp>/uploads.tar.gz` |

Implementation: `deploy/backup.sh` uses Python's SQLite online backup API for a transactionally consistent database snapshot and tar for uploaded files, then uploads both objects to S3. Missing uploads produce an empty archive. The two objects are uploaded separately; success of only one upload is not a complete backup. The database snapshot and uploaded-file archive are not a single coordinated transaction.

Timer installation: `deploy/install-backup-timer.sh` creates `studentcarr-backup.service` and `studentcarr-backup.timer`.

```ini
[Timer]
OnStartupSec=15min
OnUnitActiveSec=2d
AccuracySec=5min
RandomizedDelaySec=15min
Unit=studentcarr-backup.service
```

This is approximately a 48-hour interval plus a startup-triggered run, with scheduling tolerance/random delay. It is not a fixed calendar-day schedule or guaranteed missed-run catch-up. Reboots and manual runs affect the observed cadence. Fourteen-day retention gives roughly seven regular generations, potentially more with startup/manual runs.

Not included by this backup script: Parameter Store export, the encryption key, Caddy volumes, OS settings, or a complete EBS image. Backup scheduling and a real restore test are still unverified. S3 lifecycle/versioning is not a substitute for tested recovery.

## 10. Operational commands

Run the following on **EC2 through Session Manager**, not CloudShell, unless stated otherwise. Review deployment changes before applying them.

### Read-only checks

```bash
cd /opt/studentcarr
docker compose --env-file deploy/.env.production -f docker-compose.production.yml ps -a
curl -i --connect-timeout 10 --max-time 30 https://api.studentcarr.com/health
docker compose --env-file deploy/.env.production -f docker-compose.production.yml exec -T backend node scripts/grant-admin.js --list
systemctl list-timers studentcarr-backup.timer --no-pager
sudo journalctl -u studentcarr-backup.service -n 30 --no-pager
```

### Apply a reviewed EC2 deployment

First run full AI type checking locally for the deployed revision. The commands below update source/configuration and recreate containers; they can cause brief downtime and run database migrations. Obtain a successful backup before a database-affecting update.

```bash
cd /opt/studentcarr
git pull --ff-only origin AWS-full-stack-demo
bash deploy/load-ssm-env.sh
docker compose --env-file deploy/.env.production -f docker-compose.production.yml config --quiet
docker compose --progress plain --env-file deploy/.env.production -f docker-compose.production.yml build
docker compose --env-file deploy/.env.production -f docker-compose.production.yml up -d
```

Do not run `docker compose config` without `--quiet` in shared output: resolved configuration can expose secrets. Do not delete `runtime/` or use `down -v` as routine troubleshooting.

### Enable and test backups — not yet confirmed executed

```bash
cd /opt/studentcarr
bash deploy/install-backup-timer.sh
sudo systemctl start studentcarr-backup.service
sudo journalctl -u studentcarr-backup.service -n 30 --no-pager
systemctl list-timers studentcarr-backup.timer --no-pager
```

Expected success log: `Backup uploaded to s3://studentcarr-demo-backup/backups/.../`. Verify both objects in the S3 console and perform a separate controlled restore test before relying on recovery.

## 11. Remaining acceptance checks

- [ ] Amplify custom-domain status reaches Available for root and www.
- [ ] Confirm saved Cloudflare targets against current Amplify Domain configuration.
- [ ] Test homepage and direct `/login` navigation/refresh; verify SPA rewrite behavior if a direct route returns 404.
- [ ] Test demo creation/login on `https://studentcarr.com`; inspect request URL/CORS if it fails.
- [ ] Confirm permanent admin creation, then configure/select the shared AI provider key.
- [ ] Test a normal user's AI chat and relevant document/profile flows with admin-selected credentials.
- [ ] Confirm two-day backup timer enabled and both S3 backup objects uploaded.
- [ ] Test database/uploads recovery with access to the original field-encryption key.
- [ ] Confirm current EC2 type, EBS details, IAM policy scope, and S3 lifecycle in AWS.
- [ ] Review monthly costs; the recorded budget is an alerting control, not a spending cap.
- [ ] Review reported frontend dependency vulnerabilities separately; do not blindly use `npm audit fix --force` during deployment.

## 12. Reference sources

Account-specific details above come from supplied deployment evidence and repository configuration, not from these generic references.

- [Amplify monorepo configuration](https://docs.aws.amazon.com/amplify/latest/userguide/monorepo-configuration.html)
- [Amplify environment variables](https://docs.aws.amazon.com/amplify/latest/userguide/setting-env-vars.html)
- [Amplify custom domains with third-party DNS](https://docs.aws.amazon.com/amplify/latest/userguide/to-add-a-custom-domain-managed-by-a-third-party-dns-provider.html)
- [CloudFront DNS/alias troubleshooting](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/troubleshooting-distributions.html)
- [Cloudflare apex CNAME flattening](https://developers.cloudflare.com/dns/cname-flattening/set-up-cname-flattening/)
- [npm 11.6.2 package and supported Node engines](https://github.com/npm/cli/blob/v11.6.2/package.json)
- [Browser fetch credentials and SameSite behavior](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)

Repository files inspected: `docker-compose.production.yml`, `Caddyfile`, `deploy/load-ssm-env.sh`, `deploy/backup.sh`, `deploy/install-backup-timer.sh`, `deploy/README.md`, `Backend/Dockerfile`, `Backend/scripts/grant-admin.js`, `Backend/src/lib/cookies.js`, `Backend/src/llmSettings/llmSettings.service.js`, and `App/src/lib/apiClient.js`.
