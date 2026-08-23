# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG VITE_API_URL=https://clinicflow-api.dwsolucoes.tech
RUN VITE_API_URL="${VITE_API_URL}" npm run build

FROM caddy:2-alpine AS final
COPY deploy/vps/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=5 \
  CMD wget --quiet --output-document=/dev/null http://127.0.0.1:8080/ || exit 1
