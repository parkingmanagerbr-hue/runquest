# RunQuest Premium — Personal Trainer IA

Feature **flagship** do tier Premium. Substitui o "Coach virtual" genérico por um **Personal Trainer IA verdadeiro**: aprende o atleta, prescreve treinos adaptativos, ajusta carga em tempo real, dá feedback durante e depois da corrida.

---

## 1. Capacidades

### 1.1 Avaliação inicial (onboarding Premium)
- Questionário guiado por LLM: histórico de treino, lesões, objetivo (perder peso, 5k sub-25, maratona, manutenção)
- Importa últimos 90 dias do Strava (se conectado) para baseline
- Calcula **VO₂máx estimado** (Daniels/Jack formula via melhor performance recente)
- Define **zonas de FC** (5 zonas, fórmula de Karvonen com FC repouso medida)
- Gera **perfil do atleta** persistente: nível, ritmo confortável, ritmo limiar, ritmo VO₂máx

### 1.2 Plano de treino adaptativo (semanal)
- Job semanal (domingo 18h BRT) gera **microciclo** de 7 dias
- Composição balanceada: tempo runs, intervalados, longão, regenerativos, descanso
- **Periodização**: ciclos de 4 semanas (3 progressão + 1 deload)
- Ajusta em tempo real com base em:
  - Aderência da semana anterior (% de treinos cumpridos)
  - Performance vs. prescrito (ritmo real vs. alvo)
  - Indicadores de fadiga (FC elevada em ritmo fácil, declínio de pace)
  - Eventos do calendário (prova marcada → taper automático)

### 1.3 Coach em tempo real (durante a corrida)
- **Voz on-demand** via TTS (ElevenLabs primário, Gemini TTS fallback — padrão GENIA seção 3.0)
- Cues a cada km ou em momento-chave:
  - "Você está 8s/km abaixo do ritmo alvo, recue um pouco"
  - "Próximos 400m em ritmo de limiar — vamos!"
  - "FC subiu pra zona 4 e você ainda tá no aquecimento, respira"
- **Modo intervalado guiado**: conta start/stop dos tiros, fala duração restante
- Funciona com **fones bluetooth** sobre música (ducking automático)

### 1.4 Análise pós-corrida
- Relatório gerado por LLM (Gemini → Cerebras → SambaNova — fallback chain GENIA)
- Estrutura:
  - **Resumo executivo** (3-4 frases, tom motivacional)
  - **O que funcionou** (pontos positivos objetivos)
  - **O que ajustar** (1-2 recomendações concretas)
  - **Comparativo** vs. treino prescrito + média móvel das últimas 4 semanas
  - **Próximo treino** (sugestão com justificativa)
- **Charts inline**: pace split por km, FC zones, elevação, cadência

### 1.5 Detecção de overtraining e lesão iminente
- Modelo simples on-device (TFLite) + regras:
  - **TRIMP** (Training Impulse) acumulado 7d > 1.5× média 28d → alerta amarelo
  - HRV em queda (se Apple Watch/Garmin conectado) → alerta vermelho, propõe descanso
  - Pace em ritmo fácil 5%+ mais lento por 3 treinos seguidos → fadiga
  - Aumento de cadência + queda de stride length → possível lesão
- Quando aciona: bloqueia treinos intensos da semana, propõe regenerativo

### 1.6 Coach motivacional contextual
- Não envia push genérico ("hora de correr!")
- Analisa: hora do dia em que o usuário historicamente corre, clima local, último humor reportado, streak atual
- Geração de mensagem personalizada: "Tá fazendo 18°C agora, você costuma correr terça à noite e tá 2 dias longe do recorde mensal — bora?"

---

## 2. Arquitetura técnica

### 2.1 Models adicionais

```prisma
model AthleteProfile {
  userId           String   @id @db.Uuid
  user             User     @relation(fields: [userId], references: [id])
  vo2maxEstimate   Float?
  hrRest           Int?
  hrMax            Int?
  zone1Max         Int?     // 50-60%
  zone2Max         Int?     // 60-70%
  zone3Max         Int?     // 70-80%
  zone4Max         Int?     // 80-90%
  goal             AthleteGoal
  targetEventDate  DateTime?
  weeklyLoadTarget Int      // TRIMP target
  injuryHistory    Json?    // [{type, side, year, healed}]
  preferences      Json?    // voiceCoach, units, audioCueIntervalKm, ...
  updatedAt        DateTime @updatedAt
}

enum AthleteGoal { WEIGHT_LOSS GENERAL_FITNESS RACE_5K RACE_10K HALF_MARATHON MARATHON ULTRA }

model TrainingPlan {
  id           String   @id @default(uuid()) @db.Uuid
  userId       String   @db.Uuid
  weekStart    DateTime
  phase        String   // 'base' | 'build' | 'peak' | 'taper' | 'deload'
  generatedBy  String   // 'ai:gemini-2.0-flash' etc.
  reasoning    String   // explicação do AI (mostrada ao usuário)
  workouts     PlannedWorkout[]
  createdAt    DateTime @default(now())

  @@unique([userId, weekStart])
}

model PlannedWorkout {
  id             String   @id @default(uuid()) @db.Uuid
  planId         String   @db.Uuid
  plan           TrainingPlan @relation(fields: [planId], references: [id])
  scheduledFor   DateTime
  type           WorkoutType
  targetDistanceKm Float?
  targetDurationSec Int?
  targetPaceSecPerKm Int?
  zones          Json     // [{km: 1-3, zone: 2}, {km: 3-4, zone: 4}, ...]
  notes          String
  completedRunId String?  @unique @db.Uuid
  status         String   @default("planned") // planned | done | skipped | adapted
}

enum WorkoutType { EASY TEMPO INTERVAL LONG RECOVERY RACE REST CROSS }

model CoachFeedback {
  id        String   @id @default(uuid()) @db.Uuid
  runId     String   @unique @db.Uuid
  run       Run      @relation(fields: [runId], references: [id])
  summary   String
  positives String[]
  improvements String[]
  nextSuggestion String
  loadScore Float    // TRIMP do treino
  acwr      Float?   // Acute:Chronic Workload Ratio
  rawLlmJson Json
  createdAt DateTime @default(now())
}

model FatigueSignal {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @db.Uuid
  severity  String   // 'green' | 'yellow' | 'red'
  reason    String
  triggeredAt DateTime @default(now())
  acknowledgedAt DateTime?
}
```

### 2.2 Endpoints adicionais

```
POST   /coach/onboarding           # responde questionário, gera AthleteProfile
GET    /coach/profile              # perfil + zonas
PATCH  /coach/profile              # ajustes manuais

GET    /coach/plan/current         # microciclo da semana
POST   /coach/plan/regenerate      # força nova geração (1x/semana grátis)
POST   /coach/plan/skip-workout    { workoutId, reason }

POST   /coach/realtime/start       { plannedWorkoutId? }  # abre WebSocket
WS     /coach/realtime/ws          # streams TTS cues + recebe GPS+FC
POST   /coach/realtime/end

GET    /coach/feedback/:runId      # gera/retorna análise pós-corrida
POST   /coach/feedback/:runId/regenerate

GET    /coach/fatigue              # sinais ativos
POST   /coach/fatigue/:id/ack
```

Todos com `@UseGuards(JwtAuthGuard, PremiumGuard)`.

### 2.3 Pipeline de geração de plano (worker semanal)

```typescript
@Cron('0 18 * * 0', { timeZone: 'America/Sao_Paulo' })
async generateWeeklyPlansForAllPremium() {
  const users = await this.users.findPremiumActive();
  await this.queue.addBulk(users.map(u => ({
    name: 'generate-weekly-plan',
    data: { userId: u.id },
    opts: { jobId: `plan:${u.id}:${weekStart()}`, attempts: 3 },
  })));
}

// Processor
@Process('generate-weekly-plan')
async process(job: Job<{ userId: string }>) {
  const profile = await this.profiles.findOne(job.data.userId);
  const recent  = await this.runs.last30Days(job.data.userId);
  const lastPlan = await this.plans.lastPlan(job.data.userId);

  const prompt = buildCoachPrompt({ profile, recent, lastPlan });
  const llmResponse = await this.aiClient.complete({
    prompt,
    schema: WeeklyPlanSchema, // JSON schema validation
    fallbackChain: ['gemini', 'cerebras', 'sambanova', 'huggingface'],
  });

  await this.plans.upsertWeek(job.data.userId, llmResponse);
  await this.notify.scheduleWeekReminders(job.data.userId);
}
```

### 2.4 Prompt template (resumido)

```
Você é o Personal Trainer IA do RunQuest. Gere um microciclo de 7 dias para o atleta.

PERFIL:
- Nível: {level}, VO₂máx estimado: {vo2max}
- Objetivo: {goal} | Evento alvo: {eventDate} ({weeksToEvent}sem)
- FC repouso: {hrRest} | FCmax: {hrMax}
- Zonas (bpm): Z1≤{z1} Z2≤{z2} Z3≤{z3} Z4≤{z4} Z5>{z4}

ÚLTIMOS 30 DIAS:
- Total: {totalKm}km em {totalRuns} corridas
- TRIMP médio semanal: {avgTrimp}
- Aderência ao último plano: {adherence}%
- Sinais de fadiga: {fatigueSignals}

REGRAS:
- 80/20: 80% volume em zonas 1-2, 20% em zonas 3-5
- 1 longão por semana (≥35% do volume semanal)
- Após sessão dura, próxima deve ser fácil ou descanso
- Aumento de volume semanal máx +10% vs semana anterior
- Se {fatigueSignals} contém 'yellow' ou 'red': deload semana (-20% volume)

SAÍDA: JSON estrito conforme schema fornecido.
```

### 2.5 Coach em tempo real (WebSocket)

```
App → WS /coach/realtime/ws (com JWT)
App ←→ Server: streams a cada 5s:
  { type: 'gps', lat, lng, pace, distance, hr }
  { type: 'cue_request', reason: 'km_mark' | 'pace_drift' | 'zone_drift' }
Server → App:
  { type: 'tts', audioBase64, transcript }
  { type: 'next_segment', distance, targetPace, zone }
```

Server-side: detecta eventos (km marcado, pace ±10%, FC fora da zona por 60s+), pede LLM curto (Cerebras 360 RPM é ideal aqui — latência baixa), gera TTS, envia.

### 2.6 Custo controlado

- Plano semanal: 1 chamada LLM ~3k tokens out → ~R$ 0.02/user/semana
- Análise pós-corrida: ~1k tokens out → ~R$ 0.005/corrida
- Realtime: 3-6 chamadas curtas + TTS por corrida → ~R$ 0.10/corrida
- **Estimativa total Premium ativo: ~R$ 1.50/mês em IA** vs. R$ 19.90 de receita → margem 92%
- Fallback chain GENIA garante uso preferencial de tiers gratuitos

---

## 3. UX no app

### Telas novas

```
/premium/onboarding-coach         # questionário guiado (8-10 telas swipeable)
/premium/coach                    # tab dedicada
├── /coach/today                  # treino de hoje em destaque + botão "Iniciar"
├── /coach/week                   # microciclo (cards horizontais)
├── /coach/profile                # zonas, VO₂máx, objetivo
└── /coach/insights               # tendências, ACWR, fadiga
/premium/coach/realtime-run       # tela de corrida com voz coach
/runs/:id/coach-feedback          # análise pós-corrida
```

### Diferenciação visual
- **Tab "Coach"** com ícone exclusivo (silhueta runner + raio)
- Cards do plano com **gradiente lime→violet** (cor Premium)
- Avatar do coach personalizado: usuário escolhe entre 3 personas no onboarding
  - **Atlas** (calmo, técnico)
  - **Nyx** (intenso, motivador)
  - **Sol** (positivo, energético)
- Cada persona tem voz própria + estilo de feedback (prompt system distinto)

---

## 4. Atualização do escopo (substitui seção "Premium do RunQuest" do projeto principal)

```
Premium RunQuest — R$ 19,90/mês ou R$ 149,90/ano

✓ Personal Trainer IA (planos adaptativos, coach em tempo real, análise pós-corrida)
✓ 3 personas de coach (Atlas, Nyx, Sol)
✓ Detecção de overtraining e prevenção de lesão
✓ Estatísticas avançadas (VO₂máx, TRIMP, ACWR, splits negativos, etc.)
✓ Missões exclusivas semanais (dificuldade adaptada ao perfil)
✓ Itens cosméticos exclusivos para territórios
✓ Suporte a Apple Watch / Wear OS (FC, HRV, cadência)
✓ Export ilimitado para Strava
✓ Sem anúncios
```

---

## 5. Roadmap incremental do Coach

| Versão | Entrega |
|--------|---------|
| **v1.0 (MVP Premium)** | Onboarding + plano semanal + análise pós-corrida |
| **v1.1** | Coach voz em tempo real (km marker apenas) |
| **v1.2** | Coach reativo (pace drift, zone drift) + 3 personas |
| **v1.3** | Integração wearables (HRV, sleep) via Apple HealthKit / Health Connect |
| **v1.4** | Detecção de lesão iminente (modelo TFLite on-device) |
| **v2.0** | Coach multi-modal: foto do tênis (desgaste) + análise de corrida por vídeo |
