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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { mobileApi } from '../../../services/api';
import { getSocket, joinOrderRoom } from '../../../services/socket';
import { formatPrice, SupportedLanguage, OrderStatus, SOCKET_EVENTS } from '@localshop/shared';
import {
  ArrowLeft,
  Phone,
  CheckCircle2,
  Clock,
  Package,
  Truck,
  Check,
  XCircle,
  MapPin,
  AlertTriangle,
} from 'lucide-react-native';

export default function OrderLiveStatusScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const currentLang = (i18n.language as SupportedLanguage) || SupportedLanguage.UZ;

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

    // Setup Socket.IO realtime listener
    getSocket().then((socket) => {
      joinOrderRoom(id);

      socket.on(SOCKET_EVENTS.ORDER_STATUS, (data) => {
        if (data.orderId === id) {
          setOrder((prev: any) => (prev ? { ...prev, status: data.status } : prev));
          loadOrder(); // full refresh
        }
      });
    });

    // Poll every 5s as fallback
    const interval = setInterval(loadOrder, 5000);
    return () => clearInterval(interval);
  }, [id]);

  const handleCancelOrder = async () => {
    Alert.alert(
      t('orderStatus.cancelOrder'),
      'Haqiqatan ham buyurtmani bekor qilmoqchimisiz?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('orderStatus.cancelOrder'),
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await mobileApi.cancelOrder(id, 'Xaridor tomonidan bekor qilindi');
              await loadOrder();
            } catch (err: any) {
              Alert.alert('Xatolik', err.message || 'Bekor qilishda xatolik yuz berdi');
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  };

  const handleCallShop = () => {
    if (order?.shop?.phone) {
      Linking.openURL(`tel:${order.shop.phone}`);
    }
  };

  if (loading || !order) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#16a34a" />
      </SafeAreaView>
    );
  }

  const steps = [
    { key: OrderStatus.NEW, title: t('orderStatus.new'), icon: Clock },
    { key: OrderStatus.ACCEPTED, title: t('orderStatus.accepted'), icon: CheckCircle2 },
    { key: OrderStatus.PREPARING, title: t('orderStatus.preparing'), icon: Package },
    { key: OrderStatus.ON_THE_WAY, title: t('orderStatus.on_the_way'), icon: Truck },
    { key: OrderStatus.DELIVERED, title: t('orderStatus.delivered'), icon: Check },
  ];

  const getStepIndex = (status: string) => {
    return steps.findIndex((s) => s.key === status);
  };

  const currentStepIdx = getStepIndex(order.status);
  const isCancelled = order.status === OrderStatus.CANCELLED;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Buyurtma #{order.id.slice(0, 8)}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Status Timeline Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Buyurtma Holati</Text>

          {isCancelled ? (
            <View style={styles.cancelledBox}>
              <XCircle size={32} color="#e11d48" />
              <Text style={styles.cancelledTitle}>{t('orderStatus.cancelled')}</Text>
              <Text style={styles.cancelledText}>Ushbu buyurtma bekor qilingan</Text>
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
                        ]}
                      >
                        {step.title}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Cancel button: Only enabled while status is NEW (Section 4 & 7) */}
          {order.status === OrderStatus.NEW && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelOrder}
              disabled={cancelling}
            >
              <Text style={styles.cancelButtonText}>{t('orderStatus.cancelOrder')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Shop Info & Call */}
        <View style={styles.card}>
          <View style={styles.shopRow}>
            <View>
              <Text style={styles.shopName}>{order.shop?.name}</Text>
              <Text style={styles.shopPhone}>{order.shop?.phone}</Text>
            </View>
            <TouchableOpacity style={styles.callBtn} onPress={handleCallShop}>
              <Phone size={16} color="#16a34a" />
              <Text style={styles.callText}>{t('orderStatus.callSeller')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Delivery Address */}
        <View style={styles.card}>
          <View style={styles.addressRow}>
            <MapPin size={18} color="#16a34a" />
            <Text style={styles.addressText}>{order.address_snapshot?.text}</Text>
          </View>
        </View>

        {/* Order Items */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Buyurtma tarkibi</Text>
          {order.items?.map((item: any) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.product_name}</Text>
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
            <Text style={styles.totalLabel}>Jami to'lov:</Text>
            <Text style={styles.totalAmount}>{formatPrice(order.total_amount, currentLang)}</Text>
          </View>
          <Text style={styles.paymentMethod}>
            To'lov turi: {order.payment_method === 'cash' ? 'Naqd (yetkazilganda)' : 'Onlayn'}
          </Text>
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
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  timeline: {
    paddingVertical: 6,
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 48,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 32,
  },
  timelineCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
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
    justifyContent: 'center',
    paddingBottom: 20,
  },
  timelineText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  timelineTextCurrent: {
    color: '#0f172a',
    fontWeight: '800',
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
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#fff1f2',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e11d48',
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shopName: {
    fontSize: 15,
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
    alignItems: 'center',
    gap: 10,
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  itemQuantity: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  itemSubtotal: {
    fontSize: 13,
    fontWeight: '700',
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
    fontWeight: '700',
    color: '#0f172a',
  },
  totalAmount: {
    fontSize: 17,
    fontWeight: '900',
    color: '#16a34a',
  },
  paymentMethod: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 6,
  },
});
