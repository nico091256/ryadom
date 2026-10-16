import 'package:flutter/material.dart';

import '../../../../ui/ui.dart';

/// One segment of [OrderSegmentedControl].
class OrderSegment {
  const OrderSegment({required this.label, this.count});

  final String label;
  final int? count;
}

/// Two-or-more segment switch with a sliding white thumb inside a grey track
/// (44px tall). Driven by a [TabController] so swiping the TabBarView moves
/// the thumb in lock-step with the pages.
class OrderSegmentedControl extends StatelessWidget {
  const OrderSegmentedControl({super.key, required this.controller, required this.segments, this.height = 44});

  final TabController controller;
  final List<OrderSegment> segments;
  final double height;

  @override
  Widget build(BuildContext context) {
    const inset = 4.0;
    final n = segments.length;
    final animation = controller.animation ?? const AlwaysStoppedAnimation<double>(0);

    return Container(
      height: height,
      padding: const EdgeInsets.all(inset),
      decoration: BoxDecoration(color: AppColors.ink100, borderRadius: AppRadius.control),
      child: AnimatedBuilder(
        animation: animation,
        builder: (context, _) {
          final t = animation.value.clamp(0.0, (n - 1).toDouble());
          return Stack(
            children: [
              // Sliding thumb: alignment x goes from -1 (first) to 1 (last).
              Align(
                alignment: Alignment(n == 1 ? 0 : -1 + 2 * t / (n - 1), 0),
                child: FractionallySizedBox(
                  widthFactor: 1 / n,
                  heightFactor: 1,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(AppRadius.md - inset),
                      boxShadow: AppShadows.xs,
                    ),
                  ),
                ),
              ),
              Row(
                children: [
                  for (var i = 0; i < n; i++)
                    Expanded(
                      child: _SegmentLabel(
                        segment: segments[i],
                        // 1 when this segment is fully selected, 0 when fully away.
                        selection: (1 - (t - i).abs()).clamp(0.0, 1.0),
                        onTap: () => controller.animateTo(i, duration: AppDurations.slow, curve: AppCurves.standard),
                      ),
                    ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}

class _SegmentLabel extends StatelessWidget {
  const _SegmentLabel({required this.segment, required this.selection, required this.onTap});

  final OrderSegment segment;
  final double selection;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = Color.lerp(AppColors.textSecondary, AppColors.textPrimary, selection)!;
    final countBg = Color.lerp(AppColors.ink200, AppColors.green100, selection)!;
    final countFg = Color.lerp(AppColors.ink600, AppColors.green700, selection)!;
    final count = segment.count;
    return Pressable(
      onTap: onTap,
      scale: 1,
      child: Center(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Flexible(
              child: Text(
                segment.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.bodyStrong.copyWith(color: color),
              ),
            ),
            if (count != null) ...[
              const SizedBox(width: 6),
              Container(
                constraints: const BoxConstraints(minWidth: 20),
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: AppSpacing.xxs),
                decoration: BoxDecoration(color: countBg, borderRadius: AppRadius.chip),
                alignment: Alignment.center,
                child: Text('$count', style: AppText.captionStrong.copyWith(color: countFg)),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
