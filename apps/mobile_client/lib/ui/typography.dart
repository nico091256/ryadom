import 'package:flutter/material.dart';

import 'tokens.dart';

/// Inter (variable) typography scale. Weights are driven through
/// `fontVariations` so the single bundled TTF renders every weight crisply
/// on web and native; `fontWeight` is set too for engines that fall back.
abstract final class AppText {
  static const family = 'Inter';

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

  // Display / headings — tight tracking, heavy weight.
  static final display = _style(32, 800, height: 1.15, letterSpacing: -0.8);
  static final h1 = _style(26, 800, height: 1.2, letterSpacing: -0.6);
  static final h2 = _style(22, 700, height: 1.25, letterSpacing: -0.4);
  static final h3 = _style(18, 700, height: 1.3, letterSpacing: -0.3);
  static final title = _style(16, 700, height: 1.35, letterSpacing: -0.2);

  // Body
  static final bodyLg = _style(16, 400, height: 1.5);
  static final body = _style(14, 400, height: 1.5);
  static final bodyMedium = _style(14, 500, height: 1.5);
  static final bodyStrong = _style(14, 600, height: 1.4);
  static final bodySm = _style(13, 400, height: 1.45, color: AppColors.textSecondary);
  static final bodySmStrong = _style(13, 600, height: 1.4);

  // Supporting
  static final caption = _style(12, 500, height: 1.35, color: AppColors.textSecondary);
  static final captionStrong = _style(12, 600, height: 1.35);
  static final overline = _style(11, 700, height: 1.3, letterSpacing: 0.6, color: AppColors.textTertiary);
  static final micro = _style(10, 600, height: 1.2, letterSpacing: 0.2);

  // Controls
  static final button = _style(15, 700, height: 1.2, letterSpacing: -0.1);
  static final buttonSm = _style(13, 700, height: 1.2);
  static final chip = _style(13, 600, height: 1.2);
  static final label = _style(13, 600, height: 1.3, color: AppColors.textSecondary);

  // Money — always tabular so digits align in lists.
  static final priceLg = _style(20, 800, height: 1.2, letterSpacing: -0.4, tabular: true);
  static final price = _style(16, 800, height: 1.2, letterSpacing: -0.2, tabular: true);
  static final priceSm = _style(14, 700, height: 1.2, tabular: true);
  static final numeric = _style(14, 600, height: 1.3, tabular: true);

  /// Builds the Material TextTheme from the scale so default widgets inherit Inter.
  static TextTheme textTheme() => TextTheme(
        displayLarge: display,
        displayMedium: h1,
        displaySmall: h2,
        headlineLarge: h1,
        headlineMedium: h2,
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
