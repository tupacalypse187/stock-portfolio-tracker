# --- Frontend build stage ---
FROM node:18-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci   # Install ALL deps, not just production, so react-scripts is present

COPY frontend/ .
RUN npm run build

# --- Backend build stage ---
FROM node:18-alpine AS backend-build

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --only=production

COPY backend/ .

# --- Production image ---
FROM node:18-alpine AS production

WORKDIR /app

# Copy backend code
COPY --from=backend-build /app/backend .

# Copy frontend build outputs into /public
COPY --from=frontend-build /app/frontend/build ./public

# (Optional) Create a non-root user
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001 \
    && chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3001

CMD ["node", "server.js"]
    