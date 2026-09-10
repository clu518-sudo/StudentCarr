FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
COPY scripts ./scripts
RUN mkdir -p /app/data /app/uploads/profile

EXPOSE 10001
CMD ["node", "src/server.js"]
