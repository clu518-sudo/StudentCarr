FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY tsconfig.json ./
COPY src ./src
# Node derives a roughly 1 GiB heap limit on the small ARM deployment host.
# TypeScript needs slightly more for the LangChain type graph; the EC2 host
# has a 2 GiB swap file specifically to absorb this temporary build peak.
RUN NODE_OPTIONS=--max-old-space-size=1536 npx tsc
RUN npm prune --omit=dev --legacy-peer-deps && npm cache clean --force

FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 10002
CMD ["node", "dist/src/server.js"]
