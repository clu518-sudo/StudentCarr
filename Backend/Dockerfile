FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
# @langchain/community declares an optional Browserbase peer that still
# targets Zod 3. The application uses Zod 4, so install the locked dependency
# graph without asking npm to re-resolve that optional peer relationship.
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
COPY scripts ./scripts
RUN mkdir -p /app/data /app/uploads/profile

EXPOSE 10001
CMD ["node", "src/server.js"]
