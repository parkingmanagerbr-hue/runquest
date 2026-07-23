'use client';
import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

/**
 * Sistema de toast + confirm on-brand, substituindo os alert()/confirm() nativos
 * (que travam a thread, quebram a identidade visual e no PWA/standalone somem
 * atrás da barra de status). Montado uma vez no AppChrome, cobre toda a /app.
 */
type Variant = 'success' | 'error' | 'info';
interface ToastItem { id: number; message: string; variant: Variant; }
interface ConfirmState { message: string; confirmLabel: string; resolve: (v: boolean) => void; }

interface ToastApi {
  toast: (message: string, variant?: Variant) => void;
  /** Retorna Promise<boolean> — substitui window.confirm sem bloquear a thread. */
  confirm: (message: string, confirmLabel?: string) => Promise<boolean>;
}

const Ctx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast precisa estar dentro de <ToastProvider>');
  return ctx;
}

const VARIANT_STYLE: Record<Variant, { icon: typeof Info; ring: string; text: string }> = {
  success: { icon: CheckCircle2, ring: 'border-rq-lime/40', text: 'text-rq-lime' },
  error: { icon: AlertTriangle, ring: 'border-rq-orange/50', text: 'text-rq-orange' },
  info: { icon: Info, ring: 'border-white/20', text: 'text-white/80' },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, variant: Variant = 'info') => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    // Auto-dismiss; erros ficam um pouco mais para dar tempo de ler.
    setTimeout(() => dismiss(id), variant === 'error' ? 5000 : 3500);
  }, [dismiss]);

  const confirm = useCallback((message: string, confirmLabel = 'Confirmar') => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ message, confirmLabel, resolve });
    });
  }, []);

  const closeConfirm = useCallback((result: boolean) => {
    setConfirmState((prev) => {
      prev?.resolve(result);
      return null;
    });
  }, []);

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}

      {/* Stack de toasts — acima da BottomNav (z-40). */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => {
          const s = VARIANT_STYLE[t.variant];
          const Icon = s.icon;
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-2xl border ${s.ring} bg-rq-night/90 px-4 py-3 shadow-xl backdrop-blur-xl animate-fadeIn`}
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${s.text}`} />
              <span className="flex-1 text-sm text-white/90">{t.message}</span>
              <button onClick={() => dismiss(t.id)} aria-label="Fechar" className="text-white/40 hover:text-white/70">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Confirm modal */}
      {confirmState && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div role="alertdialog" aria-modal="true" className="glass w-full max-w-xs p-6 text-center animate-fadeIn">
            <p className="mb-6 text-sm text-white/90">{confirmState.message}</p>
            <div className="flex gap-2">
              <button onClick={() => closeConfirm(false)} className="btn-ghost flex-1 py-2.5 text-sm">
                Cancelar
              </button>
              <button
                onClick={() => closeConfirm(true)}
                className="flex-1 rounded-2xl bg-gradient-to-br from-rq-orange to-red-500 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.98]"
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
