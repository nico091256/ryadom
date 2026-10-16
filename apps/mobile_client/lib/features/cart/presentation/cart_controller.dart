import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../shops/domain/product.dart';
import '../domain/cart_state.dart';

enum AddToCartResult { added, differentShop }

final cartControllerProvider = NotifierProvider<CartController, CartState>(CartController.new);

const _cartStorageKey = 'ryadom_persisted_cart';

/// Single-shop cart, matching the backend's one-cart-per-customer model and
/// the RN app's "clear cart or stay on your current shop" rule. Persisted locally
/// to SharedPreferences so the cart survives app restarts and browser refreshes.
class CartController extends Notifier<CartState> {
  @override
  CartState build() {
    _loadFromStorage();
    return CartState.empty;
  }

  Future<void> _loadFromStorage() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_cartStorageKey);
      if (raw != null && raw.isNotEmpty) {
        final decoded = json.decode(raw) as Map<String, dynamic>;
        state = CartState.fromJson(decoded);
      }
    } catch (_) {
      // Ignored if corrupt or unavailable
    }
  }

  Future<void> _saveToStorage() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (state.isEmpty) {
        await prefs.remove(_cartStorageKey);
      } else {
        await prefs.setString(_cartStorageKey, json.encode(state.toJson()));
      }
    } catch (_) {}
  }

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
    _saveToStorage();
    return AddToCartResult.added;
  }

  void clearAndAdd(Product product, String shopName) {
    state = CartState(shopId: product.shopId, shopName: shopName, items: [CartItem(product: product, quantity: 1)]);
    _saveToStorage();
  }

  void reorder({required String shopId, required String shopName, required List<CartItem> items}) {
    state = CartState(shopId: shopId, shopName: shopName, items: items);
    _saveToStorage();
  }

  void setQuantity(String productId, int quantity) {
    if (quantity <= 0) {
      remove(productId);
      return;
    }
    state = state.copyWith(items: state.items.map((i) => i.product.id == productId ? i.copyWith(quantity: quantity) : i).toList());
    _saveToStorage();
  }

  void decrement(String productId) {
    final current = state.quantityOf(productId);
    setQuantity(productId, current - 1);
  }

  void remove(String productId) {
    final items = state.items.where((i) => i.product.id != productId).toList();
    state = items.isEmpty ? CartState.empty : state.copyWith(items: items);
    _saveToStorage();
  }

  void clear() {
    state = CartState.empty;
    _saveToStorage();
  }
}
