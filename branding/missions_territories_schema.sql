-- ===== USER GAMIFICATION ADDS =====
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "xp" INT NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "level" INT NOT NULL DEFAULT 1;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "runCoins" INT NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "streakDays" INT NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastRunAt" TIMESTAMP(3);

-- ===== MISSIONS =====
DO $$ BEGIN
  CREATE TYPE "MissionScope" AS ENUM ('DAILY','WEEKLY','EVENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MissionType" AS ENUM ('STANDARD','CHALLENGE','AI_GENERATED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Mission" (
  "id" UUID PRIMARY KEY,
  "code" TEXT UNIQUE NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "type" "MissionType" NOT NULL DEFAULT 'STANDARD',
  "scope" "MissionScope" NOT NULL,
  "goalKind" TEXT NOT NULL,        -- 'distance_km' | 'runs_count' | 'duration_min' | 'territory_capture'
  "goalValue" DOUBLE PRECISION NOT NULL,
  "xpReward" INT NOT NULL,
  "coinReward" INT NOT NULL,
  "premiumOnly" BOOLEAN NOT NULL DEFAULT false,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "MissionProgress" (
  "id" UUID PRIMARY KEY,
  "userId" UUID NOT NULL,
  "missionId" UUID NOT NULL REFERENCES "Mission"("id") ON DELETE CASCADE,
  "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "claimed" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3),
  "claimedAt" TIMESTAMP(3),
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("userId","missionId")
);
CREATE INDEX IF NOT EXISTS "MissionProgress_userId_idx" ON "MissionProgress"("userId");

-- ===== TERRITORIES =====
CREATE TABLE IF NOT EXISTS "Territory" (
  "id" UUID PRIMARY KEY,
  "userId" UUID NOT NULL,
  "h3Index" TEXT NOT NULL,
  "visits" INT NOT NULL DEFAULT 1,
  "capturedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastVisitAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("userId","h3Index")
);
CREATE INDEX IF NOT EXISTS "Territory_h3Index_idx" ON "Territory"("h3Index");
CREATE INDEX IF NOT EXISTS "Territory_userId_idx" ON "Territory"("userId");

-- Permissions
GRANT ALL ON "Mission","MissionProgress","Territory" TO runquest;
GRANT USAGE ON TYPE "MissionScope" TO runquest;
GRANT USAGE ON TYPE "MissionType" TO runquest;

-- ===== SEED MISSIONS GLOBAIS =====
INSERT INTO "Mission" (id, code, title, description, type, scope, "goalKind", "goalValue", "xpReward", "coinReward") VALUES
('a1111111-0000-0000-0000-000000000001', 'daily_5k', 'Sair pra correr', 'Complete 1 corrida hoje', 'STANDARD', 'DAILY', 'runs_count', 1, 50, 25),
('a1111111-0000-0000-0000-000000000002', 'daily_3km', 'Movimente-se 3km', 'Acumule 3 km hoje', 'STANDARD', 'DAILY', 'distance_km', 3, 100, 50),
('a1111111-0000-0000-0000-000000000003', 'daily_30min', '30 minutos em movimento', 'Some 30 minutos de corrida hoje', 'STANDARD', 'DAILY', 'duration_min', 30, 80, 40),
('a2222222-0000-0000-0000-000000000001', 'weekly_20km', 'Maratonista da semana', 'Acumule 20 km na semana', 'STANDARD', 'WEEKLY', 'distance_km', 20, 500, 250),
('a2222222-0000-0000-0000-000000000002', 'weekly_3runs', 'Consistência', 'Complete 3 corridas na semana', 'STANDARD', 'WEEKLY', 'runs_count', 3, 300, 150),
('a2222222-0000-0000-0000-000000000003', 'weekly_territories', 'Conquistador', 'Capture 5 territórios novos esta semana', 'CHALLENGE', 'WEEKLY', 'territory_capture', 5, 700, 350)
ON CONFLICT (code) DO NOTHING;
