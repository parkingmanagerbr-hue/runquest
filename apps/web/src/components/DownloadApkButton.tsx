'use client';
import { useState } from 'react';
import { Download } from 'lucide-react';

/**
 * Baixar o APK Android direto do site (sideload), ao lado do instalar-PWA.
 * O APK é servido estático em /downloads/runquest.apk. Instalar fora da Play
 * Store exige liberar "apps de fontes desconhecidas" — o hint explica isso.
 */
export function DownloadApkButton() {
  const [hint, setHint] = useState(false);

  return (
    <div className="inline-flex flex-col items-start gap-2">
      <a
        href="/downloads/runquest.apk"
        download
        onClick={() => setHint(true)}
        className="btn-ghost"
      >
        {/* Robô do Android */}
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M6 18a1 1 0 0 0 1 1h1v3.5a1.5 1.5 0 0 0 3 0V19h2v3.5a1.5 1.5 0 0 0 3 0V19h1a1 1 0 0 0 1-1V9H6zM3.5 9A1.5 1.5 0 0 0 2 10.5v5a1.5 1.5 0 0 0 3 0v-5A1.5 1.5 0 0 0 3.5 9m17 0a1.5 1.5 0 0 0-1.5 1.5v5a1.5 1.5 0 0 0 3 0v-5A1.5 1.5 0 0 0 20.5 9M15.53 2.16l1.3-1.3a.5.5 0 0 0-.71-.71l-1.48 1.49A5.9 5.9 0 0 0 12 1c-.96 0-1.86.22-2.66.61L7.88.15a.5.5 0 1 0-.71.71l1.31 1.3A5.98 5.98 0 0 0 6 7h12a5.98 5.98 0 0 0-2.47-4.84M9.5 5.5A.75.75 0 1 1 9.5 4a.75.75 0 0 1 0 1.5m5 0A.75.75 0 1 1 14.5 4a.75.75 0 0 1 0 1.5" />
        </svg>
        Baixar APK <span className="text-white/50 font-normal">(Android)</span>
        <Download className="w-3.5 h-3.5 opacity-60" />
      </a>
      {hint && (
        <div className="text-xs text-white/70 max-w-xs glass px-3 py-2">
          Após baixar, abra o arquivo <strong>runquest.apk</strong>. Se o Android pedir,
          permita <strong>&ldquo;instalar apps de fontes desconhecidas&rdquo;</strong> para este navegador — é normal em apps fora da Play Store.
        </div>
      )}
    </div>
  );
}
