# Builds the React site in Live mode and serves it, with the API, from one container.
FROM node:22-alpine AS web
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY src ./src
RUN VITE_LIVE=1 npx vite build

FROM node:22-alpine
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./
COPY --from=web /app/dist /app/dist
ENV NODE_ENV=production FRONTEND_DIR=../dist DB_FILE=/data/gbl80s.db UPLOAD_DIR=/data/uploads BACKUP_DIR=/data/backups
VOLUME /data
EXPOSE 3000
HEALTHCHECK CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["npm","start"]
