import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../ui/tokens.dart';
import '../ui/typography.dart';

/// Material theme assembled from the design tokens in `lib/ui/`.
/// Screens should reach for `AppColors` / `AppText` / the `lib/ui` components
/// directly; this theme only makes stock Material widgets look right.
class AppTheme {
  AppTheme._();

  /// Kept for call sites that still reference the old seed colour.
  static const seed = AppColors.brand;

  static ThemeData light() {
    const scheme = ColorScheme(
      brightness: Brightness.light,
      primary: AppColors.brand,
      onPrimary: AppColors.white,
      primaryContainer: AppColors.green100,
      onPrimaryContainer: AppColors.green900,
      secondary: AppColors.orange500,
      onSecondary: AppColors.white,
      secondaryContainer: AppColors.orange100,
      onSecondaryContainer: AppColors.orange600,
      tertiary: AppColors.info,
      onTertiary: AppColors.white,
      error: AppColors.danger,
      onError: AppColors.white,
      errorContainer: AppColors.dangerSoft,
      onErrorContainer: AppColors.danger,
      surface: AppColors.surface,
      onSurface: AppColors.textPrimary,
      onSurfaceVariant: AppColors.textSecondary,
      surfaceContainerHighest: AppColors.ink100,
      surfaceContainerHigh: AppColors.ink100,
      surfaceContainer: AppColors.ink50,
      surfaceContainerLow: AppColors.background,
      surfaceContainerLowest: AppColors.white,
      outline: AppColors.border,
      outlineVariant: AppColors.divider,
      shadow: AppColors.ink900,
      scrim: AppColors.ink900,
      inverseSurface: AppColors.ink900,
      onInverseSurface: AppColors.white,
      inversePrimary: AppColors.green200,
    );

    final textTheme = AppText.textTheme();

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      fontFamily: AppText.family,
      textTheme: textTheme,
      primaryTextTheme: textTheme,
      scaffoldBackgroundColor: AppColors.background,
      canvasColor: AppColors.surface,
      splashFactory: InkSparkle.splashFactory,
      splashColor: AppColors.brand.withValues(alpha: 0.08),
      highlightColor: AppColors.ink900.withValues(alpha: 0.04),
      dividerColor: AppColors.divider,
      visualDensity: VisualDensity.standard,
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: CupertinoPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
          TargetPlatform.windows: FadeUpwardsPageTransitionsBuilder(),
          TargetPlatform.macOS: CupertinoPageTransitionsBuilder(),
          TargetPlatform.linux: FadeUpwardsPageTransitionsBuilder(),
        },
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: AppText.h3,
        systemOverlayStyle: SystemUiOverlayStyle.dark,
        iconTheme: const IconThemeData(color: AppColors.textPrimary, size: 22),
      ),
      iconTheme: const IconThemeData(color: AppColors.ink700, size: 22),
      cardTheme: CardThemeData(
        color: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(borderRadius: AppRadius.card),
      ),
      dividerTheme: const DividerThemeData(color: AppColors.divider, thickness: 1, space: 1),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.brand,
          foregroundColor: AppColors.white,
          disabledBackgroundColor: AppColors.ink200,
          disabledForegroundColor: AppColors.ink400,
          elevation: 0,
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(borderRadius: AppRadius.control),
          textStyle: AppText.button,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.brand,
          foregroundColor: AppColors.white,
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(borderRadius: AppRadius.control),
          textStyle: AppText.button,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.textPrimary,
          side: const BorderSide(color: AppColors.border),
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(borderRadius: AppRadius.control),
          textStyle: AppText.button,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.brand,
          textStyle: AppText.buttonSm,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.sm)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.ink50,
        hintStyle: AppText.body.copyWith(color: AppColors.textTertiary),
        labelStyle: AppText.label,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(borderRadius: AppRadius.control, borderSide: const BorderSide(color: AppColors.border)),
        enabledBorder: OutlineInputBorder(borderRadius: AppRadius.control, borderSide: const BorderSide(color: AppColors.border)),
        focusedBorder: OutlineInputBorder(borderRadius: AppRadius.control, borderSide: const BorderSide(color: AppColors.brand, width: 1.5)),
        errorBorder: OutlineInputBorder(borderRadius: AppRadius.control, borderSide: const BorderSide(color: AppColors.danger)),
        focusedErrorBorder: OutlineInputBorder(borderRadius: AppRadius.control, borderSide: const BorderSide(color: AppColors.danger, width: 1.5)),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.ink100,
        selectedColor: AppColors.ink900,
        labelStyle: AppText.chip,
        side: BorderSide.none,
        shape: RoundedRectangleBorder(borderRadius: AppRadius.chip),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        showCheckmark: false,
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        modalBackgroundColor: AppColors.surface,
        showDragHandle: false,
        shape: RoundedRectangleBorder(borderRadius: AppRadius.sheet),
        clipBehavior: Clip.antiAlias,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.xl)),
        titleTextStyle: AppText.h3,
        contentTextStyle: AppText.body.copyWith(color: AppColors.textSecondary),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.ink900,
        contentTextStyle: AppText.bodyMedium.copyWith(color: AppColors.white),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: AppRadius.control),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        indicatorColor: Colors.transparent,
        height: 64,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => AppText.micro.copyWith(
            fontSize: 11,
            color: states.contains(WidgetState.selected) ? AppColors.brand : AppColors.textTertiary,
          ),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            size: 24,
            color: states.contains(WidgetState.selected) ? AppColors.brand : AppColors.ink400,
          ),
        ),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(color: AppColors.brand, linearTrackColor: AppColors.ink100),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? AppColors.white : AppColors.white),
        trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? AppColors.brand : AppColors.ink300),
        trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
      ),
      listTileTheme: ListTileThemeData(
        shape: RoundedRectangleBorder(borderRadius: AppRadius.control),
        titleTextStyle: AppText.bodyStrong,
        subtitleTextStyle: AppText.bodySm,
        iconColor: AppColors.ink600,
      ),
      tabBarTheme: TabBarThemeData(
        labelStyle: AppText.bodyStrong,
        unselectedLabelStyle: AppText.bodyMedium.copyWith(color: AppColors.textSecondary),
        labelColor: AppColors.textPrimary,
        unselectedLabelColor: AppColors.textSecondary,
        indicatorColor: AppColors.brand,
        indicatorSize: TabBarIndicatorSize.label,
        dividerColor: AppColors.divider,
      ),
    );
  }
}
