/**
 * Tipos mínimos da Web Bluetooth API — não existe pacote `@types/web-bluetooth`
 * ambiente instalado (não faz parte de `lib.dom.d.ts`), então declaramos aqui
 * só a superfície que os hooks BLE do app (useHeartRate, useCadence) usam,
 * em vez de recorrer a `any` nos pontos de chamada.
 */

export interface BleRemoteGATTCharacteristic extends EventTarget {
  readonly value: DataView | null;
  startNotifications(): Promise<BleRemoteGATTCharacteristic>;
  stopNotifications(): Promise<BleRemoteGATTCharacteristic>;
}

export interface BleRemoteGATTService {
  getCharacteristic(characteristic: string): Promise<BleRemoteGATTCharacteristic>;
}

export interface BleRemoteGATTServer {
  connect(): Promise<BleRemoteGATTServer>;
  getPrimaryService(service: string): Promise<BleRemoteGATTService>;
  disconnect(): void;
}

export interface BleDevice extends EventTarget {
  readonly name?: string;
  readonly gatt?: BleRemoteGATTServer;
}

export interface BleNavigator {
  bluetooth: {
    requestDevice(options: {
      filters: { services: string[] }[];
      optionalServices?: string[];
    }): Promise<BleDevice>;
  };
}

/** DataView do evento `characteristicvaluechanged` (não tipado nativamente). */
export function bleCharacteristicValue(e: Event): DataView | null {
  const target = e.target as BleRemoteGATTCharacteristic | null;
  return target?.value ?? null;
}
