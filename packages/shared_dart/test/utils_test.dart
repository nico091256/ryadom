import 'package:localshop_shared/localshop_shared.dart';
import 'package:test/test.dart';

void main() {
  group('Price & Currency Calculations', () {
    test('converts tiyin to UZS correctly', () {
      expect(tiyinToUzs(800000), 8000);
      expect(tiyinToUzs(1250000), 12500);
    });

    test('converts UZS to tiyin correctly', () {
      expect(uzsToTiyin(8000), 800000);
      expect(uzsToTiyin(45000), 4500000);
    });

    test('formats price according to language requirements', () {
      expect(formatPrice(4500000, SupportedLanguage.uz), "45 000 so'm");
      expect(formatPrice(4500000, SupportedLanguage.ru), '45 000 сум');
      expect(formatPrice(4500000, SupportedLanguage.en), '45 000 UZS');
    });
  });

  group('Distance Formatting', () {
    test('formats meters under 1 km correctly', () {
      expect(formatDistance(850, SupportedLanguage.uz), '850 m');
      expect(formatDistance(850, SupportedLanguage.ru), '850 м');
    });

    test('formats distances 1 km and above as decimal km', () {
      expect(formatDistance(1200, SupportedLanguage.uz), '1.2 km');
      expect(formatDistance(2500, SupportedLanguage.ru), '2.5 км');
    });
  });

  group('Order State Machine Transitions (4-state spec)', () {
    test('allows valid normal lifecycle: new -> accepted -> on_the_way -> delivered', () {
      expect(canTransitionOrder(OrderStatus.newOrder, OrderStatus.accepted, UserRole.seller), isTrue);
      expect(canTransitionOrder(OrderStatus.accepted, OrderStatus.onTheWay, UserRole.seller), isTrue);
      expect(canTransitionOrder(OrderStatus.onTheWay, OrderStatus.delivered, UserRole.seller), isTrue);
    });

    test('allows customer to cancel only while order is new', () {
      expect(canTransitionOrder(OrderStatus.newOrder, OrderStatus.cancelled, UserRole.customer), isTrue);
      expect(canTransitionOrder(OrderStatus.accepted, OrderStatus.cancelled, UserRole.customer), isFalse);
      expect(canTransitionOrder(OrderStatus.onTheWay, OrderStatus.cancelled, UserRole.customer), isFalse);
    });

    test('allows seller to cancel from new or accepted, but not once on the way', () {
      expect(canTransitionOrder(OrderStatus.newOrder, OrderStatus.cancelled, UserRole.seller), isTrue);
      expect(canTransitionOrder(OrderStatus.accepted, OrderStatus.cancelled, UserRole.seller), isTrue);
      expect(canTransitionOrder(OrderStatus.onTheWay, OrderStatus.cancelled, UserRole.seller), isFalse);
      expect(canTransitionOrder(OrderStatus.delivered, OrderStatus.cancelled, UserRole.seller), isFalse);
    });

    test('allows only the admin to cancel an order that is already on the way', () {
      expect(canTransitionOrder(OrderStatus.onTheWay, OrderStatus.cancelled, UserRole.admin), isTrue);
      expect(canTransitionOrder(OrderStatus.onTheWay, OrderStatus.cancelled, UserRole.seller), isFalse);
      expect(canTransitionOrder(OrderStatus.onTheWay, OrderStatus.cancelled, UserRole.customer), isFalse);
      expect(canTransitionOrder(OrderStatus.delivered, OrderStatus.cancelled, UserRole.admin), isFalse);
    });

    test('rejects invalid or illegal skips in state progression', () {
      expect(canTransitionOrder(OrderStatus.newOrder, OrderStatus.onTheWay, UserRole.seller), isFalse);
      expect(canTransitionOrder(OrderStatus.newOrder, OrderStatus.delivered, UserRole.seller), isFalse);
      expect(canTransitionOrder(OrderStatus.delivered, OrderStatus.newOrder, UserRole.seller), isFalse);
      expect(canTransitionOrder(OrderStatus.cancelled, OrderStatus.accepted, UserRole.seller), isFalse);
    });
  });

  group('Multilingual Fallback Resolver', () {
    test('returns exact requested language if present', () {
      expect(
        resolveLocalizedText(uz: 'Olma', ru: 'Яблоки', en: 'Apples', lang: SupportedLanguage.ru),
        'Яблоки',
      );
    });

    test('falls back to Uzbek first if requested language is missing', () {
      expect(resolveLocalizedText(uz: 'Non', ru: '', en: '', lang: SupportedLanguage.en), 'Non');
      expect(resolveLocalizedText(uz: 'Non', ru: '', en: '', lang: SupportedLanguage.ru), 'Non');
    });
  });
}
