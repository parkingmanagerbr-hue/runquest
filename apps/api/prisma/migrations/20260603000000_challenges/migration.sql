-- Desafios da comunidade (Challenge) + participações (ChallengeParticipant)

-- CreateTable: Challenge
CREATE TABLE IF NOT EXISTS "Challenge" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "goalKind" TEXT NOT NULL,
    "goalValue" DOUBLE PRECISION NOT NULL,
    "xpReward" INTEGER NOT NULL,
    "coinReward" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Challenge_code_key" ON "Challenge"("code");
CREATE INDEX IF NOT EXISTS "Challenge_active_endsAt_idx" ON "Challenge"("active", "endsAt");

-- CreateTable: ChallengeParticipant
CREATE TABLE IF NOT EXISTS "ChallengeParticipant" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "challengeId" UUID NOT NULL,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    CONSTRAINT "ChallengeParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChallengeParticipant_userId_challengeId_key" ON "ChallengeParticipant"("userId", "challengeId");
CREATE INDEX IF NOT EXISTS "ChallengeParticipant_challengeId_idx" ON "ChallengeParticipant"("challengeId");
CREATE INDEX IF NOT EXISTS "ChallengeParticipant_userId_idx" ON "ChallengeParticipant"("userId");

-- AddForeignKey (idempotente)
DO $$ BEGIN
  ALTER TABLE "ChallengeParticipant"
    ADD CONSTRAINT "ChallengeParticipant_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ChallengeParticipant"
    ADD CONSTRAINT "ChallengeParticipant_challengeId_fkey"
    FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed: desafios de exemplo (janela de 30 dias a partir do deploy). Idempotente por "code".
INSERT INTO "Challenge" ("id","code","title","description","goalKind","goalValue","xpReward","coinReward","startsAt","endsAt","active")
VALUES
  (gen_random_uuid(), 'monthly_100k', 'Maratona do Mês', 'Corra 100 km no total ao longo do desafio e prove sua resistência.', 'distance_km', 100, 500, 300, date_trunc('day', now()), now() + interval '30 days', true),
  (gen_random_uuid(), 'consistency_15', 'Constância', 'Complete 15 corridas no período. Disciplina vence talento.', 'runs_count', 15, 300, 200, date_trunc('day', now()), now() + interval '30 days', true),
  (gen_random_uuid(), 'sweat_300', 'Hora do Suor', 'Acumule 300 minutos de corrida. Cada minuto conta!', 'duration_min', 300, 250, 150, date_trunc('day', now()), now() + interval '30 days', true)
ON CONFLICT ("code") DO NOTHING;
