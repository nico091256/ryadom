import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../../../../core/utils/launch_url.dart';
import '../../../../ui/ui.dart';
import '../../domain/shop.dart';
import 'shop_card.dart' show ShopCover;

/// How far the header card below the cover overlaps the cover image.
const double kShopCoverOverlap = 28;

/// Height of the visible cover photo when the app bar is fully expanded.
const double kShopCoverHeight = 220;

/// Pinned, stretchable cover: shop photo with a legibility gradient, a white
/// toolbar that fades in as it collapses, and the shop name fading into the
/// toolbar. The bottom [kShopCoverOverlap] px are left transparent so the
/// header card ([ShopOverlapShift]) can tuck under the photo.
class ShopCoverAppBar extends StatelessWidget {
  const ShopCoverAppBar({super.key, required this.shop, this.onBack});

  final Shop shop;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return SliverAppBar(
      pinned: true,
      stretch: true,
      expandedHeight: kShopCoverHeight + kShopCoverOverlap,
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      automaticallyImplyLeading: false,
      leadingWidth: AppSpacing.page + 40 + AppSpacing.sm,
      leading: Padding(
        padding: const EdgeInsets.only(left: AppSpacing.page),
        child: Center(
          child: AppIconButton(
            icon: LucideIcons.arrowLeft,
            bordered: false,
            shadow: true,
            onPressed: onBack ?? () => Navigator.of(context).maybePop(),
          ),
        ),
      ),
      actions: [
        if (shop.phone.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(right: AppSpacing.page),
            child: Center(
              child: AppIconButton(
                icon: LucideIcons.phone,
                bordered: false,
                shadow: true,
                foreground: AppColors.brand,
                onPressed: () => launchCallerUrl(shop.phone),
              ),
            ),
          ),
      ],
      flexibleSpace: _CoverFlexibleSpace(shop: shop),
    );
  }
}

class _CoverFlexibleSpace extends StatelessWidget {
  const _CoverFlexibleSpace({required this.shop});

  final Shop shop;

  @override
  Widget build(BuildContext context) {
    final settings = context.dependOnInheritedWidgetOfExactType<FlexibleSpaceBarSettings>();
    final topPadding = MediaQuery.paddingOf(context).top;

    return LayoutBuilder(
      builder: (context, constraints) {
        final height = constraints.maxHeight;
        final minExtent = settings?.minExtent ?? (kToolbarHeight + topPadding);
        final maxExtent = settings?.maxExtent ?? (kShopCoverHeight + kShopCoverOverlap + topPadding);
        final range = math.max(1.0, maxExtent - minExtent);
        // 1 = fully expanded, 0 = collapsed to the toolbar.
        final t = ((height - minExtent) / range).clamp(0.0, 1.0);
        final band = kShopCoverOverlap * t;
        final toolbarOpacity = 1 - t;
        final titleOpacity = ((0.35 - t) / 0.35).clamp(0.0, 1.0);
        final coverHeight = math.max(0.0, height - band);

        return Stack(
          fit: StackFit.expand,
          children: [
            // Cover photo (stops above the transparent overlap band).
            Positioned(
              left: 0,
              right: 0,
              top: 0,
              height: coverHeight,
              child: _Cover(shop: shop, width: constraints.maxWidth, height: coverHeight),
            ),
            // Gradients for toolbar icon / status bar legibility.
            Positioned(
              left: 0,
              right: 0,
              top: 0,
              height: coverHeight,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      AppColors.ink900.withValues(alpha: 0.2),
                      AppColors.ink900.withValues(alpha: 0),
                      AppColors.ink900.withValues(alpha: 0.55),
                    ],
                    stops: const [0, 0.4, 1],
                  ),
                ),
              ),
            ),
            // White toolbar surfaces as the bar collapses.
            if (toolbarOpacity > 0)
              Positioned(
                left: 0,
                right: 0,
                top: 0,
                height: coverHeight,
                child: IgnorePointer(
                  child: Opacity(
                    opacity: toolbarOpacity,
                    child: const DecoratedBox(
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        border: Border(bottom: BorderSide(color: AppColors.divider)),
                      ),
                    ),
                  ),
                ),
              ),
            // Shop name fades into the toolbar near the collapsed state.
            if (titleOpacity > 0)
              Positioned(
                top: topPadding,
                left: AppSpacing.page + 40 + AppSpacing.md,
                right: AppSpacing.page + 40 + AppSpacing.md,
                height: kToolbarHeight,
                child: IgnorePointer(
                  child: Opacity(
                    opacity: titleOpacity,
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: Text(shop.name, style: AppText.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _Cover extends StatelessWidget {
  const _Cover({required this.shop, required this.width, required this.height});

  final Shop shop;
  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    // Same widget as the Home card so the Hero flight is seamless; the shop's
    // real photo (server-relative paths resolved + cached) or the brand fallback.
    return ShopCover(url: shop.logoUrl, width: width, height: height);
  }
}

/// Lays out its child normally, then reports a height that is [overlap] px
/// shorter and paints the child shifted up by [overlap] — a true negative
/// top margin for the header card so following slivers sit flush beneath it.
class ShopOverlapShift extends SingleChildRenderObjectWidget {
  const ShopOverlapShift({super.key, this.overlap = kShopCoverOverlap, required super.child});

  final double overlap;

  @override
  RenderObject createRenderObject(BuildContext context) => RenderShopOverlapShift(overlap);

  @override
  void updateRenderObject(BuildContext context, RenderShopOverlapShift renderObject) {
    renderObject.overlap = overlap;
  }
}

class RenderShopOverlapShift extends RenderShiftedBox {
  RenderShopOverlapShift(this._overlap) : super(null);

  double _overlap;
  set overlap(double value) {
    if (value == _overlap) return;
    _overlap = value;
    markNeedsLayout();
  }

  BoxConstraints _childConstraints(BoxConstraints constraints) =>
      BoxConstraints(minWidth: constraints.minWidth, maxWidth: constraints.maxWidth);

  @override
  Size computeDryLayout(BoxConstraints constraints) {
    final child = this.child;
    if (child == null) return constraints.smallest;
    final childSize = child.getDryLayout(_childConstraints(constraints));
    return constraints.constrain(Size(childSize.width, math.max(0, childSize.height - _overlap)));
  }

  @override
  void performLayout() {
    final child = this.child;
    if (child == null) {
      size = constraints.smallest;
      return;
    }
    child.layout(_childConstraints(constraints), parentUsesSize: true);
    (child.parentData! as BoxParentData).offset = Offset(0, -_overlap);
    size = constraints.constrain(Size(child.size.width, math.max(0, child.size.height - _overlap)));
  }
}
