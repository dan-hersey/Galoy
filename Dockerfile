FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/

# Create data directory for persistence
RUN mkdir -p /app/data

ENV DATA_DIR=/app/data
ENV NODE_ENV=production

EXPOSE 3000

CMD ["npx", "tsx", "src/index.ts"]
