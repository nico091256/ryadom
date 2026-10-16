import {
  OrderStatus,
  UserRole,
  canTransitionOrder,
  formatPrice,
  formatDistance,
  tiyinToUzs,
  uzsToTiyin,
  SupportedLanguage,
  resolveLocalizedText,
} from '@localshop/shared';

describe('Domain Utils & State Transitions', () => {
  describe('Price & Currency Calculations', () => {
    it('converts tiyin to UZS correctly', () => {
      expect(tiyinToUzs(800000)).toBe(8000);
      expect(tiyinToUzs(1250000)).toBe(12500);
    });

    it('converts UZS to tiyin correctly', () => {
      expect(uzsToTiyin(8000)).toBe(800000);
      expect(uzsToTiyin(45000)).toBe(4500000);
    });

    it('formats price according to language requirements (Section 10)', () => {
      expect(formatPrice(4500000, SupportedLanguage.UZ)).toBe("45 000 so'm");
      expect(formatPrice(4500000, SupportedLanguage.RU)).toBe('45 000 сум');
      expect(formatPrice(4500000, SupportedLanguage.EN)).toBe('45 000 UZS');
    });
  });

  describe('Distance Formatting', () => {
    it('formats meters under 1 km correctly (Section 14 UI rules)', () => {
      expect(formatDistance(850, SupportedLanguage.UZ)).toBe('850 m');
      expect(formatDistance(850, SupportedLanguage.RU)).toBe('850 м');
    });

    it('formats distances 1 km and above as decimal km', () => {
      expect(formatDistance(1200, SupportedLanguage.UZ)).toBe('1.2 km');
      expect(formatDistance(2500, SupportedLanguage.RU)).toBe('2.5 км');
    });
  });

  describe('Order State Machine Transitions (4-state spec)', () => {
    it('allows valid normal lifecycle: new -> accepted -> on_the_way -> delivered', () => {
      expect(canTransitionOrder(OrderStatus.NEW, OrderStatus.ACCEPTED, UserRole.SELLER)).toBe(true);
      expect(canTransitionOrder(OrderStatus.ACCEPTED, OrderStatus.ON_THE_WAY, UserRole.SELLER)).toBe(true);
      expect(canTransitionOrder(OrderStatus.ON_THE_WAY, OrderStatus.DELIVERED, UserRole.SELLER)).toBe(true);
    });

    it('allows customer to cancel only while order is new', () => {
      expect(canTransitionOrder(OrderStatus.NEW, OrderStatus.CANCELLED, UserRole.CUSTOMER)).toBe(true);
      expect(canTransitionOrder(OrderStatus.ACCEPTED, OrderStatus.CANCELLED, UserRole.CUSTOMER)).toBe(false);
      expect(canTransitionOrder(OrderStatus.ON_THE_WAY, OrderStatus.CANCELLED, UserRole.CUSTOMER)).toBe(false);
    });

    it('allows seller to cancel from new or accepted, but not once on the way', () => {
      expect(canTransitionOrder(OrderStatus.NEW, OrderStatus.CANCELLED, UserRole.SELLER)).toBe(true);
      expect(canTransitionOrder(OrderStatus.ACCEPTED, OrderStatus.CANCELLED, UserRole.SELLER)).toBe(true);
      expect(canTransitionOrder(OrderStatus.ON_THE_WAY, OrderStatus.CANCELLED, UserRole.SELLER)).toBe(false);
      expect(canTransitionOrder(OrderStatus.DELIVERED, OrderStatus.CANCELLED, UserRole.SELLER)).toBe(false);
    });

    it('rejects invalid or illegal skips in state progression', () => {
      expect(canTransitionOrder(OrderStatus.NEW, OrderStatus.ON_THE_WAY, UserRole.SELLER)).toBe(false);
      expect(canTransitionOrder(OrderStatus.NEW, OrderStatus.DELIVERED, UserRole.SELLER)).toBe(false);
      expect(canTransitionOrder(OrderStatus.DELIVERED, OrderStatus.NEW, UserRole.SELLER)).toBe(false);
      expect(canTransitionOrder(OrderStatus.CANCELLED, OrderStatus.ACCEPTED, UserRole.SELLER)).toBe(false);
    });
  });

  describe('Multilingual Fallback Resolver (Section 5 & 10)', () => {
    it('returns exact requested language if present', () => {
      const text = { uz: 'Olma', ru: 'Яблоки', en: 'Apples' };
      expect(resolveLocalizedText(text, SupportedLanguage.RU)).toBe('Яблоки');
    });

    it('falls back to Uzbek first if requested language is missing', () => {
      const text = { uz: 'Non', ru: '', en: '' };
      expect(resolveLocalizedText(text, SupportedLanguage.EN)).toBe('Non');
      expect(resolveLocalizedText(text, SupportedLanguage.RU)).toBe('Non');
    });
  });
});
