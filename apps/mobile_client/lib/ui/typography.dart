import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'tokens.dart';

/// Manrope typography scale directly per PDF Design System (Page 16).
/// Sarlavha XL: 32 / 800
/// Sarlavha L: 28 / 800
/// Sarlavha M: 20 / 800
/// Tugma: 16 / 800
/// Asosiy matn: 15 / 700
/// Izoh: 13 / 500
/// Yorliq: 12 / 700
abstract final class AppText {
  static const family = 'Manrope';

  static TextStyle _style(
    double size,
    FontWeight weight, {
    double? height,
    double letterSpacing = 0,
    Color color = AppColors.textPrimary,
    bool tabular = false,
  }) {
    return GoogleFonts.manrope(
      fontSize: size,
      fontWeight: weight,
      height: height,
      letterSpacing: letterSpacing,
      color: color,
      fontFeatures: tabular ? const [FontFeature.tabularFigures()] : null,
      decoration: TextDecoration.none,
    );
  }

  // Display / headings from PDF design system
  static final sarlavhaXL = _style(32, FontWeight.w800, height: 1.15, letterSpacing: -0.6);
  static final sarlavhaL = _style(28, FontWeight.w800, height: 1.2, letterSpacing: -0.4);
  static final sarlavhaM = _style(20, FontWeight.w800, height: 1.25, letterSpacing: -0.2);

  // Synonyms for compatibility
  static final display = sarlavhaXL;
  static final h1 = sarlavhaL;
  static final h2 = sarlavhaM;
  static final h3 = _style(18, FontWeight.w700, height: 1.3);
  static final title = _style(16, FontWeight.w700, height: 1.35);

  // Button per PDF: 16 / 800
  static final tugma = _style(16, FontWeight.w800, height: 1.2);
  static final button = tugma;
  static final buttonSm = _style(14, FontWeight.w700, height: 1.2);

  // Asosiy matn per PDF: 15 / 700
  static final asosiyMatn = _style(15, FontWeight.w700, height: 1.45);
  static final bodyStrong = asosiyMatn;
  static final body = _style(15, FontWeight.w500, height: 1.45);
  static final bodyLg = _style(16, FontWeight.w500, height: 1.5);
  static final bodyMedium = _style(14, FontWeight.w500, height: 1.45);
  static final bodySm = _style(13, FontWeight.w400, height: 1.4, color: AppColors.textSecondary);
  static final bodySmStrong = _style(13, FontWeight.w600, height: 1.4);

  // Izoh per PDF: 13 / 500
  static final izoh = _style(13, FontWeight.w500, height: 1.35, color: AppColors.textSecondary);
  static final caption = izoh;
  static final captionStrong = _style(13, FontWeight.w600, height: 1.35);

  // Yorliq per PDF: 12 / 700
  static final yorliq = _style(12, FontWeight.w700, height: 1.3, color: AppColors.textSecondary);
  static final label = yorliq;
  static final chip = _style(13, FontWeight.w600, height: 1.2);
  static final overline = _style(11, FontWeight.w700, height: 1.3, letterSpacing: 0.5, color: AppColors.textTertiary);
  static final micro = _style(10, FontWeight.w600, height: 1.2);

  // Money / Price figures (always tabular)
  static final priceLg = _style(22, FontWeight.w800, height: 1.2, letterSpacing: -0.4, tabular: true);
  static final price = _style(16, FontWeight.w800, height: 1.2, letterSpacing: -0.2, tabular: true);
  static final priceSm = _style(14, FontWeight.w700, height: 1.2, tabular: true);
  static final numeric = _style(14, FontWeight.w600, height: 1.3, tabular: true);

  /// Builds the Material TextTheme using Manrope.
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

  TextStyle weight(int w) => copyWith(
        fontWeight: switch (w) {
          <= 300 => FontWeight.w300,
          <= 400 => FontWeight.w400,
          <= 500 => FontWeight.w500,
          <= 600 => FontWeight.w600,
          <= 700 => FontWeight.w700,
          <= 800 => FontWeight.w800,
          _ => FontWeight.w900,
        },
      );
}
