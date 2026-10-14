import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAddressStore } from '../../store/useAddressStore';
import { mobileApi } from '../../services/api';
import { formatDistance, SupportedLanguage } from '@localshop/shared';
import {
  MapPin,
  ChevronDown,
  Store as StoreIcon,
  Clock,
  Map as MapIcon,
  List as ListIcon,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react-native';

export default function CustomerHomeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { currentAddress } = useAddressStore();

  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const loadNearbyShops = async () => {
    try {
      const data = await mobileApi.getNearbyShops(currentAddress.lat, currentAddress.lng, 3000);
      setShops(data);
    } catch (err) {
      console.warn('Failed to load nearby shops', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadNearbyShops();
  }, [currentAddress]);

  const onRefresh = () => {
    setRefreshing(true);
    loadNearbyShops();
  };

  const currentLang = (i18n.language as SupportedLanguage) || SupportedLanguage.UZ;

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Address Selector Bar */}
      <View style={styles.addressBar}>
        <TouchableOpacity
          style={styles.addressButton}
          onPress={() => router.push('/(customer)/address-picker')}
          activeOpacity={0.7}
        >
          <View style={styles.addressPinIcon}>
            <MapPin size={18} color="#16a34a" />
          </View>
          <View style={styles.addressTextContainer}>
            <Text style={styles.addressLabel}>{t('home.deliverTo')}</Text>
            <View style={styles.addressTitleRow}>
              <Text style={styles.addressTitle} numberOfLines={1}>
                {currentAddress.title ? `${currentAddress.title}: ` : ''}
                {currentAddress.address_text}
              </Text>
              <ChevronDown size={14} color="#0f172a" />
            </View>
          </View>
        </TouchableOpacity>

        {/* View Mode Toggle (List vs Map) */}
        <TouchableOpacity
          style={styles.toggleViewBtn}
          onPress={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
        >
          {viewMode === 'list' ? (
            <MapIcon size={18} color="#0f172a" />
          ) : (
            <ListIcon size={18} color="#0f172a" />
          )}
        </TouchableOpacity>
      </View>

      {/* Free Delivery Banner */}
      <View style={styles.freeDeliveryBanner}>
        <ShieldCheck size={16} color="#166534" />
        <Text style={styles.freeDeliveryText}>{t('common.freeDelivery')}</Text>
      </View>

      {/* Content: List or Map View */}
      {viewMode === 'map' ? (
        <View style={styles.mapContainer}>
          <View style={styles.mapMock}>
            <MapPin size={36} color="#16a34a" style={styles.currentLocationPin} />
            <Text style={styles.mapMockTitle}>Yandex Xarita Ko'rinishi</Text>
            <Text style={styles.mapMockSubtitle}>
              Siz tanlagan manzil atrofida 3 km radiusdagi {shops.length} ta do'kon ko'rsatilmoqda
            </Text>

            {/* Simulated shop markers */}
            <View style={styles.mapPinsRow}>
              {shops.slice(0, 3).map((s, idx) => (
                <TouchableOpacity
                  key={s.id}
                  style={styles.mapShopCard}
                  onPress={() => router.push(`/(customer)/shop/${s.id}` as any)}
                >
                  <StoreIcon size={16} color="#16a34a" />
                  <Text style={styles.mapShopName} numberOfLines={1}>{s.name}</Text>
                  <Text style={styles.mapShopDist}>{formatDistance(s.distanceMeters || 250, currentLang)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      ) : (
        <FlatList
          data={shops}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#16a34a']} />
          }
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.sectionTitle}>{t('home.nearbyShops')}</Text>
              <Text style={styles.sectionSubtitle}>3 km radiusdagi eng yaqin do'konlar</Text>
            </View>
          }
          ListEmptyComponent={
            loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#16a34a" />
                <Text style={styles.loadingText}>{t('common.loading')}</Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <StoreIcon size={48} color="#cbd5e1" />
                <Text style={styles.emptyTitle}>{t('home.noShopsNearby')}</Text>
                <Text style={styles.emptyDesc}>
                  Manzilni o'zgartirib ko'ring yoki boshqa hududni tanlang
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => {
            const isOpen = item.isCurrentlyOpen;
            const distanceText = formatDistance(item.distanceMeters || 200, currentLang);

            return (
              <TouchableOpacity
                style={[styles.shopCard, !isOpen && styles.shopCardClosed]}
                onPress={() => router.push(`/(customer)/shop/${item.id}` as any)}
                activeOpacity={0.8}
              >
                <View style={styles.shopLogoWrapper}>
                  {item.logo_url ? (
                    <Image source={{ uri: item.logo_url }} style={styles.shopLogo} />
                  ) : (
                    <StoreIcon size={28} color="#16a34a" />
                  )}
                </View>

                <View style={styles.shopInfo}>
                  <View style={styles.shopTitleRow}>
                    <Text style={styles.shopName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        isOpen ? styles.statusBadgeOpen : styles.statusBadgeClosed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          isOpen ? styles.statusTextOpen : styles.statusTextClosed,
                        ]}
                      >
                        {isOpen ? t('common.open') : t('common.closed')}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.shopAddress} numberOfLines={1}>
                    {item.address_text}
                  </Text>

                  <View style={styles.shopMetaRow}>
                    <View style={styles.distanceBadge}>
                      <MapPin size={11} color="#16a34a" />
                      <Text style={styles.distanceText}>{distanceText}</Text>
                    </View>

                    <View style={styles.hoursRow}>
                      <Clock size={11} color="#64748b" />
                      <Text style={styles.hoursText}>
                        {item.open_time} - {item.close_time}
                      </Text>
                    </View>
                  </View>
                </View>

                <ChevronRight size={18} color="#cbd5e1" style={{ alignSelf: 'center' }} />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  addressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  addressButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressPinIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  addressTextContainer: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16a34a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addressTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    maxWidth: '90%',
  },
  toggleViewBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  freeDeliveryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    backgroundColor: '#f0fdf4',
    borderBottomWidth: 1,
    borderBottomColor: '#dcfce7',
  },
  freeDeliveryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  listHeader: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  shopCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  shopCardClosed: {
    opacity: 0.7,
  },
  shopLogoWrapper: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  shopLogo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  shopInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  shopTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shopName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusBadgeOpen: {
    backgroundColor: '#dcfce7',
  },
  statusBadgeClosed: {
    backgroundColor: '#f1f5f9',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusTextOpen: {
    color: '#15803d',
  },
  statusTextClosed: {
    color: '#64748b',
  },
  shopAddress: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  shopMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  hoursText: {
    fontSize: 11,
    color: '#64748b',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748b',
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginTop: 14,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#e2e8f0',
  },
  mapMock: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  currentLocationPin: {
    marginBottom: 12,
  },
  mapMockTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  mapMockSubtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  mapPinsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    justifyContent: 'center',
  },
  mapShopCard: {
    backgroundColor: '#ffffff',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    width: 100,
  },
  mapShopName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 4,
  },
  mapShopDist: {
    fontSize: 10,
    color: '#16a34a',
    fontWeight: '700',
    marginTop: 2,
  },
});
