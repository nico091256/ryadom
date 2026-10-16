import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:localshop_shared/localshop_shared.dart';

import '../../../../core/providers.dart';
import '../../../../ui/ui.dart';

/// The four forward stages of an order, in display order.
const kOrderStages = [OrderStatus.newOrder, OrderStatus.accepted, OrderStatus.onTheWay, OrderStatus.delivered];

/// Statuses that still change — the order is "live".
const kActiveOrderStatuses = {OrderStatus.newOrder, OrderStatus.accepted, OrderStatus.onTheWay};

bool isActiveOrderStatus(OrderStatus status) => kActiveOrderStatuses.contains(status);

bool isTerminalOrderStatus(OrderStatus status) => status == OrderStatus.delivered || status == OrderStatus.cancelled;

/// Index of [status] in [kOrderStages]; -1 for cancelled.
int orderStageIndex(OrderStatus status) => kOrderStages.indexOf(status);

BadgeTone orderStatusTone(OrderStatus status) => switch (status) {
      OrderStatus.newOrder => BadgeTone.info,
      OrderStatus.accepted => BadgeTone.brand,
      OrderStatus.onTheWay => BadgeTone.brand,
      OrderStatus.delivered => BadgeTone.neutral,
      OrderStatus.cancelled => BadgeTone.danger,
    };

IconData? orderStatusIcon(OrderStatus status) => switch (status) {
      OrderStatus.onTheWay => LucideIcons.bike,
      OrderStatus.delivered => LucideIcons.check,
      OrderStatus.cancelled => LucideIcons.x,
      OrderStatus.newOrder || OrderStatus.accepted => null,
    };

/// Status pill — translated label with the tone/icon convention shared by the
/// orders list and the tracking screen.
class OrderStatusBadge extends ConsumerWidget {
  const OrderStatusBadge(this.status, {super.key});

  final OrderStatus status;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return AppBadge(
      label: ref.t('orderStatus.${status.value}'),
      tone: orderStatusTone(status),
      icon: orderStatusIcon(status),
      dot: status == OrderStatus.newOrder || status == OrderStatus.accepted,
    );
  }
}

/// Thin 4-segment progress strip; segments fill up to the current stage.
/// Renders nothing for cancelled orders.
class OrderProgressStrip extends StatelessWidget {
  const OrderProgressStrip(this.status, {super.key, this.height = 4});

  final OrderStatus status;
  final double height;

  @override
  Widget build(BuildContext context) {
    final current = orderStageIndex(status);
    if (current < 0) return const SizedBox.shrink();
    return Row(
      children: [
        for (var i = 0; i < kOrderStages.length; i++) ...[
          if (i > 0) const SizedBox(width: AppSpacing.xs),
          Expanded(
            child: AnimatedContainer(
              duration: AppDurations.slow,
              curve: AppCurves.standard,
              height: height,
              decoration: BoxDecoration(
                color: i <= current ? AppColors.brand : AppColors.ink100,
                borderRadius: BorderRadius.circular(height / 2),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// A cheap, repeating 1.6s pulse (scale + opacity on a single circle) wrapped
/// in its own RepaintBoundary. Stops animating when [active] is false.
class PulsingDot extends StatefulWidget {
  const PulsingDot({super.key, this.size = 8, this.color = AppColors.brand, this.active = true});

  final double size;
  final Color color;
  final bool active;

  @override
  State<PulsingDot> createState() => _PulsingDotState();
}

class _PulsingDotState extends State<PulsingDot> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1600));

  @override
  void initState() {
    super.initState();
    if (widget.active) _c.repeat();
  }

  @override
  void didUpdateWidget(covariant PulsingDot oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.active && !_c.isAnimating) {
      _c.repeat();
    } else if (!widget.active && _c.isAnimating) {
      _c.stop();
      _c.value = 0;
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dot = DecoratedBox(decoration: BoxDecoration(color: widget.color, shape: BoxShape.circle));
    // Halo grows to 2.4x and fades out while the core dot stays put.
    final halo = widget.size * 2.4;
    return RepaintBoundary(
      child: SizedBox(
        width: halo,
        height: halo,
        child: Stack(
          alignment: Alignment.center,
          children: [
            if (widget.active)
              AnimatedBuilder(
                animation: _c,
                builder: (_, _) {
                  final t = Curves.easeOut.transform(_c.value);
                  return Opacity(
                    opacity: (1 - t) * 0.45,
                    child: Transform.scale(
                      scale: 1 + t * 1.4,
                      child: SizedBox(width: widget.size, height: widget.size, child: dot),
                    ),
                  );
                },
              ),
            SizedBox(width: widget.size, height: widget.size, child: dot),
          ],
        ),
      ),
    );
  }
}

/// "Jonli kuzatuv" pill with a pulsing dot — shown while the order is active.
class LiveTrackingBadge extends ConsumerWidget {
  const LiveTrackingBadge({super.key, this.active = true});

  final bool active;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      padding: const EdgeInsets.fromLTRB(AppSpacing.sm, AppSpacing.xs, AppSpacing.sm + 2, AppSpacing.xs),
      decoration: BoxDecoration(color: AppColors.green100, borderRadius: AppRadius.chip),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          PulsingDot(size: 7, color: AppColors.green600, active: active),
          const SizedBox(width: AppSpacing.xs),
          Text(ref.t('order.liveTracking'), style: AppText.captionStrong.copyWith(color: AppColors.green700)),
        ],
      ),
    );
  }
}
