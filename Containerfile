# Single-container DreamTeam app (API + web). Ollama stays on the host.
FROM docker.io/library/node:22-bookworm-slim

WORKDIR /app

# Install workspace deps first (better layer cache)
COPY package.json package-lock.json ./
COPY packages/api/package.json packages/api/
COPY packages/web/package.json packages/web/
RUN npm install

COPY . .

ENV NODE_ENV=development
ENV PORT=3001
ENV API_PORT=3001
ENV WEB_PORT=5173
ENV API_URL=http://127.0.0.1:3001
# Override at runtime to reach host Ollama, e.g. http://host.containers.internal:11434
ENV OLLAMA_URL=http://host.containers.internal:11434
ENV OLLAMA_MODEL=llama3.2
ENV HOST_OS_LABEL=unknown

EXPOSE 5173 3001

# Vite must bind all interfaces inside the container
CMD ["npm", "run", "dev:container"]
