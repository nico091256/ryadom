/**
 * Yandex Maps JS API 2.1 — dinamik yuklash va yordamchi funksiyalar.
 *
 * Og'ir npm paket (`@pbe/react-yandex-maps`) o'rniga rasmiy skript faqat kerak
 * bo'lganda (xarita modali ochilganda) bir marta yuklanadi. Shu bilan store
 * build'i va lockfile o'zgarmaydi, deploy yengil qoladi.
 *
 * Kalit: NEXT_PUBLIC_YANDEX_MAPS_KEY (build vaqtida yopishadi).
 */

/** Bepul tarif cheklovi tufayli reverse-geocode so'rovlari shu kechikish bilan yuboriladi. */
export const GEOCODE_DEBOUNCE_MS = 500;

/** Toshkent markazi — koordinata hali belgilanmaganda boshlang'ich nuqta. */
export const DEFAULT_CENTER: [number, number] = [41.311081, 69.240562];

/** [lat, lng] juftligi — Yandex `[kenglik, uzunlik]` tartibini ishlatadi. */
export type LatLng = { lat: number; lng: number };

/** Ishlatiladigan ymaps imkoniyatlarining tor interfeysi (global `any` emas). */
export interface YMaps {
  ready(callback: () => void): void;
  Map: new (
    el: HTMLElement | string,
    state: { center: [number, number]; zoom: number; controls?: string[] },
    options?: Record<string, unknown>,
  ) => YMap;
  Placemark: new (
    coords: [number, number],
    properties?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => YPlacemark;
  geocode(
    request: [number, number] | string,
    options?: { results?: number; kind?: string },
  ): Promise<YGeocodeResult>;
}

export interface YMap {
  geoObjects: { add(obj: unknown): void; remove(obj: unknown): void };
  events: { add(type: string, handler: (e: YEvent) => void): void };
  setCenter(coords: [number, number], zoom?: number, options?: { duration?: number }): void;
  destroy(): void;
}

export interface YPlacemark {
  geometry: { getCoordinates(): [number, number]; setCoordinates(coords: [number, number]): void };
  events: { add(type: string, handler: (e: YEvent) => void): void };
}

interface YEvent {
  get(key: 'coords'): [number, number];
  get(key: 'target'): YPlacemark;
  get(key: string): unknown;
}

interface YGeocodeResult {
  geoObjects: {
    get(index: number): { getAddressLine(): string } | undefined;
  };
}

declare global {
  interface Window {
    ymaps?: YMaps;
  }
}

let loaderPromise: Promise<YMaps> | null = null;

/**
 * Yandex JS API'ni bir marta yuklab, `ymaps.ready` dan keyin tayyor obyektni
 * qaytaradi. Takroriy chaqiriqlar o'sha promise'ni qayta ishlatadi.
 * Kalit yo'q bo'lsa yoki skript yuklanmasa — xato (chaqiruvchi ushlaydi).
 */
export function loadYandexMaps(): Promise<YMaps> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Yandex Maps faqat brauzerda yuklanadi'));
  }
  if (loaderPromise) return loaderPromise;

  const apiKey =
    process.env.NEXT_PUBLIC_YANDEX_MAPS_KEY || '940df956-9edc-4494-a9a8-87e465ce14fe';
  if (!apiKey) {
    return Promise.reject(new Error('NEXT_PUBLIC_YANDEX_MAPS_KEY sozlanmagan'));
  }

  loaderPromise = new Promise<YMaps>((resolve, reject) => {
    if (window.ymaps) {
      window.ymaps.ready(() => resolve(window.ymaps as YMaps));
      return;
    }

    const existing = document.getElementById('yandex-maps-script') as HTMLScriptElement | null;
    const onReady = () => {
      if (window.ymaps) window.ymaps.ready(() => resolve(window.ymaps as YMaps));
      else reject(new Error('Yandex Maps yuklanmadi'));
    };

    if (existing) {
      existing.addEventListener('load', onReady);
      existing.addEventListener('error', () => reject(new Error('Yandex Maps skripti yuklanmadi')));
      return;
    }

    const script = document.createElement('script');
    script.id = 'yandex-maps-script';
    // lang=ru_RU — Yandex Maps 2.1 uz_UZ ni qo'llamaydi; O'zbekiston nomlari ru/mahalliy ko'rinadi.
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`;
    script.async = true;
    script.addEventListener('load', onReady);
    script.addEventListener('error', () => {
      loaderPromise = null; // keyingi urinishda qayta yuklashga imkon ber
      reject(new Error('Yandex Maps skripti yuklanmadi'));
    });
    document.head.appendChild(script);
  });

  return loaderPromise;
}

/** Koordinatani 6 xonali aniqlikka (≈ 11 sm) yaxlitlaydi — bazada shu formatda saqlanadi. */
export function roundCoord(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Koordinata bo'yicha manzil matnini (ko'cha, shahar) qaytaradi.
 * Topilmasa yoki xato bo'lsa — bo'sh satr (chaqiruvchi fallback qiladi).
 */
export async function reverseGeocode(ymaps: YMaps, { lat, lng }: LatLng): Promise<string> {
  try {
    const res = await ymaps.geocode([lat, lng], { results: 1 });
    const first = res.geoObjects.get(0);
    return first ? first.getAddressLine() : '';
  } catch {
    return '';
  }
}
