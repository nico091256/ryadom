import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { mobileApi } from '../../../services/api';
import { getSocket, joinOrderRoom } from '../../../services/socket';
import { formatPrice, OrderStatus, SOCKET_EVENTS } from '@localshop/shared';
import { hapticFeedback } from '../../../utils/haptics';
import { localizedField, toSupportedLang } from '../../../utils/localize';
import {
  Phone,
  CheckCircle2,
  Clock,
  Package,
  Truck,
  Check,
  XCircle,
  MapPin,
  Store,
  ShieldCheck,
  Home,
} from 'lucide-react-native';

export default function OrderLiveStatusScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const currentLang = toSupportedLang(i18n.language);

  const loadOrder = async () => {
    try {
      const data = await mobileApi.getOrderDetails(id);
      setOrder(data);
    } catch (err) {
      console.warn('Failed to load order', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();

    let cancelled = false;
    let activeSocket: any = null;

    const handleStatus = (data: any) => {
      if (data?.orderId === id) {
        hapticFeedback('success');
        setOrder((prev: any) => (prev ? { ...prev, status: data.status } : prev));
        loadOrder(); // full refresh
      }
    };

    // Setup Socket.IO realtime listener
    getSocket()
      .then((socket) => {
        if (cancelled || !socket) return;
        activeSocket = socket;
        joinOrderRoom(id);
        socket.on(SOCKET_EVENTS.ORDER_STATUS, handleStatus);
      })
      .catch((err) => console.warn('Socket connection failed', err));

    // Poll every 5s as fallback
    const interval = setInterval(loadOrder, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      activeSocket?.off(SOCKET_EVENTS.ORDER_STATUS, handleStatus);
    };
  }, [id]);

  const handleCancelOrder = async () => {
    hapticFeedback('medium');
    const doCancel = async () => {
      setCancelling(true);
      try {
        await mobileApi.cancelOrder(id, t('customer.order.cancelReasonByCustomer'));
        hapticFeedback('success');
        await loadOrder();
      } catch (err: any) {
        Alert.alert(t('customer.common.error'), err.message || t('customer.order.cancelFailed'));
      } finally {
        setCancelling(false);
      }
    };
    const question = t('customer.order.cancelQuestion');
    if (Platform.OS === 'web') {
      if (window.confirm(question)) await doCancel();
      return;
    }
    Alert.alert(t('orderStatus.cancelOrder'), question, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('orderStatus.cancelOrder'), style: 'destructive', onPress: doCancel },
    ]);
  };

  const handleCallShop = () => {
    hapticFeedback('selection');
    if (order?.shop?.phone) {
      Linking.openURL(`tel:${order.shop.phone}`);
    } else {
      Alert.alert(t('customer.common.info'), t('customer.order.noShopPhone'));
    }
  };

  if (loading || !order) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={styles.loadingText}>{t('customer.order.loading')}</Text>
      </SafeAreaView>
    );
  }

  // Reason comes from the latest 'cancelled' entry in the status history
  const cancelReason: string | null =
    [...(order.status_history || [])]
      .reverse()
      .find((h: any) => h.status === OrderStatus.CANCELLED)?.reason || null;

  const steps = [
    {
      key: OrderStatus.NEW,
      title: t('orderStatus.new'),
      subtitle: t('customer.order.stepNew'),
      icon: Clock,
    },
    {
      key: OrderStatus.ACCEPTED,
      title: t('orderStatus.accepted'),
      subtitle: t('customer.order.stepAccepted'),
      icon: CheckCircle2,
    },
    {
      key: OrderStatus.PREPARING,
      title: t('orderStatus.preparing'),
      subtitle: t('customer.order.stepPreparing'),
      icon: Package,
    },
    {
      key: OrderStatus.ON_THE_WAY,
      title: t('orderStatus.on_the_way'),
      subtitle: t('customer.order.stepOnTheWay'),
      icon: Truck,
    },
    {
      key: OrderStatus.DELIVERED,
      title: t('orderStatus.delivered'),
      subtitle: t('customer.order.stepDelivered'),
      icon: Check,
    },
  ];

  const getStepIndex = (status: string) => {
    return steps.findIndex((s) => s.key === status);
  };

  const currentStepIdx = getStepIndex(order.status);
  const isCancelled = order.status === OrderStatus.CANCELLED;
  const isDelivered = order.status === OrderStatus.DELIVERED;

  const getHeroStatusInfo = () => {
    switch (order.status) {
      case OrderStatus.NEW:
        return {
          title: t('customer.order.heroNewTitle'),
          desc: t('customer.order.heroNewDesc'),
          eta: t('customer.order.eta', { range: '15-25' }),
          color: '#d97706',
          bg: '#fef3c7',
        };
      case OrderStatus.ACCEPTED:
        return {
          title: t('customer.order.heroAcceptedTitle'),
          desc: t('customer.order.heroAcceptedDesc'),
          eta: t('customer.order.eta', { range: '15-20' }),
          color: '#16a34a',
          bg: '#dcfce7',
        };
      case OrderStatus.PREPARING:
        return {
          title: t('customer.order.heroPreparingTitle'),
          desc: t('customer.order.heroPreparingDesc'),
          eta: t('customer.order.eta', { range: '10-15' }),
          color: '#16a34a',
          bg: '#dcfce7',
        };
      case OrderStatus.ON_THE_WAY:
        return {
          title: t('customer.order.heroOnTheWayTitle'),
          desc: t('customer.order.heroOnTheWayDesc'),
          eta: t('customer.order.eta', { range: '5-10' }),
          color: '#2563eb',
          bg: '#dbeafe',
        };
      case OrderStatus.DELIVERED:
        return {
          title: t('customer.order.heroDeliveredTitle'),
          desc: t('customer.order.heroDeliveredDesc'),
          eta: t('orderStatus.delivered'),
          color: '#16a34a',
          bg: '#dcfce7',
        };
      case OrderStatus.CANCELLED:
        return {
          title: t('customer.order.heroCancelledTitle'),
          desc: cancelReason || t('customer.order.heroCancelledDesc'),
          eta: t('orderStatus.cancelled'),
          color: '#e11d48',
          bg: '#ffe4e6',
        };
      default:
        return {
          title: t('customer.order.heroDefaultTitle'),
          desc: t('customer.order.heroDefaultDesc'),
          eta: '—',
          color: '#16a34a',
          bg: '#dcfce7',
        };
    }
  };

  const heroInfo = getHeroStatusInfo();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            hapticFeedback('selection');
            router.push('/(customer)');
          }}
          style={styles.backBtn}
        >
          <Home size={20} color="#0f172a" />
        </TouchableOpacity>
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>
            {t('customer.order.title', { code: order.id.slice(0, 8).toUpperCase() })}
          </Text>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>{t('customer.order.liveTracking')}</Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Status Card */}
        <View style={[styles.heroCard, { backgroundColor: heroInfo.bg }]}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroTitle, { color: heroInfo.color }]}>
                {heroInfo.title}
              </Text>
              <Text style={styles.heroDesc}>{heroInfo.desc}</Text>
            </View>
            <View style={styles.etaBadge}>
              <Clock size={14} color="#0f172a" />
              <Text style={styles.etaText}>{heroInfo.eta}</Text>
            </View>
          </View>

          {/* Quick Progress Bar */}
          {!isCancelled && (
            <View style={styles.heroProgressBarTrack}>
              <View
                style={[
                  styles.heroProgressBarFill,
                  {
                    width: `${Math.min(100, Math.max(15, ((currentStepIdx + 1) / steps.length) * 100))}%`,
                    backgroundColor: heroInfo.color,
                  },
                ]}
              />
            </View>
          )}
        </View>

        {/* Status Timeline Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('customer.order.stagesTitle')}</Text>

          {isCancelled ? (
            <View style={styles.cancelledBox}>
              <XCircle size={44} color="#e11d48" />
              <Text style={styles.cancelledTitle}>{t('orderStatus.cancelled')}</Text>
              <Text style={styles.cancelledText}>
                {cancelReason || t('customer.order.heroCancelledTitle')}
              </Text>
            </View>
          ) : (
            <View style={styles.timeline}>
              {steps.map((step, idx) => {
                const isPassed = currentStepIdx >= idx;
                const isCurrent = currentStepIdx === idx;
                const Icon = step.icon;

                return (
                  <View key={step.key} style={styles.timelineItem}>
                    <View style={styles.timelineLeft}>
                      <View
                        style={[
                          styles.timelineCircle,
                          isPassed && styles.timelineCirclePassed,
                          isCurrent && styles.timelineCircleCurrent,
                        ]}
                      >
                        <Icon size={16} color={isPassed ? '#ffffff' : '#94a3b8'} />
                      </View>
                      {idx < steps.length - 1 && (
                        <View
                          style={[
                            styles.timelineLine,
                            currentStepIdx > idx && styles.timelineLinePassed,
                          ]}
                        />
                      )}
                    </View>
                    <View style={styles.timelineRight}>
                      <Text
                        style={[
                          styles.timelineText,
                          isCurrent && styles.timelineTextCurrent,
                          isPassed && !isCurrent && styles.timelineTextPassed,
                        ]}
                      >
                        {step.title}
                      </Text>
                      <Text style={styles.timelineSub}>{step.subtitle}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Cancel button: Only allowed while status is NEW */}
          {order.status === OrderStatus.NEW && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelOrder}
              disabled={cancelling}
              activeOpacity={0.8}
            >
              {cancelling ? (
                <ActivityIndicator size="small" color="#e11d48" />
              ) : (
                <Text style={styles.cancelButtonText}>{t('orderStatus.cancelOrder')}</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Shop Info & Direct Call */}
        <View style={styles.card}>
          <View style={styles.shopRow}>
            <View style={styles.shopLeft}>
              <View style={styles.shopIconCircle}>
                <Store size={20} color="#16a34a" />
              </View>
              <View>
                <Text style={styles.shopName}>{order.shop?.name || t('customer.common.shopFallback')}</Text>
                <Text style={styles.shopPhone}>
                  {order.shop?.phone || "+998 (--) --- -- --"}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.callBtn}
              onPress={handleCallShop}
              activeOpacity={0.7}
            >
              <Phone size={16} color="#16a34a" />
              <Text style={styles.callText}>{t('orderStatus.callSeller')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Delivery Address */}
        <View style={styles.card}>
          <View style={styles.addressRow}>
            <View style={styles.addressIconCircle}>
              <MapPin size={18} color="#16a34a" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.addressLabel}>{t('checkout.deliveryAddress')}</Text>
              <Text style={styles.addressText}>{order.address_snapshot?.text}</Text>
            </View>
          </View>
        </View>

        {/* Order Items Breakdown */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {t('customer.order.itemsTitle', { count: order.items?.length || 0 })}
          </Text>
          {order.items?.map((item: any) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>
                  {localizedField(item.product, 'name', currentLang) || item.product_name}
                </Text>
                <Text style={styles.itemQuantity}>
                  {item.quantity} × {formatPrice(item.unit_price, currentLang)}
                </Text>
              </View>
              <Text style={styles.itemSubtotal}>
                {formatPrice(item.unit_price * item.quantity, currentLang)}
              </Text>
            </View>
          ))}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('customer.order.totalPaid')}</Text>
            <Text style={styles.totalAmount}>{formatPrice(order.total_amount, currentLang)}</Text>
          </View>

          <View style={styles.paymentInfoRow}>
            <Text style={styles.paymentMethod}>
              {t('customer.order.payment', {
                method:
                  order.payment_method === 'cash'
                    ? t('customer.order.paymentCash')
                    : t('customer.order.paymentOnline'),
              })}
            </Text>
            <View style={styles.freeBadge}>
              <ShieldCheck size={12} color="#166534" />
              <Text style={styles.freeBadgeText}>{t('customer.order.freeDelivery')}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
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
    padding: 24,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
  },
  headerTitleBox: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16a34a',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  heroCard: {
    padding: 16,
    borderRadius: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  heroDesc: {
    fontSize: 12,
    color: '#475569',
    marginTop: 3,
    lineHeight: 16,
  },
  etaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  etaText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  heroProgressBarTrack: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 3,
    marginTop: 12,
    overflow: 'hidden',
  },
  heroProgressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 16,
  },
  timeline: {
    paddingVertical: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 56,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 32,
  },
  timelineCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineCirclePassed: {
    backgroundColor: '#16a34a',
  },
  timelineCircleCurrent: {
    backgroundColor: '#16a34a',
    borderWidth: 3,
    borderColor: '#bbf7d0',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 4,
  },
  timelineLinePassed: {
    backgroundColor: '#16a34a',
  },
  timelineRight: {
    marginLeft: 14,
    justifyContent: 'flex-start',
    paddingTop: 4,
    paddingBottom: 16,
    flex: 1,
  },
  timelineText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  timelineTextCurrent: {
    color: '#0f172a',
    fontWeight: '900',
  },
  timelineTextPassed: {
    color: '#334155',
    fontWeight: '700',
  },
  timelineSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  cancelledBox: {
    alignItems: 'center',
    padding: 24,
  },
  cancelledTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#e11d48',
    marginTop: 10,
  },
  cancelledText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#fff1f2',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#e11d48',
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  shopIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  shopPhone: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  callBtn: {
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
  callText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  addressIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  addressLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  addressText: {
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 2,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  itemQuantity: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  itemSubtotal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#16a34a',
  },
  paymentInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  paymentMethod: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  freeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  freeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
});

