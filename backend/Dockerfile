FROM node:24-alpine AS base

WORKDIR /app

COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

FROM base AS development

RUN npm install

COPY . .

RUN NODE_TLS_REJECT_UNAUTHORIZED=0 npm run prisma:generate -w backend

EXPOSE 3000

CMD ["npm", "run", "start:dev", "-w", "backend"]

FROM base AS build

RUN npm ci

COPY . .

RUN NODE_TLS_REJECT_UNAUTHORIZED=0 npm run prisma:generate -w backend && npm run build -w backend

FROM base AS production

ENV NODE_ENV=production

RUN npm ci --omit=dev

COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/data ./data
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3000

CMD ["npm", "run", "start:backend:prod"]
