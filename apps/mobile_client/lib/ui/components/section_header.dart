import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../tokens.dart';
import '../typography.dart';
import 'pressable.dart';

/// "Yaqin do'konlar  ·  12        Barchasi ›" row above lists.
class SectionHeader extends StatelessWidget {
  const SectionHeader({
    super.key,
    required this.title,
    this.count,
    this.actionLabel,
    this.onAction,
    this.padding = const EdgeInsets.fromLTRB(AppSpacing.page, AppSpacing.xl, AppSpacing.page, AppSpacing.md),
  });

  final String title;
  final int? count;
  final String? actionLabel;
  final VoidCallback? onAction;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Row(
              children: [
                Flexible(child: Text(title, style: AppText.h3, maxLines: 1, overflow: TextOverflow.ellipsis)),
                if (count != null) ...[
                  const SizedBox(width: AppSpacing.sm),
                  Text('$count', style: AppText.h3.copyWith(color: AppColors.textTertiary)),
                ],
              ],
            ),
          ),
          if (actionLabel != null && onAction != null)
            Pressable(
              onTap: onAction,
              child: Row(
                children: [
                  Text(actionLabel!, style: AppText.buttonSm.copyWith(color: AppColors.brand)),
                  const Icon(LucideIcons.chevronRight, size: 16, color: AppColors.brand),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
