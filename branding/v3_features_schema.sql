-- ===== USER: perfil físico + settings =====
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "weightKg" DOUBLE PRECISION;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "heightCm" INT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "birthDate" DATE;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "units" TEXT NOT NULL DEFAULT 'metric'; -- 'metric' | 'imperial'
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "audioCoachEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "audioCoachIntervalKm" INT NOT NULL DEFAULT 1;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pushSubscription" JSONB;

-- ===== GOALS =====
CREATE TABLE IF NOT EXISTS "Goal" (
  "id" UUID PRIMARY KEY,
  "userId" UUID NOT NULL,
  "kind" TEXT NOT NULL,        -- 'distance_km' | 'runs_count' | 'duration_min'
  "period" TEXT NOT NULL,      -- 'WEEKLY' | 'MONTHLY' | 'YEARLY'
  "target" DOUBLE PRECISION NOT NULL,
  "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "windowEnd" TIMESTAMP(3) NOT NULL,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Goal_userId_active_idx" ON "Goal"("userId","windowEnd");

-- ===== KUDOS =====
CREATE TABLE IF NOT EXISTS "Kudo" (
  "id" UUID PRIMARY KEY,
  "runId" UUID NOT NULL REFERENCES "Run"("id") ON DELETE CASCADE,
  "userId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("runId","userId")
);
CREATE INDEX IF NOT EXISTS "Kudo_runId_idx" ON "Kudo"("runId");
CREATE INDEX IF NOT EXISTS "Kudo_userId_idx" ON "Kudo"("userId");

-- ===== COMMENTS =====
CREATE TABLE IF NOT EXISTS "RunComment" (
  "id" UUID PRIMARY KEY,
  "runId" UUID NOT NULL REFERENCES "Run"("id") ON DELETE CASCADE,
  "userId" UUID NOT NULL,
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "RunComment_runId_idx" ON "RunComment"("runId");

-- ===== NOTIFICATIONS LOG =====
CREATE TABLE IF NOT EXISTS "Notification" (
  "id" UUID PRIMARY KEY,
  "userId" UUID NOT NULL,
  "type" TEXT NOT NULL,        -- 'level_up' | 'badge' | 'mission' | 'kudo' | 'comment' | 'follow' | 'goal'
  "title" TEXT NOT NULL,
  "body" TEXT,
  "data" JSONB,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId","createdAt" DESC);

GRANT ALL ON "Goal","Kudo","RunComment","Notification" TO runquest;
