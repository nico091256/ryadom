import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';

import '../../../core/providers.dart';
import '../../../ui/ui.dart';
import 'address_controller.dart';
import 'app_map_tiles.dart';
import 'location_feedback.dart';

/// "Yetkazish manzili" sheet: detect via GPS, drag a mini map under a fixed
/// pin (reverse-geocoded with a 500 ms debounce) or type the address by hand.
/// [onApplied] runs after the address has been saved (Home uses it to refetch
/// nearby shops).
Future<void> showAddressPickerSheet(BuildContext context, WidgetRef ref, {VoidCallback? onApplied}) {
  return showAppSheet<void>(
    context,
    title: ref.t('home.deliverTo'),
    builder: (_) => AddressPickerSheet(onApplied: onApplied),
  );
}

class AddressPickerSheet extends ConsumerStatefulWidget {
  const AddressPickerSheet({super.key, this.onApplied});

  final VoidCallback? onApplied;

  @override
  ConsumerState<AddressPickerSheet> createState() => _AddressPickerSheetState();
}

class _AddressPickerSheetState extends ConsumerState<AddressPickerSheet> {
  static const _debounceDuration = Duration(milliseconds: 500);

  late final TextEditingController _text;
  final MapController _map = MapController();
  Timer? _debounce;
  int _geocodeSeq = 0;

  late LatLng _centre;
  late String _resolved;
  bool _resolving = false;
  bool _locating = false;

  @override
  void initState() {
    super.initState();
    final address = ref.read(addressControllerProvider);
    _centre = LatLng(address.lat, address.lng);
    _resolved = address.addressText;
    _text = TextEditingController(text: address.addressText);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _text.dispose();
    _map.dispose();
    super.dispose();
  }

  void _onPositionChanged(MapCamera camera, bool hasGesture) {
    if (!hasGesture) return;
    _centre = camera.center;
    _debounce?.cancel();
    if (!_resolving) setState(() => _resolving = true);
    _debounce = Timer(_debounceDuration, _reverseGeocode);
  }

  Future<void> _reverseGeocode() async {
    final seq = ++_geocodeSeq;
    final target = _centre;
    final lang = ref.read(localeProvider).value;
    final text = await ref.read(geocodingApiProvider).reverseGeocode(target.latitude, target.longitude, lang: lang);
    if (!mounted || seq != _geocodeSeq) return;
    setState(() {
      _resolving = false;
      _resolved = text;
      _text.text = text;
    });
  }

  Future<void> _locate() async {
    if (_locating) return;
    setState(() => _locating = true);
    final lang = ref.read(localeProvider).value;
    try {
      await ref.read(addressControllerProvider.notifier).detectCurrentLocation(lang: lang);
      if (!mounted) return;
      widget.onApplied?.call();
      Navigator.of(context).pop();
    } on LocationException catch (e) {
      if (!mounted) return;
      showLocationError(context, ref, e);
      setState(() => _locating = false);
    }
  }

  void _apply() {
    final text = _text.text.trim();
    if (text.isEmpty) return;
    final current = ref.read(addressControllerProvider);
    ref.read(addressControllerProvider.notifier).setManual(
          current.copyWith(addressText: text, lat: _centre.latitude, lng: _centre.longitude),
        );
    widget.onApplied?.call();
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _OptionRow(
            icon: LucideIcons.locateFixed,
            label: ref.t('home.useCurrentLocation'),
            loading: _locating,
            onTap: _locate,
          ),
          const SizedBox(height: AppSpacing.sm),
          const Divider(),
          const SizedBox(height: AppSpacing.lg),
          Padding(
            padding: const EdgeInsets.only(left: AppSpacing.xs, bottom: 6),
            child: Text(ref.t('home.pickOnMap'), style: AppText.label),
          ),
          ClipRRect(
            borderRadius: AppRadius.control,
            child: SizedBox(
              height: 220,
              child: RepaintBoundary(
                child: Stack(
                  children: [
                    FlutterMap(
                      mapController: _map,
                      options: MapOptions(
                        initialCenter: _centre,
                        initialZoom: 16,
                        backgroundColor: AppColors.ink100,
                        onPositionChanged: _onPositionChanged,
                        interactionOptions: const InteractionOptions(flags: InteractiveFlag.all & ~InteractiveFlag.rotate),
                      ),
                      children: [appTileLayer(context)],
                    ),
                    const IgnorePointer(child: _CentrePin()),
                    const Positioned(left: AppSpacing.sm, bottom: 6, child: IgnorePointer(child: MapAttribution())),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          _ResolvedAddress(resolving: _resolving, text: _resolved),
          const SizedBox(height: AppSpacing.lg),
          AppTextField(
            controller: _text,
            label: ref.t('home.enterAddressManually'),
            hint: ref.t('home.addressPlaceholder'),
            icon: LucideIcons.pencil,
            showClear: true,
            textCapitalization: TextCapitalization.sentences,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _apply(),
          ),
          const SizedBox(height: AppSpacing.xl),
          ValueListenableBuilder<TextEditingValue>(
            valueListenable: _text,
            builder: (_, value, _) => AppButton(
              label: ref.t('home.deliverHere'),
              icon: LucideIcons.check,
              onPressed: value.text.trim().isEmpty ? null : _apply,
            ),
          ),
        ],
      ),
    );
  }
}

class _OptionRow extends StatelessWidget {
  const _OptionRow({required this.icon, required this.label, required this.onTap, this.loading = false});

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return Pressable(
      onTap: loading ? null : onTap,
      haptic: true,
      scale: 0.985,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: const BoxDecoration(color: AppColors.brandSoft, shape: BoxShape.circle),
              alignment: Alignment.center,
              child: Icon(icon, size: 20, color: AppColors.brand),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(child: Text(label, style: AppText.bodyStrong)),
            const SizedBox(width: AppSpacing.sm),
            AnimatedSwitcher(
              duration: AppDurations.normal,
              child: loading
                  ? const SizedBox(
                      key: ValueKey('spinner'),
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2.2),
                    )
                  : const Icon(LucideIcons.chevronRight, key: ValueKey('chevron'), size: 18, color: AppColors.ink400),
            ),
          ],
        ),
      ),
    );
  }
}

/// Fixed pin drawn over the map centre; the map moves underneath it.
class _CentrePin extends StatelessWidget {
  const _CentrePin();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            width: 10,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.ink900.withValues(alpha: 0.25),
              borderRadius: BorderRadius.circular(AppRadius.pill),
            ),
          ),
          Transform.translate(
            offset: const Offset(0, -18),
            child: const Icon(LucideIcons.mapPin, size: 36, color: AppColors.brand),
          ),
        ],
      ),
    );
  }
}

class _ResolvedAddress extends StatelessWidget {
  const _ResolvedAddress({required this.resolving, required this.text});

  final bool resolving;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(top: 2),
          child: Icon(LucideIcons.mapPin, size: 16, color: AppColors.brand),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: AnimatedSwitcher(
            duration: AppDurations.normal,
            child: resolving
                ? const Skeleton(
                    key: ValueKey('skeleton'),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SkeletonLine(width: 200, height: 12),
                        SizedBox(height: 6),
                        SkeletonLine(width: 120, height: 12),
                      ],
                    ),
                  )
                : Text(text, key: ValueKey(text), style: AppText.bodyMedium, maxLines: 2, overflow: TextOverflow.ellipsis),
          ),
        ),
      ],
    );
  }
}
