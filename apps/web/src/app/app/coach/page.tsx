'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, Sparkles, Lock, Bot } from 'lucide-react';
import { api, tokens, ApiError } from '@/lib/api';
import { SkeletonPage } from '@/components/Skeleton';

interface Msg { role: 'user' | 'assistant'; content: string; }

const SUGGESTIONS = [
  'Como melhorar meu pace no 5K?',
  'Estou com dor na canela, o que faço?',
  'Monte um aquecimento pra hoje',
  'Quantos km devo correr essa semana?',
];

export default function CoachPage() {
  const router = useRouter();
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tokens.hasSession()) { router.replace('/auth/login'); return; }
    api.me().then(u => setIsPremium(u.isPremium || !!u.isOwner)).catch(() => setIsPremium(false));
  }, [router]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    setError('');
    const next: Msg[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setSending(true);
    try {
      const { reply } = await api.coachChat(next);
      setMessages([...next, { role: 'assistant', content: reply }]);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Falha ao falar com o coach. Tente novamente.';
      setError(msg);
      // Mantém a mensagem do usuário pra ele poder reenviar
    }
    setSending(false);
  };

  if (isPremium === null) {
    return <SkeletonPage />;
  }

  return (
    <main className="min-h-screen bg-rq-aurora flex flex-col">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app/ai-trainer" className="text-white/70"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-rq-lime" />
            <h1 className="font-display font-bold">Coach IA</h1>
          </div>
        </div>
      </header>

      {!isPremium ? (
        <section className="max-w-2xl w-full mx-auto px-4 py-10">
          <div className="glass p-6 border-rq-violet/40 bg-gradient-to-br from-rq-violet/10 to-transparent text-center">
            <Lock className="w-10 h-10 mx-auto mb-3 text-rq-violet" />
            <h2 className="font-bold text-lg mb-1">Recurso Premium</h2>
            <p className="text-white/60 text-sm mb-4">Converse com seu coach de corrida com IA, quando quiser.</p>
            <Link href="/pricing" className="btn-primary inline-flex text-sm py-2 px-6">
              Ver planos · a partir de R$ 19,90/mês
            </Link>
          </div>
        </section>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-rq-lime/15 flex items-center justify-center mb-3">
                    <Sparkles className="w-7 h-7 text-rq-lime" />
                  </div>
                  <h2 className="font-bold mb-1">Oi! Sou seu coach de corrida 🏃</h2>
                  <p className="text-white/50 text-sm mb-5">Pergunte sobre treino, ritmo, recuperação ou lesões.</p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {SUGGESTIONS.map(s => (
                      <button key={s} onClick={() => send(s)}
                        className="text-left text-sm p-3 rounded-xl bg-white/5 border border-white/10 hover:border-rq-lime/40 transition">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-rq-lime/20 border border-rq-lime/30'
                      : 'glass'
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}

              {sending && (
                <div className="flex justify-start">
                  <div className="glass rounded-2xl px-4 py-3 text-sm text-white/50 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-rq-lime animate-pulse" /> Coach está digitando…
                  </div>
                </div>
              )}

              {error && <div className="glass p-3 border-rq-orange/40 text-rq-orange text-sm">{error}</div>}
            </div>
          </div>

          <div className="sticky bottom-0 backdrop-blur-md bg-rq-ink/80 border-t border-white/5">
            <div className="max-w-2xl mx-auto px-4 py-3 flex items-end gap-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                rows={1}
                placeholder="Pergunte ao seu coach…"
                className="flex-1 resize-none rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm focus:border-rq-lime/40 outline-none max-h-32" />
              <button onClick={() => send()} disabled={sending || !input.trim()}
                className="btn-primary w-11 h-11 shrink-0 flex items-center justify-center disabled:opacity-40 !p-0">
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
