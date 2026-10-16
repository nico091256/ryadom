import 'package:flutter/material.dart';

import '../../../../ui/ui.dart';

/// "+998901234567" → "+998 90 123 45 67"; anything else is returned as-is.
String formatPhoneForDisplay(String raw) {
  final digits = raw.replaceAll(RegExp(r'\D'), '');
  if (digits.length != 12) return raw;
  return '+${digits.substring(0, 3)} ${digits.substring(3, 5)} ${digits.substring(5, 8)} '
      '${digits.substring(8, 10)} ${digits.substring(10, 12)}';
}

/// Avatar with a brand-gradient ring, name and formatted phone.
class ProfileHeader extends StatelessWidget {
  const ProfileHeader({super.key, required this.name, this.phone});

  final String name;
  final String? phone;

  @override
  Widget build(BuildContext context) {
    final phoneText = (phone == null || phone!.isEmpty) ? null : formatPhoneForDisplay(phone!);
    return Column(
      children: [
        Container(
          width: 80,
          height: 80,
          padding: const EdgeInsets.all(2),
          decoration: const BoxDecoration(gradient: AppColors.brandGradient, shape: BoxShape.circle),
          child: Container(
            padding: const EdgeInsets.all(2),
            decoration: const BoxDecoration(color: AppColors.surface, shape: BoxShape.circle),
            child: AppAvatar(name: name, size: 72),
          ),
        ).animate().fadeIn(duration: AppDurations.slow).scale(
              begin: const Offset(0.9, 0.9),
              end: const Offset(1, 1),
              duration: AppDurations.slow,
              curve: AppCurves.emphasized,
            ),
        const SizedBox(height: AppSpacing.md),
        Text(name, style: AppText.h2, textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis)
            .animate(delay: 40.ms)
            .fadeIn(duration: AppDurations.slow)
            .moveY(begin: 6, end: 0, curve: AppCurves.standard),
        if (phoneText != null) ...[
          const SizedBox(height: AppSpacing.xxs),
          Text(phoneText, style: AppText.body.secondary.copyWith(fontFeatures: const [FontFeature.tabularFigures()]))
              .animate(delay: 80.ms)
              .fadeIn(duration: AppDurations.slow)
              .moveY(begin: 6, end: 0, curve: AppCurves.standard),
        ],
      ],
    );
  }
}
