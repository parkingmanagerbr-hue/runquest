CREATE TYPE "WorkoutType" AS ENUM ('INTERVALS','TEMPO','LONG_RUN','EASY','RECOVERY','RACE','CUSTOM');
CREATE TYPE "SegmentKind" AS ENUM ('WARMUP','INTERVAL_FAST','INTERVAL_SLOW','TEMPO','EASY','COOLDOWN','REST','CUSTOM');

CREATE TABLE "Workout" (
  "id" UUID PRIMARY KEY,
  "userId" UUID,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" "WorkoutType" NOT NULL DEFAULT 'INTERVALS',
  "totalDurationSec" INT NOT NULL DEFAULT 0,
  "totalDistanceM" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "isTemplate" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Workout_userId_idx" ON "Workout"("userId");

CREATE TABLE "WorkoutSegment" (
  "id" UUID PRIMARY KEY,
  "workoutId" UUID NOT NULL REFERENCES "Workout"("id") ON DELETE CASCADE,
  "order" INT NOT NULL,
  "kind" "SegmentKind" NOT NULL,
  "durationSec" INT,
  "distanceM" DOUBLE PRECISION,
  "targetPaceSecPerKm" INT,
  "repeats" INT NOT NULL DEFAULT 1,
  "notes" TEXT,
  UNIQUE("workoutId","order")
);

CREATE TABLE "WorkoutSession" (
  "id" UUID PRIMARY KEY,
  "userId" UUID NOT NULL,
  "workoutId" UUID NOT NULL REFERENCES "Workout"("id"),
  "runId" UUID UNIQUE REFERENCES "Run"("id"),
  "startedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "segmentsDone" INT NOT NULL DEFAULT 0,
  "notes" TEXT
);
CREATE INDEX "WorkoutSession_userId_idx" ON "WorkoutSession"("userId","startedAt" DESC);

CREATE TABLE "TrainingPlan" (
  "id" UUID PRIMARY KEY,
  "userId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "goal" TEXT NOT NULL,
  "weeks" INT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "scheduledWorkouts" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "TrainingPlan_userId_idx" ON "TrainingPlan"("userId");

GRANT ALL ON "Workout","WorkoutSegment","WorkoutSession","TrainingPlan" TO runquest;
GRANT USAGE ON TYPE "WorkoutType" TO runquest;
GRANT USAGE ON TYPE "SegmentKind" TO runquest;
