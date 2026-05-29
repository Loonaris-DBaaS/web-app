# syntax=docker/dockerfile:1

# ---- Build stage: install everything, generate Prisma client, compile TS ----
FROM node:22-alpine AS builder
WORKDIR /app

# Install ALL deps (incl. prisma CLI + typescript) needed for codegen and build
COPY package.json package-lock.json ./
RUN npm ci

# Prisma needs the schema + config to generate the client into src/generated
COPY prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

# Generate the Prisma client, then compile TS (tsc) and rewrite @/ aliases (tsc-alias)
RUN npx prisma generate
RUN npm run build

# Strip dev dependencies so the runtime image carries only prod node_modules
RUN npm prune --omit=dev

# ---- Runtime stage: lean image, prod deps + compiled output only ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

EXPOSE 3001
USER node
CMD ["node", "dist/index.js"]
