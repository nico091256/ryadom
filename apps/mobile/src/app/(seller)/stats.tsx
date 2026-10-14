import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { mobileApi } from '../../services/api';
import { formatPrice, SupportedLanguage } from '@localshop/shared';
import { TrendingUp, ShoppingBag, Calendar, Banknote } from 'lucide-react-native';

export default function SellerStatsScreen() {
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const currentLang = (i18n.language as SupportedLanguage) || SupportedLanguage.UZ;

  const loadStats = async () => {
    try {
      const data = await mobileApi.getSellerStats();
      setStats(data);
    } catch (e) {
      console.warn('Failed to load stats', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#16a34a" />
      </SafeAreaView>
    );
  }

  const today = stats?.today || { orderCount: 0, revenueTiyin: 0 };
  const thisWeek = stats?.thisWeek || { orderCount: 0, revenueTiyin: 0 };
  const thisMonth = stats?.thisMonth || { orderCount: 0, revenueTiyin: 0 };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Do'kon Statistikasi</Text>
        <Text style={styles.headerSubtitle}>Sotuvlar va buyurtmalar ko'rsatkichlari</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#16a34a']} />
        }
      >
        {/* Today Card */}
        <View style={styles.metricCard}>
          <View style={styles.cardTop}>
            <Text style={styles.cardPeriod}>{t('seller.todayStats')}</Text>
            <View style={[styles.iconCircle, { backgroundColor: '#f0fdf4' }]}>
              <Calendar size={18} color="#16a34a" />
            </View>
          </View>
          <Text style={styles.revenueAmount}>{formatPrice(today.revenueTiyin, currentLang)}</Text>
          <View style={styles.countBadge}>
            <ShoppingBag size={12} color="#166534" />
            <Text style={styles.countText}>{today.orderCount} ta buyurtma</Text>
          </View>
        </View>

        {/* This Week Card */}
        <View style={styles.metricCard}>
          <View style={styles.cardTop}>
            <Text style={styles.cardPeriod}>{t('seller.weekStats')}</Text>
            <View style={[styles.iconCircle, { backgroundColor: '#eff6ff' }]}>
              <TrendingUp size={18} color="#2563eb" />
            </View>
          </View>
          <Text style={styles.revenueAmount}>{formatPrice(thisWeek.revenueTiyin, currentLang)}</Text>
          <View style={[styles.countBadge, { backgroundColor: '#eff6ff' }]}>
            <ShoppingBag size={12} color="#1e40af" />
            <Text style={[styles.countText, { color: '#1e40af' }]}>
              {thisWeek.orderCount} ta buyurtma
            </Text>
          </View>
        </View>

        {/* This Month Card */}
        <View style={styles.metricCard}>
          <View style={styles.cardTop}>
            <Text style={styles.cardPeriod}>{t('seller.monthStats')}</Text>
            <View style={[styles.iconCircle, { backgroundColor: '#faf5ff' }]}>
              <Banknote size={18} color="#9333ea" />
            </View>
          </View>
          <Text style={styles.revenueAmount}>{formatPrice(thisMonth.revenueTiyin, currentLang)}</Text>
          <View style={[styles.countBadge, { backgroundColor: '#faf5ff' }]}>
            <ShoppingBag size={12} color="#6b21a8" />
            <Text style={[styles.countText, { color: '#6b21a8' }]}>
              {thisMonth.orderCount} ta buyurtma
            </Text>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
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
  content: {
    padding: 16,
    gap: 14,
  },
  metricCard: {
    backgroundColor: '#ffffff',
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardPeriod: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revenueAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    marginVertical: 4,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
});
