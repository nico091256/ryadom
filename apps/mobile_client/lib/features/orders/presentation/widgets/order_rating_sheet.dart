import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/errors/app_exception.dart';
import '../../../../core/providers.dart';
import '../../../../ui/ui.dart';

/// "Buyurtma yetkazildi · Xizmatni baholang" sheet (design PDF p.13).
/// [onSubmit] performs the API call; errors are shown in-place so the user
/// can retry, success closes the sheet with a thank-you toast.
Future<void> showOrderRatingSheet(
  BuildContext context, {
  required Future<void> Function(int stars, String comment) onSubmit,
}) {
  return showAppSheet<void>(
    context,
    padding: const EdgeInsets.fromLTRB(AppSpacing.xl, 0, AppSpacing.xl, AppSpacing.xl),
    builder: (_) => _OrderRatingSheet(onSubmit: onSubmit),
  );
}

class _OrderRatingSheet extends ConsumerStatefulWidget {
  const _OrderRatingSheet({required this.onSubmit});

  final Future<void> Function(int stars, String comment) onSubmit;

  @override
  ConsumerState<_OrderRatingSheet> createState() => _OrderRatingSheetState();
}

class _OrderRatingSheetState extends ConsumerState<_OrderRatingSheet> {
  int _stars = 5;
  final _comment = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() => _submitting = true);
    final thanks = ref.t('rating.thanks');
    final fallback = ref.t('common.error');
    try {
      await widget.onSubmit(_stars, _comment.text.trim());
      if (!mounted) return;
      Navigator.of(context).pop();
      showAppToast(context, thanks, tone: ToastTone.success);
    } catch (e) {
      if (!mounted) return;
      showAppToast(context, e is AppException ? e.message : fallback, tone: ToastTone.error);
      setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Center(child: Illustration(AppIllustration.success, size: 96))
              .animate()
              .scale(begin: const Offset(0.6, 0.6), end: const Offset(1, 1), duration: AppDurations.slow, curve: AppCurves.spring)
              .fadeIn(duration: AppDurations.normal),
          const SizedBox(height: AppSpacing.lg),
          Text(ref.t('rating.title'), style: AppText.h2, textAlign: TextAlign.center),
          const SizedBox(height: AppSpacing.xs),
          Text(ref.t('rating.subtitle'), style: AppText.body.secondary, textAlign: TextAlign.center),
          const SizedBox(height: AppSpacing.xl),
          AppCard(
            child: Column(
              children: [
                Text(ref.t('rating.prompt'), style: AppText.title),
                const SizedBox(height: AppSpacing.md),
                _StarPicker(value: _stars, onChanged: _submitting ? null : (v) => setState(() => _stars = v)),
                const SizedBox(height: AppSpacing.lg),
                AppTextField(
                  controller: _comment,
                  hint: ref.t('rating.commentHint'),
                  maxLines: 3,
                  maxLength: 500,
                  enabled: !_submitting,
                  textCapitalization: TextCapitalization.sentences,
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          AppButton(label: ref.t('rating.submit'), icon: LucideIcons.star, loading: _submitting, onPressed: _submit),
          const SizedBox(height: AppSpacing.sm),
          AppButton(
            label: ref.t('rating.skip'),
            variant: AppButtonVariant.ghost,
            onPressed: _submitting ? null : () => Navigator.of(context).pop(),
          ),
        ],
      ),
    );
  }
}

class _StarPicker extends StatelessWidget {
  const _StarPicker({required this.value, required this.onChanged});

  final int value;
  final ValueChanged<int>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (var i = 1; i <= 5; i++)
          Pressable(
            onTap: onChanged == null ? null : () => onChanged!(i),
            haptic: true,
            scale: 0.85,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
              child: AnimatedScale(
                scale: i <= value ? 1 : 0.9,
                duration: AppDurations.fast,
                child: Icon(LucideIcons.star, size: 36, color: i <= value ? AppColors.accent : AppColors.ink300),
              ),
            ),
          ),
      ],
    );
  }
}

/// Read-only "you rated this" row shown once a review exists.
class OrderRatingSummary extends ConsumerWidget {
  const OrderRatingSummary({super.key, required this.stars, this.comment});

  final int stars;
  final String? comment;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return AppCard(
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: const BoxDecoration(color: AppColors.accentLight, shape: BoxShape.circle),
            alignment: Alignment.center,
            child: const Icon(LucideIcons.star, size: 22, color: AppColors.accent),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(ref.t('order.rated', {'stars': '$stars'}), style: AppText.bodyStrong),
                if (comment != null && comment!.trim().isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.xxs),
                  Text(comment!, style: AppText.bodySm, maxLines: 2, overflow: TextOverflow.ellipsis),
                ],
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (var i = 1; i <= 5; i++)
                Icon(LucideIcons.star, size: 14, color: i <= stars ? AppColors.accent : AppColors.ink300),
            ],
          ),
        ],
      ),
    );
  }
}
