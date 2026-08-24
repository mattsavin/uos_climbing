FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy all files
COPY . .

# Build frontend and backend
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy built artifacts and necessary files from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/backend ./backend

# Directory for SQLite database to persist
RUN mkdir -p /data

# Expose port
EXPOSE 3000

# Container self-reports health via the /api/health probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Run the backend server
CMD ["npm", "start"]
