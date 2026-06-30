FROM nginx:1.27-alpine AS development

COPY proxy/nginx.dev.conf /etc/nginx/conf.d/default.conf

FROM node:24-alpine AS frontend-build

WORKDIR /app

COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

RUN npm ci

COPY . .

RUN npm run build -w bookshelf-frontend

FROM nginx:1.27-alpine AS production

COPY proxy/nginx.prod.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /app/frontend/dist/bookshelf-frontend/browser /usr/share/nginx/html
