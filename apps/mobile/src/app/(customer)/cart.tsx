import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useCartStore } from '../../store/useCartStore';
import { formatPrice, SupportedLanguage, resolveLocalizedText } from '@localshop/shared';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ShieldCheck,
  Store,
} from 'lucide-react-native';

export default function CartScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { items, shopName, shopId, updateQuantity, removeItem, clearCart, getTotalAmount } =
    useCartStore();

  const currentLang = (i18n.language as SupportedLanguage) || SupportedLanguage.UZ;
  const totalTiyin = getTotalAmount();

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <ShoppingBag size={48} color="#94a3b8" />
          </View>
          <Text style={styles.emptyTitle}>{t('cart.empty')}</Text>
          <Text style={styles.emptySubtitle}>
            Yaqin do'konlardan mahsulotlarni tanlang va bepul yetkazib beramiz
          </Text>
          <TouchableOpacity
            style={styles.startShopBtn}
            onPress={() => router.push('/(customer)')}
          >
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
        <Text style={styles.headerTitle}>{t('cart.title')}</Text>
        <TouchableOpacity onPress={clearCart} style={styles.clearBtn}>
          <Trash2 size={16} color="#e11d48" />
          <Text style={styles.clearText}>{t('cart.clearCart')}</Text>
        </TouchableOpacity>
      </View>

      {/* Shop Info Card */}
      <View style={styles.shopCard}>
        <Store size={18} color="#16a34a" />
        <Text style={styles.shopName} numberOfLines={1}>
          {shopName || "Do'kon"}
        </Text>
      </View>

      {/* Items List */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.product.id}
        contentContainerStyle={styles.listContent}
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
                  <Text style={{ fontSize: 24 }}>🛍</Text>
                )}
              </View>

              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={2}>
                  {localizedName}
                </Text>
                <Text style={styles.itemPrice}>{formatPrice(item.product.price, currentLang)}</Text>

                <View style={styles.itemBottomRow}>
                  <View style={styles.qtyControl}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => updateQuantity(item.product.id, item.quantity - 1)}
                    >
                      <Minus size={14} color="#16a34a" />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => updateQuantity(item.product.id, item.quantity + 1)}
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
      />

      {/* Footer Summary & Checkout */}
      <View style={styles.footer}>
        <View style={styles.freeDeliveryNote}>
          <ShieldCheck size={16} color="#166534" />
          <Text style={styles.freeDeliveryText}>{t('common.freeDelivery')}</Text>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t('cart.total')}:</Text>
          <Text style={styles.totalAmount}>{formatPrice(totalTiyin, currentLang)}</Text>
        </View>

        <TouchableOpacity
          style={styles.checkoutBtn}
          onPress={() => router.push('/(customer)/checkout')}
          activeOpacity={0.8}
        >
          <Text style={styles.checkoutText}>{t('cart.checkout')}</Text>
          <ArrowRight size={18} color="#ffffff" style={{ marginLeft: 8 }} />
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
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
    fontWeight: '600',
  },
  shopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#dcfce7',
  },
  shopName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  itemImageWrapper: {
    width: 64,
    height: 64,
    borderRadius: 12,
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
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
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
    borderRadius: 8,
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
    fontWeight: '700',
    color: '#166534',
    paddingHorizontal: 8,
  },
  itemSubtotal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  footer: {
    backgroundColor: '#ffffff',
    padding: 16,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  freeDeliveryNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
  },
  freeDeliveryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#16a34a',
  },
  checkoutBtn: {
    flexDirection: 'row',
    backgroundColor: '#16a34a',
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  checkoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
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
    marginTop: 6,
    marginBottom: 24,
    lineHeight: 18,
  },
  startShopBtn: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  startShopText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
