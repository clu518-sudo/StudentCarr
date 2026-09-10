# Production Docker deployment

This stack is for the EC2 host. Amplify continues to build and host `App/`.
It deliberately does not start Chroma, Google login, or Gmail OAuth.

## First server start

Before each deployment, run `npm --prefix AIServices run typecheck` on the
development machine for the revision being deployed. The AI Docker build
uses TypeScript's `--noCheck --noResolve` emit mode with a 512 MiB heap limit because full
type checking exceeds the small EC2 host's memory budget. This still compiles
the application to JavaScript and reports parse/emit errors; semantic type
checking is a required separate pre-deployment step. All application TypeScript
files are included explicitly by `src/**/*.ts`; dependency declarations are
not followed during the Docker compilation.

1. Load the production configuration from Parameter Store. The EC2 instance
   role must be able to read `/studentcarr/production/*`:

   ```sh
   bash deploy/load-ssm-env.sh
   ```

   This writes `deploy/.env.production` atomically with mode `0600`, validates
   required settings, and never prints secret values. For an offline/local
   test, copy `.env.production.example` to `.env.production` and replace every
   placeholder instead.
2. Point `API_DOMAIN` at the EC2 Elastic IP and ensure ports 80 and 443 are
   open before starting Caddy, so it can obtain its TLS certificate.
3. Start the stack from the repository root:

   ```sh
   docker compose --env-file deploy/.env.production -f docker-compose.production.yml up -d --build
   ```

4. Verify the private services and public API:

   ```sh
   docker compose --env-file deploy/.env.production -f docker-compose.production.yml ps
   curl https://api.example.com/health
   ```

SQLite data is stored in `runtime/backend-data/`, and uploaded PDFs are stored
in `runtime/uploads/`. Back up both directories. Do not delete them during a
deployment.

## Backups

Install the systemd timer after the first successful stack start:

```sh
bash deploy/install-backup-timer.sh
```

The timer runs every two days. Each run uses SQLite's online backup API to
create a consistent database snapshot, archives the uploads directory, and
uploads both objects under a timestamped `backups/` prefix in
`s3://studentcarr-demo-backup`. With the bucket's 14-day lifecycle, this keeps
approximately seven scheduled backup generations.

Run and inspect a backup immediately with:

```sh
sudo systemctl start studentcarr-backup.service
sudo journalctl -u studentcarr-backup.service -n 100 --no-pager
```

## Updates

After updating the checked-out branch on EC2, rebuild and restart with the
same commands: refresh `deploy/.env.production` with `load-ssm-env.sh`, then
run `docker compose ... up -d --build`. Prisma migrations run before the
Backend starts; if migration fails, the Backend container does not start.
