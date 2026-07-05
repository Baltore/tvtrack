# Image de production du backend TVTrack.
FROM node:20-alpine

WORKDIR /app

# Installe uniquement les dépendances de production (cache optimisé).
COPY package*.json ./
RUN npm ci --omit=dev

# Copie le code source.
COPY . .

ENV NODE_ENV=production
EXPOSE 5000

# Lance le serveur (l'hébergeur injecte PORT, MONGODB_URI, JWT_SECRET, CORS_ORIGIN).
CMD ["node", "server.js"]
