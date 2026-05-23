FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++ openssl
COPY apps/api/package.json apps/api/tsconfig.json apps/api/nest-cli.json ./
COPY apps/api/prisma ./prisma
RUN npm install --no-audit --no-fund

FROM deps AS build
COPY apps/api/src ./src
COPY tsconfig.base.json /tsconfig.base.json
RUN npx prisma generate && npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY apps/api/package.json ./
COPY apps/api/prisma ./prisma
RUN npm install --omit=dev --no-audit --no-fund && npx prisma generate
COPY --from=build /app/dist ./dist
EXPOSE 4000
CMD ["sh","-c","npx prisma migrate deploy && node dist/main.js"]
