# frontend/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy dependency manifests first (for better caching)
COPY package*.json ./
RUN npm install

# Copy the rest of the source code
COPY . .

# Expose Vite's default port
EXPOSE 5173

# Start the dev server, binding to all interfaces so it's reachable from the host
CMD ["npm", "run", "dev", "--", "--host"]