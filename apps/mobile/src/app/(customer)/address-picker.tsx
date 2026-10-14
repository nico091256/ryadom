import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAddressStore } from '../../store/useAddressStore';
import { mobileApi } from '../../services/api';
import { ArrowLeft, MapPin, Navigation, Plus, Check, Briefcase, Home } from 'lucide-react-native';

export default function AddressPickerScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentAddress, setCurrentAddress, savedAddresses, setSavedAddresses } = useAddressStore();

  const [addressText, setAddressText] = useState(currentAddress.address_text);
  const [addressTitle, setAddressTitle] = useState('Uy');
  const [lat, setLat] = useState(currentAddress.lat);
  const [lng, setLng] = useState(currentAddress.lng);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadSaved() {
      try {
        const addresses = await mobileApi.getAddresses();
        setSavedAddresses(addresses);
      } catch (e) {
        console.warn('Failed to load saved addresses', e);
      }
    }
    loadSaved();
  }, []);

  const handleUseCurrentGPS = () => {
    // Simulated Tashkent GPS location reverse-geocoding
    const simulatedAddress = 'Toshkent sh., Chilonzor 5-mavze, 12-uy';
    setAddressText(simulatedAddress);
    setLat(41.2840);
    setLng(69.2160);
    Alert.alert('Joylashuv aniqlandi', simulatedAddress);
  };

  const handleSelectAddress = (addr: any) => {
    setCurrentAddress({
      id: addr.id,
      title: addr.title,
      address_text: addr.address_text,
      lat: addr.lat,
      lng: addr.lng,
    });
    router.back();
  };

  const handleConfirmNewAddress = async () => {
    if (!addressText.trim()) {
      Alert.alert('Xatolik', 'Manzil matnini kiriting');
      return;
    }

    const newAddr = {
      title: addressTitle,
      address_text: addressText.trim(),
      lat,
      lng,
    };

    setCurrentAddress(newAddr);

    // Save to user addresses on backend
    try {
      await mobileApi.createAddress(newAddr);
    } catch (e) {
      console.warn('Could not save address to server', e);
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

      <View style={styles.content}>
        {/* Current GPS Button */}
        <TouchableOpacity style={styles.gpsButton} onPress={handleUseCurrentGPS} activeOpacity={0.7}>
          <Navigation size={18} color="#16a34a" />
          <Text style={styles.gpsText}>Hozirgi joylashuvimni aniqlash (GPS)</Text>
        </TouchableOpacity>

        {/* Address Input Form */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Manzilni kiritish yoki xaritadan tanlash</Text>

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
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.input}
            value={addressText}
            onChangeText={setAddressText}
            placeholder="Toshkent sh., ko'cha, uy, xonadon..."
            placeholderTextColor="#94a3b8"
            multiline
          />

          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmNewAddress}>
            <Text style={styles.confirmBtnText}>Ushbu manzilni tanlash</Text>
          </TouchableOpacity>
        </View>

        {/* Saved Addresses List */}
        <View style={styles.savedSection}>
          <Text style={styles.savedSectionTitle}>Saqlangan manzillar</Text>
          <FlatList
            data={savedAddresses}
            keyExtractor={(item) => item.id || item.address_text}
            renderItem={({ item }) => (
              <TouchableOpacity
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
                    <Text style={styles.savedTitle}>{item.title}</Text>
                    <Text style={styles.savedText} numberOfLines={1}>
                      {item.address_text}
                    </Text>
                  </View>
                </View>
                <Check size={18} color="#cbd5e1" />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.noSavedText}>Saqlangan manzillar hali yo'q</Text>
            }
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    padding: 16,
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
