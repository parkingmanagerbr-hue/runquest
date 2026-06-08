/**
 * Camada de abstração de geolocalização.
 *
 * No navegador (PWA) usa a Web Geolocation API (`navigator.geolocation`),
 * que PARA de emitir posições quando a aba é ocultada / a tela apaga.
 *
 * Dentro do app nativo (Capacitor) usa o plugin
 * `@capacitor-community/background-geolocation`, que mantém o GPS ativo
 * em segundo plano com uma notificação persistente — o comportamento que
 * um app de corrida de verdade precisa (rastrear com a tela apagada).
 *
 * O resto do app só conhece `GeoFix` e `watchPosition`/`clear`, sem saber
 * qual implementação está rodando por baixo.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

/** Posição normalizada — mesma forma nas duas plataformas (unidades SI). */
export interface GeoFix {
  latitude: number;
  longitude: number;
  accuracy: number; // metros
  speed: number | null; // m/s (Doppler), null se indisponível
  altitude: number | null; // metros
  altitudeAccuracy: number | null; // metros
}

export interface GeoWatchHandle {
  clear: () => void;
}

type FixCb = (fix: GeoFix) => void;
type ErrCb = (message: string) => void;

/** Forma do plugin nativo de background geolocation. */
interface NativeLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  speed: number | null;
  bearing: number | null;
  time: number | null;
  simulated: boolean;
}

interface NativeError {
  code: string; // 'NOT_AUTHORIZED' | ...
  message?: string;
}

interface BackgroundGeolocationPlugin {
  addWatcher(
    options: {
      backgroundMessage?: string;
      backgroundTitle?: string;
      requestPermissions?: boolean;
      stale?: boolean;
      distanceFilter?: number;
    },
    callback: (location?: NativeLocation, error?: NativeError) => void,
  ): Promise<string>;
  removeWatcher(options: { id: string }): Promise<void>;
  openSettings(): Promise<void>;
}

export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

let _bgGeo: BackgroundGeolocationPlugin | null = null;
function bgGeo(): BackgroundGeolocationPlugin {
  if (!_bgGeo) {
    _bgGeo = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');
  }
  return _bgGeo;
}

/**
 * Inicia o rastreamento contínuo de posição.
 * Retorna um handle com `.clear()` para parar.
 */
export function watchPosition(onFix: FixCb, onError: ErrCb): GeoWatchHandle {
  // ---- App nativo: GPS em segundo plano ----
  if (isNativePlatform()) {
    let watcherId: string | null = null;
    let cleared = false;
    const plugin = bgGeo();

    plugin
      .addWatcher(
        {
          backgroundTitle: 'RunQuest — corrida ativa',
          backgroundMessage: 'Rastreando sua corrida em segundo plano.',
          requestPermissions: true,
          stale: false,
          distanceFilter: 0, // queremos todas as atualizações, filtramos no app
        },
        (location, error) => {
          if (error) {
            if (error.code === 'NOT_AUTHORIZED') {
              onError('Permissão de localização negada. Ative nas configurações do app.');
            } else {
              onError('GPS: ' + (error.message || error.code));
            }
            return;
          }
          if (!location) return;
          onFix({
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy ?? 999,
            speed: location.speed ?? null,
            altitude: location.altitude ?? null,
            altitudeAccuracy: location.altitudeAccuracy ?? null,
          });
        },
      )
      .then((id) => {
        watcherId = id;
        // Se o usuário parou antes do plugin registrar, remove imediatamente.
        if (cleared) plugin.removeWatcher({ id }).catch(() => {});
      })
      .catch((e) => onError('GPS: ' + (e?.message ?? 'falha ao iniciar rastreamento')));

    return {
      clear: () => {
        cleared = true;
        if (watcherId) plugin.removeWatcher({ id: watcherId }).catch(() => {});
      },
    };
  }

  // ---- Navegador (PWA): Web Geolocation ----
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    onError('GPS indisponível');
    return { clear: () => {} };
  }

  const id = navigator.geolocation.watchPosition(
    (pos) =>
      onFix({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        speed: pos.coords.speed,
        altitude: pos.coords.altitude,
        altitudeAccuracy: pos.coords.altitudeAccuracy,
      }),
    (e) => onError('GPS: ' + e.message),
    { enableHighAccuracy: true, maximumAge: 500, timeout: 15000 },
  );

  return { clear: () => navigator.geolocation.clearWatch(id) };
}

/** Abre as configurações nativas do app (para o usuário liberar a permissão). */
export function openLocationSettings(): void {
  if (isNativePlatform()) bgGeo().openSettings().catch(() => {});
}
