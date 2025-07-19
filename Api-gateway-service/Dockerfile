# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy only package files and install dependencies
COPY pnpm-lock.yaml ./
COPY package.json ./
RUN pnpm install --frozen-lockfile

COPY . .

# Build the project
RUN pnpm build

# Stage 2: Production
FROM node:22-alpine

WORKDIR /app

RUN npm install -g pnpm

# Copy only what's needed for runtime
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]