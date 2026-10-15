import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { mobileApi } from '../../services/api';
import { useCartStore } from '../../store/useCartStore';
import { useAuthStore } from '../../store/useAuthStore';
import { formatPrice } from '@localshop/shared';
import { hapticFeedback } from '../../utils/haptics';
import { getOrderStatusBadge, localeTag, localizedField, toSupportedLang } from '../../utils/localize';
import {
  ShoppingBag,
  RotateCcw,
  Store,
  Sparkles,
  ArrowRight,
} from 'lucide-react-native';

export default function CustomerOrdersScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { reorder } = useCartStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [orders, setOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const currentLang = toSupportedLang(i18n.language);

  const loadOrders = async () => {
    try {
      const res = await mobileApi.getOrders();
      setOrders(res.data || []);
    } catch (e) {
      console.warn('Failed to load customer orders', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadOrders();
  }, [isAuthenticated]);

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const activeOrders = orders.filter((o) =>
    ['new', 'accepted', 'preparing', 'on_the_way'].includes(o.status),
  );
  const pastOrders = orders.filter((o) =>
    ['delivered', 'cancelled'].includes(o.status),
  );

  const displayedOrders = activeTab === 'active' ? activeOrders : pastOrders;

  const [reorderingId, setReorderingId] = useState<string | null>(null);

  const handleReorder = async (order: any) => {
    if (reorderingId) return;
    hapticFeedback('selection');
    setReorderingId(order.id);
    try {
      // Use current catalog data (price, stock, name, image) instead of the order snapshot
      const products: any[] = await mobileApi.getShopProducts(order.shop_id);
      const byId = new Map<string, any>((Array.isArray(products) ? products : []).map((p) => [p.id, p]));

      let skipped = 0;
      const cartItems: any[] = [];
      for (const item of order.items || []) {
        const product = byId.get(item.product_id);
        if (!product || product.is_available === false || product.deleted_at || product.stock <= 0) {
          skipped += 1;
          continue;
        }
        cartItems.push({
          product: {
            id: product.id,
            name_uz: product.name_uz,
            name_ru: product.name_ru,
            name_en: product.name_en,
            price: product.price,
            image_url: product.image_url,
            stock: product.stock,
            shop_id: product.shop_id,
            description_uz: product.description_uz,
            description_ru: product.description_ru,
            description_en: product.description_en,
          },
          quantity: Math.min(item.quantity, product.stock),
        });
      }

      if (cartItems.length === 0) {
        hapticFeedback('warning');
        const msg = t('customer.orders.noneAvailable');
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert(t('customer.orders.noneAvailableTitle'), msg);
        return;
      }

      reorder(cartItems, order.shop_id, order.shop?.name || t('customer.common.shopFallback'));
      hapticFeedback('success');

      const msg =
        skipped > 0
          ? t('customer.orders.reorderedPartial', { count: skipped })
          : t('customer.orders.reorderedAll');

      if (Platform.OS === 'web') {
        if (window.confirm(`${msg}\n\n${t('customer.orders.goToCartQuestion')}`)) router.push('/(customer)/cart');
        return;
      }
      Alert.alert(t('customer.orders.addedToCart'), msg, [
        { text: t('customer.common.later'), style: 'cancel' },
        {
          text: t('customer.common.goToCart'),
          onPress: () => {
            hapticFeedback('selection');
            router.push('/(customer)/cart');
          },
        },
      ]);
    } catch (err: any) {
      Alert.alert(t('customer.common.error'), err?.message || t('customer.common.loadProductsFailed'));
    } finally {
      setReorderingId(null);
    }
  };

  const getStatusBadge = (status: string) => getOrderStatusBadge(t, status);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('tabs.orders')}</Text>
        </View>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <ShoppingBag size={44} color="#94a3b8" />
          </View>
          <Text style={styles.emptyTitle}>{t('customer.orders.loginTitle')}</Text>
          <Text style={styles.emptySubtitle}>
            {t('customer.orders.loginSubtitle')}
          </Text>
          <TouchableOpacity
            style={styles.startShopBtn}
            onPress={() => {
              hapticFeedback('selection');
              router.push({ pathname: '/(auth)/login', params: { next: '/(customer)/orders' } } as any);
            }}
          >
            <Text style={styles.startShopText}>{t('customer.common.login')}</Text>
            <ArrowRight size={16} color="#ffffff" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('tabs.orders')}</Text>
      </View>

      {/* Tabs Switcher */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'active' && styles.tabBtnActive]}
          onPress={() => {
            hapticFeedback('selection');
            setActiveTab('active');
          }}
          activeOpacity={0.8}
        >
          <Text
            style={[styles.tabBtnText, activeTab === 'active' && styles.tabBtnTextActive]}
          >
            {t('customer.orders.activeTab')}
          </Text>
          {activeOrders.length > 0 && (
            <View
              style={[
                styles.tabBadge,
                activeTab === 'active' ? styles.tabBadgeActive : styles.tabBadgeInactive,
              ]}
            >
              <Text
                style={[
                  styles.tabBadgeText,
                  activeTab === 'active' ? styles.tabBadgeTextActive : styles.tabBadgeTextInactive,
                ]}
              >
                {activeOrders.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]}
          onPress={() => {
            hapticFeedback('selection');
            setActiveTab('history');
          }}
          activeOpacity={0.8}
        >
          <Text
            style={[styles.tabBtnText, activeTab === 'history' && styles.tabBtnTextActive]}
          >
            {t('customer.orders.historyTab')}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={displayedOrders}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#16a34a']} />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#16a34a" style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <ShoppingBag size={44} color="#94a3b8" />
              </View>
              <Text style={styles.emptyTitle}>
                {activeTab === 'active'
                  ? t('customer.orders.emptyActive')
                  : t('customer.orders.emptyHistory')}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'active'
                  ? t('customer.orders.emptyActiveSub')
                  : t('customer.orders.emptyHistorySub')}
              </Text>
              <TouchableOpacity
                style={styles.startShopBtn}
                onPress={() => {
                  hapticFeedback('selection');
                  router.push('/(customer)');
                }}
              >
                <Sparkles size={16} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.startShopText}>{t('cart.startShopping')}</Text>
              </TouchableOpacity>
            </View>
          )
        }
        renderItem={({ item }) => {
          const isActive = ['new', 'accepted', 'preparing', 'on_the_way'].includes(item.status);
          const badge = getStatusBadge(item.status);
          const BadgeIcon = badge.icon;

          return (
            <TouchableOpacity
              style={[styles.orderCard, isActive && styles.orderCardActiveHighlight]}
              onPress={() => {
                hapticFeedback('selection');
                router.push(`/(customer)/order/${item.id}` as any);
              }}
              activeOpacity={0.85}
            >
              <View style={styles.orderTopRow}>
                <View style={styles.shopRow}>
                  <View style={styles.shopIconCircle}>
                    <Store size={16} color="#16a34a" />
                  </View>
                  <View>
                    <Text style={styles.shopName}>{item.shop?.name || t('customer.common.shopFallback')}</Text>
                    <Text style={styles.orderDate}>
                      {new Date(item.created_at).toLocaleString(localeTag(currentLang), {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                </View>

                <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                  <BadgeIcon size={12} color={badge.color} style={{ marginRight: 4 }} />
                  <Text style={[styles.statusText, { color: badge.color }]}>{badge.text}</Text>
                </View>
              </View>

              {/* Items summary */}
              <View style={styles.itemsSummary}>
                {item.items?.slice(0, 3).map((prod: any) => (
                  <Text key={prod.id} style={styles.itemLine} numberOfLines={1}>
                    &bull; {localizedField(prod.product, 'name', currentLang) || prod.product_name} × {prod.quantity}
                  </Text>
                ))}
                {item.items?.length > 3 && (
                  <Text style={styles.itemMoreText}>
                    {t('customer.orders.moreItems', { count: item.items.length - 3 })}
                  </Text>
                )}
              </View>

              {/* Bottom Row */}
              <View style={styles.orderBottomRow}>
                <View>
                  <Text style={styles.totalLabel}>{t('customer.common.total')}</Text>
                  <Text style={styles.totalAmount}>
                    {formatPrice(item.total_amount, currentLang)}
                  </Text>
                </View>

                {isActive ? (
                  <View style={styles.trackOrderBtn}>
                    <Text style={styles.trackOrderText}>{t('customer.orders.trackLive')}</Text>
                    <ArrowRight size={14} color="#ffffff" />
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.reorderBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleReorder(item);
                    }}
                    activeOpacity={0.8}
                    disabled={reorderingId === item.id}
                  >
                    {reorderingId === item.id ? (
                      <ActivityIndicator size="small" color="#16a34a" />
                    ) : (
                      <RotateCcw size={14} color="#16a34a" />
                    )}
                    <Text style={styles.reorderText}>{t('orderStatus.reorder')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
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
  header: {
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
  tabsContainer: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: '#16a34a',
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  tabBtnTextActive: {
    color: '#ffffff',
  },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tabBadgeActive: {
    backgroundColor: '#ffffff',
  },
  tabBadgeInactive: {
    backgroundColor: '#e2e8f0',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  tabBadgeTextActive: {
    color: '#16a34a',
  },
  tabBadgeTextInactive: {
    color: '#475569',
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  orderCardActiveHighlight: {
    borderColor: '#bbf7d0',
    borderWidth: 1.5,
    backgroundColor: '#ffffff',
  },
  orderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shopRow: {
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
  },
  shopName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  orderDate: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  itemsSummary: {
    marginVertical: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f8fafc',
  },
  itemLine: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  itemMoreText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
    fontStyle: 'italic',
  },
  orderBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  trackOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#16a34a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  trackOrderText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  reorderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  reorderText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 18,
  },
  startShopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16a34a',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  startShopText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
});

