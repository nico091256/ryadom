import React, { useState, useEffect, useMemo } from 'react';
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
  Linking,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { mobileApi } from '../../../services/api';
import { useCartStore } from '../../../store/useCartStore';
import { formatPrice, resolveLocalizedText } from '@localshop/shared';
import {
  ArrowLeft,
  Clock,
  Search,
  Plus,
  Minus,
  ShoppingBag,
  Phone,
  X,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react-native';
import ProductDetailModal from '../../../components/ProductDetailModal';
import { hapticFeedback } from '../../../utils/haptics';
import { toSupportedLang } from '../../../utils/localize';

export default function ShopDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const {
    addItem,
    setItemQuantity,
    increment,
    decrement,
    shopId: activeShopId,
    clearCart,
    getItemQuantity,
    getTotalAmount,
    getTotalItemsCount,
  } = useCartStore();

  const [shop, setShop] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const currentLang = toSupportedLang(i18n.language);

  const loadData = async () => {
    try {
      const [shopData, prodsData] = await Promise.all([
        mobileApi.getShopDetails(id),
        mobileApi.getShopProducts(id),
      ]);
      setShop(shopData);
      // Customers only see products the seller marked as available
      setProducts((Array.isArray(prodsData) ? prodsData : []).filter((p: any) => p.is_available !== false));
    } catch (err) {
      console.warn('Failed to load shop details', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  // Category tabs: only categories that actually have products in this shop
  const categories = useMemo(() => {
    const map = new Map<string, any>();
    for (const p of products) {
      if (p.category && !map.has(p.category.id)) {
        map.set(p.category.id, p.category);
      }
    }
    return Array.from(map.values());
  }, [products]);

  // Client-side filtering for ultra-fast instant UI response
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCatId && p.category_id !== selectedCatId) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleUz = (p.name_uz || '').toLowerCase();
        const titleRu = (p.name_ru || '').toLowerCase();
        const titleEn = (p.name_en || '').toLowerCase();
        if (!titleUz.includes(q) && !titleRu.includes(q) && !titleEn.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [products, selectedCatId, searchQuery]);

  /**
   * Adds a product to the cart with closed-shop and single-shop checks.
   * When `quantity` is given (product modal) the cart quantity is SET to it;
   * otherwise one unit is added.
   */
  const handleAddToCart = (product: any, quantity?: number) => {
    if (!shop?.isCurrentlyOpen) {
      hapticFeedback.warning();
      Alert.alert(t('common.closed'), t('shop.closedBanner'));
      return;
    }

    const doAdd = () =>
      quantity !== undefined
        ? setItemQuantity(product, shop.id, shop.name, quantity)
        : addItem(product, shop.id, shop.name);

    hapticFeedback.light();
    const res = doAdd();
    if (res.conflict) {
      hapticFeedback.warning();
      const replaceCart = () => {
        clearCart();
        doAdd();
      };
      if (Platform.OS === 'web') {
        if (window.confirm(t('cart.multipleShopsWarning'))) replaceCart();
        return;
      }
      Alert.alert(
        t('customer.shop.otherShopTitle'),
        t('cart.multipleShopsWarning'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('cart.clearCart'), style: 'destructive', onPress: replaceCart },
        ],
      );
    }
  };

  const handleCallShop = () => {
    if (shop?.phone) {
      Linking.openURL(`tel:${shop.phone}`);
    }
  };

  const isCartBelongToShop = activeShopId === id;
  const cartTotalAmount = isCartBelongToShop ? getTotalAmount() : 0;
  const cartItemsCount = isCartBelongToShop ? getTotalItemsCount() : 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </SafeAreaView>
    );
  }

  if (!shop) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>{t('customer.shop.notFound')}</Text>
        <TouchableOpacity style={styles.backBtnError} onPress={() => router.back()}>
          <Text style={styles.backBtnErrorText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isOpen = shop.isCurrentlyOpen;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Top Floating Back & Phone Header */}
      <View style={styles.navHeader}>
        <TouchableOpacity
          style={styles.navCircleBtn}
          onPress={() => {
            hapticFeedback.selection();
            router.back();
          }}
        >
          <ArrowLeft size={20} color="#0f172a" />
        </TouchableOpacity>

        {shop.phone && (
          <TouchableOpacity style={styles.navCircleBtn} onPress={handleCallShop}>
            <Phone size={18} color="#059669" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Hero Cover Image */}
            <View style={styles.heroCover}>
              <Image
                source={{
                  uri:
                    shop.logo_url ||
                    'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=800&q=80',
                }}
                style={styles.heroImage}
                resizeMode="cover"
              />
              <View style={styles.heroOverlay} />
            </View>

            {/* Shop Details Card */}
            <View style={styles.shopDetailCard}>
              <View style={styles.shopTitleRow}>
                <Text style={styles.shopName}>{shop.name}</Text>
              </View>

              <Text style={styles.addressText}>{shop.address_text}</Text>

              {/* Working Hours & Status */}
              <View style={styles.metaRow}>
                <View
                  style={[
                    styles.statusPill,
                    isOpen ? styles.statusPillOpen : styles.statusPillClosed,
                  ]}
                >
                  <View
                    style={[
                      styles.statusPillDot,
                      { backgroundColor: isOpen ? '#10b981' : '#f43f5e' },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: isOpen ? '#065f46' : '#9f1239' },
                    ]}
                  >
                    {isOpen ? t('common.open') : t('common.closed')}
                  </Text>
                </View>

                <View style={styles.hoursBadge}>
                  <Clock size={13} color="#64748b" />
                  <Text style={styles.hoursText}>
                    {shop.open_time} - {shop.close_time}
                  </Text>
                </View>

                <View style={styles.deliveryBadge}>
                  <ShieldCheck size={13} color="#059669" />
                  <Text style={styles.deliveryBadgeText}>{t('common.freeDelivery')}</Text>
                </View>
              </View>
            </View>

            {/* In-Store Search Bar */}
            <View style={styles.searchSection}>
              <View style={styles.searchBar}>
                <Search size={18} color="#94a3b8" />
                <TextInput
                  style={styles.searchInput}
                  placeholder={t('customer.shop.searchPlaceholder')}
                  placeholderTextColor="#94a3b8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <X size={16} color="#64748b" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Category Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryTabsScroll}
            >
              <TouchableOpacity
                style={[
                  styles.categoryTab,
                  selectedCatId === null && styles.categoryTabActive,
                ]}
                onPress={() => {
                  hapticFeedback.selection();
                  setSelectedCatId(null);
                }}
              >
                <Text
                  style={[
                    styles.categoryTabText,
                    selectedCatId === null && styles.categoryTabTextActive,
                  ]}
                >
                  {t('shop.allCategories')} ({products.length})
                </Text>
              </TouchableOpacity>

              {categories.map((cat) => {
                const isSelected = selectedCatId === cat.id;
                const count = products.filter((p) => p.category_id === cat.id).length;
                const catName = resolveLocalizedText(
                  { uz: cat.name_uz, ru: cat.name_ru, en: cat.name_en },
                  currentLang,
                );
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.categoryTab, isSelected && styles.categoryTabActive]}
                    onPress={() => {
                      hapticFeedback.selection();
                      setSelectedCatId(isSelected ? null : cat.id);
                    }}
                  >
                    <Text
                      style={[
                        styles.categoryTabText,
                        isSelected && styles.categoryTabTextActive,
                      ]}
                    >
                      {catName} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyProducts}>
            <ShoppingBag size={48} color="#cbd5e1" />
            <Text style={styles.emptyProductsTitle}>{t('customer.shop.noProducts')}</Text>
            <Text style={styles.emptyProductsSub}>
              {t('customer.shop.noProductsHint')}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const itemTitle = resolveLocalizedText(
            { uz: item.name_uz, ru: item.name_ru, en: item.name_en },
            currentLang,
          );
          const priceText = formatPrice(item.price, currentLang);
          const quantityInCart = isCartBelongToShop ? getItemQuantity(item.id) : 0;
          const isOutOfStock = item.stock <= 0;

          return (
            <TouchableOpacity
              style={styles.productCard}
              onPress={() => {
                hapticFeedback.selection();
                setSelectedProduct(item);
              }}
              activeOpacity={0.88}
            >
              {/* Product Thumbnail */}
              <View style={styles.productImageWrapper}>
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.productImage} />
                ) : (
                  <View style={styles.placeholderImg}>
                    <ShoppingBag size={28} color="#94a3b8" />
                  </View>
                )}
              </View>

              {/* Product Details */}
              <View style={styles.productInfo}>
                <Text style={styles.productTitle} numberOfLines={2}>
                  {itemTitle}
                </Text>

                <View style={styles.productFooter}>
                  <Text style={styles.productPrice}>{priceText}</Text>

                  {/* Add / Stepper CTA */}
                  {isOutOfStock ? (
                    <View style={styles.outOfStockPill}>
                      <Text style={styles.outOfStockPillText}>{t('shop.outOfStock')}</Text>
                    </View>
                  ) : quantityInCart === 0 ? (
                    <TouchableOpacity
                      style={styles.addPillBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleAddToCart(item);
                      }}
                    >
                      <Plus size={16} color="#059669" />
                      <Text style={styles.addPillText}>{t('customer.shop.addShort')}</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.stepperMini}>
                      <TouchableOpacity
                        style={styles.stepMiniBtn}
                        onPress={(e) => {
                          e.stopPropagation();
                          hapticFeedback.light();
                          decrement(item.id);
                        }}
                      >
                        <Minus size={14} color="#059669" />
                      </TouchableOpacity>
                      <Text style={styles.stepMiniQty}>{quantityInCart}</Text>
                      <TouchableOpacity
                        style={styles.stepMiniBtn}
                        onPress={(e) => {
                          e.stopPropagation();
                          hapticFeedback.light();
                          increment(item, shop.id, shop.name);
                        }}
                      >
                        <Plus size={14} color="#059669" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Floating Bottom Cart Bar (Appears when items are added) */}
      {cartItemsCount > 0 && (
        <View style={styles.floatingCartBar}>
          <TouchableOpacity
            style={styles.floatingCartBtn}
            onPress={() => {
              hapticFeedback.selection();
              router.push('/(customer)/cart');
            }}
            activeOpacity={0.9}
          >
            <View style={styles.floatingCartLeft}>
              <View style={styles.cartBadgeCircle}>
                <Text style={styles.cartBadgeCircleText}>{cartItemsCount}</Text>
              </View>
              <View>
                <Text style={styles.floatingCartTitle}>{t('customer.shop.inCart')}</Text>
                <Text style={styles.floatingCartSum}>{formatPrice(cartTotalAmount, currentLang)}</Text>
              </View>
            </View>

            <View style={styles.floatingCartRight}>
              <Text style={styles.floatingCheckoutText}>{t('cart.checkout')}</Text>
              <ChevronRight size={18} color="#ffffff" />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          visible={!!selectedProduct}
          product={selectedProduct}
          currentQuantity={isCartBelongToShop ? getItemQuantity(selectedProduct.id) : 0}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={(prod, qty) => handleAddToCart(prod, qty)}
          shopName={shop.name}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  backBtnError: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#059669',
    borderRadius: 14,
  },
  backBtnErrorText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  navHeader: {
    position: 'absolute',
    top: 44,
    left: 16,
    right: 16,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  listContent: {
    paddingBottom: 100,
  },
  heroCover: {
    width: '100%',
    height: 180,
    position: 'relative',
    backgroundColor: '#0f172a',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.3)',
  },
  shopDetailCard: {
    backgroundColor: '#ffffff',
    marginTop: -24,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  shopTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  shopName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    flex: 1,
    marginRight: 10,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400e',
  },
  addressText: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusPillOpen: {
    backgroundColor: '#ecfdf5',
  },
  statusPillClosed: {
    backgroundColor: '#ffe4e6',
  },
  statusPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  hoursBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  hoursText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  deliveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  deliveryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    marginLeft: 8,
    fontWeight: '500',
  },
  categoryTabsScroll: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  categoryTab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  categoryTabActive: {
    backgroundColor: '#059669',
  },
  categoryTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  categoryTabTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  emptyProducts: {
    paddingVertical: 60,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyProductsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 12,
  },
  emptyProductsSub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },
  productCard: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
    alignItems: 'center',
  },
  productImageWrapper: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
    position: 'relative',
    marginRight: 14,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImg: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitChip: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  unitChipText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
  productInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  productTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
    lineHeight: 20,
  },
  productFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '900',
    color: '#059669',
  },
  outOfStockPill: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  outOfStockPillText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  addPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#059669',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  addPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  stepperMini: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#059669',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  stepMiniBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepMiniQty: {
    fontSize: 13,
    fontWeight: '800',
    color: '#059669',
    marginHorizontal: 8,
  },
  floatingCartBar: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    zIndex: 99,
  },
  floatingCartBtn: {
    backgroundColor: '#059669',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  floatingCartLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cartBadgeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeCircleText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  floatingCartTitle: {
    fontSize: 11,
    color: '#a7f3d0',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  floatingCartSum: {
    fontSize: 15,
    fontWeight: '900',
    color: '#ffffff',
  },
  floatingCartRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  floatingCheckoutText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
