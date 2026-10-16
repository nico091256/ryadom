import '../../shops/domain/product.dart';

class CartItem {
  const CartItem({required this.product, required this.quantity});

  final Product product;
  final int quantity;

  int get subtotal => product.price * quantity;

  CartItem copyWith({int? quantity}) => CartItem(product: product, quantity: quantity ?? this.quantity);
}

class CartState {
  const CartState({this.shopId, this.shopName, this.items = const []});

  final String? shopId;
  final String? shopName;
  final List<CartItem> items;

  bool get isEmpty => items.isEmpty;
  int get totalAmount => items.fold(0, (sum, item) => sum + item.subtotal);
  int get itemCount => items.fold(0, (sum, item) => sum + item.quantity);

  int quantityOf(String productId) => items.firstWhere((i) => i.product.id == productId, orElse: () => const CartItem(product: _emptyProduct, quantity: 0)).quantity;

  static const _emptyProduct = Product(id: '', shopId: '', categoryId: '', nameUz: '', price: 0, stock: 0, isAvailable: false);

  CartState copyWith({String? shopId, String? shopName, List<CartItem>? items}) =>
      CartState(shopId: shopId ?? this.shopId, shopName: shopName ?? this.shopName, items: items ?? this.items);

  static const empty = CartState();
}
