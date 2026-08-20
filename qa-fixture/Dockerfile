FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY qa-fixture ./qa-fixture

CMD ["npx", "tsx", "qa-fixture/server.ts"]
