FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY tsconfig.json ./
COPY src ./src
# Full type checking must pass on the development machine before deployment
# (npm run typecheck). Emit JavaScript here without loading the large type
# graph into the 2 GiB EC2 host. Parse/emit errors still fail the build.
# All source files are included by tsconfig; --noResolve avoids following
# imports into dependency declarations while emitting those source files.
RUN node --max-old-space-size=512 node_modules/typescript/bin/tsc --noCheck --noResolve
RUN npm prune --omit=dev --legacy-peer-deps && npm cache clean --force

FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 10002
CMD ["node", "dist/src/server.js"]
