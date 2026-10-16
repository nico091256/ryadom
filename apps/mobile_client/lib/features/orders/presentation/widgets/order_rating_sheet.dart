import 'package:flutter/material.dart';

import '../../../../ui/ui.dart';

/// Modal bottom sheet matching PDF Page 13: "Buyurtma yetkazildi" + "Xizmatni baholang"
Future<void> showOrderRatingSheet(
  BuildContext context, {
  required String orderId,
  required Future<void> Function(int stars, String comment) onSubmit,
}) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => _OrderRatingSheetContent(orderId: orderId, onSubmit: onSubmit),
  );
}

class _OrderRatingSheetContent extends StatefulWidget {
  const _OrderRatingSheetContent({required this.orderId, required this.onSubmit});

  final String orderId;
  final Future<void> Function(int stars, String comment) onSubmit;

  @override
  State<_OrderRatingSheetContent> createState() => _OrderRatingSheetContentState();
}

class _OrderRatingSheetContentState extends State<_OrderRatingSheetContent> {
  int _stars = 5;
  final TextEditingController _commentController = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    setState(() => _submitting = true);
    try {
      await widget.onSubmit(_stars, _commentController.text.trim());
      if (!mounted) return;
      Navigator.of(context).pop();
      showAppToast(context, 'Bahoyingiz uchun rahmat!', tone: ToastTone.success);
    } catch (_) {
      if (!mounted) return;
      Navigator.of(context).pop();
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
      ),
      padding: EdgeInsets.fromLTRB(AppSpacing.page, AppSpacing.xxl, AppSpacing.page, AppSpacing.xl + bottomInset),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: const BoxDecoration(
                color: AppColors.brand,
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: const Icon(LucideIcons.check, size: 36, color: AppColors.white),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'Buyurtma yetkazildi',
              style: AppText.sarlavhaL.copyWith(fontSize: 24),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 4),
            Text(
              'Yoqimli ishtaha!',
              style: AppText.bodyMedium.copyWith(color: AppColors.textSecondary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.xl),
            AppCard(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                children: [
                  Text(
                    'Xizmatni baholang',
                    style: AppText.bodyStrong.copyWith(fontSize: 16),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      for (int i = 1; i <= 5; i++)
                        GestureDetector(
                          onTap: () => setState(() => _stars = i),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 6),
                            child: Icon(
                              LucideIcons.star,
                              size: 36,
                              color: i <= _stars ? AppColors.accent : AppColors.border,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  TextField(
                    controller: _commentController,
                    maxLines: 3,
                    decoration: InputDecoration(
                      hintText: 'Fikringiz (ixtiyoriy)',
                      hintStyle: AppText.izoh,
                      filled: true,
                      fillColor: AppColors.surface,
                      contentPadding: const EdgeInsets.all(AppSpacing.md),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppRadius.sm),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppRadius.sm),
                        borderSide: const BorderSide(color: AppColors.brand, width: 1.5),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            AppButton(
              label: 'Yuborish',
              loading: _submitting,
              onPressed: _handleSubmit,
            ),
            const SizedBox(height: AppSpacing.sm),
            AppButton(
              label: 'O\'tkazib yuborish',
              variant: AppButtonVariant.ghost,
              onPressed: () => Navigator.of(context).pop(),
            ),
          ],
        ),
      ),
    );
  }
}
