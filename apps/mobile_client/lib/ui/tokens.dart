import 'package:flutter/material.dart';

/// Brand + neutral palette. Hand-tuned (not seed-generated) so every tone is
/// intentional: green is the brand, orange is reserved for promos/discounts,
/// amber for "closed/attention", red for destructive/error.
abstract final class AppColors {
  // Brand green
  static const green50 = Color(0xFFF0FDF4);
  static const green100 = Color(0xFFDCFCE7);
  static const green200 = Color(0xFFBBF7D0);
  static const green300 = Color(0xFF86EFAC);
  static const green400 = Color(0xFF4ADE80);
  static const green500 = Color(0xFF16A34A);
  static const green600 = Color(0xFF15803D);
  static const green700 = Color(0xFF166534);
  static const green900 = Color(0xFF14532D);

  static const brand = green500;
  static const brandDark = green600;
  static const brandSoft = green50;

  // Accent (promo, discounts, highlights)
  static const orange50 = Color(0xFFFFF7ED);
  static const orange100 = Color(0xFFFFEDD5);
  static const orange500 = Color(0xFFF97316);
  static const orange600 = Color(0xFFEA580C);

  // Neutrals (ink scale)
  static const ink900 = Color(0xFF0B1220);
  static const ink800 = Color(0xFF1E293B);
  static const ink700 = Color(0xFF334155);
  static const ink600 = Color(0xFF475569);
  static const ink500 = Color(0xFF64748B);
  static const ink400 = Color(0xFF94A3B8);
  static const ink300 = Color(0xFFCBD5E1);
  static const ink200 = Color(0xFFE2E8F0);
  static const ink100 = Color(0xFFF1F5F9);
  static const ink50 = Color(0xFFF8FAFC);
  static const white = Color(0xFFFFFFFF);

  /// Page background — a hair warmer than slate-50 so white cards lift off it.
  static const background = Color(0xFFF5F6F8);
  static const surface = white;
  static const border = ink200;
  static const divider = Color(0xFFEEF1F5);

  // Semantic
  static const success = green500;
  static const warning = Color(0xFFF59E0B);
  static const warningSoft = Color(0xFFFFFBEB);
  static const danger = Color(0xFFEF4444);
  static const dangerSoft = Color(0xFFFEF2F2);
  static const info = Color(0xFF3B82F6);
  static const infoSoft = Color(0xFFEFF6FF);

  // Text
  static const textPrimary = ink900;
  static const textSecondary = ink500;
  static const textTertiary = ink400;
  static const textOnBrand = white;

  static const brandGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF22C55E), Color(0xFF15803D)],
  );
}

/// 4-pt spacing scale.
abstract final class AppSpacing {
  static const double xxs = 2;
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
  static const double xxxl = 32;
  static const double huge = 48;

  /// Horizontal page gutter.
  static const double page = 16;
  static const pagePadding = EdgeInsets.symmetric(horizontal: page);
}

abstract final class AppRadius {
  static const double xs = 8;
  static const double sm = 12;
  static const double md = 16;
  static const double lg = 20;
  static const double xl = 24;
  static const double xxl = 28;
  static const double pill = 999;

  static final BorderRadius card = BorderRadius.circular(lg);
  static final BorderRadius control = BorderRadius.circular(md);
  static final BorderRadius chip = BorderRadius.circular(pill);
  static final BorderRadius sheet = const BorderRadius.vertical(top: Radius.circular(xxl));
}

/// Two-layer soft shadows (ambient + key) — never a single hard drop shadow.
abstract final class AppShadows {
  static const List<BoxShadow> none = [];

  static const List<BoxShadow> xs = [
    BoxShadow(color: Color(0x0A0B1220), blurRadius: 2, offset: Offset(0, 1)),
  ];

  static const List<BoxShadow> sm = [
    BoxShadow(color: Color(0x0A0B1220), blurRadius: 3, offset: Offset(0, 1)),
    BoxShadow(color: Color(0x0F0B1220), blurRadius: 12, offset: Offset(0, 4)),
  ];

  static const List<BoxShadow> md = [
    BoxShadow(color: Color(0x0D0B1220), blurRadius: 6, offset: Offset(0, 2)),
    BoxShadow(color: Color(0x140B1220), blurRadius: 24, offset: Offset(0, 10)),
  ];

  static const List<BoxShadow> lg = [
    BoxShadow(color: Color(0x100B1220), blurRadius: 10, offset: Offset(0, 4)),
    BoxShadow(color: Color(0x1A0B1220), blurRadius: 40, offset: Offset(0, 20)),
  ];

  /// Coloured glow under primary CTAs.
  static const List<BoxShadow> brand = [
    BoxShadow(color: Color(0x3316A34A), blurRadius: 20, offset: Offset(0, 8)),
  ];
}

abstract final class AppDurations {
  static const fast = Duration(milliseconds: 120);
  static const normal = Duration(milliseconds: 200);
  static const slow = Duration(milliseconds: 320);
  static const page = Duration(milliseconds: 280);
}

abstract final class AppCurves {
  static const standard = Curves.easeOutCubic;
  static const emphasized = Curves.easeOutQuart;
  static const spring = Curves.easeOutBack;
}

/// Minimum tap target per platform guidelines.
const double kMinTapTarget = 44;
