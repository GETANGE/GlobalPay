# Use a Bun base image
FROM oven/bun:latest

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and bun.lockb to leverage Docker's layer caching
COPY package.json bun.lockb ./

# Install dependencies using bun install
RUN bun install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Expose the port your application listens
EXPOSE 3002

# Command to run the Bun application
CMD ["bun", "run", "start"]