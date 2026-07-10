'use client';
import { useEffect, useRef } from 'react';

interface Settings {
  audioCoachEnabled: boolean;
  audioCoachIntervalKm: number;
}

/**
 * Anuncia via TTS PT-BR a cada N km completados.
 * Lê settings do localStorage cache (preenchido pelo settings page) ou pula se desativado.
 */
export function useAudioCoach(distanceMeters: number, durationSec: number, active: boolean) {
  const lastAnnouncedKm = useRef(0);
  const settingsRef = useRef<Settings>({ audioCoachEnabled: true, audioCoachIntervalKm: 1 });

  useEffect(() => {
    try {
      const cached = localStorage.getItem('rq.settings');
      if (cached) settingsRef.current = { ...settingsRef.current, ...JSON.parse(cached) };
    } catch {}
  }, []);

  useEffect(() => {
    if (!active) { lastAnnouncedKm.current = 0; return; }
    const s = settingsRef.current;
    if (!s.audioCoachEnabled) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const km = Math.floor(distanceMeters / 1000);
    const interval = s.audioCoachIntervalKm || 1;
    if (km >= lastAnnouncedKm.current + interval && km > 0) {
      lastAnnouncedKm.current = km;
      const pace = distanceMeters > 0 ? Math.round((durationSec * 1000) / distanceMeters) : 0;
      const text = `${km} quilômetros. Tempo ${spokenDuration(durationSec)}. Ritmo ${spokenPace(pace)} por quilômetro.`;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'pt-BR';
      u.rate = 1.0;
      u.volume = 1.0;
      window.speechSynthesis.speak(u);
    }
  }, [distanceMeters, durationSec, active]);
}

function spokenDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s} segundos`;
  if (s === 0) return `${m} minutos`;
  return `${m} minutos e ${s} segundos`;
}

function spokenPace(secPerKm: number): string {
  if (!secPerKm) return 'zero';
  const m = Math.floor(secPerKm / 60);
  const s = secPerKm % 60;
  return `${m} minutos e ${s} segundos`;
}
