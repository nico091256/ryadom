import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:localshop_shared/localshop_shared.dart';

import '../../core/providers.dart';
import '../tokens.dart';
import '../typography.dart';

/// Money in tiyin → "45 000 so'm" with tabular digits; optional strike-through
/// for the pre-discount amount.
class PriceText extends ConsumerWidget {
  const PriceText(
    this.tiyin, {
    super.key,
    this.style,
    this.color,
    this.strike = false,
    this.prefix,
  });

  final int tiyin;
  final TextStyle? style;
  final Color? color;
  final bool strike;
  /// e.g. "−" for discounts or "+" for extras.
  final String? prefix;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = ref.watch(localeProvider);
    final base = style ?? AppText.price;
    final text = '${prefix ?? ''}${formatPrice(tiyin, lang)}';
    return Text(
      text,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: base.copyWith(
        color: color ?? (strike ? AppColors.textTertiary : base.color),
        decoration: strike ? TextDecoration.lineThrough : TextDecoration.none,
        decorationColor: AppColors.textTertiary,
        fontFeatures: const [FontFeature.tabularFigures()],
      ),
    );
  }
}

/// Price that cross-fades + nudges when the amount changes (cart totals).
class AnimatedPriceText extends StatelessWidget {
  const AnimatedPriceText(this.tiyin, {super.key, this.style, this.color});

  final int tiyin;
  final TextStyle? style;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: AppDurations.normal,
      switchInCurve: AppCurves.standard,
      switchOutCurve: Curves.easeIn,
      transitionBuilder: (child, anim) => FadeTransition(
        opacity: anim,
        child: SlideTransition(
          position: Tween<Offset>(begin: const Offset(0, 0.35), end: Offset.zero).animate(anim),
          child: child,
        ),
      ),
      child: PriceText(tiyin, key: ValueKey(tiyin), style: style, color: color),
    );
  }
}
