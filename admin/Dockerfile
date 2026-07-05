FROM node:20-alpine

WORKDIR /app

# Install deps first for better layer caching
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# Source mounted at runtime via compose; this COPY is here so a plain
# `docker build` still produces a runnable image without the mount.
COPY . .

EXPOSE 5173

# Vite dev server. --host binds 0.0.0.0 so the container is reachable
# from the host, and CHOKIDAR_USEPOLLING (set in compose) handles the
# file-watch quirk on Windows/mounted volumes.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]