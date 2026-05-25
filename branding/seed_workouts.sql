INSERT INTO "Workout" (id, "userId", name, description, type, "totalDurationSec", "totalDistanceM", "isTemplate") VALUES
('11111111-1111-1111-1111-111111111111', NULL, 'Tiros 6x400m', 'Aquecimento + 6 tiros fortes + recuperacoes + volta-calma', 'INTERVALS', 2520, 0, true),
('22222222-2222-2222-2222-222222222222', NULL, 'Tempo Run 20min', 'Aquecimento leve + 20 min em ritmo de limiar', 'TEMPO', 2100, 0, true),
('33333333-3333-3333-3333-333333333333', NULL, 'Longao 60min', 'Corrida continua em ritmo confortavel', 'LONG_RUN', 3600, 0, true),
('44444444-4444-4444-4444-444444444444', NULL, 'Recuperacao 30min', 'Trote bem leve pos treino intenso', 'RECOVERY', 1800, 0, true)
ON CONFLICT DO NOTHING;

INSERT INTO "WorkoutSegment" (id, "workoutId", "order", kind, "durationSec", repeats) VALUES
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 0, 'WARMUP', 600, 1),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 1, 'INTERVAL_FAST', 90, 6),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 2, 'INTERVAL_SLOW', 90, 6),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 3, 'COOLDOWN', 600, 1),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 0, 'WARMUP', 300, 1),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 1, 'TEMPO', 1200, 1),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 2, 'COOLDOWN', 600, 1),
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 0, 'EASY', 3600, 1),
(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 0, 'EASY', 1800, 1)
ON CONFLICT DO NOTHING;
