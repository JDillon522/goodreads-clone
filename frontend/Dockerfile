FROM node:24-alpine AS base

WORKDIR /app

COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

FROM base AS development

RUN npm install

COPY . .

EXPOSE 4200

CMD ["npm", "run", "start", "-w", "bookshelf-frontend", "--", "--host", "0.0.0.0", "--port", "4200", "--poll", "2000"]

FROM base AS build

RUN npm ci

COPY . .

RUN npm run build -w bookshelf-frontend
