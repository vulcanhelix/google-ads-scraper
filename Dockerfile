# Use the official Playwright image to ensure all browser dependencies are installed
# Must match the playwright version in package.json
FROM mcr.microsoft.com/playwright:v1.40.1-jammy

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for build)
RUN npm ci

# Copy Prisma schema and generating client
COPY prisma ./prisma/
# Set explicit output for Docker environment to avoid caching issues
ENV PRISMA_CLIENT_OUTPUT="../node_modules/.prisma/client"
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript to JavaScript
RUN npm run build

# Expose the API port
EXPOSE 3000

# Start the API server
# We use the built JS files for production
CMD ["node", "dist/api/server.js"]
