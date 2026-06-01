'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hook que conecta a uma cinta cardíaca BLE (serviço heart_rate 0x180D).
 * Lê o caractere `heart_rate_measurement` (0x2A37) e expõe BPM em tempo real.
 *
 * Suporte: Chrome/Edge desktop+Android. NÃO funciona em iOS/Safari (sem Web Bluetooth).
 */
export function useHeartRate() {
  const [bpm, setBpm] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const charRef = useRef<any>(null);

  const onValue = useCallback((e: Event) => {
    const value = (e.target as any).value as DataView;
    if (!value) return;
    // Per Bluetooth GATT spec: byte 0 = flags. Bit 0 = format (0=uint8, 1=uint16).
    const flags = value.getUint8(0);
    const fmt16 = (flags & 0x1) !== 0;
    const hr = fmt16 ? value.getUint16(1, true) : value.getUint8(1);
    if (hr > 0 && hr < 250) setBpm(hr);
  }, []);

  const connect = useCallback(async () => {
    if (!('bluetooth' in navigator)) {
      setError('Web Bluetooth não suportado nesse navegador (use Chrome/Edge Android ou Desktop)');
      return;
    }
    setError(null); setConnecting(true);
    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }],
        optionalServices: ['battery_service'],
      });
      deviceRef.current = device;
      device.addEventListener('gattserverdisconnected', () => {
        setConnected(false); setBpm(null);
      });
      const server = await device.gatt!.connect();
      const svc = await server.getPrimaryService('heart_rate');
      const ch = await svc.getCharacteristic('heart_rate_measurement');
      await ch.startNotifications();
      ch.addEventListener('characteristicvaluechanged', onValue);
      charRef.current = ch;
      setConnected(true);
    } catch (e: any) {
      setError(e?.message ?? 'Falha ao conectar');
    } finally {
      setConnecting(false);
    }
  }, [onValue]);

  const disconnect = useCallback(async () => {
    try { await charRef.current?.stopNotifications(); } catch {}
    try { deviceRef.current?.gatt?.disconnect(); } catch {}
    setConnected(false); setBpm(null);
  }, []);

  useEffect(() => () => { void disconnect(); }, [disconnect]);

  return { bpm, connecting, connected, error, connect, disconnect };
}
