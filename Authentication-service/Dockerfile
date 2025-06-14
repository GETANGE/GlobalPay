FROM node:23-alpine

WORKDIR /app

COPY package*.json ./

# Install pnpm
RUN npm install -g pnpm 

RUN pnpm install 

COPY . .

EXPOSE 3001

# Start the application.
CMD ["pnpm", "start"]