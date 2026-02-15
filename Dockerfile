# Use Apify's official Node.js + Playwright image (Node 20)
FROM apify/actor-node-playwright-chrome:20

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Set dummy env vars for Prisma build only (runtime will use real secrets)
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV DIRECT_URL="postgresql://build:build@localhost:5432/build"

# Build the TypeScript code
RUN npm run build

# Run the actor
# We use 'node dist/actor.js' assuming the build outputs there
# Run the actor
# We use 'node dist/actor.js' assuming the build outputs there
CMD [ "node", "dist/actor.js" ]
