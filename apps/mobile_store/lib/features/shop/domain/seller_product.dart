class SellerCategory {
  const SellerCategory({required this.id, required this.nameUz});

  final String id;
  final String nameUz;

  factory SellerCategory.fromJson(Map<String, dynamic> json) =>
      SellerCategory(id: json['id'] as String, nameUz: json['name_uz'] as String);
}

class SellerProduct {
  const SellerProduct({
    required this.id,
    required this.categoryId,
    required this.nameUz,
    this.nameRu,
    this.nameEn,
    this.descriptionUz,
    this.descriptionRu,
    this.descriptionEn,
    required this.price,
    this.imageUrl,
    required this.stock,
    required this.isAvailable,
    this.category,
  });

  final String id;
  final String categoryId;
  final String nameUz;
  final String? nameRu;
  final String? nameEn;
  final String? descriptionUz;
  final String? descriptionRu;
  final String? descriptionEn;
  final int price; // tiyin
  final String? imageUrl;
  final int stock;
  final bool isAvailable;
  final SellerCategory? category;

  factory SellerProduct.fromJson(Map<String, dynamic> json) => SellerProduct(
        id: json['id'] as String,
        categoryId: json['category_id'] as String,
        nameUz: json['name_uz'] as String,
        nameRu: json['name_ru'] as String?,
        nameEn: json['name_en'] as String?,
        descriptionUz: json['description_uz'] as String?,
        descriptionRu: json['description_ru'] as String?,
        descriptionEn: json['description_en'] as String?,
        price: (json['price'] as num).toInt(),
        imageUrl: json['image_url'] as String?,
        stock: (json['stock'] as num).toInt(),
        isAvailable: json['is_available'] as bool? ?? true,
        category: json['category'] != null ? SellerCategory.fromJson(json['category'] as Map<String, dynamic>) : null,
      );
}
