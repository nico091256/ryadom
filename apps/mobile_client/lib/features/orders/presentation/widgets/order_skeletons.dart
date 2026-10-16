import 'package:flutter/material.dart';

import '../../../../ui/ui.dart';

/// Shimmer stand-in for one [OrderCard].
class OrderCardSkeleton extends StatelessWidget {
  const OrderCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              SkeletonBox(height: 44, circle: true),
              SizedBox(width: AppSpacing.md),
              Expanded(child: SkeletonLine(height: 14)),
              SizedBox(width: AppSpacing.xxl),
              SkeletonBox(width: 72, height: 22, radius: AppRadius.pill),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          const SkeletonLine(width: 140, height: 10),
          const SizedBox(height: AppSpacing.sm),
          const SkeletonLine(width: 220, height: 10),
          const SizedBox(height: AppSpacing.lg),
          Row(
            children: const [
              SkeletonLine(width: 96, height: 16),
              Spacer(),
              SkeletonBox(width: 100, height: 38, radius: AppRadius.md),
            ],
          ),
        ],
      ),
    );
  }
}

/// Three stacked card skeletons shimmering in sync (one animation).
class OrderListSkeleton extends StatelessWidget {
  const OrderListSkeleton({super.key, this.count = 3, this.padding = const EdgeInsets.all(AppSpacing.page)});

  final int count;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Skeleton(
      child: ListView.separated(
        padding: padding,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: count,
        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
        itemBuilder: (_, _) => const OrderCardSkeleton(),
      ),
    );
  }
}

/// Skeleton for the tracking screen: hero, timeline, items.
class OrderTrackingSkeleton extends StatelessWidget {
  const OrderTrackingSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Skeleton(
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.page),
        physics: const NeverScrollableScrollPhysics(),
        children: [
          AppCard(
            child: Row(
              children: const [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SkeletonLine(width: 160, height: 20),
                      SizedBox(height: AppSpacing.sm),
                      SkeletonLine(width: 220, height: 12),
                    ],
                  ),
                ),
                SizedBox(width: AppSpacing.md),
                SkeletonBox(width: 110, height: 26, radius: AppRadius.pill),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          const SkeletonLine(width: 150, height: 14),
          const SizedBox(height: AppSpacing.sm),
          AppCard(
            child: Column(
              children: [
                for (var i = 0; i < 4; i++)
                  Padding(
                    padding: EdgeInsets.only(bottom: i == 3 ? 0 : AppSpacing.xl),
                    child: Row(
                      children: const [
                        SkeletonBox(height: 28, circle: true),
                        SizedBox(width: AppSpacing.md),
                        Expanded(child: SkeletonLine(height: 12)),
                        SizedBox(width: AppSpacing.huge),
                        SkeletonLine(width: 40, height: 10),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          const SkeletonLine(width: 120, height: 14),
          const SizedBox(height: AppSpacing.sm),
          AppCard(
            child: Column(
              children: [
                for (var i = 0; i < 3; i++)
                  Padding(
                    padding: EdgeInsets.only(bottom: i == 2 ? 0 : AppSpacing.lg),
                    child: Row(
                      children: const [
                        Expanded(child: SkeletonLine(height: 12)),
                        SizedBox(width: AppSpacing.huge),
                        SkeletonLine(width: 70, height: 12),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
