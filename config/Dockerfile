# Ortenau Guesser - Production Dockerfile
# Base image: Official lightweight Node.js 22 LTS on Alpine Linux
FROM node:22-alpine

LABEL org.opencontainers.image.title="Ortenau Guesser"
LABEL org.opencontainers.image.description="GeoGuessr-style game explicitly fixed to the Ortenau region (Baden-Württemberg, Germany) powered by OpenStreetMap APIs"
LABEL org.opencontainers.image.vendor="Ortenau Guesser"

# Runtime environment configuration
ENV NODE_ENV=production
ENV PORT=3000
ENV OSM_USER_AGENT="OrtenauGuesser/1.0 (Baden-Wuerttemberg GeoGame)"

# Mirror local repository layout (/app/Backend and /app/Frontend)
# so path.join(__dirname, '../Frontend') in Backend/server.js resolves to /app/Frontend
WORKDIR /app/Backend

# Copy Backend package manifests and install production dependencies
COPY --chown=node:node Backend/package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy Backend application code (including Backend/Geoservices/) and Frontend static files
COPY --chown=node:node Backend/ /app/Backend/
COPY --chown=node:node Frontend/ /app/Frontend/

# Switch to built-in non-root user for security
USER node

# Expose application HTTP port
EXPOSE 3000

# Container healthcheck hitting the Express health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Start the Ortenau Guesser server
CMD ["node", "server.js"]
