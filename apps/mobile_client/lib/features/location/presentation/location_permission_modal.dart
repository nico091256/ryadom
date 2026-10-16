import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../../ui/ui.dart';
import 'address_controller.dart';
import 'location_feedback.dart';

/// Modal dialog matching PDF Page 10:
/// "Uyingiz qayerda?" + "Joylashuvga ruxsat berish" + "Manzilni qo'lda kiritish".
Future<void> showLocationPermissionModal(
  BuildContext context,
  WidgetRef ref, {
  required VoidCallback onManualSelected,
  VoidCallback? onLocationGranted,
}) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => _LocationPermissionContent(
      onManualSelected: onManualSelected,
      onLocationGranted: onLocationGranted,
    ),
  );
}

class _LocationPermissionContent extends ConsumerStatefulWidget {
  const _LocationPermissionContent({
    required this.onManualSelected,
    this.onLocationGranted,
  });

  final VoidCallback onManualSelected;
  final VoidCallback? onLocationGranted;

  @override
  ConsumerState<_LocationPermissionContent> createState() => _LocationPermissionContentState();
}

class _LocationPermissionContentState extends ConsumerState<_LocationPermissionContent> {
  bool _locating = false;

  Future<void> _requestLocation() async {
    if (_locating) return;
    setState(() => _locating = true);
    final lang = ref.read(localeProvider).value;

    try {
      await ref.read(addressControllerProvider.notifier).detectCurrentLocation(lang: lang);
      if (!mounted) return;
      Navigator.of(context).pop();
      widget.onLocationGranted?.call();
    } on LocationException catch (e) {
      if (!mounted) return;
      showLocationError(context, ref, e);
      setState(() => _locating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
      ),
      padding: const EdgeInsets.fromLTRB(AppSpacing.page, AppSpacing.xxl, AppSpacing.page, AppSpacing.xxl),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(
                color: AppColors.accentLight,
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: const Icon(LucideIcons.mapPin, size: 32, color: AppColors.accent),
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(
            'Uyingiz qayerda?',
            style: AppText.sarlavhaL.copyWith(fontSize: 24),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Joylashuvingiz bo\'yicha eng yaqin do\'konlarni ko\'rsatamiz. Joylashuv faqat buyurtma uchun ishlatiladi.',
            style: AppText.bodyMedium.copyWith(color: AppColors.textSecondary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.xxl),
          AppButton(
            label: 'Joylashuvga ruxsat berish',
            loading: _locating,
            onPressed: _requestLocation,
          ),
          const SizedBox(height: AppSpacing.sm),
          AppButton(
            label: 'Manzilni qo\'lda kiritish',
            variant: AppButtonVariant.outline,
            onPressed: () {
              Navigator.of(context).pop();
              widget.onManualSelected();
            },
          ),
        ],
      ),
    );
  }
}
