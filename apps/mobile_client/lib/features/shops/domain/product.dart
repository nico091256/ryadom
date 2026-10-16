class ProductCategory {
  const ProductCategory({required this.id, required this.nameUz, this.nameRu, this.nameEn});

  final String id;
  final String nameUz;
  final String? nameRu;
  final String? nameEn;

  factory ProductCategory.fromJson(Map<String, dynamic> json) => ProductCategory(
        id: json['id'] as String,
        nameUz: json['name_uz'] as String,
        nameRu: json['name_ru'] as String?,
        nameEn: json['name_en'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name_uz': nameUz,
        'name_ru': nameRu,
        'name_en': nameEn,
      };
}

class Product {
  const Product({
    required this.id,
    required this.shopId,
    required this.categoryId,
    required this.nameUz,
    this.nameRu,
    this.nameEn,
    this.descriptionUz,
    required this.price,
    this.imageUrl,
    required this.stock,
    required this.isAvailable,
    this.category,
  });

  final String id;
  final String shopId;
  final String categoryId;
  final String nameUz;
  final String? nameRu;
  final String? nameEn;
  final String? descriptionUz;
  final int price; // tiyin
  final String? imageUrl;
  final int stock;
  final bool isAvailable;
  final ProductCategory? category;

  factory Product.fromJson(Map<String, dynamic> json) => Product(
        id: json['id'] as String,
        shopId: json['shop_id'] as String,
        categoryId: json['category_id'] as String,
        nameUz: json['name_uz'] as String,
        nameRu: json['name_ru'] as String?,
        nameEn: json['name_en'] as String?,
        descriptionUz: json['description_uz'] as String?,
        price: (json['price'] as num).toInt(),
        imageUrl: json['image_url'] as String?,
        stock: (json['stock'] as num).toInt(),
        isAvailable: json['is_available'] as bool? ?? true,
        category: json['category'] != null ? ProductCategory.fromJson(json['category'] as Map<String, dynamic>) : null,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'shop_id': shopId,
        'category_id': categoryId,
        'name_uz': nameUz,
        'name_ru': nameRu,
        'name_en': nameEn,
        'description_uz': descriptionUz,
        'price': price,
        'image_url': imageUrl,
        'stock': stock,
        'is_available': isAvailable,
        'category': category?.toJson(),
      };
}
