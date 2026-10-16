import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import '../tokens.dart';

/// Shimmering placeholder. Compose with [SkeletonBox]/[SkeletonLine] inside
/// a single [Skeleton] so all pieces shimmer in sync (one animation, one
/// repaint boundary — cheap even for long lists).
class Skeleton extends StatelessWidget {
  const Skeleton({super.key, required this.child, this.enabled = true});

  final Widget child;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    if (!enabled) return child;
    return RepaintBoundary(
      child: Shimmer.fromColors(
        baseColor: AppColors.ink100,
        highlightColor: AppColors.ink50,
        period: const Duration(milliseconds: 1400),
        child: child,
      ),
    );
  }
}

class SkeletonBox extends StatelessWidget {
  const SkeletonBox({super.key, this.width, this.height = 16, this.radius = AppRadius.sm, this.circle = false});

  final double? width;
  final double height;
  final double radius;
  final bool circle;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: circle ? height : width,
      height: height,
      decoration: BoxDecoration(
        color: AppColors.ink100,
        shape: circle ? BoxShape.circle : BoxShape.rectangle,
        borderRadius: circle ? null : BorderRadius.circular(radius),
      ),
    );
  }
}

class SkeletonLine extends StatelessWidget {
  const SkeletonLine({super.key, this.width, this.height = 12});

  final double? width;
  final double height;

  @override
  Widget build(BuildContext context) => SkeletonBox(width: width, height: height, radius: height / 2);
}
