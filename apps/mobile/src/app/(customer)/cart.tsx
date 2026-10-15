import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useCartStore } from '../../store/useCartStore';
import { useAuthStore } from '../../store/useAuthStore';
import { formatPrice, resolveLocalizedText } from '@localshop/shared';
import { hapticFeedback } from '../../utils/haptics';
import { toSupportedLang } from '../../utils/localize';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ShieldCheck,
  Store,
  Sparkles,
  Tag,
  CheckCircle2,
  Clock,
} from 'lucide-react-native';

export default function CartScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const {
    items,
    shopName,
    shopId,
    increment,
    decrement,
    removeItem,
    clearCart,
    getTotalAmount,
    getTotalItemsCount,
    promo: appliedPromo,
    applyPromo,
    clearPromo,
    getDiscountAmount,
  } = useCartStore();

  const [promoCode, setPromoCode] = useState('');
  const [promoError, setPromoError] = useState('');

  const currentLang = toSupportedLang(i18n.language);
  const rawTotalTiyin = getTotalAmount();
  // Discount is recomputed from the current cart total; the server re-validates the code on order creation
  const discountTiyin = getDiscountAmount();
  const finalTotalTiyin = Math.max(0, rawTotalTiyin - discountTiyin);
  const totalCount = getTotalItemsCount();

  const handleApplyPromo = () => {
    hapticFeedback('selection');
    const cleanCode = promoCode.trim().toUpperCase();
    if (!cleanCode) {
      setPromoError(t('customer.cart.promoEnter'));
      return;
    }

    if (applyPromo(cleanCode)) {
      setPromoCode('');
      setPromoError('');
      hapticFeedback('success');
    } else {
      setPromoError(t('customer.cart.promoInvalid'));
    }
  };

  const handleClearCart = () => {
    hapticFeedback('light');
    if (Platform.OS === 'web') {
      if (window.confirm(t('customer.cart.clearQuestion'))) {
        clearCart();
      }
      return;
    }
    Alert.alert(
      t('cart.clearCart'),
      t('customer.cart.clearQuestion'),
      [
        { text: t('customer.cart.no'), style: 'cancel' },
        {
          text: t('customer.cart.yesClear'),
          style: 'destructive',
          onPress: () => {
            hapticFeedback('medium');
            clearCart();
          },
        },
      ],
    );
  };

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <ShoppingBag size={52} color="#94a3b8" />
          </View>
          <Text style={styles.emptyTitle}>{t('cart.empty')}</Text>
          <Text style={styles.emptySubtitle}>
            {t('customer.cart.emptySub')}
          </Text>
          <TouchableOpacity
            style={styles.startShopBtn}
            onPress={() => {
              hapticFeedback('selection');
              router.push('/(customer)');
            }}
            activeOpacity={0.8}
          >
            <Sparkles size={18} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.startShopText}>{t('cart.startShopping')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>{t('cart.title')}</Text>
          <Text style={styles.headerBadge}>{t('customer.home.productCount', { count: totalCount })}</Text>
        </View>
        <TouchableOpacity onPress={handleClearCart} style={styles.clearBtn}>
          <Trash2 size={16} color="#e11d48" />
          <Text style={styles.clearText}>{t('cart.clearCart')}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.product.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Shop Info Card */}
            <TouchableOpacity
              style={styles.shopCard}
              onPress={() => {
                if (shopId) {
                  router.push(`/(customer)/shop/${shopId}` as any);
                }
              }}
              activeOpacity={0.8}
            >
              <View style={styles.shopCardLeft}>
                <View style={styles.shopIconCircle}>
                  <Store size={18} color="#16a34a" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.shopLabel}>{t('customer.cart.selectedShop')}</Text>
                  <Text style={styles.shopName} numberOfLines={1}>
                    {shopName || t('customer.cart.localShop')}
                  </Text>
                </View>
              </View>
              <Text style={styles.shopViewLink}>{t('customer.map.openShop')} →</Text>
            </TouchableOpacity>

            {/* Delivery is always free */}
            <View style={styles.freeDeliveryLine}>
              <ShieldCheck size={16} color="#16a34a" />
              <Text style={styles.freeDeliveryText}>{t('common.freeDelivery')}</Text>
            </View>
          </>
        }
        renderItem={({ item }) => {
          const localizedName = resolveLocalizedText(
            {
              uz: item.product.name_uz,
              ru: item.product.name_ru,
              en: item.product.name_en,
            },
            currentLang,
          );
          const itemTotal = item.product.price * item.quantity;

          return (
            <View style={styles.itemCard}>
              <View style={styles.itemImageWrapper}>
                {item.product.image_url ? (
                  <Image source={{ uri: item.product.image_url }} style={styles.itemImage} />
                ) : (
                  <Text style={{ fontSize: 26 }}>🛍</Text>
                )}
              </View>

              <View style={styles.itemInfo}>
                <View style={styles.itemHeaderRow}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {localizedName}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      hapticFeedback('medium');
                      removeItem(item.product.id);
                    }}
                    style={styles.itemRemoveBtn}
                  >
                    <Trash2 size={15} color="#94a3b8" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.itemPrice}>
                  {formatPrice(item.product.price, currentLang)}
                </Text>

                <View style={styles.itemBottomRow}>
                  <View style={styles.qtyControl}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => {
                        hapticFeedback('selection');
                        decrement(item.product.id);
                      }}
                    >
                      <Minus size={14} color="#16a34a" />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => {
                        hapticFeedback('selection');
                        increment(item.product.id);
                      }}
                    >
                      <Plus size={14} color="#16a34a" />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.itemSubtotal}>{formatPrice(itemTotal, currentLang)}</Text>
                </View>
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          <>
            {/* Promo Code Input */}
            <View style={styles.promoCard}>
              <View style={styles.promoHeader}>
                <Tag size={16} color="#16a34a" />
                <Text style={styles.promoTitle}>{t('customer.cart.promoTitle')}</Text>
              </View>
              {appliedPromo ? (
                <View style={styles.appliedPromoBadge}>
                  <View style={styles.appliedLeft}>
                    <CheckCircle2 size={16} color="#16a34a" />
                    <Text style={styles.appliedText}>
                      {t('customer.cart.promoApplied', {
                        code: appliedPromo.code,
                        amount: formatPrice(discountTiyin, currentLang),
                      })}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      hapticFeedback('selection');
                      clearPromo();
                    }}
                  >
                    <Text style={styles.removePromoText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.promoInputRow}>
                  <TextInput
                    style={styles.promoInput}
                    placeholder={t('customer.cart.promoPlaceholder')}
                    placeholderTextColor="#94a3b8"
                    value={promoCode}
                    onChangeText={(val) => {
                      setPromoCode(val);
                      setPromoError('');
                    }}
                    autoCapitalize="characters"
                  />
                  <TouchableOpacity
                    style={[styles.promoApplyBtn, !promoCode.trim() && styles.promoApplyBtnDisabled]}
                    onPress={handleApplyPromo}
                    disabled={!promoCode.trim()}
                  >
                    <Text style={styles.promoApplyText}>{t('customer.cart.promoApply')}</Text>
                  </TouchableOpacity>
                </View>
              )}
              {promoError ? <Text style={styles.promoErrorText}>{promoError}</Text> : null}
            </View>

            {/* Delivery Guarantee Info */}
            <View style={styles.guaranteeBox}>
              <View style={styles.guaranteeRow}>
                <Clock size={16} color="#16a34a" />
                <Text style={styles.guaranteeText}>{t('customer.cart.guaranteeFast')}</Text>
              </View>
              <View style={styles.guaranteeRow}>
                <ShieldCheck size={16} color="#16a34a" />
                <Text style={styles.guaranteeText}>{t('customer.cart.guaranteeFresh')}</Text>
              </View>
            </View>

            {/* Price Breakdown */}
            <View style={styles.breakdownCard}>
              <Text style={styles.breakdownTitle}>{t('customer.cart.breakdownTitle')}</Text>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{t('customer.cart.itemsLine', { count: totalCount })}</Text>
                <Text style={styles.breakdownValue}>{formatPrice(rawTotalTiyin, currentLang)}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{t('customer.cart.deliveryLine')}</Text>
                <Text style={[styles.breakdownValue, { color: '#16a34a' }]}>
                  {t('customer.cart.deliveryFree', { price: formatPrice(0, currentLang) })}
                </Text>
              </View>
              {discountTiyin > 0 && (
                <View style={styles.breakdownRow}>
                  <Text style={[styles.breakdownLabel, { color: '#e11d48' }]}>{t('customer.cart.discountLine')}</Text>
                  <Text style={[styles.breakdownValue, { color: '#e11d48' }]}>
                    -{formatPrice(discountTiyin, currentLang)}
                  </Text>
                </View>
              )}
            </View>
          </>
        }
      />

      {/* Sticky Bottom Bar */}
      <View style={styles.footer}>
        <View style={styles.footerSummary}>
          <Text style={styles.footerTotalLabel}>{t('customer.order.totalPaid')}</Text>
          <Text style={styles.footerTotalAmount}>{formatPrice(finalTotalTiyin, currentLang)}</Text>
        </View>

        <TouchableOpacity
          style={styles.checkoutBtn}
          onPress={() => {
            hapticFeedback('medium');
            if (!isAuthenticated) {
              router.push({ pathname: '/(auth)/login', params: { next: '/(customer)/checkout' } } as any);
              return;
            }
            router.push('/(customer)/checkout');
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.checkoutText}>{t('cart.checkout')}</Text>
          <ArrowRight size={18} color="#ffffff" style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  freeDeliveryLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  freeDeliveryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
  },
  clearText: {
    fontSize: 12,
    color: '#e11d48',
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  shopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  shopCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  shopIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  shopLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  shopName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 1,
  },
  shopViewLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a',
    marginLeft: 8,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  itemImageWrapper: {
    width: 68,
    height: 68,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    paddingRight: 6,
  },
  itemRemoveBtn: {
    padding: 4,
  },
  itemPrice: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  itemBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  qtyBtn: {
    padding: 4,
  },
  qtyText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
    paddingHorizontal: 10,
  },
  itemSubtotal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  promoCard: {
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 8,
    marginBottom: 12,
  },
  promoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  promoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  promoInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  promoInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  promoApplyBtn: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoApplyBtnDisabled: {
    backgroundColor: '#cbd5e1',
  },
  promoApplyText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  promoErrorText: {
    fontSize: 11,
    color: '#e11d48',
    marginTop: 6,
    fontWeight: '600',
  },
  appliedPromoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0fdf4',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  appliedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  appliedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
    flex: 1,
  },
  removePromoText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#e11d48',
    paddingHorizontal: 6,
  },
  guaranteeBox: {
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
    gap: 8,
  },
  guaranteeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  guaranteeText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '600',
  },
  breakdownCard: {
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  breakdownTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  breakdownLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 12,
  },
  footerSummary: {
    flex: 1,
  },
  footerTotalLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  footerTotalAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#16a34a',
  },
  checkoutBtn: {
    flexDirection: 'row',
    backgroundColor: '#16a34a',
    paddingHorizontal: 22,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  checkoutText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 19,
  },
  startShopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16a34a',
    paddingHorizontal: 26,
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  startShopText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
});
