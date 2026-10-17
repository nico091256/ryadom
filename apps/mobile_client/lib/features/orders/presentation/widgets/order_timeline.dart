import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:localshop_shared/localshop_shared.dart';

import '../../../../core/providers.dart';
import '../../../../ui/ui.dart';
import '../../domain/order.dart';
import 'order_status_ui.dart';

enum _StepState { done, current, upcoming }

/// Vertical 4-step timeline (new → accepted → on the way → delivered) with
/// timestamps from the status history. Cancelled orders show the reached
/// steps greyed out plus a red "cancelled" row with the reason.
class OrderTimeline extends ConsumerWidget {
  const OrderTimeline({super.key, required this.order});

  final Order order;

  DateTime? _reachedAt(OrderStatus status) {
    for (final e in order.statusHistory) {
      if (e.status == status) return e.createdAt;
    }
    // The creation event is not always written to the history.
    if (status == OrderStatus.newOrder) return order.createdAt;
    return null;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cancelled = order.status == OrderStatus.cancelled;
    // For a cancelled order, grey out every step but keep the ones it got
    // through "ticked" so the customer sees how far it went.
    final reached = cancelled
        ? order.statusHistory.fold<int>(0, (acc, e) {
            final i = orderStageIndex(e.status);
            return i > acc ? i : acc;
          })
        : orderStageIndex(order.status);

    OrderStatusEvent? cancelEvent;
    for (final e in order.statusHistory) {
      if (e.status == OrderStatus.cancelled) cancelEvent = e;
    }

    final rows = <Widget>[];
    for (var i = 0; i < kOrderStages.length; i++) {
      final stage = kOrderStages[i];
      final state = cancelled
          ? (i <= reached ? _StepState.done : _StepState.upcoming)
          : (i < reached ? _StepState.done : (i == reached ? _StepState.current : _StepState.upcoming));
      final isLast = i == kOrderStages.length - 1 && !cancelled;
      rows.add(
        _TimelineRow(
          state: state,
          muted: cancelled,
          label: ref.t('orderStatus.${stage.value}'),
          subtitle: ref.t('order.stage.${stage.value}'),
          time: state == _StepState.upcoming ? null : _reachedAt(stage),
          connector: isLast ? null : state == _StepState.done,
        ),
      );
    }
    if (cancelled) {
      rows.add(
        _TimelineRow(
          state: _StepState.done,
          danger: true,
          label: ref.t('orderStatus.cancelled'),
          reason: cancelEvent?.reason,
          time: cancelEvent?.createdAt,
          connector: null,
        ),
      );
    }
    return Column(children: rows);
  }
}

class _TimelineRow extends StatelessWidget {
  const _TimelineRow({
    required this.state,
    required this.label,
    required this.connector,
    this.subtitle,
    this.time,
    this.reason,
    this.muted = false,
    this.danger = false,
  });

  final _StepState state;
  final String label;
  final String? subtitle;
  final DateTime? time;
  final String? reason;

  /// null = no connector (last row); true = brand; false = grey.
  final bool? connector;
  final bool muted;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    const circle = 28.0;
    final labelStyle = switch ((danger, muted, state)) {
      (true, _, _) => AppText.bodyStrong.danger,
      (_, true, _) => AppText.bodyMedium.tertiary,
      (_, _, _StepState.current) => AppText.bodyStrong,
      (_, _, _StepState.done) => AppText.bodyStrong,
      (_, _, _StepState.upcoming) => AppText.bodyMedium.tertiary,
    };

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: circle,
          child: Column(
            children: [
              _StepCircle(state: state, muted: muted, danger: danger),
              if (connector != null)
                Container(
                  width: 2,
                  height: subtitle != null ? AppSpacing.huge : AppSpacing.xxl,
                  margin: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                  decoration: BoxDecoration(
                    color: connector! && !muted ? AppColors.brand : AppColors.border,
                    borderRadius: BorderRadius.circular(1),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(child: Text(label, style: labelStyle, maxLines: 1, overflow: TextOverflow.ellipsis)),
                    if (time != null) ...[
                      const SizedBox(width: AppSpacing.sm),
                      Text(DateFormat('HH:mm').format(time!.toLocal()), style: AppText.caption),
                    ],
                  ],
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(subtitle!, style: AppText.izoh.copyWith(color: AppColors.textSecondary)),
                ],
                if (reason != null && reason!.trim().isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: AppSpacing.xxs),
                    child: Text(reason!, style: AppText.bodySm),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _StepCircle extends StatelessWidget {
  const _StepCircle({required this.state, required this.muted, required this.danger});

  final _StepState state;
  final bool muted;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    const size = 28.0;
    if (danger) {
      return Container(
        width: size,
        height: size,
        decoration: const BoxDecoration(color: AppColors.danger, shape: BoxShape.circle),
        alignment: Alignment.center,
        child: const Icon(LucideIcons.x, size: 16, color: AppColors.white),
      );
    }
    switch (state) {
      case _StepState.done:
        return Container(
          width: size,
          height: size,
          decoration: BoxDecoration(color: muted ? AppColors.ink300 : AppColors.brand, shape: BoxShape.circle),
          alignment: Alignment.center,
          child: const Icon(LucideIcons.check, size: 16, color: AppColors.white),
        );
      case _StepState.current:
        return Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            color: AppColors.brandSoft,
            shape: BoxShape.circle,
            border: Border.all(color: AppColors.brand, width: 2),
          ),
          alignment: Alignment.center,
          child: const PulsingDot(size: 8),
        );
      case _StepState.upcoming:
        return Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            color: AppColors.surface,
            shape: BoxShape.circle,
            border: Border.all(color: AppColors.ink200, width: 2),
          ),
        );
    }
  }
}
