import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:localshop_shared/localshop_shared.dart';
import '../../../app/theme.dart';
import '../../../core/config/env.dart';
import '../../../core/providers.dart';
import 'cart_controller.dart';

class CartScreen extends ConsumerWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(cartControllerProvider);
    final lang = ref.watch(localeProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(ref.t('cart.title')),
        actions: [
          if (!cart.isEmpty)
            IconButton(
              icon: const Icon(Icons.delete_outline),
              onPressed: () => ref.read(cartControllerProvider.notifier).clear(),
            ),
        ],
      ),
      body: cart.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.shopping_cart_outlined, size: 48, color: Color(0xFFCBD5E1)),
                  const SizedBox(height: 12),
                  Text(ref.t('cart.empty'), style: const TextStyle(color: Color(0xFF94A3B8))),
                  const SizedBox(height: 16),
                  OutlinedButton(onPressed: () => context.go('/home'), child: Text(ref.t('cart.startShopping'))),
                ],
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: cart.items.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (context, i) {
                final item = cart.items[i];
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
                          child: item.product.imageUrl != null
                              ? CachedNetworkImage(imageUrl: Env.resolveMediaUrl(item.product.imageUrl!), fit: BoxFit.cover)
                              : Container(color: const Color(0xFFF1F5F9), child: const Icon(Icons.shopping_bag_outlined, color: Color(0xFF94A3B8))),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(item.product.nameUz, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                            Text(formatPrice(item.subtotal, lang), style: const TextStyle(color: AppTheme.seed, fontWeight: FontWeight.w800, fontSize: 13)),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: () => ref.read(cartControllerProvider.notifier).decrement(item.product.id),
                        icon: const Icon(Icons.remove_circle, color: AppTheme.seed),
                      ),
                      Text('${item.quantity}', style: const TextStyle(fontWeight: FontWeight.w800)),
                      IconButton(
                        onPressed: item.quantity < item.product.stock
                            ? () => ref.read(cartControllerProvider.notifier).setQuantity(item.product.id, item.quantity + 1)
                            : null,
                        icon: const Icon(Icons.add_circle, color: AppTheme.seed),
                      ),
                    ],
                  ),
                );
              },
            ),
      bottomNavigationBar: cart.isEmpty
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(ref.t('cart.total'), style: const TextStyle(fontSize: 14, color: Color(0xFF64748B))),
                        Text(formatPrice(cart.totalAmount, lang), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
                      ],
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(onPressed: () => context.push('/checkout'), child: Text(ref.t('cart.checkout'))),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}
