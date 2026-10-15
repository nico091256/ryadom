/// Mirrors packages/shared/src/utils.ts. Keep the two files in sync by hand —
/// nothing regenerates this automatically.
library;

import 'constants.dart';
import 'enums.dart';

/// Converts integer tiyin to integer UZS.
int tiyinToUzs(int tiyin) => tiyin ~/ tiyinPerUzs;

/// Converts integer UZS to integer tiyin.
int uzsToTiyin(int uzs) => uzs * tiyinPerUzs;

/// Formats tiyin to a standard display string (e.g. "45 000 so'm").
String formatPrice(int tiyin, [SupportedLanguage lang = SupportedLanguage.uz]) {
  final uzs = tiyinToUzs(tiyin);
  final formatted = _groupThousands(uzs);
  switch (lang) {
    case SupportedLanguage.ru:
      return '$formatted сум';
    case SupportedLanguage.en:
      return '$formatted UZS';
    case SupportedLanguage.uz:
      return "$formatted so'm";
  }
}

/// Formats distance in meters to a standard display string (e.g. "850 m" or
/// "1.2 km").
String formatDistance(num meters, [SupportedLanguage lang = SupportedLanguage.uz]) {
  if (meters < 1000) {
    final rounded = meters.round();
    return lang == SupportedLanguage.ru ? '$rounded м' : '$rounded m';
  }

  final km = (meters / 1000).toStringAsFixed(1);
  return lang == SupportedLanguage.ru ? '$km км' : '$km km';
}

/// Validates whether an order transition is permitted by business rules.
bool canTransitionOrder(OrderStatus currentStatus, OrderStatus targetStatus, UserRole actorRole) {
  final allowedNext = allowedStatusTransitions[currentStatus] ?? const [];
  if (!allowedNext.contains(targetStatus)) {
    return false;
  }

  if (targetStatus == OrderStatus.cancelled) {
    final allowedRoles = cancellationAllowedRoles[currentStatus] ?? const [];
    return allowedRoles.contains(actorRole);
  }

  // Seller/admin move the order forward.
  return actorRole == UserRole.seller || actorRole == UserRole.admin;
}

/// Multilingual fallback resolver: tries the selected language, then falls
/// back to Uzbek, then to any non-empty string.
String resolveLocalizedText({
  String? uz,
  String? ru,
  String? en,
  SupportedLanguage lang = SupportedLanguage.uz,
}) {
  final byLang = {SupportedLanguage.uz: uz, SupportedLanguage.ru: ru, SupportedLanguage.en: en};

  final requested = byLang[lang];
  if (requested != null && requested.trim().isNotEmpty) return requested.trim();
  if (uz != null && uz.trim().isNotEmpty) return uz.trim();
  if (ru != null && ru.trim().isNotEmpty) return ru.trim();
  if (en != null && en.trim().isNotEmpty) return en.trim();
  return '';
}

String _groupThousands(int value) {
  final digits = value.abs().toString();
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buffer.write(' ');
    buffer.write(digits[i]);
  }
  return value < 0 ? '-${buffer.toString()}' : buffer.toString();
}
