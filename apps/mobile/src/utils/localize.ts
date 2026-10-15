import type { TFunction } from 'i18next';
import { OrderStatus, SupportedLanguage, resolveLocalizedText } from '@localshop/shared';
import { Clock, CheckCircle, Package, Truck, XCircle } from 'lucide-react-native';

/** Normalises i18next's language code ("ru-RU", "en", undefined) to a SupportedLanguage. */
export function toSupportedLang(lang?: string | null): SupportedLanguage {
  const base = (lang || '').slice(0, 2).toLowerCase();
  if (base === SupportedLanguage.RU) return SupportedLanguage.RU;
  if (base === SupportedLanguage.EN) return SupportedLanguage.EN;
  return SupportedLanguage.UZ;
}

/** BCP-47 locale tag for Date#toLocale*String in the current UI language. */
export function localeTag(lang?: string | null): string {
  switch (toSupportedLang(lang)) {
    case SupportedLanguage.RU:
      return 'ru-RU';
    case SupportedLanguage.EN:
      return 'en-US';
    default:
      return 'uz-UZ';
  }
}

/**
 * Picks `<field>_<lang>` from an API entity (e.g. name_ru), falling back to Uzbek
 * and then to any non-empty translation.
 */
export function localizedField(
  entity: Record<string, any> | null | undefined,
  field: string,
  lang?: string | null,
): string {
  if (!entity) return '';
  return resolveLocalizedText(
    { uz: entity[`${field}_uz`], ru: entity[`${field}_ru`], en: entity[`${field}_en`] },
    toSupportedLang(lang),
  );
}

/** Shared colours/icons per order status; labels always come from the orderStatus.* translations. */
export const ORDER_STATUS_META: Record<string, { bg: string; color: string; icon: any }> = {
  [OrderStatus.NEW]: { bg: '#fef3c7', color: '#d97706', icon: Clock },
  [OrderStatus.ACCEPTED]: { bg: '#dcfce7', color: '#16a34a', icon: CheckCircle },
  [OrderStatus.PREPARING]: { bg: '#dcfce7', color: '#16a34a', icon: Package },
  [OrderStatus.ON_THE_WAY]: { bg: '#dbeafe', color: '#2563eb', icon: Truck },
  [OrderStatus.DELIVERED]: { bg: '#f1f5f9', color: '#16a34a', icon: CheckCircle },
  [OrderStatus.CANCELLED]: { bg: '#ffe4e6', color: '#e11d48', icon: XCircle },
};

export function getOrderStatusBadge(t: TFunction, status: string) {
  const meta = ORDER_STATUS_META[status] || { bg: '#f1f5f9', color: '#64748b', icon: Clock };
  const text = ORDER_STATUS_META[status] ? t(`orderStatus.${status}`) : status;
  return { ...meta, text };
}

/** Translated "Entrance 2, Floor 5, Apt 45" line; empty string when no details are set. */
export function formatAddressDetailsT(
  t: TFunction,
  a: { entrance?: string | null; floor?: string | null; apartment?: string | null; door_code?: string | null },
): string {
  return [
    a.entrance && t('customer.address.detailEntrance', { value: a.entrance }),
    a.floor && t('customer.address.detailFloor', { value: a.floor }),
    a.apartment && t('customer.address.detailApartment', { value: a.apartment }),
    a.door_code && t('customer.address.detailDoorCode', { value: a.door_code }),
  ]
    .filter(Boolean)
    .join(', ');
}

/** Saved-address titles are stored as Uzbek presets ('Uy' | 'Ish' | 'Boshqa'); show them translated. */
const ADDRESS_TITLE_KEYS: Record<string, string> = {
  Uy: 'customer.address.typeHome',
  Ish: 'customer.address.typeWork',
  Boshqa: 'customer.address.typeOther',
};

export function addressTitleLabel(t: TFunction, title?: string | null): string {
  if (!title) return '';
  return ADDRESS_TITLE_KEYS[title] ? t(ADDRESS_TITLE_KEYS[title]) : title;
}
