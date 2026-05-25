-- ===== USER: bonus columns =====
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastDailyClaimAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totalDistanceM" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totalRuns" INT NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "longestStreak" INT NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "selectedAvatar" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "selectedTerritoryColor" TEXT DEFAULT '#A8FF3E';

-- ===== BADGES =====
CREATE TABLE IF NOT EXISTS "Badge" (
  "id" UUID PRIMARY KEY,
  "code" TEXT UNIQUE NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "icon" TEXT NOT NULL,                -- emoji ou code
  "tier" TEXT NOT NULL DEFAULT 'bronze', -- bronze/silver/gold/platinum
  "requirementKind" TEXT NOT NULL,     -- 'first_run' | 'total_distance' | 'streak' | 'level' | 'territories' | 'single_run_distance' | 'pace_under'
  "requirementValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "xpReward" INT NOT NULL DEFAULT 0,
  "coinReward" INT NOT NULL DEFAULT 0,
  "order" INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "UserBadge" (
  "id" UUID PRIMARY KEY,
  "userId" UUID NOT NULL,
  "badgeId" UUID NOT NULL REFERENCES "Badge"("id") ON DELETE CASCADE,
  "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("userId","badgeId")
);
CREATE INDEX IF NOT EXISTS "UserBadge_userId_idx" ON "UserBadge"("userId");

-- ===== SHOP / COSMETICS =====
CREATE TABLE IF NOT EXISTS "CosmeticItem" (
  "id" UUID PRIMARY KEY,
  "code" TEXT UNIQUE NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "kind" TEXT NOT NULL,            -- 'territory_color' | 'avatar' | 'splash'
  "value" TEXT NOT NULL,           -- hex color, avatar code, etc
  "price" INT NOT NULL,            -- em RunCoins
  "icon" TEXT,
  "premiumOnly" BOOLEAN NOT NULL DEFAULT false,
  "rarity" TEXT NOT NULL DEFAULT 'common'  -- common/rare/epic/legendary
);

CREATE TABLE IF NOT EXISTS "UserItem" (
  "id" UUID PRIMARY KEY,
  "userId" UUID NOT NULL,
  "itemId" UUID NOT NULL REFERENCES "CosmeticItem"("id") ON DELETE CASCADE,
  "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("userId","itemId")
);
CREATE INDEX IF NOT EXISTS "UserItem_userId_idx" ON "UserItem"("userId");

-- ===== FOLLOWS (social) =====
CREATE TABLE IF NOT EXISTS "Follow" (
  "id" UUID PRIMARY KEY,
  "followerId" UUID NOT NULL,
  "followingId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("followerId","followingId")
);
CREATE INDEX IF NOT EXISTS "Follow_following_idx" ON "Follow"("followingId");

GRANT ALL ON "Badge","UserBadge","CosmeticItem","UserItem","Follow" TO runquest;

-- ===== SEED BADGES =====
INSERT INTO "Badge" (id, code, title, description, icon, tier, "requirementKind", "requirementValue", "xpReward", "coinReward", "order") VALUES
('b0000001-0000-0000-0000-000000000001', 'first_step', 'Primeiro passo', 'Complete sua primeira corrida', '👟', 'bronze', 'total_runs', 1, 100, 50, 1),
('b0000001-0000-0000-0000-000000000002', 'runs_5', 'Consistente', 'Complete 5 corridas', '🎯', 'bronze', 'total_runs', 5, 150, 100, 2),
('b0000001-0000-0000-0000-000000000003', 'runs_10', 'Hábito formado', '10 corridas no histórico', '🔥', 'bronze', 'total_runs', 10, 200, 150, 3),
('b0000001-0000-0000-0000-000000000004', 'runs_50', 'Maratonista mental', '50 corridas', '🧠', 'silver', 'total_runs', 50, 500, 400, 4),
('b0000001-0000-0000-0000-000000000005', 'runs_100', 'Centurião', '100 corridas', '💯', 'gold', 'total_runs', 100, 1000, 800, 5),
('b0000001-0000-0000-0000-000000000006', 'runs_500', 'Lenda', '500 corridas', '👑', 'platinum', 'total_runs', 500, 5000, 4000, 6),

('b0000002-0000-0000-0000-000000000001', 'dist_5k_total', 'Quinto km', 'Acumule 5 km totais', '5️⃣', 'bronze', 'total_distance', 5000, 100, 50, 10),
('b0000002-0000-0000-0000-000000000002', 'dist_50k_total', '50 km', 'Acumule 50 km totais', '🏃', 'bronze', 'total_distance', 50000, 250, 150, 11),
('b0000002-0000-0000-0000-000000000003', 'dist_100k_total', 'Centena', '100 km totais', '💪', 'silver', 'total_distance', 100000, 500, 300, 12),
('b0000002-0000-0000-0000-000000000004', 'dist_500k_total', 'Mil milhas', '500 km totais', '🌍', 'gold', 'total_distance', 500000, 1500, 1000, 13),
('b0000002-0000-0000-0000-000000000005', 'dist_1000k_total', 'Marco dos 1000', '1.000 km no contador', '🏔️', 'platinum', 'total_distance', 1000000, 3000, 2000, 14),

('b0000003-0000-0000-0000-000000000001', 'single_5k', 'Primeiro 5K', 'Complete 5 km em uma única corrida', '🏅', 'bronze', 'single_run_distance', 5000, 200, 100, 20),
('b0000003-0000-0000-0000-000000000002', 'single_10k', '10K finisher', 'Complete 10 km em uma corrida', '🥉', 'silver', 'single_run_distance', 10000, 400, 250, 21),
('b0000003-0000-0000-0000-000000000003', 'single_21k', 'Meia Maratona', 'Complete 21.1 km em uma corrida', '🥈', 'gold', 'single_run_distance', 21100, 1000, 600, 22),
('b0000003-0000-0000-0000-000000000004', 'single_42k', 'MARATONA', 'Complete 42.2 km em uma corrida', '🥇', 'platinum', 'single_run_distance', 42195, 3000, 2000, 23),

('b0000004-0000-0000-0000-000000000001', 'streak_3', 'Em chamas', 'Streak de 3 dias', '🔥', 'bronze', 'streak', 3, 100, 50, 30),
('b0000004-0000-0000-0000-000000000002', 'streak_7', 'Semana perfeita', 'Streak de 7 dias', '⚡', 'silver', 'streak', 7, 300, 200, 31),
('b0000004-0000-0000-0000-000000000003', 'streak_30', 'Mestre da disciplina', 'Streak de 30 dias', '⚔️', 'gold', 'streak', 30, 1000, 700, 32),
('b0000004-0000-0000-0000-000000000004', 'streak_100', 'Inabalável', 'Streak de 100 dias', '💎', 'platinum', 'streak', 100, 5000, 3000, 33),

('b0000005-0000-0000-0000-000000000001', 'level_5', 'Atleta', 'Alcance nível 5', '⭐', 'bronze', 'level', 5, 200, 100, 40),
('b0000005-0000-0000-0000-000000000002', 'level_10', 'Veterano', 'Nível 10', '⭐⭐', 'silver', 'level', 10, 500, 300, 41),
('b0000005-0000-0000-0000-000000000003', 'level_25', 'Mestre', 'Nível 25', '⭐⭐⭐', 'gold', 'level', 25, 1500, 1000, 42),
('b0000005-0000-0000-0000-000000000004', 'level_50', 'Grand Master', 'Nível 50', '🌟', 'platinum', 'level', 50, 5000, 3000, 43),

('b0000006-0000-0000-0000-000000000001', 'terr_10', 'Explorador', 'Conquiste 10 territórios', '🗺️', 'bronze', 'territories', 10, 200, 100, 50),
('b0000006-0000-0000-0000-000000000002', 'terr_50', 'Cartógrafo', '50 territórios conquistados', '🧭', 'silver', 'territories', 50, 600, 400, 51),
('b0000006-0000-0000-0000-000000000003', 'terr_200', 'Conquistador', '200 territórios', '🏰', 'gold', 'territories', 200, 2000, 1500, 52),
('b0000006-0000-0000-0000-000000000004', 'terr_1000', 'Imperador', '1.000 territórios', '👑', 'platinum', 'territories', 1000, 8000, 5000, 53),

('b0000007-0000-0000-0000-000000000001', 'pace_5min', 'Velocista bronze', 'Corrida com pace abaixo de 5:00/km', '🥉', 'bronze', 'pace_under', 300, 300, 200, 60),
('b0000007-0000-0000-0000-000000000002', 'pace_430', 'Velocista prata', 'Pace abaixo de 4:30/km', '🥈', 'silver', 'pace_under', 270, 600, 400, 61),
('b0000007-0000-0000-0000-000000000003', 'pace_400', 'Velocista ouro', 'Pace abaixo de 4:00/km', '🥇', 'gold', 'pace_under', 240, 1500, 1000, 62)
ON CONFLICT (code) DO NOTHING;

-- ===== SEED SHOP =====
INSERT INTO "CosmeticItem" (id, code, name, description, kind, value, price, icon, rarity) VALUES
('c0000001-0000-0000-0000-000000000001', 'color_lime', 'Verde elétrico', 'Cor padrão dos territórios', 'territory_color', '#A8FF3E', 0, '🟢', 'common'),
('c0000001-0000-0000-0000-000000000002', 'color_violet', 'Violeta cósmico', 'Pinte seus territórios em roxo', 'territory_color', '#5B2EFF', 100, '🟣', 'common'),
('c0000001-0000-0000-0000-000000000003', 'color_orange', 'Laranja inferno', 'Vermelho-laranja vibrante', 'territory_color', '#FF7A1A', 100, '🟠', 'common'),
('c0000001-0000-0000-0000-000000000004', 'color_cyan', 'Ciano gélido', 'Azul piscina', 'territory_color', '#00F0FF', 200, '🔵', 'rare'),
('c0000001-0000-0000-0000-000000000005', 'color_pink', 'Rosa neon', 'Synthwave vibes', 'territory_color', '#FF2A8E', 200, '💗', 'rare'),
('c0000001-0000-0000-0000-000000000006', 'color_gold', 'Ouro real', 'Cor exclusiva para campeões', 'territory_color', '#FFD700', 500, '🟡', 'epic'),
('c0000001-0000-0000-0000-000000000007', 'color_rainbow', 'Arco-íris', 'Multi-cor (rainbow gradient)', 'territory_color', 'rainbow', 1500, '🌈', 'legendary'),

('c0000002-0000-0000-0000-000000000001', 'avatar_runner', 'Corredor padrão', 'Avatar padrão', 'avatar', '🏃', 0, '🏃', 'common'),
('c0000002-0000-0000-0000-000000000002', 'avatar_lightning', 'Velocista', 'Avatar raio', 'avatar', '⚡', 50, '⚡', 'common'),
('c0000002-0000-0000-0000-000000000003', 'avatar_fire', 'Em chamas', 'Avatar fogo', 'avatar', '🔥', 100, '🔥', 'common'),
('c0000002-0000-0000-0000-000000000004', 'avatar_rocket', 'Foguete', 'Avatar foguete', 'avatar', '🚀', 200, '🚀', 'rare'),
('c0000002-0000-0000-0000-000000000005', 'avatar_crown', 'Coroa', 'Avatar realeza', 'avatar', '👑', 500, '👑', 'epic'),
('c0000002-0000-0000-0000-000000000006', 'avatar_dragon', 'Dragão', 'Avatar lendário', 'avatar', '🐉', 1000, '🐉', 'legendary')
ON CONFLICT (code) DO NOTHING;
