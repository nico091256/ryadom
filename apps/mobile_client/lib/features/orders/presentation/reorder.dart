import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers.dart';
import '../../../ui/ui.dart';
import '../../cart/domain/cart_state.dart';
import '../../cart/presentation/cart_controller.dart';
import '../../shops/domain/product.dart';
import '../domain/order.dart';

/// Puts every line of [order] back into the cart and opens it. Asks before
/// replacing a cart that belongs to a different shop. Shared by the orders
/// history list and the Home "last order" card so the behaviour never drifts.
///
/// Returns true when the cart was filled.
Future<bool> reorderOrder(BuildContext context, WidgetRef ref, Order order) async {
  final shopId = order.shopId;
  final items = order.items.where((i) => i.productId != null).toList();
  if (shopId == null || items.isEmpty) {
    showAppToast(context, ref.t('orders.reorderUnavailable'), tone: ToastTone.error);
    return false;
  }

  final cart = ref.read(cartControllerProvider);
  if (cart.shopId != null && cart.shopId != shopId && !cart.isEmpty) {
    final confirmed = await showAppConfirm(
      context,
      title: ref.t('cart.differentShopTitle'),
      message: ref.t('cart.multipleShopsWarning'),
      confirmLabel: ref.t('cart.clearCart'),
      cancelLabel: ref.t('common.cancel'),
      destructive: true,
    );
    if (!confirmed || !context.mounted) return false;
  }

  ref.read(cartControllerProvider.notifier).reorder(
        shopId: shopId,
        shopName: order.shopName ?? '',
        items: [
          for (final i in items)
            CartItem(
              product: Product(
                id: i.productId!,
                shopId: shopId,
                categoryId: '',
                nameUz: i.productName,
                price: i.unitPrice,
                // Live stock is unknown here; the backend re-validates it at checkout.
                stock: 999,
                isAvailable: true,
              ),
              quantity: i.quantity,
            ),
        ],
      );

  if (!context.mounted) return true;
  showAppToast(context, ref.t('orders.reorderSuccess'), tone: ToastTone.success);
  context.push('/cart');
  return true;
}
