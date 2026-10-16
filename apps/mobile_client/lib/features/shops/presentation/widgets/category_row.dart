import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:localshop_shared/localshop_shared.dart';

import '../../../../core/providers.dart';
import '../../../../ui/ui.dart';
import '../../domain/product.dart';
import '../home_controller.dart';

/// Home category strip (design PDF p.4): 72x72 tinted tiles, radius 20.
/// Categories come from the backend; tapping one filters the nearby shops to
/// those stocking it (tap again to clear). Hidden entirely if the catalogue
/// cannot be loaded — it is a shortcut, not a blocker.
class CategoryRow extends ConsumerWidget {
  const CategoryRow({super.key});

  static const double tileSize = 72;
  static const double _rowHeight = tileSize + AppSpacing.sm + 36;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categories = ref.watch(homeCategoriesProvider);
    final selected = ref.watch(selectedHomeCategoryProvider);
    final lang = ref.watch(localeProvider);

    return categories.when(
      loading: () => SizedBox(
        height: _rowHeight,
        child: Skeleton(
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: AppSpacing.pagePadding,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: 4,
            separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.md),
            itemBuilder: (_, _) => const Column(
              children: [
                SkeletonBox(width: tileSize, height: tileSize, radius: AppRadius.category),
                SizedBox(height: AppSpacing.sm),
                SkeletonLine(width: 48, height: 10),
              ],
            ),
          ),
        ),
      ),
      error: (_, _) => const SizedBox.shrink(),
      data: (list) {
        if (list.isEmpty) return const SizedBox.shrink();
        return SizedBox(
          height: _rowHeight,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: AppSpacing.pagePadding,
            physics: const BouncingScrollPhysics(),
            itemCount: list.length,
            separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.md),
            itemBuilder: (_, i) {
              final c = list[i];
              return _CategoryTile(
                label: _localizedName(c, lang),
                icon: categoryIcon(c.nameUz),
                tint: AppColors.categoryTints[i % AppColors.categoryTints.length],
                selected: c.id == selected,
                onTap: () => ref.read(selectedHomeCategoryProvider.notifier).state = c.id == selected ? null : c.id,
              );
            },
          ),
        );
      },
    );
  }

  static String _localizedName(ProductCategory c, SupportedLanguage lang) => switch (lang) {
        SupportedLanguage.ru => c.nameRu ?? c.nameUz,
        SupportedLanguage.en => c.nameEn ?? c.nameUz,
        _ => c.nameUz,
      };
}

/// Best-effort glyph for a category by its Uzbek name.
IconData categoryIcon(String nameUz) {
  final n = nameUz.toLowerCase();
  if (n.contains('non') || n.contains('pishiriq')) return LucideIcons.croissant;
  if (n.contains('sut')) return LucideIcons.milk;
  if (n.contains('ichimlik') || n.contains('sharbat')) return LucideIcons.cupSoda;
  if (n.contains('meva') || n.contains('sabzavot')) return LucideIcons.apple;
  if (n.contains('shirin') || n.contains('gazak')) return LucideIcons.cookie;
  if (n.contains("go'sht") || n.contains('gosht')) return LucideIcons.beef;
  if (n.contains('baliq')) return LucideIcons.fish;
  return LucideIcons.shoppingBasket;
}

class _CategoryTile extends StatelessWidget {
  const _CategoryTile({
    required this.label,
    required this.icon,
    required this.tint,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final Color tint;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Pressable(
      onTap: onTap,
      haptic: true,
      scale: 0.93,
      child: SizedBox(
        width: CategoryRow.tileSize + 8,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                AnimatedContainer(
                  duration: AppDurations.normal,
                  curve: AppCurves.standard,
                  width: CategoryRow.tileSize,
                  height: CategoryRow.tileSize,
                  decoration: BoxDecoration(
                    color: tint,
                    borderRadius: BorderRadius.circular(AppRadius.category),
                    border: Border.all(color: selected ? AppColors.brand : Colors.transparent, width: 2),
                    boxShadow: selected ? AppShadows.brand : AppShadows.xs,
                  ),
                  alignment: Alignment.center,
                  child: Icon(icon, size: 28, color: AppColors.textPrimary.withValues(alpha: 0.8)),
                ),
                if (selected)
                  Positioned(
                    right: -4,
                    top: -4,
                    child: Container(
                      width: 20,
                      height: 20,
                      decoration: const BoxDecoration(color: AppColors.brand, shape: BoxShape.circle),
                      alignment: Alignment.center,
                      child: const Icon(LucideIcons.check, size: 12, color: AppColors.white),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              label,
              style: AppText.yorliq.copyWith(color: selected ? AppColors.brand : AppColors.textPrimary),
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
