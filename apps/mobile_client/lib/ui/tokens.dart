import 'package:flutter/material.dart';

/// Brand + neutral palette directly matching the official Design System
/// from "Uygacha yetkazib berish ilovasi.pdf" (Page 16).
abstract final class AppColors {
  // Asosiy yashil (Tugma, aktiv holat): #0F5C45
  static const brand = Color(0xFF0F5C45);
  static const brandDark = Color(0xFF0B4634);
  static const brandLight = Color(0xFF147558);

  // Och yashil (Tanlangan fon, chiplar): #E8F3EE
  static const brandSoft = Color(0xFFE8F3EE);
  static const chipBg = Color(0xFFE8F3EE);

  // Aksent (Joylashuv, qo'ng'iroq, chegirmalar): #FF7A2F
  static const accent = Color(0xFFFF7A2F);
  static const accentLight = Color(0xFFFFF1E8);

  // Matn (Asosiy matn): #14231C
  static const textPrimary = Color(0xFF14231C);

  // Ikkilamchi matn (Izoh, yorliq): #4F6058
  static const textSecondary = Color(0xFF4F6058);
  static const textTertiary = Color(0xFF8A9A92);
  static const textOnBrand = Color(0xFFFFFFFF);

  // Fon (Ekran foni): #F3F6F4
  static const background = Color(0xFFF3F6F4);
  static const surface = Color(0xFFFFFFFF);
  static const white = Color(0xFFFFFFFF);

  // Chiziq (Chegara): #E1E8E4
  static const border = Color(0xFFE1E8E4);
  static const divider = Color(0xFFE1E8E4);

  // Xato (Xato, chiqish): #B42318
  static const danger = Color(0xFFB42318);
  static const dangerSoft = Color(0xFFFEE4E2);

  // Semantic
  static const success = brand;
  static const warning = accent;
  static const warningSoft = accentLight;
  static const info = Color(0xFF2563EB);
  static const infoSoft = Color(0xFFEFF6FF);

  // Compatibility aliases for existing components (strictly mapped to PDF palette)
  static const green50 = brandSoft;
  static const green100 = brandSoft;
  static const green200 = Color(0xFFD4E7DD);
  static const green300 = Color(0xFFA6D3BE);
  static const green400 = Color(0xFF5CAE8C);
  static const green500 = brand;
  static const green600 = brand;
  static const green700 = brandDark;
  static const green900 = Color(0xFF072B20);

  static const orange50 = accentLight;
  static const orange100 = accentLight;
  static const orange500 = accent;
  static const orange600 = Color(0xFFE0621B);

  // Neutral fills must stay distinguishable from the page background and the
  // border: search bars / unselected chips / skeletons sit on `background`,
  // so ink50/ink100 are one step lighter and darker than it respectively.
  static const ink50 = Color(0xFFF8FAF9);
  static const ink100 = Color(0xFFE9EFEB);
  static const ink200 = border;
  static const ink300 = Color(0xFFC9D3CD);
  static const ink400 = textTertiary;
  static const ink500 = textSecondary;
  static const ink600 = textSecondary;
  static const ink700 = Color(0xFF2C3E34);
  static const ink800 = Color(0xFF1F3027);
  static const ink900 = textPrimary;

  /// Pastel tints for the Home category tiles (cycled by index).
  static const categoryTints = [
    Color(0xFFF6D8A8),
    Color(0xFFCCE4F7),
    Color(0xFFD6E8D0),
    Color(0xFFF7D5CD),
    Color(0xFFE9D8F5),
    Color(0xFFFBE7B5),
  ];

  static const brandGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF147558), Color(0xFF0F5C45)],
  );
}

/// Spacing scale per PDF design system (Page 16): 4, 8, 12, 16, 20, 24, 32.
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

  /// Horizontal page gutter: 16px per PDF spec.
  static const double page = 16;
  static const pagePadding = EdgeInsets.symmetric(horizontal: page);
}

/// Border radii per PDF design system (Page 16):
/// Tugma: 16, balandlik 56 (ikkilamchi 48)
/// Karta: 20, ichki 16
/// Yuqori panel: 28
/// Kategoriya: 72x72, radius 20
abstract final class AppRadius {
  static const double xs = 8;
  static const double sm = 12;
  static const double button = 16;
  static const double md = 16;
  static const double lg = 20;
  static const double category = 20;
  static const double xl = 28;
  static const double xxl = 28;
  static const double pill = 999;

  // Numeric radii
  static const double rCard = 20;
  static const double rSheet = 28;

  // BorderRadius shapes
  static final BorderRadius card = BorderRadius.circular(rCard);
  static final BorderRadius cardRadius = BorderRadius.circular(rCard);
  static final BorderRadius control = BorderRadius.circular(button);
  static final BorderRadius chip = BorderRadius.circular(pill);
  static final BorderRadius sheet = const BorderRadius.vertical(top: Radius.circular(rSheet));
  static final BorderRadius sheetRadius = const BorderRadius.vertical(top: Radius.circular(rSheet));
}

/// Shadows per PDF design system (Page 16):
/// Chiqish soyasi: 0 4 16 rgba(20, 35, 28, 0.12)
abstract final class AppShadows {
  static const List<BoxShadow> none = [];

  static const List<BoxShadow> xs = [
    BoxShadow(color: Color(0x0F14231C), blurRadius: 4, offset: Offset(0, 1)),
  ];

  static const List<BoxShadow> sm = [
    BoxShadow(color: Color(0x1414231C), blurRadius: 8, offset: Offset(0, 2)),
  ];

  /// Two-tier soft shadow (0 1 2 + 0 8 24, 6-8% opacity) per premium design spec.
  static const List<BoxShadow> premium = [
    BoxShadow(color: Color(0x0F14231C), blurRadius: 4, offset: Offset(0, 1)),
    BoxShadow(color: Color(0x1414231C), blurRadius: 24, offset: Offset(0, 8)),
  ];

  /// Standard card / element shadow per PDF design system: rgba(20, 35, 28, 0.12)
  static const List<BoxShadow> md = premium;

  static const List<BoxShadow> lg = [
    BoxShadow(color: Color(0x1A14231C), blurRadius: 32, offset: Offset(0, 12)),
  ];

  /// Coloured glow under primary brand CTAs.
  static const List<BoxShadow> brand = [
    BoxShadow(color: Color(0x330F5C45), blurRadius: 20, offset: Offset(0, 8)),
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

/// Minimum tap target per PDF design system: 44x44
const double kMinTapTarget = 44;
const double kButtonHeightPrimary = 56;
const double kButtonHeightSecondary = 48;
