import 'package:flutter/material.dart';

import '../tokens.dart';
import '../typography.dart';

/// Bottom sheet with a drag handle, optional title row and keyboard-aware
/// padding. Every sheet in the app goes through this so they look identical.
Future<T?> showAppSheet<T>(
  BuildContext context, {
  required WidgetBuilder builder,
  String? title,
  bool isScrollControlled = true,
  bool showHandle = true,
  EdgeInsets padding = const EdgeInsets.fromLTRB(AppSpacing.xl, 0, AppSpacing.xl, AppSpacing.xl),
  double? maxHeightFraction,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: isScrollControlled,
    useSafeArea: true,
    backgroundColor: AppColors.surface,
    barrierColor: AppColors.ink900.withValues(alpha: 0.45),
    shape: RoundedRectangleBorder(borderRadius: AppRadius.sheet),
    clipBehavior: Clip.antiAlias,
    constraints: maxHeightFraction == null
        ? null
        : BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * maxHeightFraction),
    builder: (ctx) => AnimatedPadding(
      duration: AppDurations.normal,
      curve: AppCurves.standard,
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(ctx).bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (showHandle) const SheetHandle(),
          if (title != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(AppSpacing.xl, AppSpacing.xs, AppSpacing.xl, AppSpacing.lg),
              child: Text(title, style: AppText.h3),
            ),
          Flexible(child: Padding(padding: padding, child: builder(ctx))),
        ],
      ),
    ),
  );
}

class SheetHandle extends StatelessWidget {
  const SheetHandle({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 40,
        height: 4,
        margin: const EdgeInsets.only(top: AppSpacing.md, bottom: AppSpacing.md),
        decoration: BoxDecoration(color: AppColors.ink200, borderRadius: BorderRadius.circular(2)),
      ),
    );
  }
}

/// Confirmation dialog with the app's rounded look.
Future<bool> showAppConfirm(
  BuildContext context, {
  required String title,
  String? message,
  required String confirmLabel,
  required String cancelLabel,
  bool destructive = false,
}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: message == null ? null : Text(message),
      actionsPadding: const EdgeInsets.fromLTRB(AppSpacing.xl, 0, AppSpacing.xl, AppSpacing.xl),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(false),
          style: TextButton.styleFrom(foregroundColor: AppColors.textSecondary),
          child: Text(cancelLabel),
        ),
        FilledButton(
          onPressed: () => Navigator.of(ctx).pop(true),
          style: FilledButton.styleFrom(
            backgroundColor: destructive ? AppColors.danger : AppColors.brand,
            minimumSize: const Size(0, 44),
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
          ),
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
  return result ?? false;
}
