import {
  Body, Controller, Get, Module, Param, Post, Put, Query, UseGuards, ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString, IsInt, IsISO8601, IsOptional, IsArray, IsNumber, IsEnum, Min, Max } from 'class-validator';
// AI provider: Gemini + SambaNova multi-key fallback (serviço compartilhado)
import { AiCompletionService, AiCompletionModule } from '../../shared/kernel/ai-completion.service';
import { JwtAuthGuard } from '../auth/infrastructure/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../../shared/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { isPremiumActive } from '../../shared/kernel/premium';
import { Prisma } from '@prisma/client';

/**
 * scheduledWorkouts JSON shape:
 * [{ date: "2026-05-25", workoutId: "uuid", completed: false }, ...]
 */
interface ScheduledEntry {
  date: string;
  workoutId?: string;
  completed?: boolean;
  label?: string;
  type?: string;
  distanceM?: number;
  durationSec?: number;
  intensityZone?: number;
}

class CreatePlanDto {
  @IsString() name!: string;
  @IsString() goal!: string;
  @IsInt() @Min(1) weeks!: number;
  @IsISO8601() startDate!: string;
  @IsOptional() @IsArray() scheduledWorkouts?: any[];
}

class AiGeneratePlanDto {
  @IsEnum(['5K', '10K', '21K', '42K', 'perda_de_peso', 'condicionamento_geral']) goal!: string;
  @IsNumber() @Min(1) @Max(7) daysPerWeek!: number;
  @IsEnum(['iniciante', 'intermediario', 'avancado']) level!: string;
  @IsISO8601() startDate!: string;
  @IsOptional() @IsString() notes?: string;
}

class CoachMessageDto {
  @IsEnum(['user', 'assistant']) role!: 'user' | 'assistant';
  @IsString() content!: string;
}

class CoachChatDto {
  @IsArray() messages!: CoachMessageDto[];
}

@ApiTags('plans')
@Controller('plans')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PlansController {
  constructor(private readonly prisma: PrismaService, private readonly ai: AiCompletionService) {}

  /** Delega ao serviço compartilhado (Gemini → SambaNova, com rotação de chaves). */
  private callAi(prompt: string, opts?: { systemPrompt?: string; maxTokens?: number }): Promise<string> {
    return this.ai.complete(prompt, opts);
  }

  /** POST /plans/ai-generate — Premium only — Generates adaptive plan via Claude */
  @Post('ai-generate')
  async aiGenerate(@CurrentUser() user: RequestUser, @Body() dto: AiGeneratePlanDto) {
    // Premium check
    const u = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { isPremium: true, premiumUntil: true, isOwner: true, xp: true, level: true,
        displayName: true, weightKg: true, heightCm: true, birthDate: true },
    });
    if (!u || !isPremiumActive(u)) {
      throw new ForbiddenException('AI Trainer is a Premium feature');
    }

    // Fetch recent runs for context
    const recentRuns = await this.prisma.run.findMany({
      where: { userId: user.id },
      orderBy: { startedAt: 'desc' },
      take: 10,
      select: { distanceMeters: true, durationSec: true, avgPaceSecPerKm: true, startedAt: true },
    });

    const avgPaceMin = recentRuns.length > 0
      ? (recentRuns.reduce((a, r) => a + r.avgPaceSecPerKm, 0) / recentRuns.length / 60).toFixed(1)
      : null;

    const totalKmLast30 = recentRuns
      .filter(r => new Date(r.startedAt) > new Date(Date.now() - 30 * 86400000))
      .reduce((a, r) => a + r.distanceMeters / 1000, 0)
      .toFixed(1);

    const prompt = `You are an expert running coach. Generate a ${dto.level} training plan for a runner with these specs:

Goal: ${dto.goal}
Training days per week: ${dto.daysPerWeek}
Level: ${dto.level}
Start date: ${dto.startDate}
Recent avg pace: ${avgPaceMin ? avgPaceMin + ' min/km' : 'unknown'}
km in last 30 days: ${totalKmLast30} km
Runner notes: ${dto.notes ?? 'none'}

Return ONLY valid JSON matching this schema (no markdown, no explanation):
{
  "name": "plan name",
  "goal": "goal description",
  "weeks": 8,
  "scheduledWorkouts": [
    {
      "date": "YYYY-MM-DD",
      "label": "workout description",
      "type": "easy|tempo|intervals|long|rest",
      "distanceM": 5000,
      "durationSec": 1800,
      "intensityZone": 2
    }
  ]
}

Rules:
- Distribute workouts exactly ${dto.daysPerWeek} days per week with adequate rest
- Use progressive overload (increase volume ~10% per week max)
- Include 1 long run per week on weekends
- Intervals and tempo max 2x per week
- Total weeks: ${dto.goal.includes('42') ? 16 : dto.goal.includes('21') ? 12 : dto.goal.includes('10') ? 8 : 6}
- Dates must start from ${dto.startDate}
- distanceM and durationSec are approximate estimates`;

    const text = await this.callAi(prompt, { maxTokens: 4096 });
    let plan: any;
    try {
      plan = JSON.parse(text.trim());
    } catch {
      // Try extracting JSON from response
      const match = text.match(/\{[\s\S]+\}/);
      if (!match) throw new Error('AI returned invalid response');
      plan = JSON.parse(match[0]);
    }

    // Save to DB
    await this.prisma.trainingPlan.updateMany({
      where: { userId: user.id, active: true },
      data: { active: false },
    });
    return this.prisma.trainingPlan.create({
      data: {
        userId: user.id,
        name: plan.name,
        goal: plan.goal,
        weeks: plan.weeks,
        startDate: new Date(dto.startDate),
        scheduledWorkouts: plan.scheduledWorkouts ?? [],
        active: true,
      },
    });
  }

  /** POST /plans/coach-chat — Premium only — Conversational AI running coach */
  @Post('coach-chat')
  async coachChat(@CurrentUser() user: RequestUser, @Body() dto: CoachChatDto) {
    // Premium gating (same rule as ai-generate)
    const u = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { isPremium: true, premiumUntil: true, isOwner: true, level: true, displayName: true,
        weightKg: true, heightCm: true },
    });
    if (!u || !isPremiumActive(u)) {
      throw new ForbiddenException('AI Coach is a Premium feature');
    }

    // Validate + clamp history (last 12 turns, must start with a user message)
    const incoming = Array.isArray(dto.messages) ? dto.messages : [];
    const cleaned = incoming
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
      .slice(-12);
    while (cleaned.length && cleaned[0].role !== 'user') cleaned.shift();
    if (!cleaned.length) return { reply: 'Manda sua dúvida que eu te ajudo! 🏃' };

    // Run context for grounded advice
    const recentRuns = await this.prisma.run.findMany({
      where: { userId: user.id },
      orderBy: { startedAt: 'desc' },
      take: 8,
      select: { distanceMeters: true, durationSec: true, avgPaceSecPerKm: true, startedAt: true },
    });
    const avgPaceMin = recentRuns.length > 0
      ? (recentRuns.reduce((a: number, r: any) => a + r.avgPaceSecPerKm, 0) / recentRuns.length / 60).toFixed(1)
      : null;
    const km30 = recentRuns
      .filter((r: any) => new Date(r.startedAt) > new Date(Date.now() - 30 * 86400000))
      .reduce((a: number, r: any) => a + r.distanceMeters / 1000, 0)
      .toFixed(1);
    const activePlan = await this.prisma.trainingPlan.findFirst({
      where: { userId: user.id, active: true },
      select: { name: true, goal: true },
    });

    const system = [
      'Você é o RunQuest Coach, um personal trainer de corrida experiente, motivador e direto.',
      'Responda SEMPRE em português do Brasil, de forma concisa (no máximo ~150 palavras), prática e amigável.',
      'Dê conselhos acionáveis sobre treino, ritmo, recuperação, nutrição básica e prevenção de lesões.',
      'Use os dados do corredor quando relevante. Nunca dê diagnóstico médico — em caso de dor/lesão, recomende procurar um profissional de saúde.',
      '',
      'Dados do corredor:',
      `- Nome: ${u.displayName ?? 'corredor'}`,
      `- Nível (gamificação): ${u.level ?? 1}`,
      avgPaceMin ? `- Pace médio recente: ${avgPaceMin} min/km` : '- Sem corridas registradas ainda',
      `- Volume nos últimos 30 dias: ${km30} km`,
      u.weightKg ? `- Peso: ${u.weightKg} kg` : '',
      u.heightCm ? `- Altura: ${u.heightCm} cm` : '',
      activePlan ? `- Plano ativo: ${activePlan.name} (objetivo: ${activePlan.goal})` : '- Sem plano de treino ativo',
    ].filter(Boolean).join('\n');

    // Build prompt from conversation history
    const conversationText = cleaned.map(m => `${m.role === 'user' ? 'Corredor' : 'Coach'}: ${m.content}`).join('\n');
    const lastUserMsg = cleaned.filter(m => m.role === 'user').pop()?.content ?? '';
    const fullPrompt = cleaned.length > 1 ? conversationText + '\nCoach:' : lastUserMsg;

    let reply: string;
    try {
      reply = await this.callAi(fullPrompt, { systemPrompt: system, maxTokens: 512 });
      // Strip "Coach:" prefix if present
      reply = reply.replace(/^Coach:\s*/i, '').trim();
    } catch {
      reply = 'Desculpe, não consegui responder agora. Tenta de novo!';
    }
    return { reply };
  }

  @Get()
  async list(@CurrentUser() user: RequestUser) {
    return this.prisma.trainingPlan.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('active')
  async active(@CurrentUser() user: RequestUser) {
    return this.prisma.trainingPlan.findFirst({
      where: { userId: user.id, active: true },
    });
  }

  /** GET /plans/today — Today's workout from active plan, null if none */
  @Get('today')
  async today(@CurrentUser() user: RequestUser, @Query('date') date?: string) {
    const plan = await this.prisma.trainingPlan.findFirst({
      where: { userId: user.id, active: true },
    });
    if (!plan) return null;

    // O "hoje" é o dia LOCAL do usuário, que só o cliente conhece — o servidor,
    // em UTC, mostraria o treino de amanhã perto da meia-noite p/ quem está a
    // oeste de Greenwich (os planos adaptativos gravam datas locais). O cliente
    // manda ?date=YYYY-MM-DD; sem isso, cai no UTC do servidor (compatível com
    // os planos de template, que são ancorados em UTC).
    const todayStr = /^\d{4}-\d{2}-\d{2}$/.test(date ?? '')
      ? (date as string)
      : new Date().toISOString().slice(0, 10);
    // scheduledWorkouts é uma coluna Json: pode não ser um array (dado legado /
    // corrompido). O `as any[]` de antes presumia que sempre era.
    const scheduled = Array.isArray(plan.scheduledWorkouts)
      ? (plan.scheduledWorkouts as unknown as ScheduledEntry[])
      : [];
    const todayEntry = scheduled.find((s) => s.date === todayStr && !s.completed);
    if (!todayEntry) return null;

    let workout = null;
    if (todayEntry.workoutId) {
      workout = await this.prisma.workout.findUnique({
        where: { id: todayEntry.workoutId },
        include: { segments: { orderBy: { order: 'asc' } } },
      });
    }

    return {
      date: todayStr,
      label: todayEntry.label ?? workout?.name ?? 'Treino',
      distanceM: todayEntry.distanceM ?? null,
      durationSec: todayEntry.durationSec ?? null,
      workoutId: todayEntry.workoutId ?? null,
      workout,
      planName: plan.name,
    };
  }

  @Post()
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreatePlanDto) {
    // Desativar outros planos
    await this.prisma.trainingPlan.updateMany({
      where: { userId: user.id, active: true },
      data: { active: false },
    });
    return this.prisma.trainingPlan.create({
      data: {
        userId: user.id,
        name: dto.name,
        goal: dto.goal,
        weeks: dto.weeks,
        startDate: new Date(dto.startDate),
        scheduledWorkouts: dto.scheduledWorkouts ?? [],
        active: true,
      },
    });
  }

  @Post('templates/:templateId')
  async fromTemplate(
    @CurrentUser() user: RequestUser,
    @Param('templateId') templateId: string,
    @Body() body: { startDate: string },
  ) {
    const tpl = TEMPLATES[templateId];
    if (!tpl) return { error: 'TEMPLATE_NOT_FOUND' };

    const start = new Date(body.startDate);
    const scheduledWorkouts = tpl.weeks.flatMap((week, wIdx) =>
      week.map((wk) => {
        const d = new Date(start);
        d.setDate(d.getDate() + wIdx * 7 + (wk.day - 1));
        return {
          date: d.toISOString().slice(0, 10),
          workoutId: wk.workoutId,
          label: wk.label,
          distanceM: wk.distanceM,
          durationSec: wk.durationSec,
          completed: false,
        };
      }),
    );

    await this.prisma.trainingPlan.updateMany({
      where: { userId: user.id, active: true },
      data: { active: false },
    });
    return this.prisma.trainingPlan.create({
      data: {
        userId: user.id,
        name: tpl.name,
        goal: tpl.goal,
        weeks: tpl.weeks.length,
        startDate: start,
        scheduledWorkouts,
        active: true,
      },
    });
  }

  @Put(':id/mark-done')
  async markDone(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { date: string },
  ) {
    const plan = await this.prisma.trainingPlan.findFirst({
      where: { id, userId: user.id },
    });
    if (!plan) return { error: 'NOT_FOUND' };
    // Guarda igual à do `today`: scheduledWorkouts é Json e pode não ser array
    // (dado legado/IA). Antes `(... as any[]).map` dava 500 permanente no plano.
    const list = Array.isArray(plan.scheduledWorkouts)
      ? (plan.scheduledWorkouts as unknown as ScheduledEntry[])
      : [];
    const sw = list.map((w) => (w.date === body.date ? { ...w, completed: true } : w));
    return this.prisma.trainingPlan.update({
      where: { id },
      data: { scheduledWorkouts: sw as unknown as Prisma.InputJsonValue },
    });
  }

  @Get('templates')
  templates() {
    return Object.entries(TEMPLATES).map(([id, t]) => ({
      id, name: t.name, goal: t.goal, weeks: t.weeks.length,
      totalWorkouts: t.weeks.reduce((a, w) => a + w.length, 0),
    }));
  }
}

@Module({ imports: [AiCompletionModule], controllers: [PlansController] })
export class PlansModule {}
// ConfigModule is global so ConfigService is auto-available

// ---- Templates inline (3 planos pré-montados) ----
// dia 1=segunda, 2=terça... 7=domingo
const TEMPLATES: Record<string, { name: string; goal: string; weeks: { day: number; label: string; workoutId?: string; distanceM?: number; durationSec?: number }[][] }> = {
  '5k-iniciante': {
    name: '5K Iniciante (Couch to 5K)',
    goal: 'Sair do sedentarismo e completar 5km em 8 semanas',
    weeks: [
      // Semana 1
      [
        { day: 1, label: 'Caminhada 20min', durationSec: 1200 },
        { day: 3, label: 'Trote leve 15min', durationSec: 900 },
        { day: 5, label: 'Caminhada/trote 25min', durationSec: 1500 },
      ],
      [{ day: 1, label: 'Trote 20min', durationSec: 1200 }, { day: 3, label: 'Trote leve 25min', durationSec: 1500 }, { day: 5, label: 'Trote 30min', durationSec: 1800 }],
      [{ day: 1, label: 'Trote 25min', durationSec: 1500 }, { day: 3, label: 'Tiros 6x1min (workout)', workoutId: '11111111-1111-1111-1111-111111111111' }, { day: 5, label: 'Trote 30min', durationSec: 1800 }],
      [{ day: 1, label: 'Trote 30min', durationSec: 1800 }, { day: 3, label: 'Tiros 6x400m', workoutId: '11111111-1111-1111-1111-111111111111' }, { day: 6, label: 'Longão 3km', distanceM: 3000 }],
      [{ day: 1, label: 'Trote 35min', durationSec: 2100 }, { day: 3, label: 'Tempo 20min', workoutId: '22222222-2222-2222-2222-222222222222' }, { day: 6, label: 'Longão 4km', distanceM: 4000 }],
      [{ day: 1, label: 'Trote 35min', durationSec: 2100 }, { day: 3, label: 'Tempo 20min', workoutId: '22222222-2222-2222-2222-222222222222' }, { day: 6, label: 'Longão 5km', distanceM: 5000 }],
      [{ day: 1, label: 'Trote leve 30min', durationSec: 1800 }, { day: 3, label: 'Tiros 6x400m', workoutId: '11111111-1111-1111-1111-111111111111' }, { day: 6, label: 'Longão 6km', distanceM: 6000 }],
      [{ day: 1, label: 'Trote 20min', durationSec: 1200 }, { day: 3, label: 'Trote 15min', durationSec: 900 }, { day: 6, label: '🏁 PROVA 5K', distanceM: 5000 }],
    ],
  },
  '10k-intermediario': {
    name: '10K Intermediário',
    goal: 'Correr 10km em ritmo confortável em 8 semanas',
    weeks: Array.from({ length: 8 }, (_, w) => [
      { day: 2, label: 'Trote 40min', durationSec: 2400 },
      { day: 4, label: 'Tiros 6x400m', workoutId: '11111111-1111-1111-1111-111111111111' },
      { day: 6, label: `Longão ${5 + w}km`, distanceM: (5 + w) * 1000 },
    ]),
  },
  'half-marathon': {
    name: 'Meia Maratona (21K)',
    goal: 'Completar 21.1 km em 12 semanas',
    weeks: Array.from({ length: 12 }, (_, w) => [
      { day: 2, label: 'Trote 45min', durationSec: 2700 },
      { day: 4, label: 'Tempo 20min', workoutId: '22222222-2222-2222-2222-222222222222' },
      { day: 5, label: 'Trote 30min', durationSec: 1800 },
      { day: 6, label: `Longão ${8 + Math.min(w, 10)}km`, distanceM: (8 + Math.min(w, 10)) * 1000 },
    ]),
  },
};
