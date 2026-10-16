# Ortenau Guesser - Docker Configuration (`config/`)

## Selected Base Image
- **Image**: `node:22-alpine`
- **Rationale**:
  - **Node.js 22 LTS**: Provides native global `fetch` and `AbortSignal.timeout` support required by `Backend/Geoservices/osmService.js` to query OpenStreetMap APIs (Overpass, Nominatim, Panoramax) without extra HTTP client bloat.
  - **Alpine Linux**: Minimal footprint (~50MB compressed) with low attack surface and fast startup times.
  - **Single-Container Architecture**: Since `Backend/server.js` serves both the static `Frontend/` assets (`index.html`, `style.css`, `app.js`) and the `/api/*` endpoints, no separate Nginx reverse-proxy container or database container (first implementation is singleplayer without persistence) is needed.

## Container Directory Layout
- `/app/Backend` (`WORKDIR`): Contains `package.json`, `server.js`, `node_modules/`, and `Geoservices/`.
- `/app/Frontend`: Contains `index.html`, `style.css`, and `app.js`.
- Preserves the relative path `path.join(__dirname, '../Frontend')` between `Backend` and `Frontend`.

## Usage Commands
```bash
# Build and start the container in the foreground
docker compose up --build

# Build and start in detached mode
docker compose up -d --build

# Stop the service
docker compose down
```
