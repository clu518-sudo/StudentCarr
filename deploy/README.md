# Production Docker deployment

This stack is for the EC2 host. Amplify continues to build and host `App/`.
It deliberately does not start Chroma, Google login, or Gmail OAuth.

## First server start

1. Copy `.env.production.example` to `.env.production` and replace every
   placeholder secret and domain value. `FIELD_ENCRYPTION_KEY` must be a
   64-character hexadecimal key; generate it with `openssl rand -hex 32`.
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

## Updates

After updating the checked-out branch on EC2, rebuild and restart with the
same `docker compose ... up -d --build` command. Prisma migrations run before
the Backend starts; if migration fails, the Backend container does not start.
