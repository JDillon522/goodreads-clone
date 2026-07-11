FROM node:24-alpine AS base

WORKDIR /app

COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

FROM base AS development

RUN npm install

COPY . .

# Prisma loads prisma.config.ts during generation even though it does not connect to Postgres.
# Compose injects the real DATABASE_URL only when the container starts, so use a non-secret,
# syntactically valid build-only URL here and keep strict runtime configuration validation intact.
RUN if [ -f /app/certs/local-ca.pem ]; then export NODE_EXTRA_CA_CERTS=/app/certs/local-ca.pem; fi; \
    DATABASE_URL=postgresql://prisma:prisma@localhost:5432/prisma?schema=public npm run prisma:generate -w backend

EXPOSE 3000

CMD ["npm", "run", "start:dev", "-w", "backend"]

FROM base AS build

RUN npm ci

COPY . .

RUN if [ -f /app/certs/local-ca.pem ]; then export NODE_EXTRA_CA_CERTS=/app/certs/local-ca.pem; fi; \
    DATABASE_URL=postgresql://prisma:prisma@localhost:5432/prisma?schema=public npm run prisma:generate -w backend && npm run build -w backend

FROM base AS production

ENV NODE_ENV=production

RUN npm ci --omit=dev

COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/data ./data
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3000

CMD ["npm", "run", "start:backend:prod"]
