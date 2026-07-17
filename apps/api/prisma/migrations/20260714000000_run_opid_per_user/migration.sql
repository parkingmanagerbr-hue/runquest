-- Idempotência de POST /runs por USUÁRIO (antes opId era @unique global, o que
-- fazia dois usuários com o mesmo `run-${Date.now()}` colidirem — vazamento do
-- trajeto do outro + corrida perdida).

-- Remove o unique global de opId (nome do índice segue o padrão do Prisma).
DROP INDEX IF EXISTS "Run_opId_key";

-- Unicidade composta (userId, opId). NULLs seguem distintos (padrão do Postgres
-- e do @@unique do Prisma) — corridas sem opId não colidem entre si.
CREATE UNIQUE INDEX IF NOT EXISTS "Run_userId_opId_key" ON "Run"("userId", "opId");
