import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:localshop_shared/localshop_shared.dart';
import '../../../app/theme.dart';
import '../../../core/providers.dart';
import '../../../core/utils/launch_url.dart';
import '../../cart/presentation/cart_controller.dart';
import '../domain/product.dart';
import '../domain/shop.dart';
import 'shop_detail_controller.dart';

class ShopDetailScreen extends ConsumerWidget {
  const ShopDetailScreen({super.key, required this.shopId});

  final String shopId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final shopAsync = ref.watch(shopDetailProvider(shopId));
    final cart = ref.watch(cartControllerProvider);
    final cartHereCount = cart.shopId == shopId ? cart.itemCount : 0;

    return Scaffold(
      body: SafeArea(
        child: shopAsync.when(
          data: (shop) => Stack(
            children: [
              Column(
                children: [
                  _ShopHeader(shop: shop),
                  if (!shop.isCurrentlyOpen)
                    Container(
                      width: double.infinity,
                      color: const Color(0xFFFEF3C7),
                      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
                      child: Text(ref.t('shop.closedBanner'), style: const TextStyle(color: Color(0xFF92400E), fontSize: 12, fontWeight: FontWeight.w600)),
                    ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                    child: TextField(
                      decoration: InputDecoration(prefixIcon: const Icon(Icons.search), hintText: ref.t('shop.searchPlaceholder')),
                      onChanged: (v) => ref.read(productSearchQueryProvider.notifier).state = v,
                    ),
                  ),
                  Expanded(child: _ProductList(shopId: shopId, shopName: shop.name, shopIsOpen: shop.isCurrentlyOpen)),
                ],
              ),
              Positioned(
                top: 4,
                left: 4,
                child: SafeArea(
                  child: IconButton.filled(
                    style: IconButton.styleFrom(backgroundColor: Colors.white, foregroundColor: Colors.black87),
                    onPressed: () => context.pop(),
                    icon: const Icon(Icons.arrow_back),
                  ),
                ),
              ),
            ],
          ),
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (err, _) => Center(child: Text('$err')),
        ),
      ),
      bottomNavigationBar: cartHereCount > 0
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: ElevatedButton(
                  onPressed: () => context.push('/cart'),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('${ref.t('cart.goToCart')} ($cartHereCount)'),
                      Text(formatPrice(cart.totalAmount, ref.watch(localeProvider))),
                    ],
                  ),
                ),
              ),
            )
          : null,
    );
  }
}

class _ShopHeader extends StatelessWidget {
  const _ShopHeader({required this.shop});
  final Shop shop;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 56, 16, 8),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: SizedBox(
              width: 48,
              height: 48,
              child: shop.logoUrl != null
                  ? CachedNetworkImage(imageUrl: shop.logoUrl!, fit: BoxFit.cover)
                  : Container(color: const Color(0xFFF1F5F9), child: const Icon(Icons.storefront, color: Color(0xFF94A3B8))),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(shop.name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
                Text('${shop.openTime} – ${shop.closeTime}', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
              ],
            ),
          ),
          IconButton(
            onPressed: () => launchCallerUrl(shop.phone),
            icon: const Icon(Icons.call, color: AppTheme.seed),
          ),
        ],
      ),
    );
  }
}

class _ProductList extends ConsumerWidget {
  const _ProductList({required this.shopId, required this.shopName, required this.shopIsOpen});

  final String shopId;
  final String shopName;
  final bool shopIsOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final productsAsync = ref.watch(filteredProductsProvider(shopId));
    final allProducts = ref.watch(shopProductsProvider(shopId)).value ?? [];
    final categories = {for (final p in allProducts) if (p.category != null) p.categoryId: p.category!}.values.toList();
    final selectedCategory = ref.watch(selectedCategoryIdProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (categories.isNotEmpty)
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                _CategoryChip(label: ref.t('shop.allCategories'), selected: selectedCategory == null, onTap: () => ref.read(selectedCategoryIdProvider.notifier).state = null),
                for (final c in categories)
                  _CategoryChip(label: c.nameUz, selected: selectedCategory == c.id, onTap: () => ref.read(selectedCategoryIdProvider.notifier).state = c.id),
              ],
            ),
          ),
        Expanded(
          child: productsAsync.when(
            data: (products) => products.isEmpty
                ? Center(child: Text(ref.t('shop.noProducts'), style: const TextStyle(color: Color(0xFF94A3B8))))
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: products.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, i) => _ProductRow(product: products[i], shopName: shopName, shopIsOpen: shopIsOpen),
                  ),
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (err, _) => Center(child: Text('$err')),
          ),
        ),
      ],
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: selected,
        selectedColor: AppTheme.seed.withValues(alpha: 0.15),
        labelStyle: TextStyle(color: selected ? AppTheme.seed : const Color(0xFF334155), fontWeight: FontWeight.w700, fontSize: 12),
        onSelected: (_) => onTap(),
      ),
    );
  }
}

class _ProductRow extends ConsumerWidget {
  const _ProductRow({required this.product, required this.shopName, required this.shopIsOpen});

  final Product product;
  final String shopName;
  final bool shopIsOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = ref.watch(localeProvider);
    final qty = ref.watch(cartControllerProvider.select((c) => c.quantityOf(product.id)));
    final canAdd = product.isAvailable && product.stock > 0 && shopIsOpen;

    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: SizedBox(
              width: 56,
              height: 56,
              child: product.imageUrl != null
                  ? CachedNetworkImage(imageUrl: product.imageUrl!, fit: BoxFit.cover)
                  : Container(color: const Color(0xFFF1F5F9), child: const Icon(Icons.shopping_bag_outlined, color: Color(0xFF94A3B8))),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(product.nameUz, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                const SizedBox(height: 2),
                Text(
                  canAdd ? formatPrice(product.price, lang) : ref.t('shop.outOfStock'),
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: canAdd ? AppTheme.seed : const Color(0xFFEF4444)),
                ),
              ],
            ),
          ),
          if (canAdd) _QuantityStepper(product: product, shopName: shopName, quantity: qty),
        ],
      ),
    );
  }
}

class _QuantityStepper extends ConsumerWidget {
  const _QuantityStepper({required this.product, required this.shopName, required this.quantity});

  final Product product;
  final String shopName;
  final int quantity;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (quantity == 0) {
      return FilledButton(
        style: FilledButton.styleFrom(backgroundColor: AppTheme.seed, minimumSize: const Size(0, 36), padding: const EdgeInsets.symmetric(horizontal: 14)),
        onPressed: () => _add(context, ref),
        child: Text(ref.t('shop.addToCart'), style: const TextStyle(fontSize: 12)),
      );
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          onPressed: () => ref.read(cartControllerProvider.notifier).decrement(product.id),
          icon: const Icon(Icons.remove_circle, color: AppTheme.seed),
        ),
        Text('$quantity', style: const TextStyle(fontWeight: FontWeight.w800)),
        IconButton(
          onPressed: quantity < product.stock ? () => _add(context, ref) : null,
          icon: const Icon(Icons.add_circle, color: AppTheme.seed),
        ),
      ],
    );
  }

  void _add(BuildContext context, WidgetRef ref) {
    final result = ref.read(cartControllerProvider.notifier).addOrIncrement(product, shopName);
    if (result == AddToCartResult.differentShop) {
      _confirmClearCart(context, ref);
    }
  }

  void _confirmClearCart(BuildContext context, WidgetRef ref) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        content: Text(ref.t('cart.multipleShopsWarning')),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(), child: Text(ref.t('common.cancel'))),
          FilledButton(
            onPressed: () {
              ref.read(cartControllerProvider.notifier).clearAndAdd(product, shopName);
              Navigator.of(dialogContext).pop();
            },
            child: Text(ref.t('cart.clearCart')),
          ),
        ],
      ),
    );
  }
}
