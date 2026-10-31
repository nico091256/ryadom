import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../common/redis/cache.service';

/** Natijalar bir kun keshlanadi — Yandex bepul tarifini (1000/kun) tejaydi. */
const CACHE_TTL_SECONDS = 24 * 60 * 60;
/** Tashqi so'rov uchun maksimal kutish. */
const REQUEST_TIMEOUT_MS = 7000;

/**
 * Yandex Geocoder HTTP API uchun server-side proxy.
 *
 * Mijoz ilovasi (Flutter web + mobil) to'g'ridan-to'g'ri Yandex'ga murojaat
 * qila olmaydi: web'da CORS bloklaydi va API kalit brauzerda ochilib qolardi.
 * Shu servis kalitni yashiradi, natijani Redis'da keshlaydi va kalit sozlanmagan
 * bo'lsa `null` qaytaradi (chaqiruvchi koordinataga fallback qiladi).
 */
@Injectable()
export class GeocodeService {
  private readonly logger = new Logger(GeocodeService.name);

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly cache?: CacheService,
  ) {}

  /** `lang` (uz/ru/en) ni Yandex Geocoder qo'llaydigan kodga moslaydi. */
  private mapLang(lang?: string): string {
    switch ((lang || '').toLowerCase()) {
      case 'en':
        return 'en_US';
      case 'ru':
        return 'ru_RU';
      // Yandex Geocoder uz_UZ ni qo'llamaydi — O'zbekiston manzillari ru_RU'da to'liq qaytadi.
      default:
        return 'ru_RU';
    }
  }

  /**
   * Koordinata bo'yicha manzil matni. Topilmasa, kalit yo'q bo'lsa yoki xato
   * bo'lsa — `null`.
   */
  async reverseGeocode(lat: number, lng: number, lang?: string): Promise<string | null> {
    const ylang = this.mapLang(lang);
    // 5 kasr ≈ 1 m aniqlik; yaqin nuqtalar bitta kesh yozuvini ulashadi.
    const cacheKey = `geocode:rev:${lat.toFixed(5)}:${lng.toFixed(5)}:${ylang}`;

    const cached = await this.cache?.get<{ address: string | null }>(cacheKey);
    if (cached !== null && cached !== undefined) return cached.address;

    const apiKey = this.config.get<string>('YANDEX_GEOCODER_API_KEY');
    if (!apiKey) {
      this.logger.debug('YANDEX_GEOCODER_API_KEY sozlanmagan — reverse geocode o\'tkazib yuborildi');
      return null;
    }

    const address = await this.callYandex(apiKey, lat, lng, ylang);
    // Manfiy natijani ham keshlaymiz (qisqaroq umr bilan) — takroriy urinishlarni cheklaydi.
    await this.cache?.set(cacheKey, { address }, address ? CACHE_TTL_SECONDS : 60 * 10);
    return address;
  }

  private async callYandex(apiKey: string, lat: number, lng: number, ylang: string): Promise<string | null> {
    const url =
      'https://geocode-maps.yandex.ru/1.x/' +
      `?apikey=${encodeURIComponent(apiKey)}` +
      '&format=json&results=1&kind=house' +
      `&lang=${ylang}` +
      // Yandex uzunlik,kenglik (lng,lat) tartibini kutadi.
      `&geocode=${lng},${lat}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        this.logger.warn(`Yandex geocoder HTTP ${res.status}`);
        return null;
      }
      const data: any = await res.json();
      const member = data?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
      const text: string | undefined = member?.metaDataProperty?.GeocoderMetaData?.text;
      return text && text.trim() ? text.trim() : null;
    } catch (err: any) {
      this.logger.warn(`Yandex geocoder xatosi: ${err?.message ?? err}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
