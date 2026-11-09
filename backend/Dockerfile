# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
ENV PRISMA_HIDE_UPDATE_MESSAGE=1
# O schema engine do Prisma (usado no migrate deploy) depende do OpenSSL.
RUN apk add --no-cache openssl

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY prisma.config.ts ./
COPY prisma ./prisma
COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh ./
# Remove CRLF caso o repositório tenha sido clonado no Windows com autocrlf.
RUN sed -i 's/\r$//' docker-entrypoint.sh && chown -R node:node /app
USER node

EXPOSE 3333
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3333/api/health || exit 1

CMD ["sh", "docker-entrypoint.sh"]
