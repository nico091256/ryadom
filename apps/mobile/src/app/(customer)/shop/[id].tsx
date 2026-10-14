import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { mobileApi } from '../../../services/api';
import { useCartStore } from '../../../store/useCartStore';
import { formatPrice, SupportedLanguage, resolveLocalizedText } from '@localshop/shared';
import {
  ArrowLeft,
  Clock,
  MapPin,
  Search,
  Plus,
  Minus,
  ShoppingBag,
  AlertCircle,
  Phone,
} from 'lucide-react-native';

export default function ShopDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { addItem, updateQuantity, items: cartItems, shopId: activeShopId, clearCart } = useCartStore();

  const [shop, setShop] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const currentLang = (i18n.language as SupportedLanguage) || SupportedLanguage.UZ;

  const loadData = async () => {
    try {
      const [shopData, catsData, prodsData] = await Promise.all([
        mobileApi.getShopDetails(id),
        mobileApi.getCategories(),
        mobileApi.getShopProducts(id, selectedCatId || undefined, searchQuery || undefined),
      ]);
      setShop(shopData);
      setCategories(catsData);
      setProducts(prodsData);
    } catch (err) {
      console.warn('Failed to load shop details', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id, selectedCatId]);

  const handleSearch = () => {
    mobileApi
      .getShopProducts(id, selectedCatId || undefined, searchQuery || undefined)
      .then(setProducts)
      .catch(console.warn);
  };

  const handleAddToCart = (product: any) => {
    if (!shop?.isCurrentlyOpen) {
      Alert.alert(t('common.closed'), t('shop.closedBanner'));
      return;
    }

    const res = addItem(product, shop.id, shop.name);
    if (res.conflict) {
      Alert.alert(
        'Boshqa do\'kon mahsulotlari',
        t('cart.multipleShopsWarning'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('cart.clearCart'),
            style: 'destructive',
            onPress: () => {
              clearCart();
              addItem(product, shop.id, shop.name);
            },
          },
        ],
      );
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#16a34a" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {shop?.name}
        </Text>
        <TouchableOpacity
          style={styles.cartIconBtn}
          onPress={() => router.push('/(customer)/cart')}
        >
          <ShoppingBag size={20} color="#16a34a" />
          {cartItems.length > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartItems.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Closed Banner if shop is closed */}
      {!shop?.isCurrentlyOpen && (
        <View style={styles.closedBanner}>
          <AlertCircle size={16} color="#e11d48" />
          <Text style={styles.closedBannerText}>{t('shop.closedBanner')}</Text>
        </View>
      )}

      {/* Header Info */}
      <View style={styles.shopHeader}>
        <View style={styles.shopHeaderTop}>
          <View style={styles.shopLogo}>
            {shop?.logo_url ? (
              <Image source={{ uri: shop.logo_url }} style={styles.shopLogoImg} />
            ) : (
              <Text style={styles.shopLogoLetter}>{shop?.name.charAt(0)}</Text>
            )}
          </View>
          <View style={styles.shopMetaInfo}>
            <Text style={styles.shopNameText}>{shop?.name}</Text>
            <View style={styles.metaRow}>
              <Clock size={12} color="#64748b" />
              <Text style={styles.metaText}>
                {shop?.open_time} - {shop?.close_time}
              </Text>
              <View
                style={[
                  styles.statusPill,
                  shop?.isCurrentlyOpen ? styles.statusPillOpen : styles.statusPillClosed,
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    shop?.isCurrentlyOpen ? styles.statusPillTextOpen : styles.statusPillTextClosed,
                  ]}
                >
                  {shop?.isCurrentlyOpen ? t('common.open') : t('common.closed')}
                </Text>
              </View>
            </View>
            <View style={styles.metaRow}>
              <MapPin size={12} color="#64748b" />
              <Text style={styles.metaText} numberOfLines={1}>
                {shop?.address_text}
              </Text>
            </View>
          </View>
        </View>

        {/* In-Shop Search Bar */}
        <View style={styles.searchBar}>
          <Search size={16} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            placeholder="Do'kondan qidirish..."
            placeholderTextColor="#94a3b8"
          />
        </View>
      </View>

      {/* Categories Horizontal Scroll */}
      <View style={styles.categoriesBar}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: null, name_uz: t('shop.allCategories') }, ...categories]}
          keyExtractor={(item) => item.id || 'all'}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          renderItem={({ item }) => {
            const isSelected = selectedCatId === item.id;
            return (
              <TouchableOpacity
                style={[styles.categoryPill, isSelected && styles.categoryPillActive]}
                onPress={() => setSelectedCatId(item.id)}
              >
                <Text style={[styles.categoryPillText, isSelected && styles.categoryPillTextActive]}>
                  {item.name_uz}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Product List */}
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.productsGrid}
        numColumns={2}
        ListEmptyComponent={
          <View style={styles.emptyProducts}>
            <Text style={styles.emptyText}>Ushbu toifada mahsulotlar topilmadi</Text>
          </View>
        }
        renderItem={({ item }) => {
          const cartItem = cartItems.find((i) => i.product.id === item.id);
          const localizedName = resolveLocalizedText(
            { uz: item.name_uz, ru: item.name_ru, en: item.name_en },
            currentLang,
          );
          const isOutOfStock = !item.is_available || item.stock <= 0;

          return (
            <View style={[styles.productCard, isOutOfStock && styles.productOutOfStock]}>
              <View style={styles.productImageWrapper}>
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.productImage} />
                ) : (
                  <View style={styles.productPlaceholder}>
                    <Text style={styles.productPlaceholderText}>🛍</Text>
                  </View>
                )}
                {isOutOfStock && (
                  <View style={styles.outOfStockBadge}>
                    <Text style={styles.outOfStockText}>{t('shop.outOfStock')}</Text>
                  </View>
                )}
              </View>

              <View style={styles.productDetails}>
                <Text style={styles.productName} numberOfLines={2}>
                  {localizedName}
                </Text>
                <Text style={styles.productPrice}>{formatPrice(item.price, currentLang)}</Text>

                {/* Add to Cart or Quantity Adjuster */}
                {isOutOfStock ? (
                  <View style={styles.disabledBtn}>
                    <Text style={styles.disabledBtnText}>{t('shop.outOfStock')}</Text>
                  </View>
                ) : cartItem ? (
                  <View style={styles.qtyAdjuster}>
                    <TouchableOpacity
                      onPress={() => updateQuantity(item.id, cartItem.quantity - 1)}
                      style={styles.qtyBtn}
                    >
                      <Minus size={14} color="#16a34a" />
                    </TouchableOpacity>
                    <Text style={styles.qtyValue}>{cartItem.quantity}</Text>
                    <TouchableOpacity
                      onPress={() => updateQuantity(item.id, cartItem.quantity + 1)}
                      style={styles.qtyBtn}
                    >
                      <Plus size={14} color="#16a34a" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => handleAddToCart(item)}
                    activeOpacity={0.8}
                  >
                    <Plus size={14} color="#ffffff" />
                    <Text style={styles.addBtnText}>{t('shop.addToCart')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    maxWidth: '70%',
  },
  cartIconBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#f0fdf4',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#16a34a',
    borderRadius: 9,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  closedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff1f2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#fecdd3',
  },
  closedBannerText: {
    color: '#e11d48',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  shopHeader: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  shopHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  shopLogo: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  shopLogoImg: {
    width: '100%',
    height: '100%',
  },
  shopLogoLetter: {
    fontSize: 24,
    fontWeight: '800',
    color: '#16a34a',
  },
  shopMetaInfo: {
    flex: 1,
  },
  shopNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  metaText: {
    fontSize: 11,
    color: '#64748b',
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 6,
  },
  statusPillOpen: {
    backgroundColor: '#dcfce7',
  },
  statusPillClosed: {
    backgroundColor: '#f1f5f9',
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: '700',
  },
  statusPillTextOpen: {
    color: '#15803d',
  },
  statusPillTextClosed: {
    color: '#64748b',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
  },
  categoriesBar: {
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  categoryPillActive: {
    backgroundColor: '#16a34a',
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  categoryPillTextActive: {
    color: '#ffffff',
  },
  productsGrid: {
    padding: 12,
    paddingBottom: 32,
  },
  productCard: {
    flex: 1,
    margin: 6,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  productOutOfStock: {
    opacity: 0.6,
  },
  productImageWrapper: {
    width: '100%',
    height: 120,
    backgroundColor: '#f8fafc',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  productPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productPlaceholderText: {
    fontSize: 32,
  },
  outOfStockBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#e11d48',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  outOfStockText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ffffff',
  },
  productDetails: {
    padding: 10,
  },
  productName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    minHeight: 32,
  },
  productPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#16a34a',
    marginVertical: 6,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#16a34a',
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  qtyAdjuster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  qtyBtn: {
    padding: 4,
  },
  qtyValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
  },
  disabledBtn: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  disabledBtnText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  emptyProducts: {
    padding: 40,
    alignItems: 'center',
    width: '100%',
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8',
  },
});
