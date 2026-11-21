# Stag Fitness web — builds the React PWA, then Caddy serves it, proxies /api to the API container
# and gets / renews the HTTPS certificate (Let's Encrypt) by itself.
FROM node:20-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM caddy:2.8-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /src/dist /srv
