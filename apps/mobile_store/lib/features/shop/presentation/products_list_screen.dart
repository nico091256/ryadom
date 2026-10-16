import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:localshop_shared/localshop_shared.dart';
import '../../../app/theme.dart';
import '../../../core/config/env.dart';
import '../../../core/errors/app_exception.dart';
import '../../../core/providers.dart';
import '../domain/seller_product.dart';
import 'product_editor_screen.dart';
import 'shop_providers.dart';

class ProductsListScreen extends ConsumerStatefulWidget {
  const ProductsListScreen({super.key});

  @override
  ConsumerState<ProductsListScreen> createState() => _ProductsListScreenState();
}

class _ProductsListScreenState extends ConsumerState<ProductsListScreen> {
  String _query = '';

  Future<void> _openEditor([SellerProduct? product]) async {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => ProductEditorScreen(product: product)));
    ref.invalidate(sellerProductsProvider);
  }

  Future<void> _toggleAvailable(SellerProduct product, bool value) async {
    try {
      await ref.read(sellerApiProvider).updateProduct(product.id, {'is_available': value});
      ref.invalidate(sellerProductsProvider);
    } on AppException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _delete(SellerProduct product) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(ref.t('products.deleteTitle')),
        content: Text(ref.t('products.deleteConfirm')),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: Text(ref.t('common.cancel'))),
          FilledButton(onPressed: () => Navigator.of(dialogContext).pop(true), child: Text(ref.t('products.deleteTitle'))),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await ref.read(sellerApiProvider).deleteProduct(product.id);
      ref.invalidate(sellerProductsProvider);
    } on AppException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final productsAsync = ref.watch(sellerProductsProvider);
    final lang = ref.watch(localeProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(ref.t('products.title')),
        actions: [IconButton(icon: const Icon(Icons.add), onPressed: () => _openEditor())],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              decoration: InputDecoration(prefixIcon: const Icon(Icons.search), hintText: ref.t('products.searchPlaceholder')),
              onChanged: (v) => setState(() => _query = v.trim().toLowerCase()),
            ),
          ),
          Expanded(
            child: productsAsync.when(
              data: (products) {
                final filtered = _query.isEmpty ? products : products.where((p) => p.nameUz.toLowerCase().contains(_query)).toList();
                if (filtered.isEmpty) {
                  return Center(child: Text(ref.t('products.empty'), style: const TextStyle(color: Color(0xFF94A3B8))));
                }
                return ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  itemCount: filtered.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (context, i) {
                    final product = filtered[i];
                    return Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFE2E8F0))),
                      child: Row(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: SizedBox(
                              width: 52,
                              height: 52,
                              child: product.imageUrl != null
                                  ? CachedNetworkImage(imageUrl: Env.resolveMediaUrl(product.imageUrl!), fit: BoxFit.cover)
                                  : Container(color: const Color(0xFFF1F5F9), child: const Icon(Icons.shopping_bag_outlined, color: Color(0xFF94A3B8))),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: InkWell(
                              onTap: () => _openEditor(product),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(product.nameUz, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                                  Text(formatPrice(product.price, lang), style: const TextStyle(color: AppTheme.seed, fontWeight: FontWeight.w800, fontSize: 13)),
                                  Text(ref.t('products.stock', {'count': '${product.stock}'}), style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
                                ],
                              ),
                            ),
                          ),
                          Switch(value: product.isAvailable, activeTrackColor: AppTheme.seed, onChanged: (v) => _toggleAvailable(product, v)),
                          IconButton(
                            icon: const Icon(Icons.delete_outline, color: Colors.red),
                            onPressed: () => _delete(product),
                          ),
                        ],
                      ),
                    );
                  },
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (err, _) => Center(child: Text('$err')),
            ),
          ),
        ],
      ),
    );
  }
}
