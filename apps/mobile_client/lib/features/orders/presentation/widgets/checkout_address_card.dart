import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/providers.dart';
import '../../../../ui/ui.dart';

/// Read-only delivery address with a map pin, plus the 2x2 grid of
/// entrance / floor / apartment / door-code fields the courier needs.
class CheckoutAddressCard extends ConsumerWidget {
  const CheckoutAddressCard({
    super.key,
    required this.addressText,
    required this.entranceController,
    required this.floorController,
    required this.apartmentController,
    required this.doorCodeController,
  });

  final String addressText;
  final TextEditingController entranceController;
  final TextEditingController floorController;
  final TextEditingController apartmentController;
  final TextEditingController doorCodeController;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: const BoxDecoration(color: AppColors.green50, shape: BoxShape.circle),
              alignment: Alignment.center,
              child: const Icon(LucideIcons.mapPin, size: 20, color: AppColors.green700),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(addressText, style: AppText.bodyStrong),
                  const SizedBox(height: AppSpacing.xxs),
                  Text(ref.t('checkout.addressHint'), style: AppText.caption),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: AppTextField(controller: entranceController, label: ref.t('address.entrance'))),
            const SizedBox(width: AppSpacing.md),
            Expanded(child: AppTextField(controller: floorController, label: ref.t('address.floor'))),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: AppTextField(controller: apartmentController, label: ref.t('address.apartment'))),
            const SizedBox(width: AppSpacing.md),
            Expanded(child: AppTextField(controller: doorCodeController, label: ref.t('address.doorCode'))),
          ],
        ),
      ],
    );
  }
}
