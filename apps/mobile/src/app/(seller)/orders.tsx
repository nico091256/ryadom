import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Linking,
  Alert,
  RefreshControl,
  Vibration,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { mobileApi } from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import { getSocket, joinShopRoom } from '../../services/socket';
import {
  formatPrice,
  SupportedLanguage,
  OrderStatus,
  SOCKET_EVENTS,
  resolveLocalizedText,
} from '@localshop/shared';
import {
  Phone,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  Package,
  BellRing,
  Check,
} from 'lucide-react-native';
import SellerRejectModal from '../../components/SellerRejectModal';

// Kept as data (not a pre-built string) so the banner re-renders in the current language
type LoudAlert =
  | { kind: 'new'; id: string }
  | { kind: 'cancelled'; id: string; reason?: string };

export default function SellerOrdersScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'new' | 'in_progress' | 'completed'>('new');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loudAlert, setLoudAlert] = useState<LoudAlert | null>(null);
  const [rejectOrderId, setRejectOrderId] = useState<string | null>(null);
  const shopId = user?.shopId;

  const currentLang = (i18n.language as SupportedLanguage) || SupportedLanguage.UZ;

  const loadOrders = useCallback(async () => {
    try {
      // Default page size is 20 — request a larger page so no active orders are dropped
      const res = await mobileApi.request('/orders?limit=100');
      setOrders(res.data || []);
    } catch (e) {
      console.warn('Failed to load seller orders', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Polling fallback
  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  // Realtime socket listeners — registered once per shop and removed on unmount
  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;
    let socketRef: any = null;

    const onNewOrder = (newOrder: any) => {
      // Trigger loud alert (vibration & banner)
      if (Platform.OS !== 'web') Vibration.vibrate([0, 500, 200, 500]);
      setLoudAlert({ kind: 'new', id: newOrder?.id?.slice(0, 8) ?? '' });
      loadOrders();
    };
    const onOrderCancelled = (payload: { orderId: string; reason?: string }) => {
      setLoudAlert({
        kind: 'cancelled',
        id: payload?.orderId?.slice(0, 8) ?? '',
        reason: payload?.reason || undefined,
      });
      loadOrders();
    };
    const onConnect = () => joinShopRoom(shopId);

    getSocket().then((socket) => {
      if (cancelled) return;
      socketRef = socket;
      joinShopRoom(shopId);
      socket.on('connect', onConnect); // re-join room after reconnects
      socket.on(SOCKET_EVENTS.ORDER_NEW, onNewOrder);
      socket.on(SOCKET_EVENTS.ORDER_CANCELLED, onOrderCancelled);
    });

    return () => {
      cancelled = true;
      if (socketRef) {
        socketRef.off('connect', onConnect);
        socketRef.off(SOCKET_EVENTS.ORDER_NEW, onNewOrder);
        socketRef.off(SOCKET_EVENTS.ORDER_CANCELLED, onOrderCancelled);
      }
    };
  }, [shopId, loadOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const handleAccept = async (orderId: string) => {
    try {
      await mobileApi.acceptOrder(orderId);
      await loadOrders();
    } catch (err: any) {
      Alert.alert(t('sellerUi.common.error'), err.message || t('sellerUi.orders.acceptFailed'));
    }
  };

  const handleRejectSubmit = async (reason: string) => {
    if (!rejectOrderId) return;
    // Errors propagate to the modal, which shows them inline
    await mobileApi.rejectOrder(rejectOrderId, reason);
    setRejectOrderId(null);
    await loadOrders();
  };

  const handleAdvanceStatus = async (order: any, nextStatus: string) => {
    if (nextStatus === OrderStatus.DELIVERED && order.payment_method === 'cash') {
      const cashMsg = t('sellerUi.orders.cashConfirmMessage', {
        amount: formatPrice(order.total_amount, currentLang),
      });
      if (Platform.OS === 'web') {
        if (!window.confirm(cashMsg)) return;
        try {
          await mobileApi.updateOrderStatus(order.id, nextStatus);
          await loadOrders();
        } catch (err: any) {
          window.alert(err.message);
        }
        return;
      }
      Alert.alert(
        t('seller.confirmCash'),
        cashMsg,
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('sellerUi.orders.cashConfirmButton'),
            onPress: async () => {
              try {
                await mobileApi.updateOrderStatus(order.id, nextStatus);
                await loadOrders();
              } catch (err: any) {
                Alert.alert(t('sellerUi.common.error'), err.message);
              }
            },
          },
        ],
      );
      return;
    }

    try {
      await mobileApi.updateOrderStatus(order.id, nextStatus);
      await loadOrders();
    } catch (err: any) {
      Alert.alert(t('sellerUi.common.error'), err.message);
    }
  };

  const loudAlertText = !loudAlert
    ? null
    : loudAlert.kind === 'new'
      ? t('sellerUi.orders.newOrderAlert', { id: loudAlert.id })
      : loudAlert.reason
        ? t('sellerUi.orders.cancelledAlertReason', { id: loudAlert.id, reason: loudAlert.reason })
        : t('sellerUi.orders.cancelledAlert', { id: loudAlert.id });

  // Order items keep a name snapshot; prefer the product's name in the current language when present
  const productName = (prod: any) =>
    resolveLocalizedText(
      {
        uz: prod.product?.name_uz || prod.product_name,
        ru: prod.product?.name_ru,
        en: prod.product?.name_en,
      },
      currentLang,
    );

  const filteredOrders = orders.filter((o) => {
    if (activeTab === 'new') return o.status === 'new';
    if (activeTab === 'in_progress')
      return ['accepted', 'preparing', 'on_the_way'].includes(o.status);
    return ['delivered', 'cancelled'].includes(o.status);
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Loud Alert Banner if new order arrived */}
      {loudAlert && (
        <TouchableOpacity
          style={styles.loudAlertBar}
          onPress={() => setLoudAlert(null)}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={t('sellerUi.orders.dismissAlert')}
        >
          <BellRing size={20} color="#ffffff" />
          <Text style={styles.loudAlertText}>{loudAlertText}</Text>
          <XCircle size={18} color="#ffffff" />
        </TouchableOpacity>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('sellerUi.orders.title')}</Text>
        <Text style={styles.headerSubtitle}>
          {t('sellerUi.orders.newCount', {
            count: orders.filter((o) => o.status === 'new').length,
          })}
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'new' && styles.tabItemActive]}
          onPress={() => setActiveTab('new')}
        >
          <Text style={[styles.tabText, activeTab === 'new' && styles.tabTextActive]}>
            {t('seller.newOrders')} (
            {orders.filter((o) => o.status === 'new').length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'in_progress' && styles.tabItemActive]}
          onPress={() => setActiveTab('in_progress')}
        >
          <Text style={[styles.tabText, activeTab === 'in_progress' && styles.tabTextActive]}>
            {t('seller.inProgress')} (
            {
              orders.filter((o) =>
                ['accepted', 'preparing', 'on_the_way'].includes(o.status),
              ).length
            }
            )
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'completed' && styles.tabItemActive]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>
            {t('seller.completed')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Order Cards List */}
      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#16a34a']} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Clock size={40} color="#cbd5e1" />
            <Text style={styles.emptyText}>{t('sellerUi.orders.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const minutesElapsed = Math.floor(
            (Date.now() - new Date(item.created_at).getTime()) / 60000,
          );
          const isUrgent = item.status === 'new' && minutesElapsed >= 4;

          return (
            <View style={[styles.orderCard, isUrgent && styles.orderCardUrgent]}>
              {/* Order Header */}
              <View style={styles.orderCardHeader}>
                <View>
                  <Text style={styles.orderId}>#{item.id.slice(0, 8)}</Text>
                  <Text style={styles.orderTime}>
                    {t('sellerUi.orders.minutesAgo', { count: minutesElapsed })}
                  </Text>
                </View>
                {item.status === 'new' && (
                  <View style={[styles.timerBadge, isUrgent && styles.timerBadgeUrgent]}>
                    <Clock size={12} color={isUrgent ? '#e11d48' : '#d97706'} />
                    <Text style={[styles.timerText, isUrgent && styles.timerTextUrgent]}>
                      {t('sellerUi.orders.fiveMinRule', { count: minutesElapsed })}
                    </Text>
                  </View>
                )}
                {item.status !== 'new' && (
                  <View
                    style={[
                      styles.statusBadge,
                      item.status === 'delivered' && styles.statusBadgeDelivered,
                      item.status === 'cancelled' && styles.statusBadgeCancelled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        item.status === 'delivered' && styles.statusBadgeTextDelivered,
                        item.status === 'cancelled' && styles.statusBadgeTextCancelled,
                      ]}
                    >
                      {t(`orderStatus.${item.status}`)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Customer Contact & Address */}
              <View style={styles.customerSection}>
                <View style={styles.customerRow}>
                  <Text style={styles.customerName}>
                    {item.customer?.name || t('sellerUi.orders.customerFallback')}
                  </Text>
                  <TouchableOpacity
                    style={styles.callButton}
                    onPress={() => Linking.openURL(`tel:${item.customer_phone}`)}
                    accessibilityLabel={t('sellerUi.orders.callCustomer')}
                  >
                    <Phone size={14} color="#16a34a" />
                    <Text style={styles.callButtonText}>{item.customer_phone}</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.addressRow}
                  accessibilityLabel={t('sellerUi.orders.openMap')}
                  onPress={() =>
                    Linking.openURL(
                      `https://yandex.uz/maps/?text=${item.address_snapshot?.lat},${item.address_snapshot?.lng}`,
                    )
                  }
                >
                  <MapPin size={14} color="#64748b" />
                  <Text style={styles.addressText} numberOfLines={2}>
                    {item.address_snapshot?.text}
                  </Text>
                </TouchableOpacity>

                {item.comment ? (
                  <Text style={styles.commentText}>
                    💬 {t('sellerUi.orders.comment', { text: item.comment })}
                  </Text>
                ) : null}
              </View>

              {/* Products List */}
              <View style={styles.itemsList}>
                {item.items?.map((prod: any) => (
                  <View key={prod.id} style={styles.itemRow}>
                    <Text style={styles.itemName}>
                      {productName(prod)} <Text style={{ color: '#16a34a', fontWeight: '800' }}>×{prod.quantity}</Text>
                    </Text>
                    <Text style={styles.itemSubtotal}>
                      {formatPrice(prod.unit_price * prod.quantity, currentLang)}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Total & Payment Method */}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t('sellerUi.orders.total')}</Text>
                <Text style={styles.totalAmount}>
                  {formatPrice(item.total_amount, currentLang)} (
                  {item.payment_method === 'cash'
                    ? t('sellerUi.orders.payCash')
                    : t('sellerUi.orders.payOnline')}
                  )
                </Text>
              </View>

              {/* Action Buttons based on status */}
              <View style={styles.actionsRow}>
                {item.status === 'new' && (
                  <>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.rejectBtn]}
                      onPress={() => setRejectOrderId(item.id)}
                    >
                      <XCircle size={16} color="#e11d48" />
                      <Text style={styles.rejectBtnText}>{t('seller.reject')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, styles.acceptBtn]}
                      onPress={() => handleAccept(item.id)}
                    >
                      <CheckCircle size={16} color="#ffffff" />
                      <Text style={styles.acceptBtnText}>{t('seller.accept')}</Text>
                    </TouchableOpacity>
                  </>
                )}

                {item.status === 'accepted' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.primaryAdvanceBtn]}
                    onPress={() => handleAdvanceStatus(item, OrderStatus.PREPARING)}
                  >
                    <Package size={16} color="#ffffff" />
                    <Text style={styles.advanceBtnText}>{t('seller.markPreparing')}</Text>
                  </TouchableOpacity>
                )}

                {item.status === 'preparing' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.primaryAdvanceBtn]}
                    onPress={() => handleAdvanceStatus(item, OrderStatus.ON_THE_WAY)}
                  >
                    <Truck size={16} color="#ffffff" />
                    <Text style={styles.advanceBtnText}>{t('seller.markOnTheWay')}</Text>
                  </TouchableOpacity>
                )}

                {item.status === 'on_the_way' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.deliverBtn]}
                    onPress={() => handleAdvanceStatus(item, OrderStatus.DELIVERED)}
                  >
                    <Check size={16} color="#ffffff" />
                    <Text style={styles.advanceBtnText}>{t('seller.markDelivered')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
      />

      <SellerRejectModal
        visible={!!rejectOrderId}
        title={t('seller.reject')}
        placeholder={t('seller.rejectReason')}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('seller.reject')}
        onCancel={() => setRejectOrderId(null)}
        onSubmit={handleRejectSubmit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loudAlertBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#dc2626',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  loudAlertText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
    flex: 1,
    marginHorizontal: 10,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tabItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#16a34a',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#16a34a',
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  orderCardUrgent: {
    borderColor: '#fca5a5',
    backgroundColor: '#fffafb',
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  orderId: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  orderTime: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeDelivered: {
    backgroundColor: '#dcfce7',
  },
  statusBadgeCancelled: {
    backgroundColor: '#fee2e2',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  statusBadgeTextDelivered: {
    color: '#166534',
  },
  statusBadgeTextCancelled: {
    color: '#e11d48',
  },
  timerBadgeUrgent: {
    backgroundColor: '#fee2e2',
  },
  timerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
  },
  timerTextUrgent: {
    color: '#b91c1c',
  },
  customerSection: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  customerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  callButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  addressText: {
    flex: 1,
    fontSize: 12,
    color: '#475569',
  },
  commentText: {
    fontSize: 11,
    color: '#d97706',
    marginTop: 6,
    fontStyle: 'italic',
  },
  itemsList: {
    paddingVertical: 10,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
  itemName: {
    fontSize: 13,
    color: '#0f172a',
    flex: 1,
  },
  itemSubtotal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: '#16a34a',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  acceptBtn: {
    backgroundColor: '#16a34a',
  },
  acceptBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  rejectBtn: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  rejectBtnText: {
    color: '#e11d48',
    fontSize: 13,
    fontWeight: '700',
  },
  primaryAdvanceBtn: {
    backgroundColor: '#2563eb',
  },
  deliverBtn: {
    backgroundColor: '#16a34a',
  },
  advanceBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 10,
  },
});
