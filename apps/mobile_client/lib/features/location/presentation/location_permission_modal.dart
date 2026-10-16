import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../../ui/ui.dart';
import 'address_controller.dart';
import 'location_feedback.dart';

/// First-launch "Uyingiz qayerda?" sheet (design PDF p.10): ask for location
/// access or fall back to entering the address by hand.
Future<void> showLocationPermissionSheet(
  BuildContext context, {
  required VoidCallback onManualSelected,
  VoidCallback? onLocationGranted,
}) {
  return showAppSheet<void>(
    context,
    builder: (_) => _LocationPermissionSheet(onManualSelected: onManualSelected, onLocationGranted: onLocationGranted),
  );
}

class _LocationPermissionSheet extends ConsumerStatefulWidget {
  const _LocationPermissionSheet({required this.onManualSelected, this.onLocationGranted});

  final VoidCallback onManualSelected;
  final VoidCallback? onLocationGranted;

  @override
  ConsumerState<_LocationPermissionSheet> createState() => _LocationPermissionSheetState();
}

class _LocationPermissionSheetState extends ConsumerState<_LocationPermissionSheet> {
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
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Center(child: Illustration(AppIllustration.location, size: 120))
            .animate()
            .fadeIn(duration: AppDurations.slow)
            .scale(begin: const Offset(0.9, 0.9), end: const Offset(1, 1), curve: AppCurves.emphasized),
        const SizedBox(height: AppSpacing.lg),
        Text(ref.t('location.title'), style: AppText.h2, textAlign: TextAlign.center),
        const SizedBox(height: AppSpacing.sm),
        Text(ref.t('location.subtitle'), style: AppText.body.secondary, textAlign: TextAlign.center),
        const SizedBox(height: AppSpacing.xxl),
        AppButton(
          label: ref.t('location.allow'),
          icon: LucideIcons.locateFixed,
          loading: _locating,
          onPressed: _requestLocation,
        ),
        const SizedBox(height: AppSpacing.sm),
        AppButton(
          label: ref.t('location.manual'),
          variant: AppButtonVariant.outline,
          onPressed: _locating
              ? null
              : () {
                  Navigator.of(context).pop();
                  widget.onManualSelected();
                },
        ),
      ],
    );
  }
}
