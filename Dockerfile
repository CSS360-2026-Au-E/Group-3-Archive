FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install --no-audit --no-fund

COPY . .

RUN npm run build

FROM node:22-bookworm-slim AS prod

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
COPY --from=builder /app/build /app/build

RUN npm install --omit=dev --no-audit --no-fund

ENTRYPOINT [ "npm", "run", "prod" ]
