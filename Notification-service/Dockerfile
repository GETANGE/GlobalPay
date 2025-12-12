FROM node:22-alpine

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy package files
COPY pnpm-lock.yaml ./
COPY package.json ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy full project
COPY . .

# Expose port
EXPOSE 3006

# Run TypeScript directly using ts-node or tsx
CMD ["pnpm", "prod"]
