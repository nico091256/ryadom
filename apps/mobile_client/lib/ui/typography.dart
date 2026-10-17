import 'package:flutter/material.dart';

import 'tokens.dart';

/// Manrope typography scale per the design PDF ("Uygacha yetkazib berish
/// ilovasi", p.16): Sarlavha XL 32/800, L 28/800, M 20/800, Tugma 16/800,
/// Asosiy matn 15/700, Izoh 13/500, Yorliq 12/700.
///
/// The variable TTF is bundled (assets/fonts) — no runtime font download —
/// and weights are driven through `fontVariations` so every weight renders
/// crisply on web and native; `fontWeight` is set too for fallback engines.
abstract final class AppText {
  static const family = 'Manrope';

  static TextStyle _style(
    double size,
    int weight, {
    double? height,
    double letterSpacing = 0,
    Color color = AppColors.textPrimary,
    bool tabular = false,
  }) {
    return TextStyle(
      fontFamily: family,
      fontSize: size,
      fontWeight: _weight(weight),
      fontVariations: [FontVariation('wght', weight.toDouble())],
      height: height,
      letterSpacing: letterSpacing,
      color: color,
      fontFeatures: tabular ? const [FontFeature.tabularFigures()] : null,
      decoration: TextDecoration.none,
    );
  }

  static FontWeight _weight(int w) => switch (w) {
        <= 300 => FontWeight.w300,
        <= 400 => FontWeight.w400,
        <= 500 => FontWeight.w500,
        <= 600 => FontWeight.w600,
        <= 700 => FontWeight.w700,
        <= 800 => FontWeight.w800,
        _ => FontWeight.w900,
      };

  // Headings (PDF names kept as the canonical ones; English aliases below).
  static final sarlavhaXL = _style(32, 800, height: 1.15, letterSpacing: -0.6);
  static final sarlavhaL = _style(28, 800, height: 1.2, letterSpacing: -0.4);
  static final sarlavhaM = _style(20, 800, height: 1.25, letterSpacing: -0.2);

  static final display = sarlavhaXL;
  static final h1 = sarlavhaL;
  static final h2 = sarlavhaM;
  static final h3 = _style(18, 700, height: 1.3, letterSpacing: -0.2);
  static final title = _style(16, 700, height: 1.35, letterSpacing: -0.1);

  // Button: 16 / 800
  static final tugma = _style(16, 800, height: 1.2);
  static final button = tugma;
  static final buttonSm = _style(14, 700, height: 1.2);

  // Body: 15 / 700 is the PDF "asosiy matn"; regular body is 15 / 500.
  static final asosiyMatn = _style(15, 700, height: 1.45);
  static final bodyStrong = asosiyMatn;
  static final body = _style(15, 500, height: 1.45);
  static final bodyLg = _style(16, 500, height: 1.5);
  static final bodyMedium = _style(14, 500, height: 1.45);
  static final bodySm = _style(13, 500, height: 1.4, color: AppColors.textSecondary);
  static final bodySmStrong = _style(13, 700, height: 1.4);

  // Izoh: 13 / 500
  static final izoh = _style(13, 500, height: 1.35, color: AppColors.textSecondary);
  static final caption = izoh;
  static final captionStrong = _style(13, 700, height: 1.35);

  // Yorliq: 12 / 700
  static final yorliq = _style(12, 700, height: 1.3, color: AppColors.textSecondary);
  static final label = yorliq;
  static final chip = _style(13, 700, height: 1.2);
  static final overline = _style(11, 700, height: 1.3, letterSpacing: 0.5, color: AppColors.textTertiary);
  static final micro = _style(10, 700, height: 1.2);

  // Money — always tabular so digits align in lists.
  static final priceHero = _style(28, 800, height: 1.15, letterSpacing: -0.5, tabular: true);
  static final priceLg = _style(22, 800, height: 1.2, letterSpacing: -0.4, tabular: true);
  static final price = _style(16, 800, height: 1.2, letterSpacing: -0.2, tabular: true);
  static final priceSm = _style(14, 700, height: 1.2, tabular: true);
  static final numeric = _style(14, 700, height: 1.3, tabular: true);

  /// Builds the Material TextTheme from the scale so stock widgets inherit Manrope.
  static TextTheme textTheme() => TextTheme(
        displayLarge: sarlavhaXL,
        displayMedium: sarlavhaL,
        displaySmall: sarlavhaM,
        headlineLarge: sarlavhaL,
        headlineMedium: sarlavhaM,
        headlineSmall: h3,
        titleLarge: h3,
        titleMedium: title,
        titleSmall: bodyStrong,
        bodyLarge: bodyLg,
        bodyMedium: body,
        bodySmall: bodySm,
        labelLarge: button,
        labelMedium: label,
        labelSmall: overline,
      );
}

extension AppTextStyleX on TextStyle {
  TextStyle withColor(Color color) => copyWith(color: color);
  TextStyle get secondary => copyWith(color: AppColors.textSecondary);
  TextStyle get tertiary => copyWith(color: AppColors.textTertiary);
  TextStyle get onBrand => copyWith(color: AppColors.textOnBrand);
  TextStyle get brand => copyWith(color: AppColors.brand);
  TextStyle get danger => copyWith(color: AppColors.danger);

  /// Changes weight while keeping the variable-font axis in sync.
  TextStyle weight(int w) => copyWith(
        fontWeight: AppText._weight(w),
        fontVariations: [FontVariation('wght', w.toDouble())],
      );
}
