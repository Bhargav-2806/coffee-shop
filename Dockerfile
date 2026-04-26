# =============================================================================
#  Dockerfile — The London Brew (Coffee Shop)
#  Pattern : Multi-stage build → lean production image
#  Port    : 8080
# =============================================================================

# ── STAGE 1: BUILDER ─────────────────────────────────────────────────────────
# Use Node.js 20 Alpine as build environment (lightweight, ~50MB)
FROM node:20-alpine AS builder

# Set working directory inside the container
WORKDIR /app

# Copy package files first to leverage Docker layer caching
COPY package*.json ./

# Install all dependencies including devDependencies needed for build
RUN npm ci --frozen-lockfile

# Copy the rest of the source code
COPY . .

# Compile TypeScript and bundle React app → outputs to /app/dist
RUN npm run build


# ── STAGE 2: PRODUCTION ──────────────────────────────────────────────────────
# Fresh minimal image — build tools and devDependencies never ship
FROM node:20-alpine AS production

# Create a non-root system user and group to run the app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Set working directory
WORKDIR /app

# Copy package files to install production dependencies only
COPY package*.json ./

# Install only production dependencies — no TypeScript, Vite, etc.
RUN npm ci --omit=dev --frozen-lockfile

# Copy compiled frontend from builder stage
COPY --from=builder /app/dist ./dist

# Copy backend server source code
COPY server ./server

# Transfer file ownership to non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user — never run as root in production
USER appuser

# Set production mode for Node.js/Express optimisations
ENV NODE_ENV=production

# Set the port the server listens on
ENV PORT=8080

# Image metadata for auditing and governance
LABEL maintainer="bhargavsaiteja2806@gmail.com" \
      app="coffee-shop" \
      version="1.0.0"

# Document the port exposed by this container
EXPOSE 8080

# Health check — Docker and Kubernetes use this to verify the app is alive
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1));"

# Start the server using exec form — ensures PID 1 receives OS signals
CMD ["node", "server/server.js"]
