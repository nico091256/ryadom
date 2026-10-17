import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/providers.dart';
import '../domain/cart_state.dart';

final cartApiProvider = Provider<CartApi>((ref) => CartApi(ref.read(apiClientProvider)));

/// Server-side cart (`/cart`). The app keeps the cart locally for speed and
/// offline edits; the backend creates orders from *its* copy, so the local
/// cart is pushed here right before checkout. The server re-validates the
/// shop and every line's stock and answers with CART_MULTIPLE_SHOPS /
/// OUT_OF_STOCK / SHOP_INACTIVE when something no longer fits.
class CartApi {
  CartApi(this._client);
  final ApiClient _client;

  /// Replaces the server cart with [cart] (single-shop rule enforced server-side;
  /// `clearOtherShop` lets the fresh local cart win over a stale server one).
  Future<void> replace(CartState cart) async {
    final shopId = cart.shopId;
    if (shopId == null || cart.isEmpty) {
      await clear();
      return;
    }
    await _client.put('/cart', data: {
      'shop_id': shopId,
      'clearOtherShop': true,
      'items': [
        for (final i in cart.items) {'product_id': i.product.id, 'quantity': i.quantity},
      ],
    });
  }

  Future<void> clear() => _client.delete('/cart');
}
