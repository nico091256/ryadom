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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { mobileApi } from '../../services/api';
import { useCartStore } from '../../store/useCartStore';
import { formatPrice, SupportedLanguage } from '@localshop/shared';
import {
  ShoppingBag,
  Clock,
  CheckCircle,
  Truck,
  RotateCcw,
  ChevronRight,
  Store,
} from 'lucide-react-native';

export default function CustomerOrdersScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { addItem, clearCart } = useCartStore();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const currentLang = (i18n.language as SupportedLanguage) || SupportedLanguage.UZ;

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
    loadOrders();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const handleReorder = (order: any) => {
    clearCart();
    for (const item of order.items) {
      addItem(
        {
          id: item.product_id,
          name_uz: item.product_name,
          price: item.unit_price,
          stock: 99,
          shop_id: order.shop_id,
        },
        order.shop_id,
        order.shop?.name || 'Do\'kon',
      );
    }
    Alert.alert('Muvaffaqiyatli', 'Mahsulotlar savatchaga qayta yuklandi', [
      { text: 'Savatchaga o\'tish', onPress: () => router.push('/(customer)/cart') },
    ]);
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'new':
        return t('orderStatus.new');
      case 'accepted':
        return t('orderStatus.accepted');
      case 'preparing':
        return t('orderStatus.preparing');
      case 'on_the_way':
        return t('orderStatus.on_the_way');
      case 'delivered':
        return t('orderStatus.delivered');
      case 'cancelled':
        return t('orderStatus.cancelled');
      default:
        return status;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('tabs.orders')}</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#16a34a']} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#16a34a" style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.emptyContainer}>
              <Clock size={48} color="#94a3b8" />
              <Text style={styles.emptyTitle}>Hozircha buyurtmalar yo'q</Text>
              <Text style={styles.emptySubtitle}>Yaqin do'konlardan birinchi buyurtmangizni bering</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const isActive = ['new', 'accepted', 'preparing', 'on_the_way'].includes(item.status);

          return (
            <TouchableOpacity
              style={styles.orderCard}
              onPress={() => router.push(`/(customer)/order/${item.id}` as any)}
              activeOpacity={0.8}
            >
              <View style={styles.orderTopRow}>
                <View style={styles.shopRow}>
                  <Store size={16} color="#16a34a" />
                  <Text style={styles.shopName}>{item.shop?.name}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    isActive ? styles.statusBadgeActive : styles.statusBadgeDone,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      isActive ? styles.statusTextActive : styles.statusTextDone,
                    ]}
                  >
                    {getStatusText(item.status)}
                  </Text>
                </View>
              </View>

              <Text style={styles.orderDate}>
                {new Date(item.created_at).toLocaleString('uz-UZ', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>

              <View style={styles.itemsSummary}>
                {item.items?.map((prod: any) => (
                  <Text key={prod.id} style={styles.itemLine} numberOfLines={1}>
                    &bull; {prod.product_name} × {prod.quantity}
                  </Text>
                ))}
              </View>

              <View style={styles.orderBottomRow}>
                <Text style={styles.totalAmount}>{formatPrice(item.total_amount, currentLang)}</Text>

                <TouchableOpacity
                  style={styles.reorderBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleReorder(item);
                  }}
                >
                  <RotateCcw size={14} color="#16a34a" />
                  <Text style={styles.reorderText}>{t('orderStatus.reorder')}</Text>
                </TouchableOpacity>
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
  listContent: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  orderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shopName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeActive: {
    backgroundColor: '#dcfce7',
  },
  statusBadgeDone: {
    backgroundColor: '#f1f5f9',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextActive: {
    color: '#15803d',
  },
  statusTextDone: {
    color: '#64748b',
  },
  orderDate: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
  itemsSummary: {
    marginVertical: 10,
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
  orderBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  totalAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  reorderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  reorderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
  },
});
