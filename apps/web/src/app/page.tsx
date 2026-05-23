import Link from 'next/link';
import {
  MapPinned, Target, Trophy, Sparkles, Brain, Coins, Zap, Shield, Smartphone,
  Headphones, LineChart, HeartPulse, Globe, Award, Download, ChevronRight,
} from 'lucide-react';
import { InstallPwaButton } from '@/components/InstallPwaButton';
import { LogoMark } from '@/components/LogoMark';

const features = [
  { icon: MapPinned, title: 'Conquista de territórios', text: 'Cada rua que você corre vira sua. Mapa dividido em hexágonos H3 que você captura passando por eles.' },
  { icon: Target, title: 'Missões diárias e semanais', text: 'Distância, ritmo, novos territórios — desafios renovados que dão XP e RunCoins.' },
  { icon: Trophy, title: 'XP, níveis e badges', text: 'Sistema de progressão com curva XP, streaks e mais de 50 badges para colecionar.' },
  { icon: Sparkles, title: 'Ranking semanal', text: 'Compete com amigos e a comunidade. Leaderboard reseta toda segunda às 00:00.' },
  { icon: Brain, title: 'IA personalizada', text: 'Recomenda missões, sugere metas, detecta queda de engajamento, gera mensagens motivacionais.' },
  { icon: Coins, title: 'Economia RunCoins', text: 'Ganhe moedas por km e missões. Compre cosméticos para seus territórios e perfil.' },
  { icon: Zap, title: 'Offline-first', text: 'Registre corrida sem sinal. Sincroniza sozinho quando voltar online. Zero perda.' },
  { icon: Shield, title: 'Strava conectado', text: 'OAuth oficial. Importe seu histórico, exporte cada corrida automaticamente.' },
];

const premium = [
  { icon: HeartPulse, title: 'Personal Trainer IA', text: 'Plano de treino semanal adaptativo (base/build/peak/taper), coach por voz em tempo real, análise pós-corrida.' },
  { icon: LineChart, title: 'Estatísticas avançadas', text: 'VO₂máx estimado, zonas de FC, TRIMP, ACWR, splits negativos, comparativo histórico.' },
  { icon: Headphones, title: '3 personas de coach', text: 'Atlas (técnico), Nyx (intenso) ou Sol (positivo). Vozes ElevenLabs distintas.' },
  { icon: Award, title: 'Missões e cosméticos exclusivos', text: 'Cosméticos premium para territórios e perfil + missões só de assinantes.' },
  { icon: Globe, title: 'Wearables', text: 'Apple Watch e Wear OS: FC, HRV, sleep alimentando o coach.' },
  { icon: Shield, title: 'Sem anúncios', text: 'Experiência limpa, foco total na corrida.' },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-rq-aurora overflow-x-hidden">
      {/* NAV */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/60 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoMark className="w-9 h-9" />
            <span className="font-display text-lg tracking-tight">RunQuest</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-white/70">
            <a href="#features" className="hover:text-white">Recursos</a>
            <a href="#premium" className="hover:text-white">Premium</a>
            <a href="#pricing" className="hover:text-white">Preços</a>
            <a href="#install" className="hover:text-white">Instalar</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/auth/login" className="btn-ghost py-2 px-4 text-sm">Entrar</Link>
            <Link href="/auth/register" className="btn-primary py-2 px-4 text-sm">Começar grátis</Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative pt-20 pb-32 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-rq-lime/30 bg-rq-lime/10 px-3 py-1 text-xs font-medium text-rq-lime mb-6">
              <Sparkles className="w-3.5 h-3.5" /> v0.1 — Em construção pública
            </div>
            <h1 className="font-display text-5xl md:text-7xl font-black leading-[0.95] tracking-tight">
              Corra. <span className="gradient-text">Conquiste</span>.<br /> Evolua.
            </h1>
            <p className="mt-6 text-lg text-white/70 max-w-xl">
              RunQuest transforma cada corrida em uma quest. Conquiste territórios no mapa,
              cumpra missões, evolua com um <strong className="text-white">Personal Trainer IA</strong>{' '}
              que aprende você. Disponível agora como PWA, em breve nas lojas.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <InstallPwaButton />
              <Link href="/auth/register" className="btn-ghost">
                Criar conta <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="mt-6 flex items-center gap-6 text-xs text-white/50">
              <span className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5" /> Funciona no celular como app</span>
              <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Offline-first</span>
            </div>
          </div>

          <div className="relative">
            <div className="glass p-8 aspect-square flex items-center justify-center">
              <LogoMark className="w-full max-w-sm drop-shadow-[0_0_40px_rgba(168,255,62,0.25)]" />
            </div>
            <div className="absolute -bottom-4 -right-4 glass px-4 py-3 text-xs">
              <div className="text-rq-lime font-bold">+1.420 XP</div>
              <div className="text-white/60">missão completa</div>
            </div>
            <div className="absolute -top-4 -left-4 glass px-4 py-3 text-xs">
              <div className="text-rq-gold font-bold">12 hex</div>
              <div className="text-white/60">conquistados hoje</div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-16">
            <div className="text-rq-lime text-sm font-semibold mb-2">FUNCIONALIDADES</div>
            <h2 className="font-display text-4xl md:text-5xl font-black leading-tight">
              Tudo que um corredor moderno precisa.
            </h2>
            <p className="mt-4 text-white/60 text-lg">
              Gamificação séria, IA útil, GPS de verdade, offline que funciona.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f) => (
              <div key={f.title} className="glass p-6 hover:border-rq-lime/30 transition group">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rq-lime/20 to-rq-violet/20 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                  <f.icon className="w-6 h-6 text-rq-lime" />
                </div>
                <h3 className="font-display font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PREMIUM */}
      <section id="premium" className="py-24 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-rq-violet/5 to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto relative">
          <div className="max-w-2xl mb-16">
            <div className="text-rq-violet text-sm font-semibold mb-2 flex items-center gap-2">
              <HeartPulse className="w-4 h-4" /> RUNQUEST PREMIUM
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-black leading-tight">
              Seu Personal Trainer <span className="gradient-text">com IA</span> no bolso.
            </h2>
            <p className="mt-4 text-white/60 text-lg">
              Plano semanal adaptativo, voz durante a corrida, análise pós-corrida.
              Como ter um treinador 24/7 — por menos que um café por semana.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {premium.map((f) => (
              <div key={f.title} className="glass p-6 border-rq-violet/20 hover:border-rq-violet/50 transition">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rq-violet/40 to-rq-lime/20 flex items-center justify-center mb-4">
                  <f.icon className="w-6 h-6 text-rq-lime" />
                </div>
                <h3 className="font-display font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-rq-lime text-sm font-semibold mb-2">PREÇOS</div>
          <h2 className="font-display text-4xl md:text-5xl font-black mb-4">Comece grátis. Suba quando quiser.</h2>
          <p className="text-white/60 mb-12">Sem cartão para o plano gratuito. Cancele Premium quando quiser.</p>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="glass p-8 text-left">
              <div className="text-sm text-white/60 mb-2">FREE</div>
              <div className="font-display text-4xl font-black mb-4">R$ 0</div>
              <p className="text-white/60 text-sm mb-6">Tudo o essencial para começar</p>
              <ul className="space-y-2 text-sm text-white/70">
                <li>✓ GPS tracking ilimitado</li>
                <li>✓ Conquista de territórios</li>
                <li>✓ Missões diárias/semanais</li>
                <li>✓ Ranking semanal</li>
                <li>✓ Strava export</li>
                <li>✓ Offline-first</li>
              </ul>
            </div>
            <div className="glass p-8 text-left border-rq-lime/40 bg-gradient-to-br from-rq-violet/10 to-rq-lime/5 relative">
              <div className="absolute -top-3 left-8 bg-rq-lime text-rq-ink text-xs font-bold px-3 py-1 rounded-full">RECOMENDADO</div>
              <div className="text-sm text-rq-lime mb-2">PREMIUM MENSAL</div>
              <div className="font-display text-4xl font-black mb-1">R$ 19,90<span className="text-base font-normal text-white/50">/mês</span></div>
              <p className="text-white/60 text-sm mb-6">Cancele quando quiser</p>
              <ul className="space-y-2 text-sm text-white/70">
                <li>✓ <strong className="text-white">Personal Trainer IA</strong></li>
                <li>✓ Coach por voz em tempo real</li>
                <li>✓ Análise pós-corrida</li>
                <li>✓ 3 personas (Atlas / Nyx / Sol)</li>
                <li>✓ Stats avançadas (VO₂, FC zones)</li>
                <li>✓ Missões e cosméticos exclusivos</li>
                <li>✓ Sem anúncios</li>
              </ul>
            </div>
            <div className="glass p-8 text-left">
              <div className="text-sm text-white/60 mb-2">PREMIUM ANUAL</div>
              <div className="font-display text-4xl font-black mb-1">R$ 149,90<span className="text-base font-normal text-white/50">/ano</span></div>
              <p className="text-rq-gold text-sm mb-6">Economize 37% (~R$ 88/ano)</p>
              <ul className="space-y-2 text-sm text-white/70">
                <li>✓ Tudo do Premium Mensal</li>
                <li>✓ Equivale a R$ 12,49/mês</li>
                <li>✓ Pagamento único</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* INSTALL */}
      <section id="install" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center glass p-12">
          <Download className="w-12 h-12 mx-auto mb-4 text-rq-lime" />
          <h2 className="font-display text-4xl md:text-5xl font-black mb-4">Instale agora.</h2>
          <p className="text-white/60 mb-8 max-w-2xl mx-auto">
            RunQuest funciona como app no seu celular (PWA). Sem precisar de loja.
            Apps nativos para Android e iOS chegam após aprovação da Play Store e App Store.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <InstallPwaButton />
            <a href="#" className="btn-ghost opacity-60 cursor-not-allowed">
              <Smartphone className="w-4 h-4" /> Android APK (em breve)
            </a>
            <a href="#" className="btn-ghost opacity-60 cursor-not-allowed">
              <Smartphone className="w-4 h-4" /> iOS App Store (em breve)
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-6 items-center justify-between text-sm text-white/40">
          <div className="flex items-center gap-3">
            <LogoMark className="w-8 h-8" />
            <span>© {new Date().getFullYear()} RunQuest. Todos os direitos reservados.</span>
          </div>
          <div className="flex gap-6">
            <Link href="/legal/privacy" className="hover:text-white">Privacidade</Link>
            <Link href="/legal/terms" className="hover:text-white">Termos</Link>
            <a href="mailto:contato@runquest.veloxisit.com.br" className="hover:text-white">Contato</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
