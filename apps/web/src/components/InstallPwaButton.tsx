'use client';
import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPwaButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIos(/iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua));

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) {
    return <span className="btn-ghost cursor-default">✓ Instalado</span>;
  }

  const click = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === 'accepted') setInstalled(true);
      setDeferred(null);
    } else if (isIos) {
      setShowHint(true);
    } else {
      setShowHint(true);
    }
  };

  return (
    <div className="inline-flex flex-col items-start gap-2">
      <button onClick={click} className="btn-primary">
        <Download className="w-4 h-4" /> Instalar agora (PWA)
      </button>
      {showHint && (
        <div className="text-xs text-white/70 max-w-xs glass px-3 py-2">
          {isIos
            ? 'No iOS: toque em Compartilhar → "Adicionar à Tela de Início".'
            : 'No menu do navegador, procure "Instalar app" ou "Adicionar à tela inicial".'}
        </div>
      )}
    </div>
  );
}
