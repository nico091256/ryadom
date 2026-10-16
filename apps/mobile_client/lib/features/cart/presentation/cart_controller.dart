import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shops/domain/product.dart';
import '../domain/cart_state.dart';

enum AddToCartResult { added, differentShop }

final cartControllerProvider = NotifierProvider<CartController, CartState>(CartController.new);

/// Single-shop cart, matching the backend's one-cart-per-customer model and
/// the RN app's "clear cart or stay on your current shop" rule. Kept purely
/// client-side until checkout, same as the RN app (PUT /cart is only called
/// right before placing the order).
class CartController extends Notifier<CartState> {
  @override
  CartState build() => CartState.empty;

  /// Returns [AddToCartResult.differentShop] without changing state when the
  /// cart already holds items from another shop — the caller should confirm
  /// with the user and then call [clearAndAdd].
  AddToCartResult addOrIncrement(Product product, String shopName, {int by = 1}) {
    if (state.shopId != null && state.shopId != product.shopId) {
      return AddToCartResult.differentShop;
    }

    final items = List<CartItem>.from(state.items);
    final index = items.indexWhere((i) => i.product.id == product.id);
    if (index == -1) {
      items.add(CartItem(product: product, quantity: by));
    } else {
      items[index] = items[index].copyWith(quantity: items[index].quantity + by);
    }

    state = state.copyWith(shopId: product.shopId, shopName: shopName, items: items);
    return AddToCartResult.added;
  }

  void clearAndAdd(Product product, String shopName) {
    state = CartState(shopId: product.shopId, shopName: shopName, items: [CartItem(product: product, quantity: 1)]);
  }

  void setQuantity(String productId, int quantity) {
    if (quantity <= 0) {
      remove(productId);
      return;
    }
    state = state.copyWith(items: state.items.map((i) => i.product.id == productId ? i.copyWith(quantity: quantity) : i).toList());
  }

  void decrement(String productId) {
    final current = state.quantityOf(productId);
    setQuantity(productId, current - 1);
  }

  void remove(String productId) {
    final items = state.items.where((i) => i.product.id != productId).toList();
    state = items.isEmpty ? CartState.empty : state.copyWith(items: items);
  }

  void clear() => state = CartState.empty;
}
