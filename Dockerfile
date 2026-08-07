FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci
RUN npx playwright install --with-deps chromium

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
