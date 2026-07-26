FROM node:20-slim AS builder

WORKDIR /app

# Install all dependencies including devDependencies for build
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

FROM node:20-slim

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built artifacts from the builder stage
COPY --from=builder /app/dist ./dist

EXPOSE 5050

CMD ["node", "dist/server.js"]
