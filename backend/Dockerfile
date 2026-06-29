FROM node:24-alpine AS base

WORKDIR /app

COPY package*.json ./
COPY backend/package*.json ./backend/

FROM base AS development

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "start:dev", "-w", "backend"]

FROM base AS build

RUN npm ci

COPY . .

RUN npm run build -w backend

FROM base AS production

ENV NODE_ENV=production

RUN npm ci --omit=dev

COPY --from=build /app/backend/dist ./backend/dist

EXPOSE 3000

CMD ["npm", "run", "start:backend:prod"]
