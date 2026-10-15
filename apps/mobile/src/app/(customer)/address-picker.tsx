import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAddressStore } from '../../store/useAddressStore';
import { useAuthStore } from '../../store/useAuthStore';
import { mobileApi } from '../../services/api';
import { detectCurrentLocation, LocationPermissionError, reverseGeocode } from '../../utils/location';
import LeafletMap, { LeafletMapHandle, MapMarker } from '../../components/LeafletMap';
import { ArrowLeft, MapPin, Navigation, Check, Briefcase, Home, Trash2 } from 'lucide-react-native';
import { hapticFeedback } from '../../utils/haptics';
import { addressTitleLabel, formatAddressDetailsT } from '../../utils/localize';

/** Alert.alert is a no-op on react-native-web, so fall back to the browser dialog there */
function notify(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}

${message}`);
  else Alert.alert(title, message);
}

export default function AddressPickerScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { currentAddress, setCurrentAddress, savedAddresses, setSavedAddresses } = useAddressStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [addressText, setAddressText] = useState(currentAddress.address_text);
  const [addressTitle, setAddressTitle] = useState('Uy');
  const [lat, setLat] = useState(currentAddress.lat);
  const [lng, setLng] = useState(currentAddress.lng);
  const [isSaving, setIsSaving] = useState(false);
  const [entrance, setEntrance] = useState(currentAddress.entrance || '');
  const [floor, setFloor] = useState(currentAddress.floor || '');
  const [apartment, setApartment] = useState(currentAddress.apartment || '');
  const [doorCode, setDoorCode] = useState(currentAddress.door_code || '');
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [shopMarkers, setShopMarkers] = useState<MapMarker[]>([]);
  const mapRef = useRef<LeafletMapHandle>(null);
  const geocodeSeq = useRef(0);
  const skipFirstMove = useRef(true);

  useEffect(() => {
    mobileApi
      .getNearbyShops(currentAddress.lat, currentAddress.lng, 50000)
      .then((list: any[]) =>
        setShopMarkers(
          (list || []).map((s) => ({
            id: s.id,
            lat: s.lat,
            lng: s.lng,
            title: s.name,
            subtitle: s.address_text,
            open: s.isCurrentlyOpen,
          })),
        ),
      )
      .catch(() => {});
  }, []);

  // Map was dragged: move the delivery point there and fill the address automatically
  const handleMapMove = async (newLat: number, newLng: number) => {
    if (skipFirstMove.current) {
      skipFirstMove.current = false;
      return;
    }
    setLat(newLat);
    setLng(newLng);
    const seq = ++geocodeSeq.current;
    setGeocoding(true);
    try {
      const text = await reverseGeocode(newLat, newLng, i18n.language || 'uz');
      if (seq === geocodeSeq.current) setAddressText(text);
    } finally {
      if (seq === geocodeSeq.current) setGeocoding(false);
    }
  };

  const loadSaved = async () => {
    try {
      const addresses = await mobileApi.getAddresses();
      setSavedAddresses(Array.isArray(addresses) ? addresses : []);
    } catch (e) {
      console.warn('Failed to load saved addresses', e);
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadSaved();
  }, [isAuthenticated]);

  const handleDeleteAddress = (addr: any) => {
    if (!addr.id || deletingId) return;
    const doDelete = async () => {
      setDeletingId(addr.id);
      try {
        await mobileApi.deleteAddress(addr.id);
        hapticFeedback('success');
        if (currentAddress.id === addr.id) {
          // Keep using the location, it just isn't a saved address anymore
          setCurrentAddress({ ...currentAddress, id: undefined });
        }
        await loadSaved();
      } catch (e: any) {
        notify(t('customer.common.error'), e?.message || t('customer.address.deleteFailed'));
      } finally {
        setDeletingId(null);
      }
    };
    hapticFeedback('medium');
    const question = t('customer.address.deleteQuestion', { title: addressTitleLabel(t, addr.title) });
    if (Platform.OS === 'web') {
      if (window.confirm(question)) doDelete();
      return;
    }
    Alert.alert(t('customer.address.deleteTitle'), question, [
      { text: t('customer.cart.no'), style: 'cancel' },
      { text: t('customer.address.yesDelete'), style: 'destructive', onPress: doDelete },
    ]);
  };

  const handleUseCurrentGPS = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const loc = await detectCurrentLocation(i18n.language || 'uz');
      geocodeSeq.current++;
      setAddressText(loc.address_text);
      setLat(loc.lat);
      setLng(loc.lng);
      setUserLocation({ lat: loc.lat, lng: loc.lng });
      skipFirstMove.current = true; // address already resolved, don't geocode the fly animation
      mapRef.current?.flyTo(loc.lat, loc.lng, 17);
    } catch (e) {
      if (e instanceof LocationPermissionError) {
        Alert.alert(
          t('customer.location.permissionTitle'),
          t('customer.location.permissionSettings'),
        );
      } else {
        Alert.alert(t('customer.common.error'), t('customer.location.detectFailedGps'));
      }
    } finally {
      setLocating(false);
    }
  };

  const handleSelectAddress = (addr: any) => {
    setCurrentAddress({
      id: addr.id,
      title: addr.title,
      address_text: addr.address_text,
      lat: addr.lat,
      lng: addr.lng,
      entrance: addr.entrance,
      floor: addr.floor,
      apartment: addr.apartment,
      door_code: addr.door_code,
    });
    router.back();
  };

  const handleConfirmNewAddress = async () => {
    if (!addressText.trim()) {
      Alert.alert(t('customer.common.error'), t('customer.address.enterText'));
      return;
    }

    const newAddr = {
      title: addressTitle,
      address_text: addressText.trim(),
      lat,
      lng,
      entrance: entrance.trim() || undefined,
      floor: floor.trim() || undefined,
      apartment: apartment.trim() || undefined,
      door_code: doorCode.trim() || undefined,
    };

    setCurrentAddress(newAddr);

    // Guests just use the address locally; logged-in users also get it saved to their account
    if (isAuthenticated) {
      setIsSaving(true);
      try {
        const saved: any = await mobileApi.createAddress(newAddr);
        if (saved?.id) setCurrentAddress({ ...newAddr, id: saved.id });
        await loadSaved();
      } catch (e: any) {
        notify(
          t('customer.address.notSavedTitle'),
          t('customer.address.notSaved', { reason: e?.message || t('customer.address.unknownError') }),
        );
      } finally {
        setIsSaving(false);
      }
    }

    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('checkout.deliveryAddress')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Map: drag to move the pin */}
      <View style={styles.mapWrap}>
        <LeafletMap
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          center={{ lat: currentAddress.lat, lng: currentAddress.lng }}
          zoom={16}
          picker
          markers={shopMarkers}
          userLocation={userLocation}
          onCenterChange={handleMapMove}
          onMarkerPress={(id) => router.push(`/(customer)/shop/${id}` as any)}
        />
        <View style={styles.mapHint} pointerEvents="none">
          <Text style={styles.mapHintText}>
            {geocoding ? t('customer.address.geocoding') : t('customer.address.mapHint')}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} keyboardShouldPersistTaps="handled">
        {/* Current GPS Button */}
        <TouchableOpacity style={styles.gpsButton} onPress={handleUseCurrentGPS} activeOpacity={0.7} disabled={locating}>
          {locating ? (
            <ActivityIndicator size="small" color="#16a34a" />
          ) : (
            <Navigation size={18} color="#16a34a" />
          )}
          <Text style={styles.gpsText}>
            {locating ? t('customer.address.locating') : t('customer.address.useGps')}
          </Text>
        </TouchableOpacity>

        {/* Address Input Form */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{t('customer.address.formTitle')}</Text>

          <View style={styles.titleButtonsRow}>
            {['Uy', 'Ish', 'Boshqa'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeBtn, addressTitle === type && styles.typeBtnActive]}
                onPress={() => setAddressTitle(type)}
              >
                {type === 'Uy' ? (
                  <Home size={14} color={addressTitle === type ? '#ffffff' : '#64748b'} />
                ) : type === 'Ish' ? (
                  <Briefcase size={14} color={addressTitle === type ? '#ffffff' : '#64748b'} />
                ) : (
                  <MapPin size={14} color={addressTitle === type ? '#ffffff' : '#64748b'} />
                )}
                <Text style={[styles.typeBtnText, addressTitle === type && styles.typeBtnTextActive]}>
                  {addressTitleLabel(t, type)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.input}
            value={addressText}
            onChangeText={setAddressText}
            placeholder={t('customer.address.placeholder')}
            placeholderTextColor="#94a3b8"
            multiline
          />

          {/* Apartment details */}
          <View style={styles.detailsRow}>
            {[
              { key: 'entrance', label: t('customer.address.entrance'), value: entrance, set: setEntrance, ph: '2' },
              { key: 'floor', label: t('customer.address.floor'), value: floor, set: setFloor, ph: '5' },
              { key: 'apartment', label: t('customer.address.apartment'), value: apartment, set: setApartment, ph: '45' },
              { key: 'doorCode', label: t('customer.address.doorCode'), value: doorCode, set: setDoorCode, ph: '45K' },
            ].map((f) => (
              <View key={f.key} style={styles.detailField}>
                <Text style={styles.detailLabel}>{f.label}</Text>
                <TextInput
                  style={styles.detailInput}
                  value={f.value}
                  onChangeText={f.set}
                  placeholder={f.ph}
                  placeholderTextColor="#94a3b8"
                  keyboardType={f.key === 'doorCode' ? 'default' : 'numbers-and-punctuation'}
                  maxLength={10}
                />
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={handleConfirmNewAddress}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.confirmBtnText}>{t('customer.address.confirm')}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Saved Addresses List */}
        <View style={styles.savedSection}>
          <Text style={styles.savedSectionTitle}>{t('customer.address.savedTitle')}</Text>
          {savedAddresses.length === 0 && (
            <Text style={styles.noSavedText}>{t('customer.address.savedEmpty')}</Text>
          )}
          {savedAddresses.map((item) => (
              <TouchableOpacity
                key={item.id || item.address_text}
                style={styles.savedCard}
                onPress={() => handleSelectAddress(item)}
                activeOpacity={0.7}
              >
                <View style={styles.savedLeft}>
                  <View style={styles.savedIcon}>
                    {item.title === 'Uy' ? (
                      <Home size={16} color="#16a34a" />
                    ) : (
                      <MapPin size={16} color="#16a34a" />
                    )}
                  </View>
                  <View style={styles.savedInfo}>
                    <Text style={styles.savedTitle}>{addressTitleLabel(t, item.title)}</Text>
                    <Text style={styles.savedText} numberOfLines={1}>
                      {item.address_text}
                    </Text>
                    {!!formatAddressDetailsT(t, item) && (
                      <Text style={styles.savedText} numberOfLines={1}>
                        {formatAddressDetailsT(t, item)}
                      </Text>
                    )}
                  </View>
                </View>
                {item.id ? (
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDeleteAddress(item);
                    }}
                    disabled={deletingId === item.id}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ padding: 6 }}
                  >
                    {deletingId === item.id ? (
                      <ActivityIndicator size="small" color="#e11d48" />
                    ) : (
                      <Trash2 size={18} color="#e11d48" />
                    )}
                  </TouchableOpacity>
                ) : (
                  <Check size={18} color="#cbd5e1" />
                )}
              </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mapWrap: {
    height: 280,
    backgroundColor: '#e5e7eb',
  },
  mapHint: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  mapHintText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
    flex: 1,
  },
  contentInner: {
    padding: 16,
    paddingBottom: 32,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  detailField: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 4,
  },
  detailInput: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    textAlign: 'center',
  },
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderColor: '#bbf7d0',
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 16,
  },
  gpsText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#166534',
  },
  formCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 12,
  },
  titleButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  typeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  typeBtnActive: {
    backgroundColor: '#16a34a',
  },
  typeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  typeBtnTextActive: {
    color: '#ffffff',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 12,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    minHeight: 64,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  confirmBtn: {
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  savedSection: {
    flex: 1,
  },
  savedSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
  },
  savedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  savedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  savedIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedInfo: {
    flex: 1,
  },
  savedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  savedText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  noSavedText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 20,
  },
});
