import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/providers.dart';
import '../../../../ui/ui.dart';
import '../shop_detail_controller.dart';

const double _kSearchHeight = 48;
const double _kChipsHeight = 38;
const double _kTopPad = AppSpacing.sm;
const double _kGap = AppSpacing.sm + 2;
const double _kBottomPad = AppSpacing.sm + 2;

/// Height of the sticky toolbar for the given state (kept in sync with the
/// widget layout so the persistent header never overflows).
double shopToolbarHeight({required bool hasCategories}) =>
    _kTopPad + _kSearchHeight + (hasCategories ? _kGap + _kChipsHeight : 0) + _kBottomPad;

/// Pinned search + category chips. Background is the page colour so it reads
/// as part of the page; a hairline appears underneath only while stuck.
class ShopToolbarDelegate extends SliverPersistentHeaderDelegate {
  const ShopToolbarDelegate({required this.shopId, required this.hasCategories, required this.maxContentWidth});

  final String shopId;
  final bool hasCategories;
  final double maxContentWidth;

  double get _height => shopToolbarHeight(hasCategories: hasCategories);

  @override
  double get minExtent => _height;

  @override
  double get maxExtent => _height;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return _ShopToolbarShell(
      stuck: overlapsContent,
      height: _height,
      maxContentWidth: maxContentWidth,
      child: _ShopToolbar(shopId: shopId, hasCategories: hasCategories),
    );
  }

  @override
  bool shouldRebuild(ShopToolbarDelegate oldDelegate) =>
      oldDelegate.shopId != shopId || oldDelegate.hasCategories != hasCategories || oldDelegate.maxContentWidth != maxContentWidth;
}

class _ShopToolbarShell extends StatelessWidget {
  const _ShopToolbarShell({required this.stuck, required this.height, required this.maxContentWidth, required this.child});

  final bool stuck;
  final double height;
  final double maxContentWidth;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: AppDurations.normal,
      curve: AppCurves.standard,
      height: height,
      decoration: BoxDecoration(
        color: AppColors.background,
        border: Border(bottom: BorderSide(color: stuck ? AppColors.border : Colors.transparent)),
      ),
      child: Center(child: ConstrainedBox(constraints: BoxConstraints(maxWidth: maxContentWidth), child: child)),
    );
  }
}

class _ShopToolbar extends ConsumerStatefulWidget {
  const _ShopToolbar({required this.shopId, required this.hasCategories});

  final String shopId;
  final bool hasCategories;

  @override
  ConsumerState<_ShopToolbar> createState() => _ShopToolbarState();
}

class _ShopToolbarState extends ConsumerState<_ShopToolbar> {
  late final TextEditingController _search = TextEditingController(text: ref.read(productSearchQueryProvider));

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _onChanged(String value) => ref.read(productSearchQueryProvider.notifier).state = value;

  void _clear() {
    _search.clear();
    _onChanged('');
  }

  @override
  Widget build(BuildContext context) {
    final hasQuery = ref.watch(productSearchQueryProvider.select((q) => q.isNotEmpty));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: _kTopPad),
        Padding(
          padding: AppSpacing.pagePadding,
          child: AppSearchBar(
            hint: ref.t('shop.searchPlaceholder'),
            controller: _search,
            onChanged: _onChanged,
            trailing: hasQuery
                ? Pressable(
                    onTap: _clear,
                    scale: 0.9,
                    child: const SizedBox(
                      width: 44,
                      height: _kSearchHeight,
                      child: Center(child: Icon(LucideIcons.xCircle, size: 18, color: AppColors.ink400)),
                    ),
                  )
                : null,
          ),
        ),
        if (widget.hasCategories) ...[
          const SizedBox(height: _kGap),
          _CategoryChips(shopId: widget.shopId),
        ],
      ],
    );
  }
}

class _CategoryChips extends ConsumerWidget {
  const _CategoryChips({required this.shopId});

  final String shopId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final allProducts = ref.watch(shopProductsProvider(shopId)).value ?? const [];
    final categories = {for (final p in allProducts) if (p.category != null) p.categoryId: p.category!}.values.toList();
    final selected = ref.watch(selectedCategoryIdProvider);
    final notifier = ref.read(selectedCategoryIdProvider.notifier);

    return AppChipRow(
      height: _kChipsHeight,
      children: [
        AppChip(label: ref.t('shop.allCategories'), selected: selected == null, onTap: () => notifier.state = null),
        for (final c in categories) AppChip(label: c.nameUz, selected: selected == c.id, onTap: () => notifier.state = c.id),
      ],
    );
  }
}
