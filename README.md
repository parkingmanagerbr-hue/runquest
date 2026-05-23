# RunQuest

App de corrida gamificado — territórios H3, missões, XP, **Personal Trainer IA** (Premium).

## Stack

- **Monorepo:** pnpm workspaces (`apps/api`, `apps/web`, `packages/shared`)
- **Backend:** NestJS 10 + Prisma + PostgreSQL + JWT + Passport (Google OAuth) + Mercado Pago SDK
- **Frontend:** Next.js 14 (App Router) + Tailwind + PWA + Zustand
- **Arquitetura:** DDD / Clean Architecture / SOLID
  - `domain/` — entidades, VOs, ports (interfaces)
  - `application/` — use cases, services
  - `infrastructure/` — adapters (Prisma, MP, Passport)
  - `presentation/` — controllers, DTOs
- **Testes:** Jest (unit) + supertest (e2e backend) + Playwright (e2e frontend) + Vitest (unit frontend)

## Estrutura

```
runquest/
├── apps/
│   ├── api/                        NestJS backend
│   │   ├── prisma/schema.prisma
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── auth/            DDD completo (email/senha + Google)
│   │       │   ├── subscriptions/   Mercado Pago via API key
│   │       │   ├── users/
│   │       │   ├── runs/
│   │       │   └── health/
│   │       ├── shared/
│   │       │   ├── kernel/          Entity, Result
│   │       │   ├── errors/          DomainError tipados
│   │       │   ├── guards/          PremiumGuard
│   │       │   └── decorators/      @CurrentUser
│   │       ├── prisma/
│   │       └── main.ts
│   └── web/                        Next.js 14 PWA
│       ├── public/
│       │   ├── manifest.webmanifest
│       │   └── icon.svg
│       └── src/
│           ├── app/                App Router
│           │   ├── page.tsx        Landing
│           │   ├── auth/login,register,callback
│           │   └── app/            Área autenticada
│           ├── components/
│           └── lib/api.ts
├── branding/                       Logos SVG + guia de marca
├── docs/
├── nginx/                          runquest.conf
├── docker-compose.production.yml   Plug ao platform GENIA
└── .github/workflows/deploy.yml    Build → GHCR → SSH VPS
```

## Setup local

```bash
# Pré-requisitos: Node 20, pnpm 9, Docker (para Postgres)

# 1. Postgres local
docker run -d --name runquest-pg -e POSTGRES_USER=runquest -e POSTGRES_PASSWORD=runquest \
  -e POSTGRES_DB=runquest -p 5432:5432 postgres:16

# 2. Instalar deps
pnpm install

# 3. Backend
cp .env.example .env
# Editar .env: DATABASE_URL, MP_ACCESS_TOKEN, GOOGLE_*, JWT_*
cd apps/api && pnpm prisma:migrate:dev && cd ../..
pnpm --filter @runquest/api dev   # :4000

# 4. Frontend
pnpm --filter @runquest/web dev   # :3000
```

Acesse `http://localhost:3000`.

## Testes

```bash
pnpm test                              # backend + frontend unit
pnpm --filter @runquest/api test:e2e   # NestJS e2e
pnpm --filter @runquest/web test:e2e   # Playwright (precisa servidor up)
```

## Configuração Mercado Pago

1. Obter `MP_ACCESS_TOKEN` em https://www.mercadopago.com.br/developers/panel/app
2. Configurar webhook secret no painel
3. Criar planos via script:
   ```bash
   cd apps/api && pnpm exec ts-node scripts/seed-mp-plans.ts
   ```
   Anote os IDs retornados → `MP_PLAN_MONTHLY_ID` e `MP_PLAN_YEARLY_ID`
4. URL do webhook: `https://runquest.veloxisit.com.br/api/webhooks/mercadopago`

## Configuração Google OAuth

1. https://console.cloud.google.com/apis/credentials → Criar OAuth 2.0 Client ID
2. Authorized redirect URIs:
   - Dev: `http://localhost:4000/api/auth/google/callback`
   - Prod: `https://runquest.veloxisit.com.br/api/auth/google/callback`
3. Copiar Client ID + Secret para `.env`

## Deploy em produção (VPS GENIA)

Ver [docs/DEPLOY.md](docs/DEPLOY.md).

Resumo:
1. Criar DNS A `runquest.veloxisit.com.br` → `173.212.227.198` via Cloudflare API
2. Push p/ GitHub → GH Actions builda imagens em GHCR e faz SSH deploy
3. Adicionar bloco do `docker-compose.production.yml` ao compose do platform
4. Adicionar `nginx/runquest.conf` ao nginx do platform
5. Gerar cert: `ssh vps "certbot --nginx -d runquest.veloxisit.com.br"`

## Próximos passos

- [ ] Implementar tracking GPS real (apps/web/src/app/app/run)
- [ ] Implementar lógica de territórios H3 (worker)
- [ ] Personal Trainer IA (módulo coach/)
- [ ] App Flutter para APK/IPA (ainda em planejamento — PWA até lá)
- [ ] Sentry + Posthog
