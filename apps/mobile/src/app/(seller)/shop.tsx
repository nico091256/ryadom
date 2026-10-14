import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore';
import { mobileApi } from '../../services/api';
import { Store, Clock, Phone, MapPin, LogOut, Check } from 'lucide-react-native';

export default function SellerShopScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { logout } = useAuthStore();

  const [shop, setShop] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressText, setAddressText] = useState('');
  const [openTime, setOpenTime] = useState('08:00');
  const [closeTime, setCloseTime] = useState('23:00');
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    mobileApi
      .getSellerShop()
      .then((data) => {
        setShop(data);
        setName(data.name);
        setPhone(data.phone);
        setAddressText(data.address_text);
        setOpenTime(data.open_time);
        setCloseTime(data.close_time);
        setIsOpen(data.is_open);
      })
      .catch(console.warn)
      .finally(() => setLoading(false));
  }, []);

  const handleToggleOpen = async (val: boolean) => {
    setIsOpen(val);
    try {
      await mobileApi.updateSellerShop({ is_open: val });
    } catch (err: any) {
      setIsOpen(!val);
      Alert.alert('Xatolik', err.message);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await mobileApi.updateSellerShop({
        name,
        phone,
        address_text: addressText,
        open_time: openTime,
        close_time: closeTime,
        is_open: isOpen,
      });
      Alert.alert('Saqlandi', 'Do\'kon ma\'lumotlari muvaffaqiyatli yangilandi');
    } catch (err: any) {
      Alert.alert('Xatolik', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Chiqish', 'Hisobingizdan chiqmoqchimisiz?', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: 'Chiqish',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/welcome');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#16a34a" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Do'kon Profili</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          <Check size={18} color="#ffffff" />
          <Text style={styles.saveBtnText}>Saqlash</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Prominent Open / Closed Toggle Switch Card (Section 5) */}
        <View style={[styles.openClosedCard, isOpen ? styles.cardOpen : styles.cardClosed]}>
          <View style={styles.openClosedLeft}>
            <View style={[styles.statusDot, isOpen ? styles.dotOpen : styles.dotClosed]} />
            <View>
              <Text style={styles.openClosedTitle}>
                Do'kon Holati: {isOpen ? 'Ochiq (Buyurtmalar qabul qilinadi)' : 'Yopiq (Buyurtma to\'xtatilgan)'}
              </Text>
              <Text style={styles.openClosedSubtitle}>
                {isOpen ? 'Mijozlar sizdan buyurtma bera oladi' : 'Mijozlar buyurtma bera olmaydi'}
              </Text>
            </View>
          </View>
          <Switch
            value={isOpen}
            onValueChange={handleToggleOpen}
            trackColor={{ false: '#fecdd3', true: '#86efac' }}
            thumbColor={isOpen ? '#16a34a' : '#e11d48'}
          />
        </View>

        {/* Shop Form Card */}
        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Do'kon Nomi</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Telefon Raqami</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Manzil</Text>
            <TextInput style={styles.input} value={addressText} onChangeText={setAddressText} />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Ochilish vaqti</Text>
              <TextInput style={styles.input} value={openTime} onChangeText={setOpenTime} />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Yopilish vaqti</Text>
              <TextInput style={styles.input} value={closeTime} onChangeText={setCloseTime} />
            </View>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={18} color="#e11d48" />
          <Text style={styles.logoutText}>Do'kondan chiqish</Text>
        </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#16a34a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  openClosedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 18,
    marginBottom: 16,
    borderWidth: 1.5,
  },
  cardOpen: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  cardClosed: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
  },
  openClosedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  statusDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  dotOpen: {
    backgroundColor: '#16a34a',
  },
  dotClosed: {
    backgroundColor: '#e11d48',
  },
  openClosedTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  openClosedSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  row: {
    flexDirection: 'row',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff1f2',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fecdd3',
    marginTop: 8,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e11d48',
  },
});
