import 'package:flutter/material.dart';

import '../../../../ui/ui.dart';

class CategoryItem {
  const CategoryItem({
    required this.name,
    required this.bgColor,
    required this.icon,
    this.tag,
  });

  final String name;
  final Color bgColor;
  final IconData icon;
  final String? tag;
}

/// Category grid matching PDF Page 4: 72x72 rounded cards, radius 20.
class CategoryRow extends StatelessWidget {
  const CategoryRow({super.key, this.onCategorySelected});

  final ValueChanged<String>? onCategorySelected;

  static const List<CategoryItem> categories = [
    CategoryItem(
      name: 'Non',
      bgColor: Color(0xFFF6D8A8),
      icon: LucideIcons.croissant,
      tag: 'non',
    ),
    CategoryItem(
      name: 'Sut',
      bgColor: Color(0xFFCCE4F7),
      icon: LucideIcons.milk,
      tag: 'sut',
    ),
    CategoryItem(
      name: 'Meva',
      bgColor: Color(0xFFD6E8D0),
      icon: LucideIcons.apple,
      tag: 'meva',
    ),
    CategoryItem(
      name: 'Ichimlik',
      bgColor: Color(0xFFF7D5CD),
      icon: LucideIcons.cupSoda,
      tag: 'ichimlik',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.page),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          for (final item in categories)
            _CategoryTile(
              item: item,
              onTap: () => onCategorySelected?.call(item.tag ?? item.name),
            ),
        ],
      ),
    );
  }
}

class _CategoryTile extends StatelessWidget {
  const _CategoryTile({required this.item, required this.onTap});

  final CategoryItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: item.bgColor,
              borderRadius: BorderRadius.circular(AppRadius.category),
              boxShadow: AppShadows.xs,
            ),
            alignment: Alignment.center,
            child: Icon(item.icon, size: 28, color: AppColors.textPrimary.withValues(alpha: 0.75)),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            item.name,
            style: AppText.asosiyMatn.copyWith(fontSize: 14),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
