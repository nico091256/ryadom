import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { mobileApi } from '../services/api';
import { OrderStatus } from '@localshop/shared';
import { Clock, ChevronRight, PackageCheck, Truck } from 'lucide-react-native';
import { hapticFeedback } from '../utils/haptics';
import { useAuthStore } from '../store/useAuthStore';

export default function ActiveOrderWidget() {
  const { t } = useTranslation();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    if (!isAuthenticated) {
      setActiveOrder(null);
      return;
    }

    // Check for active orders
    const fetchActiveOrders = async () => {
      try {
        const res = await mobileApi.getOrders();
        const orders: any[] = Array.isArray(res) ? res : res?.data;
        if (Array.isArray(orders)) {
          const ongoing = orders.find((o: any) =>
            [
              OrderStatus.NEW,
              OrderStatus.ACCEPTED,
              OrderStatus.PREPARING,
              OrderStatus.ON_THE_WAY,
            ].includes(o.status),
          );
          setActiveOrder(ongoing || null);
        }
      } catch {
        // Silently fail if not logged in
      }
    };

    fetchActiveOrders();
    const interval = setInterval(fetchActiveOrders, 10000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  if (!activeOrder) return null;

  const getStatusText = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.NEW:
      case OrderStatus.ACCEPTED:
      case OrderStatus.PREPARING:
      case OrderStatus.ON_THE_WAY:
        return `${t(`orderStatus.${status}`)} • ${t(`customer.activeOrder.${status}`)}`;
      default:
        return t('home.activeOrderTitle');
    }
  };

  const getIcon = (status: OrderStatus) => {
    if (status === OrderStatus.ON_THE_WAY) {
      return <Truck size={20} color="#ffffff" />;
    }
    if (status === OrderStatus.PREPARING) {
      return <PackageCheck size={20} color="#ffffff" />;
    }
    return <Clock size={20} color="#ffffff" />;
  };

  const handlePress = () => {
    hapticFeedback.selection();
    router.push(`/(customer)/order/${activeOrder.id}` as any);
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: pulseAnim }] }]}>
      <TouchableOpacity
        style={styles.touchable}
        onPress={handlePress}
        activeOpacity={0.88}
      >
        <View style={styles.iconCircle}>{getIcon(activeOrder.status)}</View>
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <View style={styles.pulsingDot} />
            <Text style={styles.title}>{t('home.activeOrderTitle')}</Text>
          </View>
          <Text style={styles.status} numberOfLines={1}>
            {getStatusText(activeOrder.status)}
          </Text>
        </View>
        <View style={styles.actionRow}>
          <Text style={styles.trackText}>{t('home.trackOrder')}</Text>
          <ChevronRight size={16} color="#ffffff" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: '#059669',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  touchable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  pulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34d399',
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    color: '#a7f3d0',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  status: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    gap: 2,
  },
  trackText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
});
