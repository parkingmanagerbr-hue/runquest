FROM node:20-alpine AS deps
WORKDIR /app
COPY apps/web/package.json apps/web/tsconfig.json apps/web/next.config.mjs apps/web/tailwind.config.ts apps/web/postcss.config.js ./
RUN npm install --no-audit --no-fund

FROM deps AS build
COPY apps/web/src ./src
COPY apps/web/public ./public
ARG NEXT_PUBLIC_API_URL=https://runquest.veloxisit.com.br/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node","server.js"]
