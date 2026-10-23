import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:localshop_shared/localshop_shared.dart';

import '../../../../core/providers.dart';
import '../../../../ui/ui.dart';

/// Two side-by-side payment option cards (cash / online). When cash is
/// selected the "prepare change?" chip row expands underneath.
class CheckoutPaymentSelector extends ConsumerWidget {
  const CheckoutPaymentSelector({
    super.key,
    required this.method,
    required this.onMethodChanged,
    required this.changeFrom,
    required this.onChangeFromChanged,
    this.onlineEnabled = false,
  });

  final PaymentMethod method;
  final ValueChanged<PaymentMethod> onMethodChanged;

  /// Online payments are gated server-side (ONLINE_PAYMENTS_ENABLED, 400
  /// ONLINE_PAYMENTS_DISABLED otherwise); until the gateway is live the card
  /// is shown as "coming soon" instead of letting the order fail at submit.
  final bool onlineEnabled;

  /// 'exact' or a banknote label such as '50 000' (kept verbatim in the comment).
  final String changeFrom;
  final ValueChanged<String> onChangeFromChanged;

  static const _changeOptions = ['50 000', '100 000'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isCash = method == PaymentMethod.cash;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: _PaymentOption(
                icon: LucideIcons.banknote,
                label: ref.t('checkout.cash'),
                hint: ref.t('checkout.cashHint'),
                selected: isCash,
                onTap: () => onMethodChanged(PaymentMethod.cash),
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: _PaymentOption(
                icon: LucideIcons.creditCard,
                label: ref.t('checkout.online'),
                hint: ref.t(onlineEnabled ? 'checkout.onlineHint' : 'checkout.onlineSoon'),
                selected: !isCash,
                enabled: onlineEnabled,
                onTap: () => onMethodChanged(PaymentMethod.online),
              ),
            ),
          ],
        ),
        AnimatedSize(
          duration: AppDurations.normal,
          curve: AppCurves.standard,
          alignment: Alignment.topCenter,
          child: isCash
              ? Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: AppSpacing.lg),
                    Text(ref.t('checkout.changeQuestion'), style: AppText.label),
                    const SizedBox(height: AppSpacing.sm),
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.sm,
                      children: [
                        AppChip(
                          label: ref.t('checkout.changeExact'),
                          selected: changeFrom == 'exact',
                          onTap: () => onChangeFromChanged('exact'),
                        ),
                        for (final option in _changeOptions)
                          AppChip(
                            label: option,
                            selected: changeFrom == option,
                            onTap: () => onChangeFromChanged(option),
                          ),
                      ],
                    ),
                  ],
                )
              : const SizedBox(width: double.infinity, height: 0),
        ),
      ],
    );
  }
}

class _PaymentOption extends StatelessWidget {
  const _PaymentOption({
    required this.icon,
    required this.label,
    required this.hint,
    required this.selected,
    required this.onTap,
    this.enabled = true,
  });

  final IconData icon;
  final String label;
  final String hint;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Pressable(
      onTap: enabled ? onTap : null,
      haptic: enabled,
      scale: enabled ? 0.97 : 1,
      borderRadius: AppRadius.control,
      child: Opacity(
        opacity: enabled ? 1 : 0.55,
        child: AnimatedContainer(
          duration: AppDurations.normal,
          curve: AppCurves.standard,
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: selected ? AppColors.green50 : AppColors.surface,
            borderRadius: AppRadius.control,
            border: Border.all(color: selected ? AppColors.brand : AppColors.border, width: selected ? 1.5 : 1),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  AnimatedContainer(
                    duration: AppDurations.normal,
                    curve: AppCurves.standard,
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: selected ? AppColors.brand : AppColors.ink100,
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: Icon(icon, size: 18, color: selected ? AppColors.white : AppColors.ink600),
                  ),
                  const Spacer(),
                  AnimatedOpacity(
                    duration: AppDurations.fast,
                    opacity: selected ? 1 : 0,
                    child: const Icon(LucideIcons.checkCircle2, size: 20, color: AppColors.brand),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              Text(label, style: AppText.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
              const SizedBox(height: AppSpacing.xxs),
              Text(hint, style: AppText.caption, maxLines: 2, overflow: TextOverflow.ellipsis),
            ],
          ),
        ),
      ),
    );
  }
}
