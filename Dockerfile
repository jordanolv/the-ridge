FROM node:22-slim

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY activity/package.json activity/package-lock.json ./activity/
RUN npm --prefix activity ci

COPY . .
RUN npm run build && npm --prefix activity run build

CMD ["node", "dist/index.js"]
