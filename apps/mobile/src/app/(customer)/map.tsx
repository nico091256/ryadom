import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAddressStore } from '../../store/useAddressStore';
import { mobileApi } from '../../services/api';
import { detectCurrentLocation, LocationPermissionError } from '../../utils/location';
import LeafletMap, { LeafletMapHandle, MapMarker } from '../../components/LeafletMap';
import { hapticFeedback } from '../../utils/haptics';
import { Navigation, Store } from 'lucide-react-native';

// Large radius so the map shows every shop in the city, not only the 3 km delivery zone
const ALL_SHOPS_RADIUS_METERS = 50000;

export default function ShopsMapScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { currentAddress } = useAddressStore();
  const mapRef = useRef<LeafletMapHandle>(null);

  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    mobileApi
      .getNearbyShops(currentAddress.lat, currentAddress.lng, ALL_SHOPS_RADIUS_METERS)
      .then((list: any[]) => setShops(list || []))
      .catch((e) => console.warn('Failed to load shops for map', e))
      .finally(() => setLoading(false));
  }, []);

  const markers: MapMarker[] = useMemo(
    () =>
      shops.map((s) => ({
        id: s.id,
        lat: s.lat,
        lng: s.lng,
        title: s.name,
        subtitle: `${s.isCurrentlyOpen ? t('common.open') : t('common.closed')} · ${s.open_time}–${s.close_time}`,
        open: s.isCurrentlyOpen,
      })),
    [shops, t],
  );

  const openCount = shops.filter((s) => s.isCurrentlyOpen).length;

  const handleLocate = async () => {
    if (locating) return;
    hapticFeedback('selection');
    setLocating(true);
    try {
      const loc = await detectCurrentLocation(i18n.language);
      setUserLocation({ lat: loc.lat, lng: loc.lng });
      mapRef.current?.flyTo(loc.lat, loc.lng, 15);
    } catch (e) {
      Alert.alert(
        t('customer.common.error'),
        e instanceof LocationPermissionError
          ? t('customer.location.permissionDenied')
          : t('customer.location.detectFailed'),
      );
    } finally {
      setLocating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('customer.map.title')}</Text>
        <View style={styles.countBadge}>
          <Store size={14} color="#166534" />
          <Text style={styles.countText}>
            {t('customer.map.count', { count: shops.length, open: openCount })}
          </Text>
        </View>
      </View>

      <View style={styles.mapWrap}>
        <LeafletMap
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          center={{ lat: currentAddress.lat, lng: currentAddress.lng }}
          zoom={13}
          markers={markers}
          userLocation={userLocation}
          onMarkerPress={(id) => router.push(`/(customer)/shop/${id}` as any)}
        />

        {loading && (
          <View style={styles.loadingPill}>
            <ActivityIndicator size="small" color="#16a34a" />
            <Text style={styles.loadingText}>{t('customer.map.loading')}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.locateBtn} onPress={handleLocate} activeOpacity={0.8}>
          {locating ? (
            <ActivityIndicator size="small" color="#16a34a" />
          ) : (
            <Navigation size={20} color="#16a34a" />
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  mapWrap: {
    flex: 1,
  },
  loadingPill: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  locateBtn: {
    position: 'absolute',
    left: 16,
    bottom: 24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
});
