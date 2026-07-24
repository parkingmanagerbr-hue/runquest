'use client';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Campo de senha com botão mostrar/ocultar. Antes as telas de login/cadastro
 * eram <input type="password"> cru — sem como ver o que se digita (fricção no
 * mobile) e sem autoComplete (o gerenciador de senhas não oferecia salvar/
 * preencher). O `autoComplete` é obrigatório: "current-password" no login,
 * "new-password" no cadastro — é o que aciona o cofre de senhas do navegador.
 */
export function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete,
  minLength,
  required = true,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete: 'current-password' | 'new-password';
  minLength?: number;
  required?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        required={required}
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 pr-12 focus:border-rq-lime/50 outline-none"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={show}
        className="absolute inset-y-0 right-0 flex items-center px-3.5 text-white/40 transition hover:text-white/80"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
