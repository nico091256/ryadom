import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_client/features/cart/domain/cart_state.dart';
import 'package:mobile_client/features/cart/presentation/cart_controller.dart';
import 'package:mobile_client/features/shops/domain/product.dart';

Product _product(String id, {String shopId = 'shop-1', int price = 10000, int stock = 5}) =>
    Product(id: id, shopId: shopId, categoryId: 'cat-1', nameUz: 'Product $id', price: price, stock: stock, isAvailable: true);

void main() {
  late ProviderContainer container;

  setUp(() => container = ProviderContainer());
  tearDown(() => container.dispose());

  test('adding a product creates a single-item cart', () {
    final notifier = container.read(cartControllerProvider.notifier);
    final result = notifier.addOrIncrement(_product('p1'), 'Shop One');

    expect(result, AddToCartResult.added);
    final state = container.read(cartControllerProvider);
    expect(state.items.length, 1);
    expect(state.itemCount, 1);
    expect(state.totalAmount, 10000);
    expect(state.shopId, 'shop-1');
  });

  test('adding the same product again increments its quantity instead of duplicating', () {
    final notifier = container.read(cartControllerProvider.notifier);
    final product = _product('p1');
    notifier.addOrIncrement(product, 'Shop One');
    notifier.addOrIncrement(product, 'Shop One');

    final state = container.read(cartControllerProvider);
    expect(state.items.length, 1);
    expect(state.quantityOf('p1'), 2);
    expect(state.totalAmount, 20000);
  });

  test('adding a product from a different shop is rejected without mutating state', () {
    final notifier = container.read(cartControllerProvider.notifier);
    notifier.addOrIncrement(_product('p1', shopId: 'shop-1'), 'Shop One');

    final result = notifier.addOrIncrement(_product('p2', shopId: 'shop-2'), 'Shop Two');

    expect(result, AddToCartResult.differentShop);
    final state = container.read(cartControllerProvider);
    expect(state.shopId, 'shop-1');
    expect(state.items.length, 1);
  });

  test('clearAndAdd replaces the cart with only the new shop\'s item', () {
    final notifier = container.read(cartControllerProvider.notifier);
    notifier.addOrIncrement(_product('p1', shopId: 'shop-1'), 'Shop One');
    notifier.clearAndAdd(_product('p2', shopId: 'shop-2'), 'Shop Two');

    final state = container.read(cartControllerProvider);
    expect(state.shopId, 'shop-2');
    expect(state.items.length, 1);
    expect(state.quantityOf('p2'), 1);
  });

  test('decrementing to zero removes the item, and an empty cart resets shopId', () {
    final notifier = container.read(cartControllerProvider.notifier);
    notifier.addOrIncrement(_product('p1'), 'Shop One');
    notifier.decrement('p1');

    final state = container.read(cartControllerProvider);
    expect(state.isEmpty, isTrue);
    expect(state.shopId, isNull);
  });

  test('setQuantity with zero or negative removes the item', () {
    final notifier = container.read(cartControllerProvider.notifier);
    notifier.addOrIncrement(_product('p1'), 'Shop One');
    notifier.setQuantity('p1', 0);

    expect(container.read(cartControllerProvider).isEmpty, isTrue);
  });

  test('reorder replaces the cart with multiple items from specified shop', () {
    final notifier = container.read(cartControllerProvider.notifier);
    notifier.addOrIncrement(_product('old_p'), 'Old Shop');

    notifier.reorder(
      shopId: 'reorder-shop',
      shopName: 'Reorder Shop',
      items: [
        CartItem(product: _product('r1', shopId: 'reorder-shop', price: 15000), quantity: 2),
        CartItem(product: _product('r2', shopId: 'reorder-shop', price: 20000), quantity: 1),
      ],
    );

    final state = container.read(cartControllerProvider);
    expect(state.shopId, 'reorder-shop');
    expect(state.shopName, 'Reorder Shop');
    expect(state.items.length, 2);
    expect(state.itemCount, 3);
    expect(state.totalAmount, 50000);
  });

  test('CartState serializes to JSON and deserializes correctly', () {
    final original = CartState(
      shopId: 'shop-abc',
      shopName: 'Test Shop',
      items: [
        CartItem(product: _product('p1', shopId: 'shop-abc', price: 5000), quantity: 3),
      ],
    );

    final json = original.toJson();
    final restored = CartState.fromJson(json);

    expect(restored.shopId, original.shopId);
    expect(restored.shopName, original.shopName);
    expect(restored.items.length, 1);
    expect(restored.items.first.product.id, 'p1');
    expect(restored.items.first.quantity, 3);
    expect(restored.totalAmount, 15000);
  });
}
