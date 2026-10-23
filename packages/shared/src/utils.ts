import { ALLOWED_STATUS_TRANSITIONS, CANCELLATION_ALLOWED_ROLES, TIYIN_PER_UZS } from './constants';
import { OrderStatus, SupportedLanguage, UserRole } from './enums';

/**
 * Converts integer tiyin to integer UZS.
 */
export function tiyinToUzs(tiyin: number): number {
  return Math.floor(tiyin / TIYIN_PER_UZS);
}

/**
 * Converts integer UZS to integer tiyin.
 */
export function uzsToTiyin(uzs: number): number {
  return Math.round(uzs * TIYIN_PER_UZS);
}

/**
 * Formats tiyin to standard display string (e.g., "45 000 so'm").
 */
export function formatPrice(tiyin: number, lang: SupportedLanguage = SupportedLanguage.UZ): string {
  const uzs = tiyinToUzs(tiyin);
  const formatted = uzs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  switch (lang) {
    case SupportedLanguage.RU:
      return `${formatted} сум`;
    case SupportedLanguage.EN:
      return `${formatted} UZS`;
    case SupportedLanguage.UZ:
    default:
      return `${formatted} so'm`;
  }
}

/**
 * Formats distance in meters to standard display string (e.g., "850 m" or "1.2 km").
 */
export function formatDistance(meters: number, lang: SupportedLanguage = SupportedLanguage.UZ): string {
  if (meters < 1000) {
    const rounded = Math.round(meters);
    switch (lang) {
      case SupportedLanguage.RU:
        return `${rounded} м`;
      case SupportedLanguage.EN:
      case SupportedLanguage.UZ:
      default:
        return `${rounded} m`;
    }
  }

  const km = (meters / 1000).toFixed(1);
  switch (lang) {
    case SupportedLanguage.RU:
      return `${km} км`;
    case SupportedLanguage.EN:
    case SupportedLanguage.UZ:
    default:
      return `${km} km`;
  }
}

/**
 * Validates if an order transition is permitted by business rules.
 */
export function canTransitionOrder(
  currentStatus: OrderStatus,
  targetStatus: OrderStatus,
  actorRole: UserRole,
): boolean {
  const allowedNext = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowedNext.includes(targetStatus)) {
    return false;
  }

  if (targetStatus === OrderStatus.CANCELLED) {
    const allowedRoles = CANCELLATION_ALLOWED_ROLES[currentStatus] || [];
    return allowedRoles.includes(actorRole);
  }

  // Seller moves forward
  if (actorRole === UserRole.SELLER || actorRole === UserRole.ADMIN) {
    return true;
  }

  return false;
}

/**
 * Whether a shop accepts orders right now: the manual `is_open` switch must be
 * on AND the current Uzbekistan local time (UTC+5, no DST) must fall inside the
 * `HH:mm` opening window. Windows that end before they start (e.g. 20:00-02:00)
 * are treated as overnight. Empty times fall back to 08:00-22:00.
 */
export function isShopOpenNow(
  openTime: string | null | undefined,
  closeTime: string | null | undefined,
  isOpen: boolean,
  now: Date = new Date(),
): boolean {
  if (!isOpen) {
    return false;
  }

  const uzHours = (now.getUTCHours() + 5) % 24;
  const currentMinutes = uzHours * 60 + now.getUTCMinutes();

  const [openH, openM] = (openTime || '08:00').split(':').map(Number);
  const [closeH, closeM] = (closeTime || '22:00').split(':').map(Number);
  const openTotal = openH * 60 + openM;
  const closeTotal = closeH * 60 + closeM;

  if (closeTotal > openTotal) {
    return currentMinutes >= openTotal && currentMinutes <= closeTotal;
  }
  // Overnight window (e.g. 20:00 to 02:00)
  return currentMinutes >= openTotal || currentMinutes <= closeTotal;
}

/**
 * Multilingual fallback resolver:
 * Attempts selected language; falls back to Uzbek, then to any non-empty string.
 */
export function resolveLocalizedText(
  texts: { uz?: string | null; ru?: string | null; en?: string | null },
  lang: SupportedLanguage = SupportedLanguage.UZ,
): string {
  if (texts[lang] && texts[lang]!.trim().length > 0) {
    return texts[lang]!.trim();
  }
  if (texts.uz && texts.uz.trim().length > 0) {
    return texts.uz.trim();
  }
  if (texts.ru && texts.ru.trim().length > 0) {
    return texts.ru.trim();
  }
  if (texts.en && texts.en.trim().length > 0) {
    return texts.en.trim();
  }
  return '';
}
