'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { bleCharacteristicValue, type BleDevice, type BleNavigator, type BleRemoteGATTCharacteristic } from './bluetooth';

/**
 * Hook que conecta a QUALQUER sensor de corrida com o serviço BLE padrão
 * "Running Speed and Cadence" (0x1814) — foot pods, muitos relógios/watches
 * e alguns tênis inteligentes expõem essa característica genérica, então
 * isso funciona com praticamente qualquer fabricante (Garmin, Polar, Coros,
 * Stryd, etc.), não só um dispositivo específico.
 *
 * Suporte: Chrome/Edge desktop+Android. NÃO funciona em iOS/Safari (sem Web Bluetooth).
 */

export interface RscReading {
  speedMs: number | null; // m/s
  cadenceSpm: number | null; // passos/min
  strideLengthM: number | null;
  totalDistanceM: number | null;
  running: boolean | null;
}

/**
 * Parser puro do RSC Measurement (Bluetooth GATT spec, char 0x2A53):
 * byte0 = flags (bit0 stride length presente, bit1 distância total presente, bit2 running/walking)
 * bytes1-2 = velocidade instantânea uint16 LE, unidade 1/256 m/s
 * byte3 = cadência instantânea uint8, passos/min
 * [uint16 LE stride length, cm] se flag
 * [uint32 LE distância total, unidade 1/10 m] se flag
 */
export function parseRscMeasurement(value: DataView): RscReading {
  if (!value || value.byteLength < 4) {
    return { speedMs: null, cadenceSpm: null, strideLengthM: null, totalDistanceM: null, running: null };
  }
  const flags = value.getUint8(0);
  const hasStride = (flags & 0x01) !== 0;
  const hasDistance = (flags & 0x02) !== 0;
  const running = (flags & 0x04) !== 0;

  const speedRaw = value.getUint16(1, true);
  const speedMs = Math.round((speedRaw / 256) * 100) / 100;
  const cadenceSpm = value.getUint8(3);

  let offset = 4;
  let strideLengthM: number | null = null;
  if (hasStride && value.byteLength >= offset + 2) {
    strideLengthM = Math.round((value.getUint16(offset, true) / 100) * 100) / 100;
    offset += 2;
  }
  let totalDistanceM: number | null = null;
  if (hasDistance && value.byteLength >= offset + 4) {
    totalDistanceM = Math.round((value.getUint32(offset, true) / 10) * 10) / 10;
  }

  return {
    speedMs: isFinite(speedMs) ? speedMs : null,
    cadenceSpm: cadenceSpm > 0 && cadenceSpm < 260 ? cadenceSpm : null,
    strideLengthM,
    totalDistanceM,
    running,
  };
}

export function useCadence() {
  const [reading, setReading] = useState<RscReading | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deviceRef = useRef<BleDevice | null>(null);
  const charRef = useRef<BleRemoteGATTCharacteristic | null>(null);

  const onValue = useCallback((e: Event) => {
    const value = bleCharacteristicValue(e);
    if (!value) return;
    setReading(parseRscMeasurement(value));
  }, []);

  const connect = useCallback(async () => {
    if (!('bluetooth' in navigator)) {
      setError('Web Bluetooth não suportado nesse navegador (use Chrome/Edge Android ou Desktop)');
      return;
    }
    setError(null); setConnecting(true);
    try {
      const device = await (navigator as unknown as BleNavigator).bluetooth.requestDevice({
        filters: [{ services: ['running_speed_and_cadence'] }],
        optionalServices: ['battery_service'],
      });
      deviceRef.current = device;
      setDeviceName(device.name ?? 'Sensor de corrida');
      device.addEventListener('gattserverdisconnected', () => {
        setConnected(false); setReading(null);
      });
      const server = await device.gatt!.connect();
      const svc = await server.getPrimaryService('running_speed_and_cadence');
      const ch = await svc.getCharacteristic('rsc_measurement');
      await ch.startNotifications();
      ch.addEventListener('characteristicvaluechanged', onValue);
      charRef.current = ch;
      setConnected(true);
    } catch (e) {
      if (e instanceof Error && e.name !== 'NotFoundError') setError(e.message);
    } finally {
      setConnecting(false);
    }
  }, [onValue]);

  const disconnect = useCallback(async () => {
    try { await charRef.current?.stopNotifications(); } catch {}
    try { deviceRef.current?.gatt?.disconnect(); } catch {}
    setConnected(false); setReading(null); setDeviceName(null);
  }, []);

  useEffect(() => () => { void disconnect(); }, [disconnect]);

  return { reading, deviceName, connecting, connected, error, connect, disconnect };
}
